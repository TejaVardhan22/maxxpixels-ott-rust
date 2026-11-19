-- Migration 0005: accurate, realtime views and watch history
-- Additive and idempotent. Safe to apply on an existing live database.

-- Exactly-once view ledger. event_id is the playback session token, so retries,
-- replays and duplicate client events cannot increment the counter twice.
CREATE TABLE IF NOT EXISTS content_view_events (
    event_id TEXT PRIMARY KEY,
    content_id BIGINT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    user_id BIGINT,
    viewer_key TEXT NOT NULL,
    session_id TEXT,
    event_type VARCHAR(32) NOT NULL DEFAULT 'start',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_view_events_content_created
    ON content_view_events (content_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_view_events_viewer_created
    ON content_view_events (viewer_key, created_at DESC);

-- One canonical watch-history row per profile and content. Both the heartbeat
-- path and the progress API now upsert on this key, removing duplicate rows.
-- Keep the most recently watched row when legacy duplicates exist.
DELETE FROM watch_history
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY profile_id, content_id
                   ORDER BY last_watched_at DESC NULLS LAST, id DESC
               ) AS rn
        FROM watch_history
    ) ranked
    WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_history_profile_content
    ON watch_history (profile_id, content_id);
