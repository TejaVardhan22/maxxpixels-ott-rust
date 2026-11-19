# maxx-games-service-go

Go rewrite of `games-service-rs/` (standalone MaxxPixels games service) with API/behavior parity.

## What it does
- **PlayforFun launch signing**: `GET /api/v1/games/playforfun/launch?game=ludo|carrom|snooker|chess`
- **Gamer snapshot**: `GET /api/v1/games/playforfun/me`
- **PlayforFun webhooks** (HMAC `x-playforfun-signature`): match lifecycle, coin events, recharges, player registration
- **Razorpay coin recharges**: packs/order/verify/webhook with idempotent settlement + PFF tenant wallet grant sync
- **Subscription coin grants**: purchase/monthly claims (`POST /api/v1/games/coins/subscription-grant`)
- **Provider wallet S2S API** (`x-pff-tenant`/`x-pff-secret`): `GET/POST /api/v1/games/wallet*`
- **Health**: `GET /healthz`, `GET /health`

Uses a **separate games Postgres database** (`GAMES_DATABASE_URL`) and mirrors user details from the main NestJS API (`GET /api/v1/auth/me`) using the caller's Bearer JWT.

## Run

```bash
cp .env.example .env   # fill values
go mod tidy
go run .
# or
go build -o maxx-games-service-go . && ./maxx-games-service-go
```

Migrations in `migrations/` are applied automatically at startup (idempotent).

## Compatibility
- Same route paths/aliases as the Rust service
- Same `{ success, status, message, data, result, timestamp }` response envelope
- Same DB schema (`001_init.sql`, `002_coin_orders.sql`)
- Intended as a drop-in replacement behind nginx for `/api/v1/games/*` cutover

## Notes
- Requires Go 1.22+ (uses pgx/v5, golang-jwt/jwt/v5, google/uuid)
- Configure `JWT_SECRET`, `PLAYFORFUN_*`, `RAZORPAY_*`, `MAIN_API_URL`, and `GAMES_DATABASE_URL` as in `.env.example`
