-- 0010_system_settings_branding_and_social_fields.sql
-- Additive & idempotent production migration:
-- Ensures system_settings has all metadata columns and seeds the newly added
-- Branding, App Store & Social Media Footer URL keys without overwriting existing values.

ALTER TABLE system_settings
    ADD COLUMN IF NOT EXISTS category VARCHAR(64),
    ADD COLUMN IF NOT EXISTS setting_group VARCHAR(64),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS is_secret BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE system_settings ALTER COLUMN setting_value TYPE TEXT;
ALTER TABLE system_settings ALTER COLUMN category DROP NOT NULL;

INSERT INTO system_settings (setting_key, setting_value, category, setting_group, description, is_secret, is_public, updated_at)
VALUES
    ('FACEBOOK_URL', 'https://www.facebook.com/maxxpixels', 'BRANDING', 'BRANDING', 'Facebook Page URL shown in website footer', FALSE, TRUE, NOW()),
    ('INSTAGRAM_URL', 'https://www.instagram.com/maxxpixels', 'BRANDING', 'BRANDING', 'Instagram Profile URL shown in website footer', FALSE, TRUE, NOW()),
    ('TWITTER_URL', 'https://x.com/maxxpixels', 'BRANDING', 'BRANDING', 'X (Twitter) Profile URL shown in website footer', FALSE, TRUE, NOW()),
    ('YOUTUBE_URL', 'https://www.youtube.com/@maxxpixels', 'BRANDING', 'BRANDING', 'YouTube Channel URL shown in website footer', FALSE, TRUE, NOW()),
    ('ANDROID_APP_URL', 'https://play.google.com/store/apps/details?id=com.maxxpixels', 'BRANDING', 'BRANDING', 'Google Play Store URL', FALSE, TRUE, NOW()),
    ('IOS_APP_URL', 'https://apps.apple.com/app/maxxpixels', 'BRANDING', 'BRANDING', 'Apple App Store URL', FALSE, TRUE, NOW()),
    ('APP_SHORT_NAME', 'MaxxPixels', 'BRANDING', 'BRANDING', 'Short display name for the platform', FALSE, TRUE, NOW()),
    ('COMPANY_NAME', 'MaxxPixels Media Pvt. Ltd.', 'BRANDING', 'BRANDING', 'Legal company name shown in footer & invoices', FALSE, TRUE, NOW()),
    ('SUPPORT_EMAIL', 'support@maxxpixels.com', 'BRANDING', 'BRANDING', 'Public customer support email', FALSE, TRUE, NOW()),
    ('WEBSITE_URL', 'https://maxxpixels.com', 'BRANDING', 'BRANDING', 'Primary consumer website URL', FALSE, TRUE, NOW()),
    ('SEO_TITLE', 'MaxxPixels - Stream Movies, Short Films & Web Series', 'BRANDING', 'BRANDING', 'Default SEO page title', FALSE, TRUE, NOW()),
    ('SEO_DESCRIPTION', 'Stream movies, series and live entertainment on MaxxPixels.', 'BRANDING', 'BRANDING', 'Default SEO meta description', FALSE, TRUE, NOW())
ON CONFLICT (setting_key) DO NOTHING;
