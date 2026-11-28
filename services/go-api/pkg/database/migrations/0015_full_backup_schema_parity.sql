-- +goose Up
-- 0015_full_backup_schema_parity.sql
-- Ensures 100% schema parity with full MaxxPixels PostgreSQL backups:
-- creates the 14 legacy/parity tables and relaxes legacy nullable columns
-- so full SQL dumps restore cleanly with ON_ERROR_STOP=1 and zero skipped tables.

-- 1. Column parity adjustments on existing tables
ALTER TABLE IF EXISTS ad_placements ALTER COLUMN placement_key DROP NOT NULL;
ALTER TABLE IF EXISTS content_languages DROP CONSTRAINT IF EXISTS content_languages_pkey;
ALTER TABLE IF EXISTS content_languages ALTER COLUMN language_id DROP NOT NULL;
ALTER TABLE IF EXISTS content_languages ADD COLUMN IF NOT EXISTS language_code TEXT;
ALTER TABLE IF EXISTS contents ADD COLUMN IF NOT EXISTS imdb_rating DOUBLE PRECISION;
ALTER TABLE IF EXISTS roles ALTER COLUMN code DROP NOT NULL;
ALTER TABLE IF EXISTS playback_sessions ALTER COLUMN session_token DROP NOT NULL;
ALTER TABLE IF EXISTS playback_sessions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE IF EXISTS user_interactions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE IF EXISTS watch_history ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE IF EXISTS watch_history ALTER COLUMN profile_id DROP NOT NULL;

-- 2. Parity tables
CREATE TABLE IF NOT EXISTS ad_provider_configurations (
    id            BIGSERIAL PRIMARY KEY,
    provider_code VARCHAR(64),
    config_key    VARCHAR(128),
    config_value  TEXT,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_revenue (
    id                    BIGSERIAL PRIMARY KEY,
    provider_code         VARCHAR(64),
    content_id            BIGINT,
    date                  DATE,
    impressions_count     BIGINT DEFAULT 0,
    completed_views_count BIGINT DEFAULT 0,
    clicks_count          BIGINT DEFAULT 0,
    gross_revenue         NUMERIC(14, 4) DEFAULT 0,
    net_revenue           NUMERIC(14, 4) DEFAULT 0,
    currency              VARCHAR(16) DEFAULT 'INR',
    status                VARCHAR(32) DEFAULT 'ESTIMATED',
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_rules (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(255),
    rule_type           VARCHAR(64),
    applies_to          VARCHAR(64),
    target_content_type VARCHAR(64),
    content_id          BIGINT,
    target_country      VARCHAR(16),
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_sessions (
    id                    BIGSERIAL PRIMARY KEY,
    session_token         VARCHAR(255),
    user_id               BIGINT,
    content_id            BIGINT,
    episode_id            BIGINT,
    device_type           VARCHAR(64),
    ip_address            VARCHAR(128),
    user_agent            TEXT,
    ad_tag_url            TEXT,
    is_eligible           BOOLEAN DEFAULT TRUE,
    ineligibility_reason  TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id            BIGSERIAL PRIMARY KEY,
    action        VARCHAR(128),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    details       TEXT,
    entity_id     VARCHAR(128),
    entity_name   VARCHAR(128),
    ip_address    VARCHAR(128),
    user_email    VARCHAR(255),
    user_id       BIGINT,
    user_role     VARCHAR(64),
    actor_email   VARCHAR(255),
    target_entity VARCHAR(128),
    target_id     VARCHAR(128),
    timestamp     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS people (
    id                   BIGSERIAL PRIMARY KEY,
    bio                  TEXT,
    name                 VARCHAR(255) NOT NULL,
    profile_image        TEXT,
    avatar_url           TEXT,
    known_for_department VARCHAR(128),
    birth_date           DATE,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_cast (
    id             BIGSERIAL PRIMARY KEY,
    character_name VARCHAR(255),
    role_type      VARCHAR(64),
    content_id     BIGINT,
    person_id      BIGINT,
    display_order  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS drm_rules (
    id                            BIGSERIAL PRIMARY KEY,
    created_at                    TIMESTAMPTZ DEFAULT NOW(),
    drm_type                      VARCHAR(128),
    dynamic_key_rotation          BOOLEAN DEFAULT FALSE,
    enforce_hdcp22                BOOLEAN DEFAULT FALSE,
    invisible_watermarking        BOOLEAN DEFAULT FALSE,
    key_rotation_interval_minutes INTEGER,
    license_type                  VARCHAR(64),
    security_level                VARCHAR(128),
    status                        VARCHAR(32) DEFAULT 'ACTIVE',
    updated_at                    TIMESTAMPTZ DEFAULT NOW(),
    name                          VARCHAR(255),
    provider                      VARCHAR(128),
    widevine_license_url          TEXT,
    fairplay_license_url          TEXT,
    fairplay_certificate_url      TEXT,
    playready_license_url         TEXT,
    hdcp_level                    VARCHAR(64),
    persistent_license            BOOLEAN DEFAULT FALSE,
    license_duration_seconds      INTEGER,
    playback_duration_seconds     INTEGER,
    block_screen_recording        BOOLEAN DEFAULT FALSE,
    block_rooted_devices          BOOLEAN DEFAULT FALSE,
    dynamic_watermarking          BOOLEAN DEFAULT FALSE,
    concurrent_stream_limit       INTEGER,
    is_active                     BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS media_assets (
    id                 BIGSERIAL PRIMARY KEY,
    asset_id           VARCHAR(128),
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    drm_protected      BOOLEAN DEFAULT FALSE,
    duration_seconds   INTEGER,
    manifest_url       TEXT,
    source_url         TEXT,
    status             VARCHAR(64),
    content_id         BIGINT,
    episode_id         BIGINT,
    original_file_name TEXT,
    s3_source_key      TEXT,
    master_playlist_url TEXT,
    encryption_type    VARCHAR(64),
    drm_key_id         VARCHAR(128),
    transcode_status   VARCHAR(64),
    resolutions        TEXT,
    file_size_bytes    BIGINT,
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_media_assets_content_id ON media_assets (content_id);

CREATE TABLE IF NOT EXISTS notification_configs (
    id          BIGSERIAL PRIMARY KEY,
    channel     VARCHAR(64),
    provider    VARCHAR(64),
    config_json TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_logs (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT,
    channel       VARCHAR(64),
    recipient     VARCHAR(255),
    title         TEXT,
    body          TEXT,
    status        VARCHAR(32),
    error_message TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id          BIGSERIAL PRIMARY KEY,
    description TEXT,
    name        VARCHAR(128) NOT NULL,
    module      VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       BIGINT NOT NULL,
    permission_id BIGINT NOT NULL,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS section_items (
    id            BIGSERIAL PRIMARY KEY,
    section_id    BIGINT,
    content_id    BIGINT,
    display_order INTEGER DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS section_items;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS notification_logs;
DROP TABLE IF EXISTS notification_configs;
DROP TABLE IF EXISTS media_assets;
DROP TABLE IF EXISTS drm_rules;
DROP TABLE IF EXISTS content_cast;
DROP TABLE IF EXISTS people;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS ad_sessions;
DROP TABLE IF EXISTS ad_rules;
DROP TABLE IF EXISTS ad_revenue;
DROP TABLE IF EXISTS ad_provider_configurations;
