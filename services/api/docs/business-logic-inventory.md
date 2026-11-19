# Business Logic Inventory & Algorithm Specifications

**Document Version:** 1.0.0  
**Target Architecture:** Rust (Tokio + Axum + SeaORM)  
**Audit Date:** November 2026  

---

## 1. Authentication & Password Compatibility

### 1.1 Password Hashing Specification
- **Existing NestJS Algorithm**: `bcryptjs` with cost factor 10 (producing hashes with prefixes `$2a$10$` and `$2y$10$`).
- **Rust Target Strategy**:
  - The Rust backend will use the `bcrypt` and `argon2` crates.
  - **Verification Flow**:
    ```
    Incoming Password ──> Check Hash Prefix
                            ├── If starts with "$2a$", "$2y$", or "$2b$" -> Verify via `bcrypt::verify`
                            └── If starts with "$argon2" -> Verify via `argon2::verify`
    ```
  - **Transparent Upgrading**: When a user logs in with a valid legacy bcrypt hash, Rust verifies the bcrypt hash and optionally re-hashes the plain password using Argon2id (`$argon2id$...`), saving the updated hash to `users.password_hash`. This delivers zero downtime and requires no forced password resets.

### 1.2 JWT Token Generation & Validation
- **Algorithm**: HMAC-SHA256 (`HS256`) using `JWT_SECRET`.
- **Payload Claims Contract**:
  ```json
  {
    "sub": "1",
    "email": "user@example.com",
    "roles": ["ROLE_USER"],
    "permissions": ["CONTENT_VIEW"],
    "deviceId": "uuid",
    "iat": 1700000000,
    "exp": 1700086400
  }
  ```
- **Token Blacklisting**: Before accepting any token, Rust computes the signature substring (`token.split('.')[2]`) and probes Redis key `jwt:blacklist:<sig>`. If the key exists, an immediate HTTP 401 Unauthorized is returned.

---

## 2. Playback Authorization & Entitlement Decisioning

### 2.1 Decision Engine (`PlaybackService.authorize`)
When a client requests a video playback stream, the following sequential checks are enforced:

```
[Playback Request (contentId, episodeId, deviceId)]
                    │
                    ▼
          Content Exists & Published?
                    ├── NO  ──> 404 Not Found
                    └── YES
                         │
                         ▼
             Content Monetization Model?
             ├── FREE / AVOD
             │     └── Allowed immediately
             ├── SVOD (Subscription)
             │     ├── Check active subscription in `subscriptions` table
             │     ├── Condition: `status = 'ACTIVE' AND valid_until > NOW()`
             │     ├── If not found ──> 403 Forbidden ("Subscription Required")
             │     └── If found ──> Allowed
             └── TVOD (Rental / PPV)
                   ├── Check purchase in `content_purchases` table
                   ├── Condition: `valid_until > NOW()`
                   ├── If not found ──> 403 Forbidden ("Rental Required")
                   └── If found ──> Allowed
                         │
                         ▼
          Concurrent Stream Enforcement
          ├── Count active `playback_sessions` for user where:
          │     `last_heartbeat_at > (NOW() - INTERVAL '90 seconds')`
          ├── Compare with plan limit (`max_concurrent_streams`, default 2)
          └── If exceeded ──> 409 Conflict ("Max screens in use")
                         │
                         ▼
         Bunny Stream URL Token Signing
         ├── Extract Bunny Video GUID from `movies` or `episodes`
         ├── Generate Token Authentication Hash:
         │     SHA256(TokenSecurityKey + VideoGUID + ExpiryTimestamp)
         └── Return Signed HLS Manifest:
               `https://vz-bb76d46f-94f.b-cdn.net/<guid>/playlist.m3u8?token=...&expires=...`
```

---

## 3. Telemetry Heartbeat & Watch Progress Aggregation

Clients send heartbeat pings every 30 seconds to `/api/v1/playback/heartbeat`:
1. **Heartbeat Refresh**: Updates `playback_sessions.last_heartbeat_at = NOW()`.
2. **Resume Progress Calculation**:
   - `progressPercent = (playbackPositionSeconds / totalDurationSeconds) * 100`
   - `isCompleted = progressPercent >= 90.0`
3. **Database Write**: Upserts into `watch_history`:
   ```sql
   INSERT INTO watch_history (user_id, content_id, episode_id, watched_seconds, last_position_seconds, progress_percent, is_completed, updated_at)
   VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
   ON CONFLICT (user_id, content_id) DO UPDATE SET
     last_position_seconds = EXCLUDED.last_position_seconds,
     watched_seconds = EXCLUDED.watched_seconds,
     progress_percent = EXCLUDED.progress_percent,
     is_completed = EXCLUDED.is_completed,
     updated_at = NOW();
   ```
4. **Kafka Telemetry Broadcast**: Publishes payload to Kafka topic `ott.telemetry.heartbeat` for real-time live viewer counter aggregation in the admin dashboard.

---

## 4. Razorpay Payments & Idempotent Webhook Processing

### 4.1 Order Creation
1. Resolves plan or content item price.
2. If coupon applied, calculates discount with minimum order threshold protection.
3. Generates Razorpay Order via REST API: `POST https://api.razorpay.com/v1/orders`.
4. Saves initial `payment_orders` row with status `CREATED`.

### 4.2 Signature Verification & Webhook Ingestion
1. Computes expected HMAC-SHA256 signature using `RAZORPAY_KEY_SECRET`.
2. Compares computed hash with `razorpaySignature` header in constant time to prevent timing attacks.
3. **Idempotency Guard**:
   - Acquires Redis distributed lock with 15-second TTL: `lock:payment:order:<orderId>`.
   - Inspects current state of `payment_orders`: if already marked `SUCCESS`, terminates immediately with HTTP 200 OK without double-provisioning.
4. **Entitlement Provisioning Transaction**:
   - Updates `payment_orders.status = 'SUCCESS'`.
   - Inserts row in `payments` ledger.
   - For plan: inserts/extends `subscriptions` with `valid_until = NOW() + plan.duration_days`.
   - For TVOD rental: inserts `content_purchases` with `valid_until = NOW() + INTERVAL '48 hours'`.
   - Emits Kafka billing event: `ott.payments.razorpay`.
5. Releases Redis mutex.

---

## 5. Dynamic CMS Page Assembly

The `/api/v1/cms/home` endpoint aggregates a rich multi-row OTT layout:
1. **Hero Banners**: Active banners from `banners` table ordered by `display_order`.
2. **Curated Sections**: Loads sections from `sections` and joins `section_items` to `contents`.
3. **Personalized Rows**: If user is authenticated:
   - Prepends "Continue Watching" row from `watch_history` where `is_completed = false`.
   - Loads user's personal "My Watchlist" row from `watchlist`.
4. **Trending & Blockbuster Fallbacks**: Fills remaining categories from active `categories` and `contents`.
5. Emits cached payload under Redis key `cms:home:<language>` with a 180s TTL.

