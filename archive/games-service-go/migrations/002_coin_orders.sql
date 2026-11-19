-- ============================================================
-- 002 — Razorpay coin recharge orders (games DB only)
-- ============================================================

CREATE TABLE IF NOT EXISTS coin_orders (
    id                 BIGSERIAL    PRIMARY KEY,
    player_id          UUID         NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    razorpay_order_id  VARCHAR(64)  NOT NULL UNIQUE,
    pack_id            VARCHAR(32)  NOT NULL,
    coins              BIGINT       NOT NULL,
    amount_paise       BIGINT       NOT NULL,
    currency           VARCHAR(8)   NOT NULL DEFAULT 'INR',
    status             VARCHAR(16)  NOT NULL DEFAULT 'CREATED',   -- CREATED | PAID | FAILED
    payment_id         VARCHAR(64),
    signature_verified BOOLEAN      NOT NULL DEFAULT FALSE,
    receipt            VARCHAR(64),
    notes              JSONB,
    payload            JSONB,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coin_orders_player  ON coin_orders (player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_orders_status  ON coin_orders (status);
