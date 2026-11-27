-- +goose Up
-- Migration 0003: Notifications Scheduling, TVOD Purchase Status, Coupons & High-Throughput Indexes
-- 100% additive & idempotent — safe to apply on live NestJS production databases.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_audience VARCHAR(64) DEFAULT 'ALL';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS content_id BIGINT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deep_link TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE content_purchases ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'ACTIVE';
ALTER TABLE content_purchases ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS usage_per_user INTEGER DEFAULT 1;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(10, 2);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_discount NUMERIC(10, 2);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS applicable_to VARCHAR(32) DEFAULT 'ALL';

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_read
    ON user_notifications (user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_content_purchases_user_content
    ON content_purchases (user_id, content_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
    ON subscriptions (user_id, status);

-- +goose Down
-- Additive migration; down is intentionally a no-op to protect production data.
SELECT 1;
