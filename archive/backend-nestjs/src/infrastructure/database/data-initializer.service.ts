import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  Role,
  Permission,
  User,
  Language,
  Genre,
  ContentType,
  Category,
  Plan,
  DrmRule,
  LegalPage,
  Page,
  AdProvider,
  AdPlacement,
  AdRule,
} from './entities';
import { BaselineSchemaAndIndexes1730000000000 } from '../../migrations/1730000000000-BaselineSchemaAndIndexes';

@Injectable()
export class DataInitializerService implements OnModuleInit {
  private readonly logger = new Logger(DataInitializerService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    const shouldSkip =
      process.env.SKIP_DB_INIT === 'true' ||
      process.env.SKIP_DATA_INITIALIZER === 'true' ||
      process.env.SKIP_DATA_INIT === 'true' ||
      process.env.RUN_DATA_INITIALIZER === 'false' ||
      process.env.INITIALIZE_DATA === 'false';

    if (!this.dataSource.isInitialized) {
      return;
    }

    const runStep = async (stepName: string, stepFn: () => Promise<void>) => {
      try {
        await stepFn();
      } catch (err: any) {
        this.logger.warn(`DataInitializer step [${stepName}] encountered issue: ${err.message}`);
      }
    };

    // Step 1: Ensure ad tables, junction tables, and schema fixes exist unconditionally (idempotent IF NOT EXISTS)
    await runStep('runMigrationsAndIndexes', () => this.runMigrationsAndIndexes());
    await runStep('ensureAdMonetizationTables', () => this.ensureAdMonetizationTables());
    await runStep('applySchemaFixesAndPatches', () => this.applySchemaFixesAndPatches());

    if (shouldSkip) {
      this.logger.log(
        'DataInitializer seeding is disabled via environment flag (SKIP_DB_INIT=true / SKIP_DATA_INITIALIZER=true). Schema patched safely; skipping data seeding to protect production DB.',
      );
      return;
    }

    // Step 2: Database sequence healing and content catalog seeding
    await runStep('healSequences', () => this.healSequences());
    await runStep('seedPermissionsAndRoles', () => this.seedPermissionsAndRoles());
    await runStep('seedLanguages', () => this.seedLanguages());
    await runStep('seedGenresAndContentTypes', () => this.seedGenresAndContentTypes());
    await runStep('seedCategoriesAndPages', () => this.seedCategoriesAndPages());
    await runStep('seedPlansAndDrm', () => this.seedPlansAndDrm());
    await runStep('seedLegalPages', () => this.seedLegalPages());
    await runStep('seedSuperAdmin', () => this.seedSuperAdmin());
    await runStep('seedAdMonetizationDefaults', () => this.seedAdMonetizationDefaults());

    this.logger.log('Database initialization, index verification, and baseline seeding completed.');
  }

  /**
   * Unconditionally guarantees all ad and monetization tables exist.
   */
  private async ensureAdMonetizationTables(): Promise<void> {
    try {
      await this.dataSource.query(`
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
    } catch (err: any) {
      this.logger.warn(`Could not verify ad tables: ${err.message}`);
    }
  }

  /**
   * Applies schema column adjustments and synchronization non-destructively.
   */
  private async applySchemaFixesAndPatches(): Promise<void> {
    try {
      await this.dataSource.query(`
        ALTER TABLE plans ADD COLUMN IF NOT EXISTS single_use_only BOOLEAN DEFAULT FALSE;
        ALTER TABLE plans ADD COLUMN IF NOT EXISTS razorpay_plan_id VARCHAR(100);
        ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_autopay_eligible BOOLEAN DEFAULT FALSE;
        ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(100);
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS autopay_enabled BOOLEAN DEFAULT FALSE;
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(100);
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_gateway_sub_id VARCHAR(500);
      `);
    } catch (err: any) {
      this.logger.warn(`Could not patch plans/orders/subscriptions columns: ${err.message}`);
    }

    try {
      await this.dataSource.query(`
        ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_kids_profile BOOLEAN DEFAULT FALSE;
      `);
    } catch (err: any) {
      this.logger.warn(`Could not patch profiles: ${err.message}`);
    }

    try {
      await this.dataSource.query(`
        ALTER TABLE pages ALTER COLUMN name DROP NOT NULL;
        ALTER TABLE pages ALTER COLUMN title DROP NOT NULL;
        UPDATE pages SET name = COALESCE(name, title), title = COALESCE(title, name) WHERE name IS NULL OR title IS NULL;
      `);
    } catch (err: any) {
      this.logger.warn(`Could not patch pages: ${err.message}`);
    }

    try {
      await this.dataSource.query(`
        ALTER TABLE devices ALTER COLUMN platform SET DEFAULT 'ANDROID';
        ALTER TABLE devices ALTER COLUMN platform DROP NOT NULL;
      `);
    } catch (err: any) {
      this.logger.warn(`Could not patch devices: ${err.message}`);
    }

    try {
      await this.dataSource.query(`
        ALTER TABLE payment_orders ALTER COLUMN order_id DROP NOT NULL;
        ALTER TABLE payment_orders ALTER COLUMN provider_order_id DROP NOT NULL;
        ALTER TABLE payment_orders ALTER COLUMN order_id SET DEFAULT ('order_' || substr(md5(random()::text), 1, 16));
        ALTER TABLE payment_orders ALTER COLUMN amount DROP NOT NULL;
        ALTER TABLE payment_orders ALTER COLUMN amount SET DEFAULT 0;
        ALTER TABLE payment_orders ALTER COLUMN final_amount DROP NOT NULL;
        ALTER TABLE payment_orders ALTER COLUMN final_amount SET DEFAULT 0;
        ALTER TABLE payment_orders ALTER COLUMN original_amount DROP NOT NULL;
        ALTER TABLE payment_orders ALTER COLUMN original_amount SET DEFAULT 0;
        UPDATE payments p
        SET 
          user_id = COALESCE(p.user_id, o.user_id),
          provider = COALESCE(p.provider, o.provider, 'RAZORPAY')
        FROM payment_orders o
        WHERE p.payment_order_id = o.id
          AND (p.user_id IS NULL OR p.provider IS NULL);

        -- Activate any paid subscription orders that were missing a subscription row
        INSERT INTO subscriptions (user_id, plan_id, status, start_date, end_date, auto_renew, payment_id, created_at, updated_at)
        SELECT 
          p.user_id, 
          COALESCE(o.plan_id, (SELECT id FROM plans WHERE is_active = true ORDER BY price ASC LIMIT 1)),
          'ACTIVE',
          COALESCE(p.paid_at, p.created_at, NOW()),
          COALESCE(p.paid_at, p.created_at, NOW()) + INTERVAL '30 days',
          false,
          p.id::text,
          NOW(),
          NOW()
        FROM payments p
        JOIN payment_orders o ON p.payment_order_id = o.id
        WHERE p.status = 'SUCCESS'
          AND o.order_type = 'SUBSCRIPTION'
          AND p.user_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM subscriptions s WHERE s.user_id = p.user_id AND s.status = 'ACTIVE' AND s.end_date > NOW()
          );
      `);
    } catch (err: any) {
      this.logger.warn(`Could not patch payment orders/subscriptions: ${err.message}`);
    }

    try {
      if (process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_SECRET) {
        await this.dataSource.query(`
          ${process.env.RAZORPAY_KEY_ID ? `
          INSERT INTO system_settings (setting_key, setting_value, setting_group, description, is_secret, is_public)
          VALUES ('RAZORPAY_KEY_ID', '${process.env.RAZORPAY_KEY_ID.replace(/'/g, "''")}', 'PAYMENT', 'Razorpay Key ID', false, true)
          ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;
          ` : ''}
          ${process.env.RAZORPAY_KEY_SECRET ? `
          INSERT INTO system_settings (setting_key, setting_value, setting_group, description, is_secret, is_public)
          VALUES ('RAZORPAY_KEY_SECRET', '${process.env.RAZORPAY_KEY_SECRET.replace(/'/g, "''")}', 'PAYMENT', 'Razorpay Key Secret', true, false)
          ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;
          ` : ''}
        `);
      }
    } catch (err: any) {
      this.logger.warn(`Could not sync Razorpay system settings: ${err.message}`);
    }
  }

  private async runMigrationsAndIndexes(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      const existingTables = await queryRunner.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contents'`,
      );
      if (!existingTables || existingTables.length === 0) {
        this.logger.log('Empty PostgreSQL database detected — bootstrapping baseline schema tables...');
        await this.dataSource.synchronize(false);
      }
      const migration = new BaselineSchemaAndIndexes1730000000000();
      await migration.up(queryRunner);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Mirrors Spring Boot DataInitializer sequence healing across PostgreSQL serial/identity columns.
   */
  private async healSequences(): Promise<void> {
    const tablesWithNumericId = [
      'roles',
      'permissions',
      'genres',
      'content_types',
      'categories',
      'persons',
      'content_cast',
      'contents',
      'seasons',
      'episodes',
      'media_assets',
      'pages',
      'sections',
      'section_items',
      'banners',
      'live_channels',
      'live_events',
      'legal_pages',
      'users',
      'profiles',
      'drm_rules',
      'plans',
      'subscriptions',
      'coupons',
      'tvod_products',
      'content_purchases',
      'payment_orders',
      'payments',
      'ad_providers',
      'ad_placements',
      'ad_rules',
      'ad_sessions',
      'ad_events',
      'ad_revenue',
      'producer_ad_revenue',
      'ad_campaigns',
      'playback_sessions',
      'watch_history',
      'watchlist',
      'notifications',
      'user_notifications',
      'user_interactions',
      'producer_profiles',
      'audit_logs',
      'outbox_events',
    ];

    for (const table of tablesWithNumericId) {
      try {
        await this.dataSource.query(`
          DO $$
          DECLARE
            seq_name TEXT;
          BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '${table}') THEN
              seq_name := pg_get_serial_sequence('${table}', 'id');
              IF seq_name IS NOT NULL THEN
                EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(id) FROM %I), 0) + 1, false)', seq_name, '${table}');
              END IF;
            END IF;
          END $$;
        `);
      } catch {
        // Ignore tables without serial sequences
      }
    }
  }

  private async seedPermissionsAndRoles(): Promise<void> {
    const permRepo = this.dataSource.getRepository(Permission);
    const roleRepo = this.dataSource.getRepository(Role);

    const defaultPermissions = [
      { name: 'DASHBOARD_VIEW', module: 'DASHBOARD', description: 'View analytics dashboard' },
      { name: 'CONTENT_VIEW', module: 'CONTENT', description: 'View movies, series, and episodes' },
      { name: 'CONTENT_CREATE', module: 'CONTENT', description: 'Create movies, series, and episodes' },
      { name: 'CONTENT_EDIT', module: 'CONTENT', description: 'Edit movies, series, and episodes' },
      { name: 'CONTENT_DELETE', module: 'CONTENT', description: 'Delete movies, series, and episodes' },
      { name: 'CMS_MANAGE', module: 'CMS', description: 'Manage pages, sections, and banners' },
      { name: 'USER_VIEW', module: 'USERS', description: 'View platform users' },
      { name: 'USER_MANAGE', module: 'USERS', description: 'Create, update, block, or delete users' },
      { name: 'PLAN_MANAGE', module: 'SUBSCRIPTIONS', description: 'Manage subscription plans and coupons' },
      { name: 'PAYMENT_VIEW', module: 'PAYMENTS', description: 'View transactions and payment analytics' },
      { name: 'PAYMENT_REFUND', module: 'PAYMENTS', description: 'Initiate payment refunds' },
      { name: 'PRODUCER_MANAGE', module: 'PRODUCERS', description: 'Manage external content producers and KYC' },
      { name: 'AD_MANAGE', module: 'ADVERTISEMENTS', description: 'Manage VAST ad campaigns' },
      { name: 'NOTIFICATION_SEND', module: 'NOTIFICATIONS', description: 'Broadcast push, SMS, WhatsApp, and email notifications' },
      { name: 'SETTINGS_MANAGE', module: 'SETTINGS', description: 'Manage global system settings and storage' },
      { name: 'SECURITY_MANAGE', module: 'SECURITY', description: 'Manage RBAC roles, permissions, and DRM rules' },
    ];

    const savedPermissions: Permission[] = [];
    for (const p of defaultPermissions) {
      let existing = await permRepo.findOne({ where: { name: p.name } });
      if (!existing) {
        existing = await permRepo.save(permRepo.create(p));
      }
      savedPermissions.push(existing);
    }

    const defaultRoles = [
      {
        name: 'ROLE_SUPER_ADMIN',
        description: 'Full unrestricted administrative access',
        isSystemRole: true,
        permissions: savedPermissions,
      },
      {
        name: 'ROLE_ADMIN',
        description: 'Administrative access across content, users, and operations',
        isSystemRole: true,
        permissions: savedPermissions,
      },
      {
        name: 'ROLE_CONTENT_MANAGER',
        description: 'Manages movies, series, CMS, and master data',
        isSystemRole: true,
        permissions: savedPermissions.filter((p) =>
          ['DASHBOARD_VIEW', 'CONTENT_VIEW', 'CONTENT_CREATE', 'CONTENT_EDIT', 'CMS_MANAGE'].includes(p.name),
        ),
      },
      {
        name: 'ROLE_PRODUCER',
        description: 'External content producer studio portal access',
        isSystemRole: true,
        permissions: savedPermissions.filter((p) => ['CONTENT_VIEW', 'CONTENT_CREATE'].includes(p.name)),
      },
      {
        name: 'ROLE_USER',
        description: 'Standard OTT viewer account',
        isSystemRole: true,
        permissions: [],
      },
    ];

    for (const r of defaultRoles) {
      let existing = await roleRepo.findOne({ where: { name: r.name }, relations: ['permissions'] });
      if (!existing) {
        await roleRepo.save(roleRepo.create(r));
      } else if (r.name === 'ROLE_SUPER_ADMIN' && (!existing.permissions || existing.permissions.length === 0)) {
        existing.permissions = savedPermissions;
        await roleRepo.save(existing);
      }
    }
  }

  private async seedLanguages(): Promise<void> {
    const langRepo = this.dataSource.getRepository(Language);
    const defaultLanguages = [
      { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', isDefault: true, isActive: true, displayOrder: 1 },
      { code: 'en', name: 'English', nativeName: 'English', isDefault: false, isActive: true, displayOrder: 2 },
      { code: 'bho', name: 'Bhojpuri', nativeName: 'भोजपुरी', isDefault: false, isActive: true, displayOrder: 3 },
      { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', isDefault: false, isActive: true, displayOrder: 4 },
      { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', isDefault: false, isActive: true, displayOrder: 5 },
      { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', isDefault: false, isActive: true, displayOrder: 6 },
      { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', isDefault: false, isActive: true, displayOrder: 7 },
      { code: 'mr', name: 'Marathi', nativeName: 'मराठी', isDefault: false, isActive: true, displayOrder: 8 },
      { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', isDefault: false, isActive: true, displayOrder: 9 },
      { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', isDefault: false, isActive: true, displayOrder: 10 },
      { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', isDefault: false, isActive: true, displayOrder: 11 },
    ];

    for (const l of defaultLanguages) {
      const existing = await langRepo.findOne({ where: { code: l.code } });
      if (!existing) {
        await langRepo.save(langRepo.create(l));
      }
    }
  }

  private async seedGenresAndContentTypes(): Promise<void> {
    const genreRepo = this.dataSource.getRepository(Genre);
    const count = await genreRepo.count();
    if (count === 0) {
      const genres = [
        { name: 'Action', slug: 'action', isActive: true },
        { name: 'Drama', slug: 'drama', isActive: true },
        { name: 'Comedy', slug: 'comedy', isActive: true },
        { name: 'Thriller', slug: 'thriller', isActive: true },
        { name: 'Romance', slug: 'romance', isActive: true },
        { name: 'Horror', slug: 'horror', isActive: true },
        { name: 'Crime', slug: 'crime', isActive: true },
        { name: 'Devotional', slug: 'devotional', isActive: true },
        { name: 'Family', slug: 'family', isActive: true },
      ];
      for (const g of genres) {
        await genreRepo.save(genreRepo.create(g));
      }
    }

    const typeRepo = this.dataSource.getRepository(ContentType);
    const typeCount = await typeRepo.count();
    if (typeCount === 0) {
      const types = [
        { name: 'Movie', slug: 'movie', isActive: true, displayOrder: 1 },
        { name: 'Web Series', slug: 'series', isActive: true, displayOrder: 2 },
        { name: 'Short Film', slug: 'short-film', isActive: true, displayOrder: 3 },
        { name: 'Music Video', slug: 'music-video', isActive: true, displayOrder: 4 },
        { name: 'Live TV', slug: 'live', isActive: true, displayOrder: 5 },
      ];
      for (const t of types) {
        await typeRepo.save(typeRepo.create(t));
      }
    }
  }

  private async seedCategoriesAndPages(): Promise<void> {
    const catRepo = this.dataSource.getRepository(Category);
    if ((await catRepo.count()) === 0) {
      const categories = [
        { name: 'Trending Now', slug: 'trending-now', displayOrder: 1, isActive: true },
        { name: 'New Releases', slug: 'new-releases', displayOrder: 2, isActive: true },
        { name: 'Maxx Originals', slug: 'maxx-originals', displayOrder: 3, isActive: true },
        { name: 'Blockbuster Movies', slug: 'blockbuster-movies', displayOrder: 4, isActive: true },
      ];
      for (const c of categories) {
        await catRepo.save(catRepo.create(c));
      }
    }

    const pageRepo = this.dataSource.getRepository(Page);
    if ((await pageRepo.count()) === 0) {
      const pages = [
        { slug: 'home', name: 'Home', title: 'Home', isActive: true, displayOrder: 1 },
        { slug: 'movies', name: 'Movies', title: 'Movies', isActive: true, displayOrder: 2 },
        { slug: 'series', name: 'Web Series', title: 'Web Series', isActive: true, displayOrder: 3 },
        { slug: 'free', name: 'Watch Free', title: 'Watch Free', isActive: true, displayOrder: 4 },
      ];
      for (const p of pages) {
        await pageRepo.save(pageRepo.create(p));
      }
    }
  }

  private async seedPlansAndDrm(): Promise<void> {
    const planRepo = this.dataSource.getRepository(Plan);
    if ((await planRepo.count()) === 0) {
      const plans = [
        {
          name: 'Mobile Monthly',
          description: 'Watch on 1 mobile screen in HD (720p)',
          price: 99,
          discountPrice: 99,
          currency: 'INR',
          durationDays: 30,
          billingCycle: 'MONTHLY',
          maxConcurrentStreams: 1,
          maxDevices: 2,
          maxProfiles: 2,
          maxVideoQuality: 'HD_720P',
          hasAds: true,
          allowDownloads: true,
          isPopular: false,
          isActive: true,
        },
        {
          name: 'Super Quarterly',
          description: 'Watch on 2 screens in Full HD (1080p) across TV, Web & Mobile',
          price: 299,
          discountPrice: 249,
          currency: 'INR',
          durationDays: 90,
          billingCycle: 'QUARTERLY',
          maxConcurrentStreams: 2,
          maxDevices: 5,
          maxProfiles: 4,
          maxVideoQuality: 'FHD_1080P',
          hasAds: false,
          allowDownloads: true,
          isPopular: true,
          isActive: true,
        },
        {
          name: 'Premium Annual VIP',
          description: 'Watch on 4 screens simultaneously in 4K Ultra HD + Dolby Atmos, Ad-Free',
          price: 999,
          discountPrice: 699,
          currency: 'INR',
          durationDays: 365,
          billingCycle: 'YEARLY',
          maxConcurrentStreams: 4,
          maxDevices: 10,
          maxProfiles: 5,
          maxVideoQuality: 'UHD_4K',
          hasAds: false,
          allowDownloads: true,
          isPopular: true,
          isActive: true,
        },
      ];
      for (const pl of plans) {
        await planRepo.save(planRepo.create(pl));
      }
    }

    const drmRepo = this.dataSource.getRepository(DrmRule);
    if ((await drmRepo.count()) === 0) {
      await drmRepo.save(
        drmRepo.create({
          name: 'Default Widevine + FairPlay Policy',
          provider: 'BUNNY_MEDIA_CAGE',
          securityLevel: 'L1',
          hdcpLevel: 'HDCP_2_2',
          persistentLicense: false,
          licenseDurationSeconds: 86400,
          playbackDurationSeconds: 14400,
          blockScreenRecording: true,
          blockRootedDevices: true,
          dynamicWatermarking: true,
          concurrentStreamLimit: 2,
          isActive: true,
        }),
      );
    }
  }

  private async seedLegalPages(): Promise<void> {
    const legalRepo = this.dataSource.getRepository(LegalPage);
    if ((await legalRepo.count()) === 0) {
      const pages = [
        {
          slug: 'privacy-policy',
          title: 'Privacy Policy',
          content: '<h2>Privacy Policy</h2><p>MaxxPixels OTT respects your privacy and safeguards your personal data.</p>',
          version: '1.0',
          isActive: true,
        },
        {
          slug: 'terms-of-use',
          title: 'Terms & Conditions',
          content: '<h2>Terms of Use</h2><p>By using MaxxPixels OTT, you agree to these terms and conditions.</p>',
          version: '1.0',
          isActive: true,
        },
        {
          slug: 'refund-policy',
          title: 'Refund & Cancellation Policy',
          content: '<h2>Refund Policy</h2><p>Subscriptions and rentals are governed by our refund policy.</p>',
          version: '1.0',
          isActive: true,
        },
      ];
      for (const lp of pages) {
        await legalRepo.save(legalRepo.create(lp));
      }
    }
  }

  private async seedSuperAdmin(): Promise<void> {
    const userRepo = this.dataSource.getRepository(User);
    const roleRepo = this.dataSource.getRepository(Role);
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@maxxpixels.com';

    const existingAdmin = await userRepo.findOne({ where: { email: adminEmail } });
    if (!existingAdmin) {
      const superAdminRole = await roleRepo.findOne({ where: { name: 'ROLE_SUPER_ADMIN' } });
      const rawPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123456';
      const passwordHash = await bcrypt.hash(rawPassword, 10);

      await userRepo.save(
        userRepo.create({
          email: adminEmail,
          phone: '+919999999999',
          fullName: 'MaxxPixels Super Admin',
          passwordHash,
          status: 'ACTIVE',
          emailVerified: true,
          phoneVerified: true,
          roles: superAdminRole ? [superAdminRole] : [],
        }),
      );
      this.logger.log(`Default Super Admin account provisioned (${adminEmail})`);
    }
  }

  private async seedAdMonetizationDefaults(): Promise<void> {
    const providerRepo = this.dataSource.getRepository(AdProvider);
    const placementRepo = this.dataSource.getRepository(AdPlacement);
    const ruleRepo = this.dataSource.getRepository(AdRule);

    const providerCount = await providerRepo.count();
    if (providerCount === 0) {
      const providers = [
        {
          code: 'GAM',
          name: 'Google Ad Manager (GAM)',
          type: 'VIDEO_VAST' as any,
          networkCode: process.env.GAM_NETWORK_CODE || '21775744923',
          publisherId: 'pub-2191993313473081',
          isActive: true,
          isBiddingEnabled: true,
          status: 'ACTIVE' as any,
        },
        {
          code: 'ADMOB',
          name: 'Google Mobile Ads (AdMob)',
          type: 'MOBILE_SDK' as any,
          appId: 'ca-app-pub-2191993313473081~5839116549',
          publisherId: 'pub-2191993313473081',
          isActive: true,
          isBiddingEnabled: true,
          status: 'ACTIVE' as any,
        },
        {
          code: 'INMOBI',
          name: 'InMobi (Open Bidding & SDK)',
          type: 'OPEN_BIDDING' as any,
          accountId: 'b0e3f3a3b99e4ed7b9a82cd25cc59481',
          appId: '8839a620596f46169ed937f1568740db',
          isActive: true,
          isBiddingEnabled: true,
          status: 'ACTIVE' as any,
        },
        {
          code: 'DIRECT',
          name: 'Direct Advertiser Campaigns',
          type: 'DIRECT' as any,
          isActive: true,
          isBiddingEnabled: false,
          status: 'ACTIVE' as any,
        },
      ];
      for (const p of providers) {
        await providerRepo.save(providerRepo.create(p));
      }
      this.logger.log('Seeded default Ad Providers (GAM, AdMob, InMobi, Direct)');
    }

    const placementCount = await placementRepo.count();
    if (placementCount === 0) {
      const placements = [
        {
          code: 'PRE_ROLL_01',
          name: 'Pre-roll Video Ad',
          format: 'PRE_ROLL' as any,
          platform: 'ALL',
          cuePointSeconds: 0,
          maxDurationSeconds: 30,
          skipOffsetSeconds: 5,
          frequencyCapPerHour: 4,
          isActive: true,
        },
        {
          code: 'MID_ROLL_01',
          name: 'Mid-roll Video Break 1 (5m)',
          format: 'MID_ROLL' as any,
          platform: 'ALL',
          cuePointSeconds: 300,
          maxDurationSeconds: 30,
          skipOffsetSeconds: 5,
          frequencyCapPerHour: 4,
          isActive: true,
        },
        {
          code: 'MID_ROLL_02',
          name: 'Mid-roll Video Break 2 (10m)',
          format: 'MID_ROLL' as any,
          platform: 'ALL',
          cuePointSeconds: 600,
          maxDurationSeconds: 30,
          skipOffsetSeconds: 5,
          frequencyCapPerHour: 4,
          isActive: true,
        },
        {
          code: 'BANNER_HOME',
          name: 'Homepage Banner Ad',
          format: 'BANNER' as any,
          platform: 'ALL',
          cuePointSeconds: 0,
          maxDurationSeconds: 0,
          skipOffsetSeconds: 0,
          frequencyCapPerHour: 10,
          isActive: true,
        },
        {
          code: 'INTERSTITIAL_NAV',
          name: 'Navigation Interstitial Ad',
          format: 'INTERSTITIAL' as any,
          platform: 'MOBILE',
          cuePointSeconds: 0,
          maxDurationSeconds: 15,
          skipOffsetSeconds: 5,
          frequencyCapPerHour: 3,
          isActive: true,
        },
      ];
      for (const pl of placements) {
        await placementRepo.save(placementRepo.create(pl));
      }
      this.logger.log('Seeded default Ad Placements (Pre-roll, Mid-rolls, Banner, Interstitial)');
    }

    const ruleCount = await ruleRepo.count();
    if (ruleCount === 0) {
      const rules = [
        {
          name: 'Ad-Free for VIP Subscribers',
          ruleType: 'EXCLUDE_PREMIUM' as any,
          appliesTo: 'VIP_SUBSCRIBERS',
          targetCountry: 'IN',
          isActive: true,
        },
        {
          name: 'Ad-Free for TVOD Purchases',
          ruleType: 'EXCLUDE_TVOD' as any,
          appliesTo: 'RENTAL',
          targetCountry: 'IN',
          isActive: true,
        },
      ];
      for (const r of rules) {
        await ruleRepo.save(ruleRepo.create(r));
      }
      this.logger.log('Seeded default Ad Eligibility Rules (Exclude Premium, Exclude TVOD)');
    }
  }
}

