-- +goose Up
-- Marketing agent onboarding + member attribution.
-- Additive only: safe on top of existing NestJS/OTT databases.

CREATE TABLE IF NOT EXISTS marketing_agents (
    id BIGSERIAL PRIMARY KEY,
    agent_code VARCHAR(32) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    mobile_number VARCHAR(32) NOT NULL,
    email VARCHAR(255) NOT NULL,
    aadhaar_number VARCHAR(32),
    pan_number VARCHAR(32),
    aadhaar_doc_url TEXT,
    pan_doc_url TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketing_agents_code ON marketing_agents (agent_code);
CREATE INDEX IF NOT EXISTS idx_marketing_agents_mobile ON marketing_agents (mobile_number);
CREATE INDEX IF NOT EXISTS idx_marketing_agents_status ON marketing_agents (status);

CREATE TABLE IF NOT EXISTS marketing_agent_members (
    id BIGSERIAL PRIMARY KEY,
    agent_id BIGINT NOT NULL REFERENCES marketing_agents(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone_number VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A user can only be attributed to one marketing agent, and unique users are
-- identified by their registered phone number via users.id.
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketing_agent_members_user ON marketing_agent_members (user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_agent_members_agent ON marketing_agent_members (agent_id, created_at);

-- +goose Down
-- Additive migration; down is intentionally a no-op to protect production data.
SELECT 1;
