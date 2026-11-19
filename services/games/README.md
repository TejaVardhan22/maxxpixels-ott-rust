# maxx-games-service (Standalone Rust Games Service)

Standalone Rust (axum) service for **PlayforFun games**. It is deliberately kept
**out of the main `rust/` backend workspace** and has **its own separate games
database**. The NestJS backend stays the single source of truth for users; this
service only **mirrors user details into its own DB** and signs launch URLs.

## Architecture

```
Mobile app ── Bearer JWT ──▶ maxx-games-service (:8090)
                               │ 1. Validates the SAME JWT locally (JWT_SECRET)
                               │ 2. Forwards the caller's Bearer token to
                               │    NestJS  GET /api/v1/auth/me  → user details
                               │ 3. Upserts (dumps) the user into the
                               │    SEPARATE games DB (players table, 24h TTL cache)
                               │ 4. Returns signed PlayforFun launch URL
                               ▼
                        playforfun.in/arena | /play/<ludo|carrom|snooker|chess>
```

- **No writes to the main platform DB.** Games DB owns everything games-related:
  `players` (mirror), `coin_transactions` (ledger), `recharges`, `game_sessions`,
  `game_stats`, `match_results` (webhook archive).
- **NestJS flow untouched.** The existing NestJS games module keeps working as a
  fallback; nginx can route `/api/v1/games/*` here whenever you cut over — the
  JSON contract is identical (`{ success, data: { launchUrl, expiresAt, tenant,
  userId, externalId, displayName, game? }, ... }`), so **no client rebuild is
  needed**.

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/games/playforfun/launch?game=ludo` | Bearer JWT | Signed launch URL (aliases: `/api/games/…`, `/games/…`, `/api/v1/games/play-for-fun/launch`, `/api/v1/games/launch`) |
| GET | `/api/v1/games/playforfun/me` | Bearer JWT | Full gamer record: profile, gamerUid, coins + lifetime totals, per-game stats, recent sessions/transactions/recharges |
| POST | `/api/v1/games/playforfun/webhook` | HMAC header | `x-playforfun-signature = HMAC_SHA256(PFF_SECRET, raw_body)`, timing-safe compare; full lifecycle processing |
| GET | `/api/v1/games/coins/packs` | Bearer JWT | Recharge catalog: packs, currency, Razorpay `keyId` |
| POST | `/api/v1/games/coins/order` | Bearer JWT | Body `{packId}` → creates a Razorpay order, returns `razorpayOrderId`, `amount` (paise), `keyId`, `coins` |
| POST | `/api/v1/games/coins/verify` | Bearer JWT | Checkout callback body `{razorpayOrderId, razorpayPaymentId, razorpaySignature}` → verifies `HMAC_SHA256(KEY_SECRET, "order\|payment")` → credits coins exactly once |
| POST | `/api/v1/games/coins/webhook` | HMAC header | Razorpay server events (`payment.captured`, `order.paid`, `payment.failed`); `x-razorpay-signature` verified against `RAZORPAY_WEBHOOK_SECRET` |
| GET | `/healthz` `/health` | — | DB + config liveness |

## Data model (separate games DB)

| Table | Purpose |
|---|---|
| `players` | One record per gamer: **UUID**, `gamer_uid` (unique `MPXG…` id for every gamer), platform `user_id`, `external_id` (`mpx_<userId>`), `name`, `email`, `age`, `mobile_number`, `display_name` (`maxpx_<mobile>`), **coin balance**, lifetime `total_coins_won / total_coins_recharged / total_coins_spent`, `matches_played / won / lost`, `last_game`, `last_played_at` |
| `coin_transactions` | Complete ledger: `RECHARGE / WIN / ENTRY_FEE / REFUND / BONUS / ADJUSTMENT`, signed amount, `balance_after`, game, match, unique `reference` (idempotency) |
| `recharges` | Recharge audit trail: coins, optional INR amount, source, unique reference |
| `game_sessions` | Every match a gamer played: result (`WON/LOST/DRAW/EXITED/PLAYED`), coins won, entry fee, score, rank, balance after — idempotent per `(match_id, player_id)` |
| `game_stats` | Per-game aggregates: played/wins/losses/draws, coins won/spent, best single win |
| `match_results` | Raw webhook archive per match (winner, prize, full payload, `signature_verified`) |

## Webhook processing (fully implemented)

After timing-safe HMAC verification of the raw body, the event is routed:

1. **Recharge events** (`event` contains `recharge`/`deposit`/`topup`) → credits
   coins (`RECHARGE` ledger row + `recharges` audit row; replay-safe by
   `reference`).
2. **Coin events** (`coin`/`wallet`/`transaction`) → applies signed movement
   with type mapping (win/recharge/fee/refund/bonus).
3. **player_registered** → creates or enriches the mirrored gamer record
   (name, email, mobile, age).
4. **Match events** (`match`/`game`/`result`/`round`, or a `match_id` present) →
   processed atomically in one DB transaction:
   - archive into `match_results` (winner resolved via
     `external_id`/`user_id`/`gamer_uid`),
   - **entry fee debit** (`ENTRY_FEE`) per participant — balance never goes
     negative (skipped with a warning if insufficient),
   - **winner coin credit** (`WIN`) on completion,
   - `game_sessions` row per participant (result, coins, fee, score, rank),
   - `game_stats` + lifetime aggregates updated,
   - idempotent: replayed match events / references never double-credit.
   Participants are read from `players[]` / `participants[]` / `results[]`
   (objects or id strings) or top-level `winner`/`loser`; keys probed in both
   camelCase and snake_case.
5. **Unknown events** → archived to `match_results` so nothing is lost.

## Razorpay coin recharges (fully implemented)

Purchase flow (mobile → games service → Razorpay):

```
1. GET  /api/v1/games/coins/packs            → catalog (packs, currency, keyId)
2. POST /api/v1/games/coins/order {packId}   → creates Razorpay order via
   POST https://api.razorpay.com/v1/orders (Basic auth), records it as
   CREATED in coin_orders, returns razorpayOrderId/amount/keyId
3. Mobile opens Razorpay Checkout with that order
4. POST /api/v1/games/coins/verify           → verifies checkout callback
   sig = HMAC_SHA256(KEY_SECRET, "order_id|payment_id")  (timing-safe)
5. POST /api/v1/games/coins/webhook          → server-to-server backstop
   (payment.captured / order.paid / payment.failed), verified with
   HMAC_SHA256(WEBHOOK_SECRET, raw_body) against x-razorpay-signature
```

- Settlement is **exactly-once**: the `CREATED → PAID` transition inside one DB
  transaction is the idempotency gate; coins are credited through the same
  ledger (`RECHARGE`, reference = `razorpay_payment_id`) used by the match
  webhook, plus an audit row in `recharges`.
- Fake/failed signature → order marked `FAILED`, no coins credited.
- Coin packs: default 5 tiers (₹49→₹1999) overridable via `COIN_PACKS` JSON env.
- Razorpay Dashboard: add a webhook pointing to
  `https://<games-host>/api/v1/games/coins/webhook` with the same secret set in
  `RAZORPAY_WEBHOOK_SECRET`.

## Launch URL (per PlayforFun docs)

```
https://playforfun.in/arena
https://playforfun.in/play/<ludo|carrom|snooker|chess>
    ?tenant=<PLAYFORFUN_TENANT_ID>
    &user=<platform user id>
    &name=maxpx_<mobilenumber>
    &exp=<unix seconds, now+600>
    &nonce=<16 hex chars>
    &sig=HMAC_SHA256(PFF_SECRET, "tenant:user:name:exp:nonce")
```

- `name` → `maxpx_<mobilenumber>` (91 country prefix stripped → 10 digits, 30-char cap).
- `PFF_SECRET`/`PLAYFORFUN_SECRET` is **server-only**. Only the public key
  (`pk_…`) is safe on clients.
- Webhook payloads persist to `match_results` with `signature_verified = true`.

## Configuration (see `.env.example`)

| Var | Purpose |
|---|---|
| `GAMES_DATABASE_URL` | **Separate** games Postgres DB |
| `MAIN_API_URL` | NestJS base URL (only used for `GET /api/v1/auth/me`) |
| `JWT_SECRET` | Same secret as NestJS |
| `PLAYFORFUN_TENANT_ID` | `maxxpixels` |
| `PLAYFORFUN_SECRET` (or `PFF_SECRET`) | Launch/webhook HMAC secret |
| `GAMES_SERVICE_PORT` | Default `8090` |
| `PLAYER_TTL_SECONDS` | Mirror freshness window (default 86400) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins |

## Run

```bash
cd services/games-service-rs
cargo run --release          # dev
cargo build --release        # prod binary: target/release/maxx-games-service
```

Schema (`migrations/001_init.sql`) is applied automatically at startup
(idempotent `CREATE TABLE IF NOT EXISTS`).

## Production cutover (no client changes)

1. Create the games DB: `CREATE DATABASE maxxpixels_games;` + a dedicated role.
2. Deploy the binary with the env above (systemd unit recommended).
3. nginx: route `/api/v1/games/playforfun/` to `127.0.0.1:8090` ahead of the
   NestJS upstream (only if/when desired — NestJS module keeps working).
4. Rotate `PFF_SECRET` after first production setup.
