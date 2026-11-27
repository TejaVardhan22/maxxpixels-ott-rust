-- Migration 0001: Additive Content Metadata, Scheduling, TVOD Pricing & Cast Members
-- 100% additive & idempotent — safe to apply on live NestJS production databases.

ALTER TABLE contents ADD COLUMN IF NOT EXISTS subtitles_json TEXT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS audio_tracks_json TEXT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS cast_json TEXT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS content_warnings TEXT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS quality_badges TEXT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS skip_intro_start INT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS skip_intro_end INT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS skip_outro_start INT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMPTZ;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS rent_price NUMERIC(10, 2);
ALTER TABLE contents ADD COLUMN IF NOT EXISTS validity_hours INTEGER;

CREATE INDEX IF NOT EXISTS idx_contents_scheduled_publish
    ON contents (scheduled_publish_at)
    WHERE status = 'SCHEDULED' AND scheduled_publish_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contents_expires_at
    ON contents (expires_at)
    WHERE status = 'PUBLISHED' AND expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS cast_members (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) DEFAULT 'Actor',
    bio TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
