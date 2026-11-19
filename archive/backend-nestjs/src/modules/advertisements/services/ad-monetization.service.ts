import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { AdProvider, AdProviderStatus, AdProviderType } from '../entities/ad-provider.entity';
import { AdProviderConfig } from '../entities/ad-provider-config.entity';
import { AdPlacement, AdFormat } from '../entities/ad-placement.entity';
import { AdRule, AdRuleType } from '../entities/ad-rule.entity';
import { AdSession } from '../entities/ad-session.entity';
import { AdEvent, AdEventType } from '../entities/ad-event.entity';
import { AdRevenue } from '../entities/ad-revenue.entity';
import { ProducerAdRevenue } from '../entities/producer-ad-revenue.entity';
import { AdCampaign } from '../entities/ad-campaign.entity';
import { Content } from '../../content/entities/content.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';

@Injectable()
export class AdMonetizationService {
  private readonly logger = new Logger(AdMonetizationService.name);

  constructor(
    @InjectRepository(AdProvider)
    private readonly providerRepo: Repository<AdProvider>,
    @InjectRepository(AdProviderConfig)
    private readonly configRepo: Repository<AdProviderConfig>,
    @InjectRepository(AdPlacement)
    private readonly placementRepo: Repository<AdPlacement>,
    @InjectRepository(AdRule)
    private readonly ruleRepo: Repository<AdRule>,
    @InjectRepository(AdSession)
    private readonly sessionRepo: Repository<AdSession>,
    @InjectRepository(AdEvent)
    private readonly eventRepo: Repository<AdEvent>,
    @InjectRepository(AdRevenue)
    private readonly revenueRepo: Repository<AdRevenue>,
    @InjectRepository(ProducerAdRevenue)
    private readonly producerRevenueRepo: Repository<ProducerAdRevenue>,
    @InjectRepository(AdCampaign)
    private readonly campaignRepo: Repository<AdCampaign>,
    @InjectRepository(Content)
    private readonly contentRepo: Repository<Content>,
    @InjectRepository(Subscription)
    private readonly subRepo: Repository<Subscription>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Distinct viewers a title has accumulated (playback sessions, real users).
   * Cached 10 min in Redis — checked on every ad-config request.
   */
  async countUniqueViewers(contentId: number): Promise<number> {
    if (!contentId) return 0;
    const cacheKey = `ads:uniq:${contentId}`;
    try {
      const cached = await this.redisService.get<number>(cacheKey);
      if (cached !== null && cached !== undefined) return Number(cached);
    } catch {
      // cache miss is fine
    }
    let unique = 0;
    try {
      const rows: any[] = await this.sessionRepo.manager.query(
        `SELECT COUNT(DISTINCT user_id)::int AS uniq
         FROM playback_sessions
         WHERE content_id = $1 AND user_id IS NOT NULL`,
        [contentId],
      );
      unique = Number(rows?.[0]?.uniq || 0);
    } catch (e: any) {
      this.logger.warn(`Unique viewer count failed for content ${contentId}: ${e?.message}`);
    }
    await this.redisService.set(cacheKey, unique, 600).catch(() => undefined);
    return unique;
  }

  /** VAST ads serve only after the title reaches AD_MIN_UNIQUE_VIEWERS distinct viewers. */
  async hasAudienceForAds(contentId: number): Promise<{ eligible: boolean; uniqueViewers: number; required: number }> {
    const required = Number(process.env.AD_MIN_UNIQUE_VIEWERS || 1000);
    const uniqueViewers = await this.countUniqueViewers(contentId);
    return { eligible: uniqueViewers >= required, uniqueViewers, required };
  }

  /**
   * 1. Check Ad Eligibility & Generate Video Ad Config for Web & Mobile IMA Players
   */
  async getAdConfigForContent(
    contentId: number,
    userId?: number,
    deviceType = 'WEB',
    clientIp?: string,
  ): Promise<{
    eligible: boolean;
    reason?: string;
    sessionId: string;
    uniqueViewers?: number;
    requiredUniqueViewers?: number;
    gamTagUrl?: string;
    fallbackVastUrl?: string;
    inmobiBiddingEnabled: boolean;
    cuePoints: number[];
    skipOffsetSeconds: number;
    maxDurationSeconds: number;
  }> {
    const sessionToken = `ad-sess-${crypto.randomBytes(12).toString('hex')}`;

    // A. Check content existence
    const content = await this.contentRepo.findOne({ where: { id: contentId } });
    if (!content) {
      return {
        eligible: false,
        reason: 'CONTENT_NOT_FOUND',
        sessionId: sessionToken,
        inmobiBiddingEnabled: false,
        cuePoints: [],
        skipOffsetSeconds: 5,
        maxDurationSeconds: 30,
      };
    }

    // B. Subscription status policy: Ads are served for every user irrespective of subscription status

    // B2. Audience threshold: content is ad-eligible only after it has reached
    // AD_MIN_UNIQUE_VIEWERS (default 1000) DISTINCT viewers via playback sessions.
    const audience = await this.hasAudienceForAds(contentId);
    if (!audience.eligible) {
      return {
        eligible: false,
        reason: 'AUDIENCE_THRESHOLD_NOT_MET',
        uniqueViewers: audience.uniqueViewers,
        requiredUniqueViewers: audience.required,
        sessionId: sessionToken,
        inmobiBiddingEnabled: false,
        cuePoints: [],
        skipOffsetSeconds: 5,
        maxDurationSeconds: 30,
      };
    }

    // C. Check content-level ad rules
    const rules = await this.ruleRepo.find({ where: { isActive: true } });
    for (const rule of rules) {
      if (rule.ruleType === AdRuleType.EXCLUDE_CONTENT && rule.contentId === contentId) {
        return {
          eligible: false,
          reason: 'CONTENT_EXCLUDED_FROM_ADS',
          sessionId: sessionToken,
          inmobiBiddingEnabled: false,
          cuePoints: [],
          skipOffsetSeconds: 5,
          maxDurationSeconds: 30,
        };
      }
    }

    // D. Fetch active Ad Providers (GAM, InMobi, Direct)
    const gamProvider = await this.providerRepo.findOne({
      where: { code: 'GAM', isActive: true },
    });
    const inmobiProvider = await this.providerRepo.findOne({
      where: { code: 'INMOBI', isActive: true },
    });

    const networkCode =
      gamProvider?.networkCode || process.env.GAM_NETWORK_CODE || '21775744923';
    const inmobiBiddingEnabled = Boolean(
      inmobiProvider?.isActive && inmobiProvider?.isBiddingEnabled,
    );

    // E. Construct Dynamic Google Ad Manager Video Tag with Open Bidding params
    const correlator = Date.now();
    const cmsId = '2547631';
    const videoId = String(contentId);
    const customTargeting = `content_id%3D${contentId}%26device%3D${deviceType.toLowerCase()}%26inmobi_bid%3D${inmobiBiddingEnabled ? '1' : '0'}`;

    const gamTagUrl =
      process.env.GAM_CUSTOM_VIDEO_AD_TAG ||
      `https://pubads.g.doubleclick.net/gampad/ads?iu=/${networkCode}/video/maxxpixels&sz=640x480&ciu_szs=300x250%2C728x90&gdfp_req=1&env=vp&output=vmap&unviewed_position_start=1&type=js&cmsid=${cmsId}&vid=${videoId}&cust_params=${customTargeting}&correlator=${correlator}`;

    const publicBaseUrl = process.env.PUBLIC_BASE_URL || 'https://api.maxxpixels.com';
    const fallbackVastUrl = `${publicBaseUrl}/api/v1/ads/vast?contentId=${contentId}`;

    // F. Determine Cue Points from Placements
    const midrollPlacements = await this.placementRepo.find({
      where: { format: AdFormat.MID_ROLL, isActive: true },
    });
    const cuePoints = midrollPlacements
      .map((p) => p.cuePointSeconds)
      .filter((s) => s > 0)
      .sort((a, b) => a - b);

    // Save ad session record
    await this.sessionRepo.save({
      sessionToken,
      userId,
      contentId,
      deviceType,
      ipAddress: clientIp,
      adTagUrl: gamTagUrl,
      isEligible: true,
    });

    return {
      eligible: true,
      sessionId: sessionToken,
      gamTagUrl,
      fallbackVastUrl,
      inmobiBiddingEnabled,
      cuePoints: cuePoints.length > 0 ? cuePoints : [300, 600, 900], // fallback 5m, 10m, 15m
      skipOffsetSeconds: 5,
      maxDurationSeconds: 30,
    };
  }

  /**
   * 2. Initialize Ad Playback Session
   */
  async createAdSession(body: {
    contentId: number;
    episodeId?: number;
    deviceType?: string;
    userId?: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ sessionId: string; sessionToken: string }> {
    const sessionToken = `ad-sess-${crypto.randomBytes(12).toString('hex')}`;
    const session = this.sessionRepo.create({
      sessionToken,
      userId: body.userId,
      contentId: body.contentId,
      episodeId: body.episodeId,
      deviceType: body.deviceType || 'WEB',
      ipAddress: body.ipAddress,
      userAgent: body.userAgent,
      isEligible: true,
    });
    await this.sessionRepo.save(session);
    return { sessionId: sessionToken, sessionToken };
  }

  /**
   * 3. Idempotent Ad Event Tracking & Quartile Progress
   */
  async recordAdEvent(body: {
    sessionId?: string;
    sessionToken?: string;
    campaignId?: number;
    providerCode?: string;
    eventType: AdEventType;
    contentId?: number;
    producerId?: number;
    metadata?: any;
  }): Promise<{ success: boolean; recorded: boolean }> {
    const token = body.sessionToken || body.sessionId || 'default-session';
    const eventType = body.eventType || AdEventType.IMPRESSION;
    const campaignId = body.campaignId ? Number(body.campaignId) : null;
    const providerCode = body.providerCode || 'GAM';

    // Unique deduplication hash to prevent duplicate billing & impression fraud
    const dedupRaw = `${token}_${eventType}_${campaignId || 0}_${providerCode}`;
    const dedupKey = crypto.createHash('sha256').update(dedupRaw).digest('hex').substring(0, 32);

    try {
      // Check if duplicate event exists
      const existing = await this.eventRepo.findOne({ where: { dedupKey } });
      if (existing) {
        return { success: true, recorded: false }; // Idempotent ack
      }

      // Calculate estimated revenue in paise (e.g. ₹0.30 per completed view = 30 paise)
      let revenuePaise = 0;
      if (eventType === AdEventType.COMPLETE || eventType === AdEventType.IMPRESSION) {
        revenuePaise = 25; // 25 paise base per valid ad impression
      }

      // Find content producer if not provided
      let producerId = body.producerId;
      if (!producerId && body.contentId) {
        const content = await this.contentRepo.findOne({ where: { id: body.contentId } });
        producerId = content?.producerId ? Number(content.producerId) : null;
      }

      await this.eventRepo.save({
        sessionToken: token,
        campaignId,
        providerCode,
        eventType,
        contentId: body.contentId,
        producerId,
        dedupKey,
        revenuePaise,
        metadata: body.metadata ? JSON.stringify(body.metadata) : undefined,
      });

      // Update aggregate revenue metrics
      if (body.contentId && (eventType === AdEventType.IMPRESSION || eventType === AdEventType.COMPLETE)) {
        await this.incrementDailyRevenue(providerCode, body.contentId, revenuePaise / 100);
        if (producerId) {
          await this.incrementProducerRevenue(producerId, body.contentId, revenuePaise / 100);
        }
      }

      return { success: true, recorded: true };
    } catch (err: any) {
      if (err.code === '23505') {
        // Postgres unique violation - duplicate safely acknowledged
        return { success: true, recorded: false };
      }
      this.logger.error(`Error recording ad event: ${err.message}`);
      return { success: false, recorded: false };
    }
  }

  /**
   * 4. Aggregate Daily Content Ad Revenue
   */
  private async incrementDailyRevenue(
    providerCode: string,
    contentId: number,
    amountRupees: number,
  ): Promise<void> {
    const today = new Date().toISOString().substring(0, 10);
    let rev = await this.revenueRepo.findOne({
      where: { providerCode, contentId, date: today },
    });
    if (!rev) {
      rev = this.revenueRepo.create({
        providerCode,
        contentId,
        date: today,
        impressionsCount: 1,
        completedViewsCount: 1,
        clicksCount: 0,
        grossRevenue: amountRupees,
        netRevenue: amountRupees * 0.95, // 5% ad serving fee deduction
        currency: 'INR',
        status: 'ESTIMATED',
      });
    } else {
      rev.impressionsCount = Number(rev.impressionsCount) + 1;
      rev.completedViewsCount = Number(rev.completedViewsCount) + 1;
      rev.grossRevenue = Number(rev.grossRevenue) + amountRupees;
      rev.netRevenue = Number(rev.netRevenue) + amountRupees * 0.95;
    }
    await this.revenueRepo.save(rev);
  }

  /**
   * 5. Producer Revenue Attribution: Contractual 60% Producer / 40% MaxxPixels Split
   */
  private async incrementProducerRevenue(
    producerId: number,
    contentId: number,
    amountRupees: number,
  ): Promise<void> {
    const billingPeriod = new Date().toISOString().substring(0, 7); // 'YYYY-MM'
    const netRevenue = amountRupees * 0.95;
    const producerAmount = netRevenue * 0.6; // 60% Producer share
    const platformAmount = netRevenue * 0.4; // 40% MaxxPixels share

    let item = await this.producerRevenueRepo.findOne({
      where: { producerId, contentId, billingPeriod },
    });

    if (!item) {
      item = this.producerRevenueRepo.create({
        producerId,
        contentId,
        billingPeriod,
        totalImpressions: 1,
        grossRevenue: amountRupees,
        netRevenue,
        producerSharePercent: 60.0,
        producerAmount,
        platformSharePercent: 40.0,
        platformAmount,
        currency: 'INR',
        status: 'PENDING',
      });
    } else {
      item.totalImpressions = Number(item.totalImpressions) + 1;
      item.grossRevenue = Number(item.grossRevenue) + amountRupees;
      item.netRevenue = Number(item.netRevenue) + netRevenue;
      item.producerAmount = Number(item.producerAmount) + producerAmount;
      item.platformAmount = Number(item.platformAmount) + platformAmount;
    }
    await this.producerRevenueRepo.save(item);
  }

  /**
   * 6. Analytics & Revenue Queries
   */
  async getAdRevenueSummary(period?: string): Promise<any> {
    const qb = this.revenueRepo.createQueryBuilder('rev');
    if (period) {
      qb.where('rev.date LIKE :period', { period: `${period}%` });
    }
    const list = await qb.orderBy('rev.date', 'DESC').take(100).getMany();

    const totalImpressions = list.reduce((sum, r) => sum + Number(r.impressionsCount), 0);
    const totalGrossRevenue = list.reduce((sum, r) => sum + Number(r.grossRevenue), 0);
    const totalNetRevenue = list.reduce((sum, r) => sum + Number(r.netRevenue), 0);
    const avgEcpm =
      totalImpressions > 0 ? (totalGrossRevenue / totalImpressions) * 1000 : 0;

    return {
      period: period || 'ALL_TIME',
      totalImpressions,
      totalGrossRevenue,
      totalNetRevenue,
      avgEcpm,
      currency: 'INR',
      records: list,
    };
  }

  /**
   * 7. Producer Revenue Settlement Reporting (60/40 Split)
   */
  async getProducerRevenueReport(producerId?: number, period?: string): Promise<any> {
    const qb = this.producerRevenueRepo.createQueryBuilder('pRev');
    if (producerId) {
      qb.andWhere('pRev.producerId = :producerId', { producerId });
    }
    if (period) {
      qb.andWhere('pRev.billingPeriod = :period', { period });
    }

    const list = await qb.orderBy('pRev.billingPeriod', 'DESC').take(100).getMany();

    const totalImpressions = list.reduce((s, r) => s + Number(r.totalImpressions), 0);
    const totalNetRevenue = list.reduce((s, r) => s + Number(r.netRevenue), 0);
    const totalProducerAmount = list.reduce((s, r) => s + Number(r.producerAmount), 0);
    const totalPlatformAmount = list.reduce((s, r) => s + Number(r.platformAmount), 0);

    return {
      producerSharePercent: 60.0,
      platformSharePercent: 40.0,
      totalImpressions,
      totalNetRevenue,
      totalProducerPayout: totalProducerAmount,
      totalPlatformRetained: totalPlatformAmount,
      currency: 'INR',
      statements: list,
    };
  }

  /**
   * 8. Ad Provider Management
   */
  async listProviders(): Promise<AdProvider[]> {
    return this.providerRepo.find({ relations: ['configurations'] });
  }

  async upsertProvider(body: any, id?: number): Promise<AdProvider> {
    let provider = id ? await this.providerRepo.findOne({ where: { id } }) : null;
    if (!provider) {
      provider = this.providerRepo.create({
        code: body.code,
        name: body.name,
        type: body.type || AdProviderType.VIDEO_VAST,
        networkCode: body.networkCode,
        publisherId: body.publisherId,
        appId: body.appId,
        accountId: body.accountId,
        isActive: body.isActive !== undefined ? body.isActive : true,
        isBiddingEnabled: body.isBiddingEnabled || false,
        status: body.status || AdProviderStatus.ACTIVE,
      });
    } else {
      Object.assign(provider, {
        name: body.name || provider.name,
        networkCode: body.networkCode !== undefined ? body.networkCode : provider.networkCode,
        publisherId: body.publisherId !== undefined ? body.publisherId : provider.publisherId,
        appId: body.appId !== undefined ? body.appId : provider.appId,
        accountId: body.accountId !== undefined ? body.accountId : provider.accountId,
        isActive: body.isActive !== undefined ? body.isActive : provider.isActive,
        isBiddingEnabled:
          body.isBiddingEnabled !== undefined ? body.isBiddingEnabled : provider.isBiddingEnabled,
        status: body.status || provider.status,
      });
    }
    return this.providerRepo.save(provider);
  }

  /**
   * 9. Ad Placement Management
   */
  async listPlacements(): Promise<AdPlacement[]> {
    return this.placementRepo.find({ order: { cuePointSeconds: 'ASC' } });
  }

  async upsertPlacement(body: any, id?: number): Promise<AdPlacement> {
    let placement = id ? await this.placementRepo.findOne({ where: { id } }) : null;
    if (!placement) {
      placement = this.placementRepo.create(body as Partial<AdPlacement>);
    } else {
      Object.assign(placement, body);
    }
    return this.placementRepo.save(placement);
  }

  /**
   * 10. Content Ad Performance & VAST Plays Analytics
   */
  async getContentAdAnalytics(): Promise<{
    summary: {
      totalContentsWithAds: number;
      totalImpressions: number;
      totalWebImpressions: number;
      totalMobileImpressions: number;
      totalCompletes: number;
      totalEstimatedRevenueInr: number;
    };
    contents: Array<{
      contentId: number;
      title: string;
      contentType: string;
      posterUrl: string;
      totalAdEvents: number;
      totalImpressions: number;
      webImpressions: number;
      mobileImpressions: number;
      totalStarts: number;
      totalFirstQuartiles: number;
      totalMidpoints: number;
      totalThirdQuartiles: number;
      totalCompletes: number;
      totalClicks: number;
      totalSkips: number;
      uniqueAdSessions: number;
      estimatedRevenueInr: number;
      providers: string[];
      platforms: string[];
      lastAdPlayedAt: Date | string | null;
    }>;
    recentPlays: Array<{
      id: number;
      sessionToken: string;
      providerCode: string;
      eventType: string;
      revenuePaise: number;
      createdAt: Date;
      platform: string;
      contentId: number;
      contentTitle: string;
      contentType: string;
      posterUrl: string;
    }>;
  }> {
    const contentsQuery = `
      SELECT 
        c.id AS content_id,
        c.title,
        c.type AS content_type,
        c.poster_url,
        COUNT(e.id)::int AS total_ad_events,
        COUNT(CASE WHEN e.event_type = 'IMPRESSION' THEN 1 END)::int AS total_impressions,
        COUNT(CASE WHEN e.event_type = 'IMPRESSION' AND (e.device_type = 'WEB' OR e.metadata ILIKE '%device%WEB%') THEN 1 END)::int AS web_impressions,
        COUNT(CASE WHEN e.event_type = 'IMPRESSION' AND (e.device_type != 'WEB' AND (e.metadata IS NULL OR e.metadata NOT ILIKE '%device%WEB%')) THEN 1 END)::int AS mobile_impressions,
        COUNT(CASE WHEN e.event_type = 'START' THEN 1 END)::int AS total_starts,
        COUNT(CASE WHEN e.event_type = 'FIRST_QUARTILE' THEN 1 END)::int AS total_first_quartiles,
        COUNT(CASE WHEN e.event_type = 'MIDPOINT' THEN 1 END)::int AS total_midpoints,
        COUNT(CASE WHEN e.event_type = 'THIRD_QUARTILE' THEN 1 END)::int AS total_third_quartiles,
        COUNT(CASE WHEN e.event_type = 'COMPLETE' THEN 1 END)::int AS total_completes,
        COUNT(CASE WHEN e.event_type = 'CLICK' THEN 1 END)::int AS total_clicks,
        COUNT(CASE WHEN e.event_type = 'SKIP' THEN 1 END)::int AS total_skips,
        COUNT(DISTINCT e.session_token)::int AS unique_ad_sessions,
        ROUND(COALESCE(SUM(e.revenue_paise), 0) / 100.0, 2)::float AS estimated_revenue_inr,
        ARRAY_AGG(DISTINCT e.provider_code) FILTER (WHERE e.provider_code IS NOT NULL) AS providers,
        ARRAY_AGG(DISTINCT CASE WHEN e.device_type = 'WEB' OR e.metadata ILIKE '%device%WEB%' THEN 'WEB' ELSE 'MOBILE' END) AS platforms,
        MAX(e.created_at) AS last_ad_played_at
      FROM (
        SELECT 
          COALESCE(ev.content_id, ses.content_id) AS resolved_content_id,
          ev.id,
          ev.event_type,
          ev.session_token,
          ev.revenue_paise,
          ev.created_at,
          ev.provider_code,
          ev.metadata,
          COALESCE(ses.device_type, 'WEB') AS device_type
        FROM ad_events ev
        LEFT JOIN ad_sessions ses ON ev.session_token = ses.session_token
      ) e
      JOIN contents c ON e.resolved_content_id = c.id
      GROUP BY c.id, c.title, c.type, c.poster_url
      ORDER BY total_impressions DESC, last_ad_played_at DESC
    `;

    const recentQuery = `
      SELECT 
        ev.id,
        ev.session_token,
        ev.provider_code,
        ev.event_type,
        ev.revenue_paise,
        ev.created_at,
        CASE 
          WHEN ev.metadata ILIKE '%device%MOBILE%' OR ev.metadata ILIKE '%android%' OR ses.device_type ILIKE '%mobile%' OR ses.device_type ILIKE '%android%' THEN 'MOBILE'
          ELSE 'WEB'
        END AS platform,
        c.id AS content_id,
        c.title AS content_title,
        c.type AS content_type,
        c.poster_url
      FROM ad_events ev
      LEFT JOIN ad_sessions ses ON ev.session_token = ses.session_token
      LEFT JOIN contents c ON COALESCE(ev.content_id, ses.content_id) = c.id
      ORDER BY ev.created_at DESC
      LIMIT 50
    `;

    try {
      const [contentsRaw, recentRaw] = await Promise.all([
        this.eventRepo.query(contentsQuery),
        this.eventRepo.query(recentQuery),
      ]);

      const contents = (contentsRaw || []).map((row: any) => ({
        contentId: Number(row.content_id),
        title: row.title,
        contentType: row.content_type || 'VIDEO',
        posterUrl: row.poster_url,
        totalAdEvents: Number(row.total_ad_events || 0),
        totalImpressions: Number(row.total_impressions || 0),
        webImpressions: Number(row.web_impressions || 0),
        mobileImpressions: Number(row.mobile_impressions || 0),
        totalStarts: Number(row.total_starts || 0),
        totalFirstQuartiles: Number(row.total_first_quartiles || 0),
        totalMidpoints: Number(row.total_midpoints || 0),
        totalThirdQuartiles: Number(row.total_third_quartiles || 0),
        totalCompletes: Number(row.total_completes || 0),
        totalClicks: Number(row.total_clicks || 0),
        totalSkips: Number(row.total_skips || 0),
        uniqueAdSessions: Number(row.unique_ad_sessions || 0),
        estimatedRevenueInr: Number(row.estimated_revenue_inr || 0),
        providers: Array.isArray(row.providers) ? row.providers : [],
        platforms: Array.isArray(row.platforms) ? row.platforms : ['WEB'],
        lastAdPlayedAt: row.last_ad_played_at,
      }));

      const recentPlays = (recentRaw || []).map((row: any) => ({
        id: Number(row.id),
        sessionToken: row.session_token,
        providerCode: row.provider_code || 'GAM',
        eventType: row.event_type,
        revenuePaise: Number(row.revenue_paise || 0),
        createdAt: row.created_at,
        platform: row.platform || 'WEB',
        contentId: Number(row.content_id || 0),
        contentTitle: row.content_title || 'Unknown Title',
        contentType: row.content_type || 'VIDEO',
        posterUrl: row.poster_url,
      }));

      const totalContentsWithAds = contents.length;
      const totalImpressions = contents.reduce((sum, c) => sum + c.totalImpressions, 0);
      const totalWebImpressions = contents.reduce((sum, c) => sum + c.webImpressions, 0);
      const totalMobileImpressions = contents.reduce((sum, c) => sum + c.mobileImpressions, 0);
      const totalCompletes = contents.reduce((sum, c) => sum + c.totalCompletes, 0);
      const totalEstimatedRevenueInr = Number(
        contents.reduce((sum, c) => sum + c.estimatedRevenueInr, 0).toFixed(2),
      );

      return {
        summary: {
          totalContentsWithAds,
          totalImpressions,
          totalWebImpressions,
          totalMobileImpressions,
          totalCompletes,
          totalEstimatedRevenueInr,
        },
        contents,
        recentPlays,
      };
    } catch (err: any) {
      this.logger.error(`Error querying content ad analytics: ${err.message}`);
      return {
        summary: {
          totalContentsWithAds: 0,
          totalImpressions: 0,
          totalWebImpressions: 0,
          totalMobileImpressions: 0,
          totalCompletes: 0,
          totalEstimatedRevenueInr: 0,
        },
        contents: [],
        recentPlays: [],
      };
    }
  }
}
