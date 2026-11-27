-- Intro video and portal banner management for web/mobile landing experiences.
-- Additive only: safe on top of existing NestJS/Rust OTT databases.

CREATE TABLE IF NOT EXISTS intro_videos (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL DEFAULT 'Intro Video',
    description TEXT,
    video_url TEXT NOT NULL,
    poster_url TEXT,
    cta_label VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intro_videos_active_order ON intro_videos (is_active, display_order, id);
CREATE INDEX IF NOT EXISTS idx_intro_videos_created_at ON intro_videos (created_at);

CREATE TABLE IF NOT EXISTS portal_banners (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subtitle TEXT,
    image_url TEXT NOT NULL,
    mobile_image_url TEXT,
    target_url TEXT NOT NULL DEFAULT '/',
    portal_key VARCHAR(64) NOT NULL DEFAULT 'all',
    button_label VARCHAR(100),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_banners_active_order ON portal_banners (is_active, display_order, id);
CREATE INDEX IF NOT EXISTS idx_portal_banners_portal_key ON portal_banners (portal_key, is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_portal_banners_created_at ON portal_banners (created_at);
