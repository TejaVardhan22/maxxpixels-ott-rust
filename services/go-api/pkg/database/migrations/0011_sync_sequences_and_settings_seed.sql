-- 0011_sync_sequences_and_settings_seed.sql
-- Fixes out-of-sync PostgreSQL primary-key sequences (e.g. system_settings_id_seq
-- after DB restore/import, which causes `duplicate key value violates unique constraint "system_settings_pkey"`),
-- then idempotently ensures branding/social keys exist in system_settings.

DO $$
DECLARE
    rec RECORD;
    max_val BIGINT;
BEGIN
    FOR rec IN
        SELECT
            c.table_schema,
            c.table_name,
            c.column_name,
            pg_get_serial_sequence(format('%I.%I', c.table_schema, c.table_name), c.column_name) AS seq_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND pg_get_serial_sequence(format('%I.%I', c.table_schema, c.table_name), c.column_name) IS NOT NULL
    LOOP
        EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I.%I', rec.column_name, rec.table_schema, rec.table_name)
        INTO max_val;

        IF max_val > 0 THEN
            PERFORM setval(rec.seq_name, max_val, true);
        ELSE
            PERFORM setval(rec.seq_name, 1, false);
        END IF;
    END LOOP;
END $$;

INSERT INTO system_settings (setting_key, setting_value, category, setting_group, description, is_secret, is_public, updated_at)
SELECT v.setting_key, v.setting_value, v.category, v.setting_group, v.description, v.is_secret, v.is_public, NOW()
FROM (VALUES
    ('FACEBOOK_URL', 'https://www.facebook.com/maxxpixels', 'BRANDING', 'BRANDING', 'Facebook Page URL shown in website footer', FALSE, TRUE),
    ('INSTAGRAM_URL', 'https://www.instagram.com/maxxpixels', 'BRANDING', 'BRANDING', 'Instagram Profile URL shown in website footer', FALSE, TRUE),
    ('TWITTER_URL', 'https://x.com/maxxpixels', 'BRANDING', 'BRANDING', 'X (Twitter) Profile URL shown in website footer', FALSE, TRUE),
    ('YOUTUBE_URL', 'https://www.youtube.com/@maxxpixels', 'BRANDING', 'BRANDING', 'YouTube Channel URL shown in website footer', FALSE, TRUE),
    ('ANDROID_APP_URL', 'https://play.google.com/store/apps/details?id=com.maxxpixels', 'BRANDING', 'BRANDING', 'Google Play Store URL', FALSE, TRUE),
    ('IOS_APP_URL', 'https://apps.apple.com/app/maxxpixels', 'BRANDING', 'BRANDING', 'Apple App Store URL', FALSE, TRUE),
    ('APP_SHORT_NAME', 'MaxxPixels', 'BRANDING', 'BRANDING', 'Short display name for the platform', FALSE, TRUE),
    ('COMPANY_NAME', 'MaxxPixels Media Pvt. Ltd.', 'BRANDING', 'BRANDING', 'Legal company name shown in footer & invoices', FALSE, TRUE),
    ('SUPPORT_EMAIL', 'support@maxxpixels.com', 'BRANDING', 'BRANDING', 'Public customer support email', FALSE, TRUE),
    ('WEBSITE_URL', 'https://maxxpixels.com', 'BRANDING', 'BRANDING', 'Primary consumer website URL', FALSE, TRUE),
    ('SEO_TITLE', 'MaxxPixels - Stream Movies, Short Films & Web Series', 'BRANDING', 'BRANDING', 'Default SEO page title', FALSE, TRUE),
    ('SEO_DESCRIPTION', 'Stream movies, series and live entertainment on MaxxPixels.', 'BRANDING', 'BRANDING', 'Default SEO meta description', FALSE, TRUE)
) AS v(setting_key, setting_value, category, setting_group, description, is_secret, is_public)
WHERE NOT EXISTS (
    SELECT 1 FROM system_settings s
    WHERE LOWER(COALESCE(s.setting_key, '')) = LOWER(v.setting_key)
)
ON CONFLICT DO NOTHING;
