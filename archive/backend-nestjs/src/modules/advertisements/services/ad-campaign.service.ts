import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdCampaign } from '../entities/ad-campaign.entity';
import { BunnyService } from '../../../infrastructure/storage/bunny.service';

@Injectable()
export class AdCampaignService {
  constructor(
    @InjectRepository(AdCampaign)
    private readonly adRepo: Repository<AdCampaign>,
    private readonly bunnyService: BunnyService,
  ) {}

  async listCampaigns(): Promise<AdCampaign[]> {
    return this.adRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getCampaignById(id: number): Promise<AdCampaign> {
    const ad = await this.adRepo.findOne({ where: { id } });
    if (!ad) throw new NotFoundException(`Ad campaign ${id} not found`);
    return ad;
  }

  async upsertCampaign(body: any, id?: number): Promise<AdCampaign> {
    let ad = id ? await this.adRepo.findOne({ where: { id } }) : null;
    const name = String(body?.name || body?.title || '').trim();
    if (!ad && !name) {
      throw new BadRequestException('Ad campaign name is required');
    }

    if (!ad) {
      ad = this.adRepo.create({
        name,
        advertiserName: body?.advertiserName || body?.advertiser || 'MaxxPixels Sponsor',
        adType: (body?.adType || 'PRE_ROLL').toUpperCase(),
        videoUrl: body?.videoUrl || body?.video_url || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        bunnyVideoGuid: body?.bunnyVideoGuid || null,
        clickThroughUrl: body?.clickThroughUrl || body?.targetUrl || 'https://maxxpixels.com',
        durationSeconds: Number(body?.durationSeconds ?? 15),
        skipOffsetSeconds: Number(body?.skipOffsetSeconds ?? 5),
        targetContentType: body?.targetContentType || null,
        targetLanguage: body?.targetLanguage || null,
        cpmRate: Number(body?.cpmRate ?? 50),
        budgetAmount: body?.budgetAmount ? Number(body.budgetAmount) : null,
        startDate: body?.startDate ? new Date(body.startDate) : new Date(),
        endDate: body?.endDate ? new Date(body.endDate) : null,
        status: (body?.status || 'ACTIVE').toUpperCase(),
        isActive: body?.isActive !== undefined ? Boolean(body.isActive) : true,
      });
    } else {
      Object.assign(ad, {
        name: name || ad.name,
        advertiserName: body.advertiserName ?? ad.advertiserName,
        adType: body.adType ? String(body.adType).toUpperCase() : ad.adType,
        videoUrl: body.videoUrl ?? ad.videoUrl,
        bunnyVideoGuid: body.bunnyVideoGuid ?? ad.bunnyVideoGuid,
        clickThroughUrl: body.clickThroughUrl ?? ad.clickThroughUrl,
        durationSeconds: body.durationSeconds !== undefined ? Number(body.durationSeconds) : ad.durationSeconds,
        skipOffsetSeconds: body.skipOffsetSeconds !== undefined ? Number(body.skipOffsetSeconds) : ad.skipOffsetSeconds,
        targetContentType: body.targetContentType ?? ad.targetContentType,
        targetLanguage: body.targetLanguage ?? ad.targetLanguage,
        cpmRate: body.cpmRate !== undefined ? Number(body.cpmRate) : ad.cpmRate,
        status: body.status ? String(body.status).toUpperCase() : ad.status,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : ad.isActive,
      });
    }

    return this.adRepo.save(ad);
  }

  async deleteCampaign(id: number): Promise<any> {
    await this.adRepo.delete(id);
    return { id, deleted: true };
  }

  async recordImpression(id: number): Promise<void> {
    await this.adRepo
      .createQueryBuilder()
      .update(AdCampaign)
      .set({ impressionsCount: () => 'COALESCE(impressions_count, 0) + 1' })
      .where('id = :id', { id })
      .execute();
  }

  async recordClick(id: number): Promise<void> {
    await this.adRepo
      .createQueryBuilder()
      .update(AdCampaign)
      .set({ clicksCount: () => 'COALESCE(clicks_count, 0) + 1' })
      .where('id = :id', { id })
      .execute();
  }

  /**
   * Generates IAB VAST 4.2 XML response for video players.
   * Mirrors Spring Boot PublicVastController.
   */
  async generateVastXml(params: {
    adType?: string;
    contentId?: number;
    language?: string;
  }): Promise<string> {
    // Audience threshold: no VAST fill until the title has AD_MIN_UNIQUE_VIEWERS
    // (default 1000) distinct viewers. Mirrors the ad-config eligibility gate.
    if (params.contentId) {
      const required = Number(process.env.AD_MIN_UNIQUE_VIEWERS || 1000);
      const unique = this.countUniqueViewersCached(params.contentId);
      if (unique < required) {
        return `<?xml version="1.0" encoding="UTF-8"?><VAST version="4.2"/>`;
      }
    }

    const qb = this.adRepo
      .createQueryBuilder('ad')
      .where('ad.isActive = true')
      .andWhere('ad.status = :status', { status: 'ACTIVE' });

    if (params.adType) {
      qb.andWhere('ad.adType = :adType', { adType: params.adType.toUpperCase() });
    }

    const campaigns = await qb.orderBy('ad.id', 'DESC').take(5).getMany();
    if (campaigns.length === 0) {
      return `<?xml version="1.0" encoding="UTF-8"?><VAST version="4.2"/>`;
    }

    const selected = campaigns[Math.floor(Math.random() * campaigns.length)];
    const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:8080';
    const mediaUrl = selected.bunnyVideoGuid
      ? this.bunnyService.generateSignedStreamUrl(selected.bunnyVideoGuid)
      : selected.videoUrl;

    const formatDuration = (sec: number): string => {
      const s = Math.max(1, Math.floor(sec || 15));
      const mins = String(Math.floor(s / 60)).padStart(2, '0');
      const rem = String(s % 60).padStart(2, '0');
      return `00:${mins}:${rem}`;
    };

    const durationStr = formatDuration(selected.durationSeconds);
    const skipStr = formatDuration(selected.skipOffsetSeconds || 5);

    return `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="4.2">
  <Ad id="${selected.id}">
    <InLine>
      <AdSystem version="2.0">MaxxPixels OTT AdServer</AdSystem>
      <AdTitle><![CDATA[${selected.name}]]></AdTitle>
      <Advertiser><![CDATA[${selected.advertiserName || 'MaxxPixels'}]]></Advertiser>
      <Impression><![CDATA[${baseUrl}/api/v1/ads/track/impression/${selected.id}]]></Impression>
      <Creatives>
        <Creative id="creative-${selected.id}">
          <Linear skipoffset="${skipStr}">
            <Duration>${durationStr}</Duration>
            <VideoClicks>
              <ClickThrough><![CDATA[${selected.clickThroughUrl || 'https://maxxpixels.com'}]]></ClickThrough>
              <ClickTracking><![CDATA[${baseUrl}/api/v1/ads/track/click/${selected.id}]]></ClickTracking>
            </VideoClicks>
            <MediaFiles>
              <MediaFile delivery="streaming" type="application/x-mpegURL" width="1920" height="1080">
                <![CDATA[${mediaUrl}]]>
              </MediaFile>
            </MediaFiles>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>`;
  }

  /** 60s in-memory cache so the VAST endpoint doesn't count uniques per request. */
  private uniqCache = new Map<string, { value: number; at: number }>();
  private countUniqueViewersCached(contentId: number): number {
    const cached = this.uniqCache.get(String(contentId));
    if (cached && Date.now() - cached.at < 60_000) return cached.value;
    // Best-effort async refresh; initial value 0 is safe (no fill until counted).
    this.adRepo.manager
      .query(
        `SELECT COUNT(DISTINCT user_id)::int AS uniq
         FROM playback_sessions WHERE content_id = $1 AND user_id IS NOT NULL`,
        [contentId],
      )
      .then((rows: any[]) => {
        this.uniqCache.set(String(contentId), {
          value: Number(rows?.[0]?.uniq || 0),
          at: Date.now(),
        });
      })
      .catch(() => undefined);
    return cached?.value ?? 0;
  }
}

