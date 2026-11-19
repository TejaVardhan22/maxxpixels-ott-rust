# Existing API Inventory — MaxxPixels OTT Platform

**Document Version:** 1.0.0  
**Target Environment:** Production OTT Platform  
**Target Architecture:** Rust (Axum + SeaORM)  
**Audit Date:** November 2026  
**Total Mapped Endpoints:** 26 Controllers / 120+ Base Operations (2042 aliased route variations)  

---

## 1. Authentication & Identity (`AuthModule`)

### 1.1 Standard & Mobile Authentication
- **`POST /api/v1/auth/login`**, `/api/auth/login`, `/auth/login`, `/api/v1/user_login`, `/user_login`
  - **Auth**: Public (`@Public()`)
  - **Rate Limit**: Auth bucket (30 req/min)
  - **Request Body**:
    ```json
    {
      "identifier": "user@example.com", // or "email" / "phone" / "mobile"
      "password": "Password123",        // optional if OTP login
      "otp": "123456",                  // optional for legacy mobile login
      "deviceId": "device-uuid-1234",
      "deviceType": "ANDROID",          // "WEB", "IOS", "ANDROID_TV"
      "deviceName": "Samsung Galaxy S22"
    }
    ```
  - **Response (200 OK)**:
    ```json
    {
      "success": true,
      "status": 200,
      "message": "Login successful",
      "data": {
        "accessToken": "eyJhbGciOi...",
        "refreshToken": "eyJhbGciOi...",
        "expiresIn": 86400,
        "tokenType": "Bearer",
        "user": {
          "id": "1",
          "email": "user@example.com",
          "phone": "+919999999999",
          "fullName": "OTT Viewer",
          "roles": ["ROLE_USER"],
          "permissions": ["CONTENT_VIEW"]
        }
      },
      "result": { ... },
      "timestamp": "2026-11-13T00:00:00.000Z"
    }
    ```
  - **Business Logic**: Normalizes email/phone, verifies password against bcrypt/Argon2 hash (or Redis OTP `otp:<phone>`), creates/updates `devices` record, sets `last_login_at`, returns JWT access + refresh tokens.

- **`POST /api/v1/auth/register`**, `/api/auth/register`, `/auth/register`, `/user_registration`
  - **Auth**: Public
  - **Request Body**: `{ "email": "...", "phone": "...", "password": "...", "fullName": "...", "dateOfBirth": "...", "profession": "...", "pincode": "..." }`
  - **Response (201 Created)**: Returns access/refresh tokens and initial profile.

- **`POST /api/v1/auth/otp/send`**, `/auth/otp/send`
  - **Auth**: Public
  - **Request Body**: `{ "phone": "+919876543210" }`
  - **Business Logic**: Generates 6-digit random OTP, stores in Redis (`otp:<phone>`, TTL 300s), dispatches SMS via MSG91 API gateway.

- **`POST /api/v1/auth/otp/verify`**, `/auth/otp/verify`
  - **Auth**: Public
  - **Request Body**: `{ "phone": "+919876543210", "otp": "123456" }`
  - **Business Logic**: Validates OTP from Redis. If user does not exist, registers new user (`ROLE_USER`), creates default profile, returns JWT tokens.

- **`POST /api/v1/auth/refresh`**, `/auth/refresh`
  - **Auth**: Public
  - **Request Body**: `{ "refreshToken": "..." }`
  - **Business Logic**: Validates refresh token signature, checks Redis blacklist, verifies against `refresh_tokens` table, issues rotated access + refresh token pair.

- **`POST /api/v1/auth/logout`**, `/auth/logout`
  - **Auth**: Authenticated (Bearer)
  - **Business Logic**: Adds access token signature to Redis blacklist (`jwt:blacklist:<sig>`, TTL 24h), marks device as inactive.

---

## 2. Content & Catalogue Management (`ContentModule`, `CategoriesModule`)

### 2.1 Public Consumer Catalog
- **`GET /api/v1/catalog/movies`**, `/catalog/movies`, `/movies`
  - **Auth**: Public
  - **Query Params**: `page` (int), `size` (int), `genre` (string), `language` (string), `category` (string), `search` (string)
  - **Response**: `PageResponse<MovieDto>` wrapped in `ApiResponse`.
  - **Caching**: Cached in Redis with key `catalog:movies:<params_hash>`, TTL 300s.

- **`GET /api/v1/catalog/:idOrSlug`**, `/catalog/:idOrSlug`, `/movies/:idOrSlug`
  - **Auth**: OptionalAuth (attaches user context if Bearer token present)
  - **Response**: Full movie or series details, joined with `movies` or `series`, `genres`, `categories`, `languages`, `castMembers` (people), related content, and user-specific rental/watchlist state (`isRented`, `isWatchlisted`).

- **`GET /api/v1/catalog/series`**, `/catalog/series`, `/series`
  - **Auth**: Public
  - **Query Params**: Pagination, genre, language filters.

- **`GET /api/v1/catalog/series/:id/episodes`**, `/series/:id/episodes`
  - **Auth**: Public
  - **Response**: List of episodes organized by season number with duration, thumbnail, and stream metadata.

- **`GET /api/v1/cms/home`**, `/cms/home`, `/home`
  - **Auth**: OptionalAuth
  - **Response**: Composite dynamic landing payload containing hero banners (`banners`), featured carousels, category rows (`sections`, `section_items`), trending titles, and user's "Continue Watching" row.
  - **Caching**: Redis key `cms:home:<lang>`, TTL 180s.

### 2.2 Studio & Admin Content Management
- **`GET /api/v1/admin/movies`**, `/admin/movies`
  - **Auth**: Roles (`ROLE_ADMIN`, `ROLE_SUPER_ADMIN`, `ROLE_CONTENT_MANAGER`, `ROLE_PRODUCER`)
  - **Query Params**: `page`, `size`, `search`, `status` (`DRAFT`, `PUBLISHED`, `ARCHIVED`), `contentType`
  - **Response**: Full catalog including unpublished drafts.

- **`GET /api/v1/admin/movies/:id`**, `/admin/movies/:id`
  - **Auth**: Roles (`ROLE_ADMIN`, `ROLE_SUPER_ADMIN`, `ROLE_CONTENT_MANAGER`, `ROLE_PRODUCER`)
  - **Response**: Movie edit DTO containing:
    `title`, `contentType`, `category` (array), `genres` (array), `originalLanguage`, `cast` (array), `producer`, `releaseDate` (`YYYY-MM-DD`), `durationTime`, `durationMinutes`, `durationSeconds`, `videoUrl`, `masterPlaylistUrl`, `bunnyVideoId`, `posterUrl`, `bannerUrl`, `trailerUrl`, `monetization`, `rentPrice`, `status`.

- **`POST /api/v1/admin/movies`**, `/admin/movies` (Create)
- **`PUT /api/v1/admin/movies/:id`**, `/admin/movies/:id` (Update)
  - **Auth**: Roles (`ROLE_ADMIN`, `ROLE_SUPER_ADMIN`, `ROLE_CONTENT_MANAGER`, `ROLE_PRODUCER`)
  - **Request Body**: Full Movie Form JSON.
  - **Business Logic**:
    1. Upserts `contents` record.
    2. Syncs `content_genres`, `content_categories`, `content_languages`.
    3. Syncs `content_cast` with `people` table (creating missing people records automatically).
    4. Upserts `movies` record with video URLs, duration, director, production house.
    5. Invalids Redis cache prefixes (`catalog:*`, `cms:*`).

- **`DELETE /api/v1/admin/movies/:id`**, `/admin/movies/:id`
  - **Auth**: Roles (`ROLE_ADMIN`, `ROLE_SUPER_ADMIN`)
  - **Business Logic**: Cascades deletion or marks status as `ARCHIVED`.

---

## 3. Playback & Watch History (`WatchHistoryModule`)

### 3.1 Stream Authorization & Heartbeat
- **`POST /api/v1/playback/authorize`**, `/playback/authorize`
  - **Auth**: Authenticated (Bearer)
  - **Request Body**: `{ "contentId": 92, "episodeId": null, "deviceId": "...", "clientIp": "..." }`
  - **Business Logic**:
    1. Checks content monetization model (`FREE` / `AVOD` / `SVOD` / `TVOD`).
    2. If `SVOD`, verifies active row in `subscriptions` table (`validUntil > NOW()`).
    3. If `TVOD`, verifies unexpired record in `content_purchases` (`validUntil > NOW()`).
    4. Validates concurrent playback session limits against `playback_sessions` and DRM rule limits.
    5. Generates Bunny Stream Token Authorization signature with expiry timestamp.
    6. Creates new active `playback_sessions` row.
    7. Returns signed HLS manifest URL, playback token, and heartbeat interval (30s).

- **`POST /api/v1/playback/heartbeat`**, `/playback/heartbeat`
  - **Auth**: Authenticated
  - **Request Body**:
    ```json
    {
      "sessionId": "session-uuid-1234",
      "contentId": 92,
      "watchedSeconds": 300,
      "totalDurationSeconds": 5640,
      "playbackPositionSeconds": 300,
      "isCompleted": false
    }
    ```
  - **Business Logic**:
    1. Updates `playback_sessions.last_heartbeat_at`.
    2. Upserts `watch_history` row (`watched_seconds`, `progress_percent`, `is_completed`).
    3. Publishes telemetry heartbeat to Kafka topic: `ott.telemetry.heartbeat`.

- **`GET /api/v1/watch-history/continue-watching`**, `/watch-history/continue-watching`
  - **Auth**: Authenticated
  - **Response**: List of partially watched items with last progress position, poster, title, and remaining time.

- **`POST /api/v1/watchlist/toggle`**, `/watchlist/toggle`
  - **Auth**: Authenticated
  - **Request Body**: `{ "contentId": 92 }`
  - **Business Logic**: Toggles record in `watchlist` table.

---

## 4. Subscriptions, Monetization & Payments (`SubscriptionsModule`, `PaymentsModule`)

### 4.1 Subscription Plans
- **`GET /api/v1/plans`**, `/plans`, `/api/v1/subscriptions/plans`
  - **Auth**: Public
  - **Response**: List of active subscription plans (`Silver Monthly`, `Gold Quarterly`, `Platinum Annual`) with features, prices, discounts, and concurrent stream allowances.
  - **Caching**: Redis key `plans:list:true`, TTL 300s.

### 4.2 Razorpay Payment Flow
- **`POST /api/v1/payments/create-order`**, `/payments/create-order`
  - **Auth**: Authenticated
  - **Request Body**:
    ```json
    {
      "planId": 2,              // or "contentId" for TVOD rental
      "couponCode": "FESTIVE50",
      "currency": "INR"
    }
    ```
  - **Business Logic**:
    1. Validates coupon discount in `coupons` table.
    2. Computes final payable amount.
    3. Calls Razorpay Orders API (`POST https://api.razorpay.com/v1/orders`).
    4. Creates `payment_orders` row with status `CREATED`.
    5. Returns `orderId`, `amount`, `currency`, `keyId` for Razorpay Checkout SDK.

- **`POST /api/v1/payments/verify-signature`**, `/payments/verify-signature`
  - **Auth**: Authenticated
  - **Request Body**:
    ```json
    {
      "razorpayOrderId": "order_Nz123...",
      "razorpayPaymentId": "pay_Nz456...",
      "razorpaySignature": "3a7b..."
    }
    ```
  - **Business Logic**:
    1. Verifies HMAC-SHA256 signature using `RAZORPAY_KEY_SECRET`.
    2. Acquires Redis transaction mutex lock: `lock:payment:order:<orderId>`.
    3. Updates `payment_orders.status` to `SUCCESS`.
    4. Inserts `payments` ledger record.
    5. Provisions subscription entitlement in `subscriptions` or `content_purchases`.
    6. Publishes payment event to Kafka topic: `ott.payments.razorpay`.
    7. Releases Redis lock.

- **`POST /api/v1/payments/webhook/razorpay`**, `/payments/webhook/razorpay`
  - **Auth**: Public (Signature verified via `X-Razorpay-Signature` header)
  - **Business Logic**: Idempotent webhook processor verifying event integrity, preventing double credit of subscriptions.

---

## 5. Advertising & Video Monetization (`AdvertisementsModule`)

- **`GET /api/v1/ads/vast`**, `/ads/vast`
  - **Auth**: Public (`RawResponse` — XML)
  - **Query Params**: `contentId`, `userId`, `platform`, `adSlot` (`preroll`, `midroll`, `postroll`)
  - **Response**: VAST 4.2 XML compliant ad response payload from Google Ad Manager (GAM) / InMobi tag.

- **`POST /api/v1/ads/track/:event`**, `/ads/track/:event`
  - **Auth**: Public
  - **Params**: `event` (`impression`, `click`, `start`, `firstQuartile`, `midpoint`, `thirdQuartile`, `complete`)
  - **Business Logic**: Records impression and click events in `ad_events` and calculates revenue metrics.

---

## 6. Producers & Studio Portal (`ProducersModule`)

- **`POST /api/v1/producer/login`**, `/producer/login`
- **`GET /api/v1/producer/dashboard`**, `/producer/dashboard`
- **`GET /api/v1/producer/analytics`**, `/producer/analytics`
- **`POST /api/v1/producer/submissions`**, `/producer/submissions`
  - **Auth**: Roles (`ROLE_PRODUCER`)
  - **Business Logic**: Scoped strictly to the authenticated producer's studio ID. Displays analytics, viewer watch hours, revenue share percentage, and allows content submission for approval.

---

## 7. Observability & System Actuators (`HealthModule`, `UploadsModule`)

- **`GET /api/v1/ping`**, `/ping` -> `{ status: "UP", timestamp: ISO8601 }`
- **`GET /api/v1/health`**, `/health`, `/actuator/health` -> Comprehensive health status of PostgreSQL, Redis, Kafka, and memory usage.
- **`GET /metrics`**, `/prometheus` -> Prometheus text format metrics for scrape collection.

