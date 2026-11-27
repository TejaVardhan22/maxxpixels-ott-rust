-- +goose Up
-- Migration 0002: CMS Section Slugs & Immutable Settings/Security Audit Logs
-- 100% additive & idempotent — safe to apply on live NestJS production databases.

ALTER TABLE sections ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

UPDATE sections
SET slug = LOWER(REGEXP_REPLACE(COALESCE(title, 'section-' || id::text), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL OR TRIM(slug) = '';

CREATE TABLE IF NOT EXISTS setting_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    action VARCHAR(64) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    user_role VARCHAR(64) NOT NULL DEFAULT 'ADMIN',
    details TEXT NOT NULL,
    before_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    after_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_setting_audit_logs_created_at
    ON setting_audit_logs (created_at DESC);

-- +goose Down
-- Additive migration; down is intentionally a no-op to protect production data.
SELECT 1;
