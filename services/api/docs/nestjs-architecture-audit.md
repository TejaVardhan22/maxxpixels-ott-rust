# NestJS Architecture Audit — MaxxPixels OTT Platform

**Document Version:** 1.0.0  
**Target Environment:** Production OTT Platform  
**Target Architecture:** Rust (Axum + SeaORM + Tokio + Redis + Kafka)  
**Audit Date:** November 2026  
**Architect:** Principal Migration & Systems Architect  

---

## 1. Executive Summary & System Overview

MaxxPixels OTT is an enterprise-grade video-on-demand and streaming platform built on Node.js (v20+) and NestJS (v10+), utilizing Fastify as its high-throughput HTTP transport engine (`@nestjs/platform-fastify`). The platform services three distinct client tiers:
1. **Public Web Portal (`web`)**: Next.js React frontend for desktop and mobile browsers.
2. **Native Mobile & TV Applications (`mobileapp`)**: Flutter Android, iOS, Android TV, and FireTV applications.
3. **Studio & Operations Admin Console (`admin`)**: Angular 18 Material management dashboard for content managers, producers, and super administrators.

### Core Architectural Characteristics
- **HTTP Engine**: Fastify (`FastifyAdapter`) configured with a 100MB body limit, 5GB streaming multipart upload limit, Helmet security headers, Gzip/Deflate compression, and CORS policy supporting credentials and mobile origins.
- **Data Persistence**: TypeORM with PostgreSQL (`maxxpixels_ott`), managing 59 tables, 52 entity models, and custom column numeric transformers.
- **Caching & Locks**: Redis (`ioredis`) for multi-level query caching, rate limiting (`RateLimitGuard`), session tracking, presence tracking, token revocation blacklisting, and distributed redlock mutexes for checkout transactions.
- **Event Streaming & Reliability**: Apache Kafka (`kafkajs`) across 6 core telemetry, analytics, billing, and notification topics, backed by an ACID Transactional Outbox pattern (`outbox_events`) to prevent dual-write anomalies.
- **Security & Authorization**: Asymmetric/Symmetric JWT authentication, multi-layered Role-Based Access Control (`ROLE_SUPER_ADMIN`, `ROLE_ADMIN`, `ROLE_CONTENT_MANAGER`, `ROLE_PRODUCER`, `ROLE_USER`), and dynamic permission evaluation.
- **Observability**: Prometheus metrics export (`prom-client`), custom health check actuator endpoint (`/health`, `/actuator/health`, `/ping`), and Winston/NestJS structured logging.

---

## 2. Request Lifecycle & Global Middleware Pipeline

Every HTTP request traverses a standardized 8-stage pipeline before reaching controller handlers:

```
[Client Request]
       │
       ▼
1. Fastify Transport Layer
   ├── CORS Validation (Allowlist & Mobile/TV origin pass-through)
   ├── Helmet Security Headers
   └── Fastify Body Parser & Compression (gzip/deflate)
       │
       ▼
2. RateLimitGuard (Global)
   ├── Checks Redis key: `rate_limit:<bucket>:<ip>`
   ├── Buckets: `general` (600 req/min), `auth` (30 req/min), `payment` (30 req/min)
   └── Sets Response Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
       │
       ▼
3. JwtAuthGuard (Global)
   ├── Checks `@Public()` or `@OptionalAuth()` decorators
   ├── Extracts Bearer token from `Authorization` header or query parameters
   ├── Verifies against Redis token blacklist (`jwt:blacklist:<tokenSig>`)
   ├── Validates JWT signature (HMAC-SHA256 with `JWT_SECRET` or remote JWKS for OIDC)
   └── Attaches `AuthenticatedUser` to request object (`req.user`)
       │
       ▼
4. RolesGuard (Global)
   ├── Evaluates `@Roles()` and `@Permissions()` metadata
   ├── Super Admin and user ID 1 bypass authorization checks
   └── Validates user role array against required role strings
       │
       ▼
5. MaintenanceModeInterceptor (Global)
   ├── Evaluates Redis key: `settings:MAINTENANCE_MODE_ENABLED`
   └── Bypasses whitelisted IPs from `settings:MAINTENANCE_ALLOWED_IPS`
       │
       ▼
6. Controller Handler Execution (Service / Database / Caching)
       │
       ▼
7. ApiResponseInterceptor (Global)
   ├── Bypasses raw responses for Actuator, Prometheus, VAST XML, and ads.txt
   └── Standardizes JSON payload into dual-key envelope:
       `{ success: true, status: 200, message: "Success", data: T, result: T, timestamp: ISO8601 }`
       │
       ▼
8. GlobalExceptionFilter (Global)
   ├── Catches `BusinessException`, `HttpException`, TypeORM database errors, and unhandled errors
   └── Formats uniform JSON error response:
       `{ success: false, status: N, message: string, code?: string, errors?: any, timestamp: ISO8601 }`
```

---

## 3. NestJS Module Inventory

| Module Name | Path | Primary Responsibilities | Dependencies |
|---|---|---|---|
| **AuthModule** | `modules/auth/` | Authentication, OTP verification (MSG91), password reset, token issuance/refresh, social OAuth. | UsersModule, RedisModule, StorageModule |
| **UsersModule** | `modules/users/` | User CRUD, profiles, device management, session termination, RBAC roles & permissions. | DatabaseModule, RedisModule |
| **ContentModule** | `modules/content/` | Movie catalog, web series, episodes, seasons, CMS dynamic landing pages, DRM policies, legal pages. | DatabaseModule, RedisModule, KafkaModule |
| **CategoriesModule** | `modules/categories/` | Categories, genres, content types, cast/crew directory, and master taxonomies. | DatabaseModule, RedisModule |
| **LanguagesModule** | `modules/languages/` | Language support, ISO code resolution, localized catalog queries. | DatabaseModule |
| **WatchHistoryModule** | `modules/watch-history/` | Telemetry heartbeats, resume playback progress, watchlists, playback session management. | ContentModule, SubscriptionsModule, RedisModule, KafkaModule |
| **SubscriptionsModule** | `modules/subscriptions/` | Subscription plans, billing cycles, coupon validation, TVOD rentals, user entitlements. | DatabaseModule, RedisModule, PaymentsModule |
| **PaymentsModule** | `modules/payments/` | Razorpay order creation, payment capture, webhook idempotency, refund processing. | SubscriptionsModule, RedisModule, KafkaModule |
| **ProducersModule** | `modules/producers/` | External studio portal, producer onboarding, agreement/KYC tracking, revenue share payouts. | UsersModule, ContentModule, DatabaseModule |
| **AdvertisementsModule**| `modules/advertisements/` | Google Ad Manager (GAM) VAST feeds, InMobi open bidding, ad campaigns, tracking beacons. | DatabaseModule, RedisModule |
| **NotificationsModule** | `modules/notifications/` | Multi-channel dispatch: Push (FCM), SMS (MSG91), WhatsApp, Email (SMTP), and in-app logs. | DatabaseModule, UsersModule |
| **AnalyticsModule** | `modules/analytics/` | Admin dashboard analytics, real-time viewer counts, revenue metrics, view count aggregations. | DatabaseModule, RedisModule |
| **UploadsModule** | `modules/uploads/` | System configuration, storage provider credentials (Bunny.net/S3), database backup automation, media streaming. | DatabaseModule, StorageModule |
| **HealthModule** | `health/` | Prometheus metrics collection, database connection verification, memory and Redis circuit-breaker health. | DatabaseModule, RedisModule, KafkaModule |

---

## 4. Key Cross-Cutting Infrastructure

### 4.1 Redis Caching & In-Memory Fallback
The `RedisService` (`infrastructure/redis/redis.service.ts`) features an intelligent in-memory fallback map with expiration timers (`memoryFallback`). If the Redis server experiences transient connectivity drops, read and write operations continue without throwing fatal exceptions. Cache invalidation uses explicit key prefixes (`catalog:`, `plans:`, `cms:`).

### 4.2 Kafka Event Streaming & Transactional Outbox
The platform publishes asynchronous events for heavy analytics, telemetry heartbeats, and notifications. To guarantee zero event loss even during broker partitions, the `KafkaService` coordinates with `OutboxService`. If Kafka is unreachable, messages are persisted to `outbox_events` and drained on a scheduled cron interval once the broker connection resumes.

### 4.3 Bunny.net Video & Storage Architecture
- **Bunny Stream**: Used for video transcoding, DRM encryption, adaptive bitrate HLS packaging (`playlist.m3u8`), and video GUID management.
- **Bunny Storage**: Edge storage zone (`b-cdn.net`) used for static image assets (posters, landscape banners, producer documents).
- **PublicMediaController**: Implements intelligent fallback serving for media URLs, preventing 404 image errors on client apps by generating dynamic SVG placeholders when files are pending upload.

---

## 5. Architectural Findings & Migration Directives for Rust

1. **Dual-Key Response Contract**: All mobile and web apps parse both `data` and `result` keys. The Axum framework in Rust must serialize responses using an identical JSON structure.
2. **Multi-Route Aliasing**: Many endpoints support multiple path prefixes (e.g. `['api/v1/movies', 'api/movies', 'movies']`). Axum routers must register these aliases to maintain backward compatibility.
3. **Graceful Redis & Kafka Degradation**: The Rust backend must mirror the NestJS behavior of handling Redis or Kafka outages without dropping critical HTTP user traffic.
4. **Fastify Performance Target**: Because NestJS already runs on Fastify (yielding high RPS), the Rust implementation must be tuned with connection pool bounds, non-blocking asynchronous Tokio tasks, and zero-allocation serialization to achieve a substantial step-function improvement in latency and memory usage.

