-- 0012_producer_content_collect_flow.sql
-- Additive & idempotent migration for the public producer content collection,
-- phone OTP verification, Agreement + KYC collection, and direct Google Drive -> Bunny draft onboarding flow.

ALTER TABLE producer_submissions
    ADD COLUMN IF NOT EXISTS producer_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS kyc_token VARCHAR(128),
    ADD COLUMN IF NOT EXISTS agreement_accepted BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS agreement_signed_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS agreement_signed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS aadhaar_number VARCHAR(32),
    ADD COLUMN IF NOT EXISTS aadhaar_doc_link TEXT,
    ADD COLUMN IF NOT EXISTS pan_number VARCHAR(32),
    ADD COLUMN IF NOT EXISTS pan_doc_link TEXT,
    ADD COLUMN IF NOT EXISTS bank_account_holder VARCHAR(255),
    ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(64),
    ADD COLUMN IF NOT EXISTS bank_ifsc_code VARCHAR(32),
    ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS bank_cheque_link TEXT,
    ADD COLUMN IF NOT EXISTS bunny_transfer_status VARCHAR(64),
    ADD COLUMN IF NOT EXISTS bunny_video_job_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS bunny_trailer_job_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS bunny_poster_url TEXT,
    ADD COLUMN IF NOT EXISTS bunny_banner_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_producer_submissions_kyc_token
    ON producer_submissions (kyc_token)
    WHERE kyc_token IS NOT NULL;
