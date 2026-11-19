-- MaxxPixels OTT Baseline Schema Initializer
-- Enables all core tables so fresh containers initialize cleanly.

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    uuid VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    full_name VARCHAR(255),
    phone_number VARCHAR(50),
    phone VARCHAR(50),
    auth_method VARCHAR(50) DEFAULT 'PASSWORD',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    phone_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    country_code VARCHAR(10),
    pincode VARCHAR(20),
    profession VARCHAR(100),
    date_of_birth VARCHAR(50),
    avatar_url VARCHAR(1000),
    preferred_languages VARCHAR(255),
    last_active_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token VARCHAR(1000) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(1000),
    is_kids BOOLEAN DEFAULT FALSE,
    pin VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50),
    fcm_token VARCHAR(1000),
    ip_address VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plans (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    billing_period VARCHAR(50) NOT NULL DEFAULT 'MONTHLY',
    billing_cycle VARCHAR(50),
    duration_days INT DEFAULT 30,
    price NUMERIC(10,2) NOT NULL DEFAULT 0.0,
    discount_price NUMERIC(10,2),
    currency VARCHAR(10) DEFAULT 'INR',
    trial_days INT DEFAULT 0,
    max_concurrent_streams INT DEFAULT 2,
    max_devices INT DEFAULT 4,
    max_registered_devices INT DEFAULT 4,
    max_profiles INT DEFAULT 5,
    max_resolution VARCHAR(50) DEFAULT 'FHD_1080P',
    max_video_quality VARCHAR(50) DEFAULT 'FHD_1080P',
    ads_enabled BOOLEAN DEFAULT FALSE,
    has_ads BOOLEAN DEFAULT FALSE,
    downloads_enabled BOOLEAN DEFAULT TRUE,
    download_allowed BOOLEAN DEFAULT TRUE,
    allow_downloads BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    is_popular BOOLEAN DEFAULT FALSE,
    is_autopay_eligible BOOLEAN DEFAULT FALSE,
    single_use_only BOOLEAN DEFAULT FALSE,
    features_json TEXT,
    razorpay_plan_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    plan_id BIGINT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    amount NUMERIC(10,2),
    auto_renew BOOLEAN DEFAULT FALSE,
    autopay_enabled BOOLEAN DEFAULT FALSE,
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date TIMESTAMPTZ NOT NULL,
    cancelled_at TIMESTAMPTZ,
    razorpay_customer_id VARCHAR(500),
    razorpay_subscription_id VARCHAR(500),
    payment_gateway_sub_id VARCHAR(500),
    payment_id VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupons (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    discount_percent NUMERIC(5,2),
    discount_amount NUMERIC(10,2),
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    max_uses INT,
    current_uses INT DEFAULT 0,
    min_order_amount NUMERIC(10,2) DEFAULT 0.0,
    plan_id BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    order_id VARCHAR(255) NOT NULL UNIQUE,
    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    plan_id BIGINT,
    content_id BIGINT,
    order_type VARCHAR(50) DEFAULT 'SUBSCRIPTION',
    discount_amount NUMERIC(10,2) DEFAULT 0.0,
    original_amount NUMERIC(10,2) DEFAULT 0.0,
    final_amount NUMERIC(10,2) DEFAULT 0.0,
    coupon_code VARCHAR(255),
    receipt_number VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    order_id VARCHAR(255),
    payment_id VARCHAR(255) NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    provider VARCHAR(50) DEFAULT 'RAZORPAY',
    payment_method VARCHAR(255),
    tax_amount NUMERIC(10,2) DEFAULT 0.0,
    paid_at TIMESTAMPTZ DEFAULT NOW(),
    provider_payment_id VARCHAR(500),
    provider_signature TEXT,
    refunded_amount NUMERIC(10,2),
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contents (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,
    description TEXT,
    short_description TEXT,
    content_type VARCHAR(50) DEFAULT 'MOVIE',
    type VARCHAR(50) DEFAULT 'MOVIE',
    status VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED',
    access_type VARCHAR(50) DEFAULT 'FREE',
    monetization VARCHAR(50) DEFAULT 'FREE',
    release_year INT,
    release_date DATE,
    age_rating VARCHAR(50),
    poster_url VARCHAR(1000),
    backdrop_url VARCHAR(1000),
    landscape_image_url VARCHAR(1000),
    logo_image_url VARCHAR(1000),
    banner_image_url VARCHAR(1000),
    trailer_url VARCHAR(1000),
    duration_seconds INT,
    original_language_code VARCHAR(10) DEFAULT 'kn',
    is_premium BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    is_trending BOOLEAN DEFAULT FALSE,
    is_original BOOLEAN DEFAULT FALSE,
    view_count BIGINT DEFAULT 0,
    producer_id BIGINT,
    content_type_id BIGINT,
    drm_rule_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movies (
    id BIGSERIAL PRIMARY KEY,
    content_id BIGINT UNIQUE,
    video_asset_id VARCHAR(255),
    video_url VARCHAR(1000),
    bunny_video_guid VARCHAR(200),
    duration_minutes INT,
    duration_seconds INT,
    director VARCHAR(255),
    writers VARCHAR(500),
    production_house VARCHAR(255),
    country_of_origin VARCHAR(100) DEFAULT 'IN',
    is_tvod_available BOOLEAN DEFAULT FALSE,
    drm_enabled BOOLEAN DEFAULT FALSE,
    stream_url VARCHAR(1000),
    hls_url VARCHAR(1000),
    dash_url VARCHAR(1000)
);

CREATE TABLE IF NOT EXISTS series (
    id BIGSERIAL PRIMARY KEY,
    content_id BIGINT UNIQUE,
    total_seasons INT DEFAULT 1,
    total_episodes INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS seasons (
    id BIGSERIAL PRIMARY KEY,
    series_id BIGINT NOT NULL,
    season_number INT NOT NULL,
    title VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS episodes (
    id BIGSERIAL PRIMARY KEY,
    season_id BIGINT NOT NULL,
    episode_number INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    video_url VARCHAR(1000),
    stream_url VARCHAR(1000),
    duration_seconds INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    image_url VARCHAR(1000)
);

CREATE TABLE IF NOT EXISTS content_categories (
    content_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    PRIMARY KEY (content_id, category_id)
);

CREATE TABLE IF NOT EXISTS genres (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS content_genres (
    content_id BIGINT NOT NULL,
    genre_id BIGINT NOT NULL,
    PRIMARY KEY (content_id, genre_id)
);

CREATE TABLE IF NOT EXISTS languages (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS content_languages (
    content_id BIGINT NOT NULL,
    language_id BIGINT NOT NULL,
    PRIMARY KEY (content_id, language_id)
);

CREATE TABLE IF NOT EXISTS content_types (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255),
    title VARCHAR(255),
    slug VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS banners (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255),
    image_url VARCHAR(1000) NOT NULL,
    action_url VARCHAR(1000),
    content_id BIGINT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sections (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    display_order INT DEFAULT 0,
    section_type VARCHAR(50) DEFAULT 'CAROUSEL',
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS pages (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255),
    name VARCHAR(255),
    slug VARCHAR(255) UNIQUE NOT NULL,
    content TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS legal_pages (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    is_published BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_settings (
    id BIGSERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    is_secret BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watch_history (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    profile_id BIGINT NOT NULL,
    content_id BIGINT NOT NULL,
    episode_id BIGINT,
    position_seconds INT DEFAULT 0,
    progress_seconds INT DEFAULT 0,
    duration_seconds INT DEFAULT 0,
    percentage NUMERIC(5,2) DEFAULT 0.0,
    completed BOOLEAN DEFAULT FALSE,
    last_watched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watch_histories (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    profile_id BIGINT,
    content_id BIGINT NOT NULL,
    episode_id BIGINT,
    progress_seconds INT DEFAULT 0,
    duration_seconds INT DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    last_watched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watchlist (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT,
    profile_id BIGINT NOT NULL,
    content_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    added_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watchlists (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    profile_id BIGINT,
    content_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS playback_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    user_id BIGINT,
    content_id BIGINT NOT NULL,
    device_id VARCHAR(255),
    ip_address VARCHAR(100),
    status VARCHAR(50) DEFAULT 'ACTIVE',
    is_active BOOLEAN DEFAULT TRUE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_heartbeat_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tvod_products (
    id BIGSERIAL PRIMARY KEY,
    content_id BIGINT NOT NULL,
    price NUMERIC(10,2) NOT NULL DEFAULT 49.0,
    currency VARCHAR(10) DEFAULT 'INR',
    purchase_type VARCHAR(50) DEFAULT 'RENT',
    validity_hours INT DEFAULT 48,
    rental_duration_hours INT DEFAULT 48,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS content_purchases (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    content_id BIGINT NOT NULL,
    tvod_product_id BIGINT,
    price NUMERIC(10,2) NOT NULL,
    amount_paid NUMERIC(10,2),
    currency VARCHAR(10) DEFAULT 'INR',
    purchase_type VARCHAR(50) DEFAULT 'RENT',
    payment_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'ACTIVE',
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    first_watched_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS producer_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL,
    company_name VARCHAR(255),
    contact_person VARCHAR(500),
    email VARCHAR(500),
    phone VARCHAR(500),
    revenue_share_percent NUMERIC(5,2) DEFAULT 60.0,
    kyc_status VARCHAR(500) DEFAULT 'PENDING',
    bank_ifsc VARCHAR(500),
    agreement_url VARCHAR(1000),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS producer_ad_revenue (
    id BIGSERIAL PRIMARY KEY,
    producer_id BIGINT NOT NULL,
    content_id BIGINT NOT NULL,
    episode_id BIGINT,
    billing_period VARCHAR(20) NOT NULL,
    total_impressions BIGINT DEFAULT 0,
    gross_revenue NUMERIC(12, 4) DEFAULT 0.0,
    net_revenue NUMERIC(12, 4) DEFAULT 0.0,
    producer_share_percent NUMERIC(5, 2) DEFAULT 60.00,
    producer_amount NUMERIC(12, 4) DEFAULT 0.0,
    platform_share_percent NUMERIC(5, 2) DEFAULT 40.00,
    platform_amount NUMERIC(12, 4) DEFAULT 0.0,
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(50) DEFAULT 'PENDING',
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_campaigns (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255),
    campaign_name VARCHAR(255),
    advertiser_name VARCHAR(255),
    vast_tag_url VARCHAR(1000),
    video_url VARCHAR(1000),
    bunny_video_guid VARCHAR(200),
    stream_video_id VARCHAR(200),
    thumbnail_url VARCHAR(1000),
    ad_type VARCHAR(50) DEFAULT 'PRE_ROLL',
    ad_break_type VARCHAR(50) DEFAULT 'PRE_ROLL',
    duration_seconds INT DEFAULT 15,
    skip_offset_seconds INT DEFAULT 5,
    target_content_type VARCHAR(100),
    target_language VARCHAR(50),
    cpm_rate DOUBLE PRECISION DEFAULT 0.0,
    budget_amount DOUBLE PRECISION,
    impressions_target BIGINT DEFAULT 10000,
    impressions_delivered BIGINT DEFAULT 0,
    impressions_count BIGINT DEFAULT 0,
    clicks_count BIGINT DEFAULT 0,
    total_budget DOUBLE PRECISION DEFAULT 0.0,
    spent_budget DOUBLE PRECISION DEFAULT 0.0,
    target_devices VARCHAR(100) DEFAULT 'ALL',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    is_active BOOLEAN DEFAULT TRUE,
    click_url VARCHAR(1000),
    click_through_url VARCHAR(1000),
    provider VARCHAR(50) DEFAULT 'BUNNY_STREAM',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_providers (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) DEFAULT 'VIDEO_VAST',
    network_code VARCHAR(100),
    publisher_id VARCHAR(100),
    app_id VARCHAR(150),
    account_id VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    is_bidding_enabled BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ad_events (
    id BIGSERIAL PRIMARY KEY,
    session_token VARCHAR(150) NOT NULL,
    campaign_id BIGINT,
    provider_code VARCHAR(50) DEFAULT 'GAM',
    event_type VARCHAR(50) NOT NULL,
    content_id BIGINT,
    producer_id BIGINT,
    dedup_key VARCHAR(120) UNIQUE NOT NULL,
    revenue_paise INT DEFAULT 0,
    metadata TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'INFO',
    channel VARCHAR(50) DEFAULT 'IN_APP',
    action_url VARCHAR(1000),
    deep_link_url VARCHAR(1000),
    target_role VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    notification_id BIGINT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS outbox_events (
    id BIGSERIAL PRIMARY KEY,
    aggregate_type VARCHAR(100) NOT NULL DEFAULT 'DOMAIN',
    aggregate_id VARCHAR(100),
    event_type VARCHAR(150),
    topic VARCHAR(150) NOT NULL,
    event_key VARCHAR(150),
    payload JSONB NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    next_attempt_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed baseline Admin user and Plan for immediate readiness
INSERT INTO users (id, uuid, email, password_hash, full_name, status, is_phone_verified, is_email_verified)
VALUES (1, 'u-admin-1', 'admin@maxxpixels.com', '$2a$12$e8YkYgD4bM4p0XF9QnZZeecwPZ0gX3c3h9gM6eM9rN3/7F8c0eYl2', 'Super Admin', 'ACTIVE', true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO plans (id, code, name, description, billing_period, duration_days, price, currency, is_active)
VALUES (1, 'STANDARD_MONTHLY', 'Super Monthly', 'Monthly subscription plan', 'MONTHLY', 30, 199.00, 'INR', true),
       (2, 'SUPER_QUARTERLY', 'Super Quarterly', 'Quarterly subscription plan', 'QUARTERLY', 90, 499.00, 'INR', true)
ON CONFLICT (id) DO NOTHING;
