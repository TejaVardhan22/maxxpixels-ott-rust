-- Local Docker Postgres schema sync for Rust SeaORM entities
ALTER TABLE banners
  ADD COLUMN IF NOT EXISTS subtitle VARCHAR(500),
  ADD COLUMN IF NOT EXISTS mobile_image_url TEXT,
  ADD COLUMN IF NOT EXISTS trailer_url TEXT,
  ADD COLUMN IF NOT EXISTS target_url TEXT,
  ADD COLUMN IF NOT EXISTS placement VARCHAR(100),
  ADD COLUMN IF NOT EXISTS page_slug VARCHAR(100),
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE sections
  ADD COLUMN IF NOT EXISTS page_id BIGINT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS layout VARCHAR(100),
  ADD COLUMN IF NOT EXISTS type VARCHAR(100) DEFAULT 'CONTENT_ROW',
  ADD COLUMN IF NOT EXISTS subtitle VARCHAR(500),
  ADD COLUMN IF NOT EXISTS section_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS layout_style VARCHAR(100),
  ADD COLUMN IF NOT EXISTS content_type_filter VARCHAR(100),
  ADD COLUMN IF NOT EXISTS category_id BIGINT,
  ADD COLUMN IF NOT EXISTS genre_id BIGINT,
  ADD COLUMN IF NOT EXISTS language_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS auto_fetch_limit INT,
  ADD COLUMN IF NOT EXISTS rule_json TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE languages
  ADD COLUMN IF NOT EXISTS native_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS icon_url TEXT,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE genres
  ADD COLUMN IF NOT EXISTS icon_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_details TEXT,
  ADD COLUMN IF NOT EXISTS recipient_target VARCHAR(255),
  ADD COLUMN IF NOT EXISTS target_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS target_value VARCHAR(255),
  ADD COLUMN IF NOT EXISTS deep_link_url TEXT,
  ADD COLUMN IF NOT EXISTS target_audience VARCHAR(100),
  ADD COLUMN IF NOT EXISTS target_user_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS sent_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);

ALTER TABLE content_types
  ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT '',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS icon_url TEXT,
  ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Missing tables in 00_init_schema.sql
CREATE TABLE IF NOT EXISTS ad_placements (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  placement_key TEXT UNIQUE NOT NULL,
  ad_type TEXT,
  position TEXT,
  provider_id BIGINT,
  campaign_id BIGINT,
  frequency_cap INT,
  skip_after_seconds INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS live_channels (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  stream_url TEXT NOT NULL,
  hls_stream_url TEXT,
  description TEXT,
  logo_url TEXT,
  poster_url TEXT,
  category TEXT,
  language_code TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_live BOOLEAN DEFAULT TRUE,
  is_premium BOOLEAN DEFAULT FALSE,
  is_drm_protected BOOLEAN DEFAULT FALSE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS live_events (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  stream_url TEXT NOT NULL,
  hls_stream_url TEXT,
  description TEXT,
  poster_url TEXT,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_premium BOOLEAN DEFAULT FALSE,
  is_drm_protected BOOLEAN DEFAULT FALSE,
  is_ppv BOOLEAN DEFAULT FALSE,
  ppv_price NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_interactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  content_id BIGINT NOT NULL,
  interaction_type TEXT NOT NULL,
  rating INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- All remaining missing columns across entities
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS discount_type TEXT;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS discount_value NUMERIC(12,2);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS maximum_discount NUMERIC(12,2);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(12,2);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS minimum_amount NUMERIC(12,2);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS usage_limit INT;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS usage_per_user INT;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS used_count INT;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS applicable_plan_id BIGINT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_model TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS os_version TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS app_version TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS is_premium BOOLEAN;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS still_image_url TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS video_asset_id TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS synopsis TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS duration_minutes INT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS bunny_video_guid TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS access_type TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS is_free_preview BOOLEAN;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS release_date TEXT;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE legal_pages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE legal_pages ADD COLUMN IF NOT EXISTS version TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS icon_url TEXT;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS display_order INT;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_order_id BIGINT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_order_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS error_code TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS error_description TEXT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS validity_hours INT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2);
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS provider_order_id TEXT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS subscription_id TEXT;
ALTER TABLE playback_sessions ADD COLUMN IF NOT EXISTS current_position_seconds INT;
ALTER TABLE playback_sessions ADD COLUMN IF NOT EXISTS device_type TEXT;
ALTER TABLE playback_sessions ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE playback_sessions ADD COLUMN IF NOT EXISTS total_duration_seconds INT;
ALTER TABLE playback_sessions ADD COLUMN IF NOT EXISTS profile_id BIGINT;
ALTER TABLE playback_sessions ADD COLUMN IF NOT EXISTS episode_id BIGINT;
ALTER TABLE producer_ad_revenue ADD COLUMN IF NOT EXISTS settlement_date TIMESTAMPTZ;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS agreement_status TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS bank_account_payout_id TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS bank_doc_url TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS bank_status TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS gst_doc_url TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS gst_number TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS gst_status TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS ifsc_code TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS onboarding_status TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS pan_doc_url TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS pan_number TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS pan_status TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS aadhar_doc_url TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS aadhar_back_doc_url TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS aadhar_number TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS aadhar_status TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS revenue_share NUMERIC(12,2);
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS signed_agreement_url TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS studio_registration_number TEXT;
ALTER TABLE producer_profiles ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_kids_profile BOOLEAN;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kids_profile BOOLEAN;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_default BOOLEAN;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pin_code_hash TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_languages TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS maturity_level TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS maturity_rating_limit TEXT;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_system_role BOOLEAN;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS poster_url TEXT;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS synopsis TEXT;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS release_year INT;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS release_date TEXT;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE series ADD COLUMN IF NOT EXISTS is_ongoing BOOLEAN;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS setting_key TEXT;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS setting_value TEXT;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS setting_group TEXT;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS is_public BOOLEAN;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS watched_seconds INT;
ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS watched_duration_seconds INT;
ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS total_duration_seconds INT;
ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS is_completed BOOLEAN;

-- Auto-synced columns for newly created tables
ALTER TABLE ad_placements ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE ad_placements ADD COLUMN IF NOT EXISTS format TEXT;
ALTER TABLE ad_placements ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE ad_placements ADD COLUMN IF NOT EXISTS cue_point_seconds INT;
ALTER TABLE ad_placements ADD COLUMN IF NOT EXISTS max_duration_seconds INT;
ALTER TABLE ad_placements ADD COLUMN IF NOT EXISTS skip_offset_seconds INT;
ALTER TABLE ad_placements ADD COLUMN IF NOT EXISTS frequency_cap_per_hour INT;
ALTER TABLE live_channels ADD COLUMN IF NOT EXISTS epg_url TEXT;
ALTER TABLE live_channels ADD COLUMN IF NOT EXISTS drm_license_url TEXT;
ALTER TABLE live_channels ADD COLUMN IF NOT EXISTS access_type TEXT;
ALTER TABLE live_channels ADD COLUMN IF NOT EXISTS channel_number INT;
ALTER TABLE live_events ADD COLUMN IF NOT EXISTS channel_id BIGINT;
ALTER TABLE live_events ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ;
ALTER TABLE live_events ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ;
ALTER TABLE live_events ADD COLUMN IF NOT EXISTS access_type TEXT;
ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS content_title TEXT;
ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS device_type TEXT;
ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS duration_seconds INT;
ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS metadata TEXT;
ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS position_seconds INT;
ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS profile_id BIGINT;
ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS rating_value NUMERIC(12,2);
ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS watch_duration_seconds INT;
ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS country_code TEXT;
ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS ip_address TEXT;
