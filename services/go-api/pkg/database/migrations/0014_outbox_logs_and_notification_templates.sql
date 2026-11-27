-- +goose Up
-- 0014_outbox_logs_and_notification_templates.sql
-- Adds centralized service_logs, transactional outbox_events (for Kafka),
-- editable notification_templates, and daily plan-expiry dispatch deduplication.

CREATE TABLE IF NOT EXISTS service_logs (
    id          BIGSERIAL    PRIMARY KEY,
    service     VARCHAR(64)  NOT NULL,
    level       VARCHAR(16)  NOT NULL DEFAULT 'INFO',
    request_id  VARCHAR(64),
    user_id     BIGINT,
    method      VARCHAR(16),
    path        TEXT,
    status      INTEGER,
    duration_ms BIGINT,
    message     TEXT         NOT NULL,
    metadata    JSONB,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_logs_created_at ON service_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_logs_service    ON service_logs (service, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_logs_level      ON service_logs (level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_logs_request_id ON service_logs (request_id);

CREATE TABLE IF NOT EXISTS outbox_events (
    id             BIGSERIAL    PRIMARY KEY,
    aggregate_type VARCHAR(64)  NOT NULL,
    aggregate_id   VARCHAR(128) NOT NULL,
    topic          VARCHAR(128) NOT NULL,
    event_type     VARCHAR(64)  NOT NULL,
    payload        JSONB        NOT NULL,
    status         VARCHAR(16)  NOT NULL DEFAULT 'PENDING',
    attempts       INTEGER      NOT NULL DEFAULT 0,
    max_attempts   INTEGER      NOT NULL DEFAULT 5,
    last_error     TEXT,
    next_retry_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    published_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE outbox_events
    ADD COLUMN IF NOT EXISTS aggregate_type VARCHAR(64) NOT NULL DEFAULT 'ott',
    ADD COLUMN IF NOT EXISTS aggregate_id   VARCHAR(128) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS topic          VARCHAR(128) NOT NULL DEFAULT 'ott.events',
    ADD COLUMN IF NOT EXISTS event_type     VARCHAR(64) NOT NULL DEFAULT 'event',
    ADD COLUMN IF NOT EXISTS status         VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS attempts       INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_attempts   INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS last_error     TEXT,
    ADD COLUMN IF NOT EXISTS next_retry_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS published_at   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events (next_retry_at ASC, id ASC) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_outbox_topic   ON outbox_events (topic, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbox_status  ON outbox_events (status, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_templates (
    id             BIGSERIAL    PRIMARY KEY,
    code           VARCHAR(64)  NOT NULL UNIQUE,
    name           VARCHAR(120) NOT NULL,
    channel        VARCHAR(16)  NOT NULL DEFAULT 'PUSH',
    title_template TEXT         NOT NULL,
    body_template  TEXT         NOT NULL,
    action_url     VARCHAR(255) DEFAULT '/plans',
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_dispatch_logs (
    id              BIGSERIAL    PRIMARY KEY,
    user_id         BIGINT       NOT NULL,
    subscription_id BIGINT,
    template_code   VARCHAR(64)  NOT NULL,
    channel         VARCHAR(16)  NOT NULL DEFAULT 'PUSH',
    dispatch_date   DATE         NOT NULL DEFAULT CURRENT_DATE,
    status          VARCHAR(16)  NOT NULL DEFAULT 'SENT',
    error_message   TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, template_code, dispatch_date)
);

CREATE INDEX IF NOT EXISTS idx_notif_dispatch_date ON notification_dispatch_logs (dispatch_date DESC, user_id);

INSERT INTO notification_templates (code, name, channel, title_template, body_template, action_url, is_active)
VALUES
    ('PLAN_EXPIRING_7D',    'Plan Expiring in 7 Days',  'PUSH', 'Your {{planName}} plan expires in {{daysLeft}} days', 'Hi {{userName}}, your {{planName}} subscription ends on {{expiryDate}}. Renew early to keep streaming uninterrupted!', '/plans', TRUE),
    ('PLAN_EXPIRING_3D',    'Plan Expiring in 3 Days',  'PUSH', 'Only {{daysLeft}} days left on {{planName}}',       'Hi {{userName}}, renew your {{planName}} plan before {{expiryDate}} so you never miss your favorite shows.',            '/plans', TRUE),
    ('PLAN_EXPIRING_2D',    'Plan Expiring in 2 Days',  'PUSH', '2 days left on your {{planName}} plan',             'Hi {{userName}}, your {{planName}} plan expires on {{expiryDate}}. Tap to renew now!',                                  '/plans', TRUE),
    ('PLAN_EXPIRING_1D',    'Plan Expiring Tomorrow',   'PUSH', 'Last day! {{planName}} expires tomorrow',           'Hi {{userName}}, your {{planName}} subscription expires on {{expiryDate}}. Renew today for uninterrupted access.',      '/plans', TRUE),
    ('PLAN_EXPIRING_TODAY', 'Plan Expiring Today',      'PUSH', 'Your {{planName}} plan expires today!',             'Hi {{userName}}, your {{planName}} access ends today ({{expiryDate}}). Renew now to keep watching.',                    '/plans', TRUE),
    ('PLAN_EXPIRED',        'Plan Expired Notice',      'PUSH', 'Your {{planName}} plan has expired',                'Hi {{userName}}, your {{planName}} subscription has ended. Renew anytime to unlock full HD/4K streaming.',              '/plans', TRUE),
    ('PAYMENT_SUCCESS',     'Payment Confirmed',        'PUSH', 'Welcome to {{planName}}!',                          'Hi {{userName}}, your payment is confirmed and {{planName}} is active until {{expiryDate}}.',                           '/profile', TRUE)
ON CONFLICT (code) DO NOTHING;

-- +goose Down
SELECT 1;
