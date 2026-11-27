-- 0008_user_referrals.sql
-- Additive-only migration for Consumer Refer & Earn (user-to-user referral codes & rewards).

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS referral_code VARCHAR(32),
    ADD COLUMN IF NOT EXISTS referred_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code_upper
    ON users (UPPER(referral_code))
    WHERE referral_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_referrals (
    id BIGSERIAL PRIMARY KEY,
    referrer_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    referral_code VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'SIGNED_UP',
    reward_type VARCHAR(32) NOT NULL DEFAULT 'VIP_DAYS',
    reward_days INTEGER NOT NULL DEFAULT 7,
    reward_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    credited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_referrals_referrer
    ON user_referrals (referrer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_referrals_status
    ON user_referrals (status);
