-- Migration 0004: Producer public content submission & agreement flow
-- 100% additive & idempotent — safe to apply on live NestJS production databases.

ALTER TABLE contents ADD COLUMN IF NOT EXISTS poster_2_url TEXT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS production_name VARCHAR(255);
ALTER TABLE contents ADD COLUMN IF NOT EXISTS producer_contact_phone VARCHAR(50);
ALTER TABLE contents ADD COLUMN IF NOT EXISTS producer_email VARCHAR(255);
ALTER TABLE contents ADD COLUMN IF NOT EXISTS google_drive_link TEXT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS one_line_brief TEXT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS submission_source VARCHAR(50) DEFAULT 'admin';
ALTER TABLE contents ADD COLUMN IF NOT EXISTS agreement_url TEXT;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS agreement_status VARCHAR(50) DEFAULT 'PENDING';

CREATE INDEX IF NOT EXISTS idx_contents_submission_source
    ON contents (submission_source)
    WHERE submission_source = 'public_producer';

CREATE INDEX IF NOT EXISTS idx_contents_submission_expires
    ON contents (expires_at)
    WHERE status = 'SUBMITTED' AND expires_at IS NOT NULL;

-- producer_submissions tracking table for public onboarding flow
CREATE TABLE IF NOT EXISTS producer_submissions (
    id BIGSERIAL PRIMARY KEY,
    content_id BIGINT REFERENCES contents(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    language VARCHAR(50),
    poster_1_url TEXT,
    poster_2_url TEXT,
    trailer_url TEXT,
    production_name VARCHAR(255),
    producer_contact_phone VARCHAR(50),
    producer_email VARCHAR(255),
    google_drive_link TEXT,
    one_line_brief TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
    agreement_url TEXT,
    agreement_status VARCHAR(50) DEFAULT 'PENDING',
    admin_review_notes TEXT,
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_producer_submissions_status
    ON producer_submissions (status);

CREATE INDEX IF NOT EXISTS idx_producer_submissions_expires
    ON producer_submissions (expires_at)
    WHERE status IN ('SUBMITTED','AGREEMENT_SHARED','AWAITING_AGREEMENT');
