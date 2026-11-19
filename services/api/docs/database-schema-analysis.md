# Database Schema Analysis & SeaORM Mapping Strategy

**Document Version:** 1.0.0  
**Database Engine:** PostgreSQL 16  
**Database Name:** `maxxpixels_ott`  
**Total Tables:** 59  
**Total Columns:** 783  
**Target ORM:** SeaORM (v1.0+) with SQLx  

---

## 1. Schema Overview & Preservation Contract

The production database is the authoritative source of truth. The Rust backend **must connect directly** to the existing `maxxpixels_ott` schema without modifying existing tables, altering column types, renaming keys, or performing destructive DDL migrations.

### Data Type Translation Matrix

| PostgreSQL Type | TypeORM Mapping | Rust / SeaORM Type | Notes |
|---|---|---|---|
| `bigint` | `type: 'bigint'` | `i64` | Primary keys, foreign IDs |
| `integer` | `type: 'integer'` / `int` | `i32` | Counts, durations, display orders |
| `numeric(10,2)` | `type: 'numeric'` / `decimal` | `rust_decimal::Decimal` | Prices, gross revenue, share percentages |
| `character varying(N)` | `type: 'varchar'` | `String` | Titles, slugs, URLs, hash strings |
| `text` | `type: 'text'` | `String` | Long descriptions, VAST XML, legal markdown |
| `boolean` | `type: 'boolean'` | `bool` | Flags (`is_active`, `is_premium`) |
| `date` | `type: 'date'` | `chrono::NaiveDate` | Release dates (`YYYY-MM-DD`) |
| `timestamp with time zone` | `type: 'timestamp with time zone'` | `chrono::DateTime<chrono::Utc>` | `created_at`, `updated_at`, telemetry timestamps |
| `json` / `jsonb` | `type: 'json'` / `jsonb` | `serde_json::Value` | Config bundles, playback tokens, device info |

---

## 2. Table-by-Table Architectural Inventory

### 2.1 Identity & Access Control
1. **`users`** (Primary user accounts)
   - Columns: `id` (bigint PK), `uuid` (varchar UK), `email` (varchar UK), `phone_number` (varchar UK), `phone` (varchar), `country_code` (varchar), `password_hash` (varchar), `full_name` (varchar), `avatar_url` (varchar), `status` (varchar default 'ACTIVE'), `email_verified` (bool), `phone_verified` (bool), `date_of_birth` (varchar), `profession` (varchar), `pincode` (varchar), `auth_method` (varchar), `last_login_at` (timestamptz), `last_active_at` (timestamptz), `created_at` (timestamptz), `updated_at` (timestamptz).
2. **`roles`** (RBAC definitions)
   - Columns: `id` (bigint PK), `name` (varchar UK, e.g. `ROLE_SUPER_ADMIN`, `ROLE_ADMIN`, `ROLE_PRODUCER`, `ROLE_USER`), `description` (varchar), `is_system_role` (bool), `created_at` (timestamptz).
3. **`user_roles`** (Many-to-Many junction)
   - Columns: `user_id` (bigint FK -> `users.id`), `role_id` (bigint FK -> `roles.id`), Composite PK `(user_id, role_id)`.
4. **`permissions`** (Granular functional permissions)
   - Columns: `id` (bigint PK), `name` (varchar UK, e.g. `CONTENT_VIEW`, `CONTENT_CREATE`), `module` (varchar), `description` (varchar).
5. **`role_permissions`** (Junction)
   - Columns: `role_id` (bigint FK -> `roles.id`), `permission_id` (bigint FK -> `permissions.id`), Composite PK.
6. **`profiles`** (Sub-profiles under viewer accounts for family/kids)
   - Columns: `id` (bigint PK), `user_id` (bigint FK -> `users.id`), `name` (varchar), `avatar_url` (varchar), `is_kids` (bool), `pin` (varchar), `created_at` (timestamptz).
7. **`devices`** (Registered viewer devices)
   - Columns: `id` (bigint PK), `user_id` (bigint FK -> `users.id`), `device_id` (varchar), `device_type` (varchar), `device_name` (varchar), `os_version` (varchar), `app_version` (varchar), `fcm_token` (varchar), `is_active` (bool), `last_active_at` (timestamptz).
8. **`refresh_tokens`** (Active JWT refresh token ledger)
   - Columns: `id` (bigint PK), `user_id` (bigint FK -> `users.id`), `token_hash` (varchar), `device_id` (varchar), `expires_at` (timestamptz), `revoked` (bool), `created_at` (timestamptz).

### 2.2 Content, Taxonomy & Media
9. **`contents`** (Central catalog polymorphic root table)
   - Columns: `id` (bigint PK), `title` (varchar), `slug` (varchar UK), `description` (text), `short_description` (varchar), `content_type` (varchar: `MOVIE`, `SERIES`, `SHORT_FILM`, `ALBUM`, `MICRODRAMA`, `PODCAST`, `DOCUMENTARY`), `type` (varchar), `status` (varchar: `DRAFT`, `PUBLISHED`, `ARCHIVED`), `access_type` (varchar: `FREE`, `PREMIUM`, `RENTAL`), `monetization` (varchar: `AVOD`, `SVOD`, `TVOD`), `release_year` (int), `release_date` (date), `age_rating` (varchar), `duration_seconds` (int), `imdb_rating` (numeric), `view_count` (bigint), `producer_id` (bigint nullable), `drm_rule_id` (bigint nullable), `poster_url` (varchar), `backdrop_url` (varchar), `landscape_image_url` (varchar), `banner_image_url` (varchar), `logo_image_url` (varchar), `trailer_url` (varchar), `original_language_code` (varchar), `is_featured` (bool), `is_trending` (bool), `is_original` (bool), `is_premium` (bool), `created_at` (timestamptz), `updated_at` (timestamptz).
10. **`movies`** (Feature film and short film physical media details)
    - Columns: `id` (bigint PK), `content_id` (bigint FK -> `contents.id`), `video_asset_id` (varchar), `video_url` (varchar), `stream_url` (varchar), `hls_url` (varchar), `dash_url` (varchar), `bunny_video_guid` (varchar), `duration_minutes` (int), `duration_seconds` (int), `director` (varchar), `writers` (varchar), `production_house` (varchar), `country_of_origin` (varchar), `is_tvod_available` (bool), `drm_enabled` (bool).
11. **`series`** (Web series & television shows)
    - Columns: `id` (bigint PK), `content_id` (bigint FK -> `contents.id`), `total_seasons` (int), `total_episodes` (int), `is_ongoing` (bool).
12. **`seasons`** (Seasons within series)
    - Columns: `id` (bigint PK), `series_id` (bigint FK -> `series.id`), `season_number` (int), `title` (varchar), `description` (text), `poster_url` (varchar).
13. **`episodes`** (Episodes within seasons)
    - Columns: `id` (bigint PK), `season_id` (bigint FK -> `seasons.id`), `episode_number` (int), `title` (varchar), `description` (text), `duration_seconds` (int), `video_url` (varchar), `hls_url` (varchar), `thumbnail_url` (varchar), `bunny_video_guid` (varchar).
14. **`categories`** (Content shelves: Trending, Blockbusters, Originals)
    - Columns: `id` (bigint PK), `name` (varchar), `slug` (varchar UK), `description` (varchar), `image_url` (varchar), `display_order` (int), `is_active` (bool).
15. **`content_categories`** (Junction between contents and categories)
    - Columns: `content_id` (bigint FK -> `contents.id`), `category_id` (bigint FK -> `categories.id`), Composite PK.
16. **`genres`** (Action, Drama, Thriller, Comedy, Romance)
    - Columns: `id` (bigint PK), `name` (varchar), `slug` (varchar UK), `is_active` (bool).
17. **`content_genres`** (Junction)
    - Columns: `content_id` (bigint FK -> `contents.id`), `genre_id` (bigint FK -> `genres.id`), Composite PK.
18. **`languages`** (Audio and subtitle languages)
    - Columns: `id` (bigint PK), `code` (varchar UK, e.g. `hi`, `en`, `kn`, `ta`), `name` (varchar), `native_name` (varchar), `is_default` (bool), `is_active` (bool), `display_order` (int).
19. **`content_languages`** (Junction)
    - Columns: `content_id` (bigint FK -> `contents.id`), `language_code` (varchar FK -> `languages.code`), Composite PK.
20. **`people`** (Cast & Crew master registry)
    - Columns: `id` (bigint PK), `name` (varchar), `bio` (text), `avatar_url` (varchar), `profile_image` (varchar), `known_for_department` (varchar).
21. **`content_cast`** (Junction for actor & director credits per title)
    - Columns: `id` (bigint PK), `content_id` (bigint FK -> `contents.id`), `person_id` (bigint FK -> `people.id`), `character_name` (varchar), `role_type` (varchar: `ACTOR`, `DIRECTOR`, `WRITER`), `display_order` (int).
22. **`banners`** (Hero carousel banners on homepage)
    - Columns: `id` (bigint PK), `title` (varchar), `image_url` (varchar), `link_url` (varchar), `content_id` (bigint FK -> `contents.id` nullable), `display_order` (int), `is_active` (bool).
23. **`sections`** & **`section_items`** (Dynamic CMS homepage layout curation).

### 2.3 Subscriptions, Purchases & Billing
24. **`plans`** (SVOD membership tiers)
    - Columns: `id` (bigint PK), `name` (varchar), `description` (varchar), `price` (numeric), `discount_price` (numeric), `currency` (varchar default 'INR'), `duration_days` (int), `billing_cycle` (varchar: `MONTHLY`, `QUARTERLY`, `YEARLY`), `max_concurrent_streams` (int), `max_devices` (int), `max_profiles` (int), `max_video_quality` (varchar), `has_ads` (bool), `allow_downloads` (bool), `is_popular` (bool), `is_active` (bool).
25. **`subscriptions`** (User active memberships)
    - Columns: `id` (bigint PK), `user_id` (bigint FK -> `users.id`), `plan_id` (bigint FK -> `plans.id`), `status` (varchar: `ACTIVE`, `EXPIRED`, `CANCELLED`), `started_at` (timestamptz), `valid_until` (timestamptz), `payment_order_id` (bigint nullable).
26. **`tvod_products`** & **`content_purchases`** (Pay-per-view rentals with 48h validity).
27. **`payment_orders`** (Razorpay order lifecycle: `CREATED`, `SUCCESS`, `FAILED`).
28. **`payments`** (Immutable financial audit ledger).
29. **`coupons`** (Promotional discount codes with usage limits).

### 2.4 Playback, Analytics & Monetization
30. **`playback_sessions`** (Live concurrent stream heartbeats).
31. **`watch_history`** (Telemetry resume playback progress).
32. **`watchlist`** (User saved bookmarks).
33. **`ad_campaigns`**, **`ad_placements`**, **`ad_events`**, **`ad_revenue`** (VAST / GAM monetization metrics).
34. **`producer_profiles`** & **`producer_ad_revenue`** (Studio revenue shares).
35. **`outbox_events`** (Reliable event delivery for Kafka outages).
36. **`system_settings`** & **`audit_logs`** (Platform configuration & change log).

---

## 3. SeaORM Code Generation Strategy

In Phase 3, SeaORM models will be organized cleanly within `rust/crates/modules/<module>/entities/`:
- Every table maps to an individual entity module (`user.rs`, `content.rs`, `movie.rs`).
- Field attributes preserve snake_case column names using `#[sea_orm(column_name = "...")]`.
- Serde derives apply camelCase translation (`#[serde(rename_all = "camelCase")]`) to guarantee that JSON responses emitted by Rust precisely match the NestJS TypeScript interfaces expected by web and mobile clients.

