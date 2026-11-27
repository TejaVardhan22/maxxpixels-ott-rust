-- +goose Up
-- 0009_payments_nullable_legacy_columns.sql
-- Additive & idempotent production migration:
-- Ensures legacy NOT NULL constraints on payments.payment_id / payments.order_id
-- do not block coupon-discounted or free subscription verifications, and guarantees
-- all optional payment tracking columns exist.

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS payment_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS order_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS provider_signature VARCHAR(512),
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(64),
    ADD COLUMN IF NOT EXISTS provider VARCHAR(64),
    ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS currency VARCHAR(16),
    ADD COLUMN IF NOT EXISTS error_code VARCHAR(128),
    ADD COLUMN IF NOT EXISTS error_description TEXT,
    ADD COLUMN IF NOT EXISTS failure_reason TEXT,
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE payments ALTER COLUMN payment_id DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN order_id DROP NOT NULL;

-- +goose Down
-- Additive migration; down is intentionally a no-op to protect production data.
SELECT 1;
