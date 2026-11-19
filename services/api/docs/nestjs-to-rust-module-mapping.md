# NestJS to Rust Module & Component Mapping

**Document Version:** 1.0.0  
**Target Environment:** Production OTT Platform  
**Target Architecture:** Rust Workspace (Axum + SeaORM + Tokio)  
**Audit Date:** November 2026  

---

## 1. Architectural Mapping Topology

```
NestJS Architectural Layer (TypeScript)           Rust Architectural Layer (Rust 2021)
────────────────────────────────────────          ────────────────────────────────────
FastifyAdapter (HTTP Transport)           ───>    Axum Router (tokio / hyper / tower)
app.module.ts (Dependency Injection)      ───>    AppState (Arc<Services>, Extension)
ValidationPipe (class-validator)          ───>    validator crate & Serde JSON extractors
ApiResponseInterceptor (Response Wrap)    ───>    axum::middleware::from_fn (Envelope middleware)
GlobalExceptionFilter (Error Handling)    ───>    AppError (IntoResponse enum implementation)
JwtAuthGuard / RolesGuard (Security)      ───>    axum::middleware (Auth & RBAC layers)
RateLimitGuard (Redis Token Bucket)       ───>    tower_governor / custom Redis sliding window
TypeORM Repositories / Entities           ───>    SeaORM Entities / ActiveModel / EntityTrait
ioredis (Redis Client)                    ───>    redis::aio::MultiplexedConnection
kafkajs (Kafka Producer & Consumer)       ───>    rdkafka (FutureProducer & StreamConsumer)
Cron Jobs (@nestjs/schedule)              ───>    tokio::spawn with tokio::time::interval
```

---

## 2. Workspace & Crate Mapping

```
rust/
├── Cargo.toml (Workspace Root)
│
├── crates/
│   ├── common/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── error.rs           <-- GlobalExceptionFilter, BusinessException
│   │       ├── response.rs        <-- ApiResponse, PageResponse
│   │       ├── security.rs        <-- JWT validation, password hashing, PII masking
│   │       ├── middleware/        <-- Rate limit, Auth, CORS, RequestId, Envelope
│   │       └── utils.rs           <-- Language normalization, circuit breaker
│   │
│   ├── core/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── config.rs          <-- Environment variables (.env)
│   │       ├── db.rs              <-- PostgreSQL / SeaORM connection pool
│   │       ├── redis.rs           <-- Redis connection pool & in-memory fallback
│   │       ├── kafka.rs           <-- Kafka producer / consumer handles
│   │       └── state.rs           <-- Axum AppState (shared Arc)
│   │
│   ├── modules/
│   │   ├── auth/                  <-- AuthModule (login, register, OTP, refresh)
│   │   ├── users/                 <-- UsersModule (user CRUD, profiles, devices)
│   │   ├── content/               <-- ContentModule (movies, series, episodes, CMS)
│   │   ├── catalogue/             <-- CategoriesModule (categories, genres, cast)
│   │   ├── playback/              <-- WatchHistoryModule (playback authorize, DRM)
│   │   ├── subscriptions/         <-- SubscriptionsModule (plans, coupons, TVOD)
│   │   ├── payments/              <-- PaymentsModule (Razorpay order & webhook)
│   │   ├── advertising/           <-- AdvertisementsModule (VAST, impressions)
│   │   ├── watch_history/         <-- WatchHistoryModule (telemetry heartbeats)
│   │   ├── notifications/         <-- NotificationsModule (Push, SMS, Email)
│   │   ├── analytics/             <-- AnalyticsModule (viewers, gross revenue)
│   │   └── admin/                 <-- Admin controllers & master settings
│   │
│   ├── integrations/
│   │   ├── razorpay/              <-- Razorpay client & HMAC verification
│   │   ├── bunny/                 <-- Bunny Stream & Storage token generation
│   │   ├── email/                 <-- SMTP dispatch
│   │   └── oauth/                 <-- Google OAuth2 ID token verification
│   │
│   └── workers/
│       ├── event_worker/          <-- Outbox table drainer cron
│       ├── analytics_worker/      <-- Kafka telemetry viewer counter
│       ├── notification_worker/   <-- Asynchronous notification processor
│       └── billing_worker/        <-- Expired subscription status updater
│
└── api/
    ├── Cargo.toml
    └── src/
        ├── main.rs                <-- Application entry point (port 8081)
        └── router.rs              <-- Central Axum router mounting all crates
```

---

## 3. NestJS Controller to Axum Handler Mapping

| NestJS Controller | Rust Module & File | Key Axum Routes |
|---|---|---|
| `AuthController` | `modules/auth/handlers.rs` | `POST /api/v1/auth/login`, `/register`, `/otp/send`, `/otp/verify`, `/refresh` |
| `AdminMovieController` | `modules/content/admin_movies.rs` | `GET /api/v1/admin/movies`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` |
| `CatalogController` | `modules/content/catalog.rs` | `GET /api/v1/catalog/movies`, `GET /:idOrSlug`, `GET /series` |
| `CmsController` | `modules/content/cms.rs` | `GET /api/v1/cms/home`, `GET /banners`, `GET /sections` |
| `PlaybackController` | `modules/playback/handlers.rs` | `POST /api/v1/playback/authorize`, `POST /playback/heartbeat` |
| `WatchController` | `modules/watch_history/handlers.rs` | `GET /api/v1/watch-history/continue-watching`, `POST /watchlist/toggle` |
| `PaymentController` | `modules/payments/handlers.rs` | `POST /api/v1/payments/create-order`, `/verify-signature`, `/webhook/razorpay` |
| `PlanController` | `modules/subscriptions/handlers.rs` | `GET /api/v1/plans`, `POST /api/v1/admin/plans` |
| `AdController` | `modules/advertising/handlers.rs` | `GET /api/v1/ads/vast`, `POST /api/v1/ads/track/:event` |
| `ProducerPortalController`| `modules/admin/producer_portal.rs`| `POST /api/v1/producer/login`, `GET /dashboard`, `POST /submissions` |
| `AdminUserController` | `modules/users/admin_users.rs` | `GET /api/v1/admin/users`, `POST /`, `PUT /:id`, `POST /:id/reset-password` |
| `HealthController` | `api/src/health.rs` | `GET /health`, `GET /api/v1/health`, `GET /ping`, `GET /metrics` |
| `PublicMediaController` | `modules/content/media_fallback.rs`| `GET /uploads/*`, `/posters/*`, `/banners/*` |

