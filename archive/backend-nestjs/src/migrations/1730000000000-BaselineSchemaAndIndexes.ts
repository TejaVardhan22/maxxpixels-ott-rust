import { MigrationInterface, QueryRunner } from 'typeorm';

export class BaselineSchemaAndIndexes1730000000000 implements MigrationInterface {
  name = 'BaselineSchemaAndIndexes1730000000000';

  private mapColumnSqlType(col: any): string {
    const rawType = typeof col.type === 'string' ? col.type.toLowerCase() : 'varchar';
    if (rawType === 'bigint' || rawType === 'int8') return 'BIGINT';
    if (rawType === 'int' || rawType === 'integer' || rawType === 'int4') return 'INTEGER';
    if (rawType === 'boolean' || rawType === 'bool') return 'BOOLEAN DEFAULT FALSE';
    if (rawType === 'numeric' || rawType === 'decimal') {
      const p = col.precision || 12;
      const s = col.scale || 2;
      return `NUMERIC(${p},${s})`;
    }
    if (rawType === 'text') return 'TEXT';
    if (rawType === 'date') return 'DATE';
    if (rawType === 'jsonb' || rawType === 'json') return 'JSONB';
    if (rawType.includes('timestamp')) return 'TIMESTAMPTZ DEFAULT NOW()';
    return 'VARCHAR(500)';
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Transactional Outbox Table (Phase 6 Kafka reliability)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS outbox_events (
        id BIGSERIAL PRIMARY KEY,
        aggregate_type VARCHAR(100) NOT NULL DEFAULT 'DOMAIN',
        aggregate_id VARCHAR(100),
        event_type VARCHAR(150),
        topic VARCHAR(150) NOT NULL,
        event_key VARCHAR(150),
        payload JSONB NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        retry_count INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        next_attempt_at TIMESTAMPTZ,
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS event_key VARCHAR(150);
      CREATE INDEX IF NOT EXISTS idx_outbox_status_next ON outbox_events (status, next_attempt_at);
    `);

    // 2. Ensure content_categories join table exists alongside content_genres and content_languages
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS content_categories (
        content_id BIGINT NOT NULL,
        category_id BIGINT NOT NULL,
        PRIMARY KEY (content_id, category_id)
      );
    `);

    // 2b. Ensure Advertising & Monetization tables exist
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ad_providers (
        id BIGSERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        type VARCHAR(50) DEFAULT 'VIDEO_VAST',
        network_code VARCHAR(100),
        publisher_id VARCHAR(100),
        app_id VARCHAR(150),
        account_id VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        is_bidding_enabled BOOLEAN DEFAULT FALSE,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ad_provider_configurations (
        id BIGSERIAL PRIMARY KEY,
        provider_id BIGINT REFERENCES ad_providers(id) ON DELETE CASCADE,
        config_key VARCHAR(150) NOT NULL,
        config_value TEXT,
        environment VARCHAR(50) DEFAULT 'PRODUCTION',
        is_secret BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_prov_config_unique ON ad_provider_configurations(provider_id, config_key, environment);
      CREATE TABLE IF NOT EXISTS ad_placements (
        id BIGSERIAL PRIMARY KEY,
        code VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        format VARCHAR(50) DEFAULT 'PRE_ROLL',
        platform VARCHAR(50) DEFAULT 'ALL',
        cue_point_seconds INT DEFAULT 0,
        max_duration_seconds INT DEFAULT 30,
        skip_offset_seconds INT DEFAULT 5,
        frequency_cap_per_hour INT DEFAULT 4,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ad_rules (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        rule_type VARCHAR(50) DEFAULT 'EXCLUDE_PREMIUM',
        applies_to VARCHAR(50) DEFAULT 'FREE_TIER',
        target_content_type VARCHAR(50),
        content_id BIGINT,
        target_country VARCHAR(10) DEFAULT 'IN',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ad_sessions (
        id BIGSERIAL PRIMARY KEY,
        session_token VARCHAR(150) UNIQUE NOT NULL,
        user_id BIGINT,
        content_id BIGINT NOT NULL,
        episode_id BIGINT,
        device_type VARCHAR(50) DEFAULT 'WEB',
        ip_address VARCHAR(100),
        user_agent VARCHAR(500),
        ad_tag_url TEXT,
        is_eligible BOOLEAN DEFAULT TRUE,
        ineligibility_reason VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ad_sessions_token ON ad_sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_ad_sessions_content ON ad_sessions(content_id);
      CREATE TABLE IF NOT EXISTS ad_events (
        id BIGSERIAL PRIMARY KEY,
        session_token VARCHAR(150) NOT NULL,
        campaign_id BIGINT,
        provider_code VARCHAR(50) DEFAULT 'GAM',
        event_type VARCHAR(50) NOT NULL,
        content_id BIGINT,
        producer_id BIGINT,
        dedup_key VARCHAR(120) UNIQUE NOT NULL,
        revenue_paise INT DEFAULT 0,
        metadata TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ad_events_session ON ad_events(session_token);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_events_dedup ON ad_events(dedup_key);
      CREATE TABLE IF NOT EXISTS ad_revenue (
        id BIGSERIAL PRIMARY KEY,
        provider_code VARCHAR(50) DEFAULT 'GAM',
        content_id BIGINT NOT NULL,
        date DATE NOT NULL,
        impressions_count BIGINT DEFAULT 0,
        completed_views_count BIGINT DEFAULT 0,
        clicks_count BIGINT DEFAULT 0,
        gross_revenue NUMERIC(12, 4) DEFAULT 0.0,
        net_revenue NUMERIC(12, 4) DEFAULT 0.0,
        currency VARCHAR(10) DEFAULT 'INR',
        status VARCHAR(50) DEFAULT 'ESTIMATED',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_revenue_unique ON ad_revenue(provider_code, content_id, date);
      CREATE TABLE IF NOT EXISTS producer_ad_revenue (
        id BIGSERIAL PRIMARY KEY,
        producer_id BIGINT NOT NULL,
        content_id BIGINT NOT NULL,
        episode_id BIGINT,
        billing_period VARCHAR(20) NOT NULL,
        total_impressions BIGINT DEFAULT 0,
        gross_revenue NUMERIC(12, 4) DEFAULT 0.0,
        net_revenue NUMERIC(12, 4) DEFAULT 0.0,
        producer_share_percent NUMERIC(5, 2) DEFAULT 60.00,
        producer_amount NUMERIC(12, 4) DEFAULT 0.0,
        platform_share_percent NUMERIC(5, 2) DEFAULT 40.00,
        platform_amount NUMERIC(12, 4) DEFAULT 0.0,
        currency VARCHAR(10) DEFAULT 'INR',
        status VARCHAR(50) DEFAULT 'PENDING',
        settled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_producer_ad_revenue_unique ON producer_ad_revenue(producer_id, content_id, billing_period);
      CREATE TABLE IF NOT EXISTS ad_campaigns (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(255),
        campaign_name VARCHAR(255),
        advertiser_name VARCHAR(255),
        vast_tag_url VARCHAR(1000),
        video_url VARCHAR(1000),
        bunny_video_guid VARCHAR(200),
        stream_video_id VARCHAR(200),
        thumbnail_url VARCHAR(1000),
        ad_type VARCHAR(50) DEFAULT 'PRE_ROLL',
        ad_break_type VARCHAR(50) DEFAULT 'PRE_ROLL',
        duration_seconds INT DEFAULT 15,
        skip_offset_seconds INT DEFAULT 5,
        target_content_type VARCHAR(100),
        target_language VARCHAR(50),
        cpm_rate DOUBLE PRECISION DEFAULT 0.0,
        budget_amount DOUBLE PRECISION,
        impressions_target BIGINT DEFAULT 10000,
        impressions_delivered BIGINT DEFAULT 0,
        impressions_count BIGINT DEFAULT 0,
        clicks_count BIGINT DEFAULT 0,
        total_budget DOUBLE PRECISION DEFAULT 0.0,
        spent_budget DOUBLE PRECISION DEFAULT 0.0,
        target_devices VARCHAR(100) DEFAULT 'ALL',
        start_date TIMESTAMPTZ,
        end_date TIMESTAMPTZ,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        is_active BOOLEAN DEFAULT TRUE,
        click_url VARCHAR(1000),
        click_through_url VARCHAR(1000),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON ad_campaigns(status, is_active);
    `);

    // 3. Non-destructively ensure every entity column exists on existing Spring Boot tables
    const metadatas = queryRunner.connection?.entityMetadatas || [];
    for (const meta of metadatas) {
      const tableName = meta.tableName;
      for (const col of meta.columns) {
        if (col.isPrimary) continue;
        const sqlType = this.mapColumnSqlType(col);
        await queryRunner.query(
          `ALTER TABLE IF EXISTS "${tableName}" ADD COLUMN IF NOT EXISTS "${col.databaseName}" ${sqlType};`,
        );
        if (col.databaseName === 'created_at' || col.databaseName === 'updated_at') {
          await queryRunner.query(
            `ALTER TABLE IF EXISTS "${tableName}" ALTER COLUMN "${col.databaseName}" SET DEFAULT NOW();`,
          );
        }
      }
    }

    // 4. Backfill existing Spring Boot rows so dual columns are 100% populated
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contents') THEN
          UPDATE contents
          SET
            type = COALESCE(type, content_type, 'MOVIE'),
            access_type = COALESCE(access_type, monetization, CASE WHEN is_premium THEN 'PREMIUM' ELSE 'FREE' END),
            is_trending = COALESCE(is_trending, is_featured, false)
          WHERE type IS NULL OR access_type IS NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'movies') THEN
          UPDATE movies
          SET
            content_id = COALESCE(content_id, id),
            stream_url = COALESCE(stream_url, video_asset_id),
            hls_url = COALESCE(hls_url, video_asset_id)
          WHERE content_id IS NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'series') THEN
          UPDATE series
          SET content_id = COALESCE(content_id, id)
          WHERE content_id IS NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
          UPDATE users
          SET
            phone = COALESCE(phone, phone_number),
            last_login_at = COALESCE(last_login_at, last_active_at)
          WHERE phone IS NULL AND phone_number IS NOT NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plans') THEN
          UPDATE plans
          SET
            duration_days = COALESCE(duration_days, CASE WHEN billing_period = 'YEARLY' THEN 365 WHEN billing_period = 'QUARTERLY' THEN 90 ELSE 30 END),
            billing_cycle = COALESCE(billing_cycle, billing_period, 'MONTHLY'),
            max_video_quality = COALESCE(max_video_quality, max_resolution, 'FHD_1080P'),
            has_ads = COALESCE(has_ads, ads_enabled, false),
            allow_downloads = COALESCE(allow_downloads, downloads_enabled, true)
          WHERE duration_days IS NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pages') THEN
          UPDATE pages
          SET title = COALESCE(title, name)
          WHERE title IS NULL AND name IS NOT NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_types') THEN
          UPDATE content_types
          SET
            name = COALESCE(name, title),
            is_active = COALESCE(is_active, true)
          WHERE name IS NULL AND title IS NOT NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'legal_pages') THEN
          UPDATE legal_pages
          SET is_active = COALESCE(is_active, is_published, true)
          WHERE is_active IS NULL;
        END IF;
      END $$;
    `);

    // 5. High-Performance Composite Indexes (Phase 3 & Phase 4 DB Optimization)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contents') THEN
          CREATE INDEX IF NOT EXISTS idx_contents_status_type_created ON contents (status, type, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_contents_featured_status ON contents (is_featured, status);
          CREATE INDEX IF NOT EXISTS idx_contents_access_type_status ON contents (access_type, status);
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'watch_history') THEN
          CREATE INDEX IF NOT EXISTS idx_watch_history_user_completed_watched ON watch_history (user_id, is_completed, last_watched_at DESC);
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'playback_sessions') THEN
          CREATE INDEX IF NOT EXISTS idx_playback_sessions_user_active_hb ON playback_sessions (user_id, is_active, last_heartbeat_at);
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
          CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status_end ON subscriptions (user_id, status, end_date DESC);
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_purchases') THEN
          CREATE INDEX IF NOT EXISTS idx_content_purchases_user_content_status ON content_purchases (user_id, content_id, status, expires_at);
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
          CREATE INDEX IF NOT EXISTS idx_payments_status_created ON payments (status, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_payments_user_created ON payments (user_id, created_at DESC);
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_interactions') THEN
          CREATE INDEX IF NOT EXISTS idx_user_interactions_type_created ON user_interactions (interaction_type, created_at DESC);
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
          CREATE INDEX IF NOT EXISTS idx_audit_logs_target_time ON audit_logs (target_entity, timestamp DESC);
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_outbox_status_next;`);
    await queryRunner.query(`DROP TABLE IF EXISTS outbox_events;`);
  }
}
