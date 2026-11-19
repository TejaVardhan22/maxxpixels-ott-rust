# Migration Execution Plan & Strangler Rollout Strategy

**Document Version:** 1.0.0  
**Target Environment:** Production OTT Platform  
**Audit Date:** November 2026  

---

## 1. Migration Roadmap & Milestone Gates

The migration is partitioned into 5 strictly phased milestones. Each milestone requires comprehensive automated contract validation before advancing:

```
[Phase 1: Architecture & API Audit] ──> COMPLETED
  └── 9 comprehensive specification & contract documents in `rust/docs/`
       │
       ▼
[Phase 2: Rust Foundation & Core Runtime] ──> CURRENT FOCUS
  ├── Rust workspace (`rust/`) initialized with Tokio, Axum, SeaORM, Redis, Kafka
  ├── Centralized error handling, request envelope middleware, CORS, rate limiting
  ├── Database connection pool & health/metrics endpoints on port 8081
  └── Native release build via cargo build --release
       │
       ▼
[Phase 3: Database Compatibility & SeaORM Models]
  ├── Exact SeaORM entities generated for all 59 tables matching PostgreSQL
  ├── Zero DDL alterations; 100% schema parity verification
  └── Data type and nullable consistency test suite
       │
       ▼
[Phase 4: Contract Testing & Module Migration] (Incremental)
  ├── Module 1: Authentication & RBAC (Login, OTP, Refresh, Revocation)
  ├── Module 2: Users & Profiles (CRUD, Devices, Sessions)
  ├── Module 3: Content & Catalogue (Movies, Series, CMS, Taxonomies)
  ├── Module 4: Playback & Streaming (Entitlements, Bunny Signed URLs, DRM)
  ├── Module 5: Subscriptions & TVOD (Plans, Coupons, Entitlement checks)
  ├── Module 6: Payments & Razorpay (Order creation, Webhook idempotency)
  ├── Module 7: Advertising (VAST 4.2 XML, Impression beacons)
  ├── Module 8: Watch History & Telemetry (Heartbeats, Continue Watching)
  └── Module 9: Admin Operations & Studio Portal
       │
       ▼
[Phase 5: Strangler Traffic Shifting & Production Cutover]
  ├── Stage 1: Read-only shadow traffic execution on port 8081
  ├── Stage 2: Automated JSON diff verification against NestJS port 8080
  ├── Stage 3: Reverse proxy (Nginx) traffic shifting (5% -> 25% -> 50% -> 100%)
  └── Stage 4: NestJS retired to standby mode with instant rollback capability
```

---

## 2. Port & Network Allocation Strategy

- **Production Port 8080**: NestJS Fastify backend continues serving all existing live production traffic uninterrupted.
- **Internal Migration Port 8081**: Rust Axum backend runs concurrently on the same host/container network, reading from the same PostgreSQL (`maxxpixels_ott`) and Redis instances without contention.
- **Nginx Ingress Router**:
  - Initially forwards all traffic to `127.0.0.1:8080`.
  - Configured with upstream weighted split directives (`split_clients` or route-based location blocks) for incremental strangler routing once Phase 4 contract validation is achieved.

---

## 3. Automated Parity & Contract Verification Protocol

For every migrated module, automated comparative integration tests will:
1. Issue an identical HTTP request to `http://localhost:8080` (NestJS) and `http://localhost:8081` (Rust).
2. Compare HTTP status codes, headers, and JSON structure.
3. Assert that both responses match on all required business fields, date formats, and casing conventions.
4. Verify that side effects (e.g. Redis key updates, database row creation) are completely identical.

