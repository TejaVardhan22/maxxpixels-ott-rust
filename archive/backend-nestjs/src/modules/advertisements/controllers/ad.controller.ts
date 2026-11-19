import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  AuthenticatedUser,
  OptionalAuth,
  Public,
  RawResponse,
  Roles,
} from '../../../common/decorators/auth.decorators';
import { AdCampaignService } from '../services/ad-campaign.service';
import { AdMonetizationService } from '../services/ad-monetization.service';

@ApiTags('Public Video Ads & Google IMA Integration')
@Controller(['api/v1/ads', 'api/ads', 'ads'])
export class PublicVastController {
  constructor(
    private readonly adService: AdCampaignService,
    private readonly monetizationService: AdMonetizationService,
  ) {}

  @Public()
  @OptionalAuth()
  @Get('config/:contentId')
  @ApiOperation({ summary: 'Get Google IMA video ad configuration, GAM ad tag, and cue points' })
  async getAdConfig(
    @Param('contentId', ParseIntPipe) contentId: number,
    @CurrentUser() user?: AuthenticatedUser,
    @Query('device') device?: string,
    @Req() req?: any,
  ) {
    return this.monetizationService.getAdConfigForContent(
      contentId,
      user?.id ? Number(user.id) : undefined,
      device || 'WEB',
      req?.ip,
    );
  }

  @Public()
  @Post(['session', 'sessions'])
  @ApiOperation({ summary: 'Initialize an ad playback session' })
  async createSession(@Body() body: any, @Req() req?: any) {
    return this.monetizationService.createAdSession({
      ...body,
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });
  }

  @Public()
  @Post(['events', 'event'])
  @ApiOperation({ summary: 'Record idempotent ad lifecycle events (impressions, quartiles, completes)' })
  async recordEvent(@Body() body: any) {
    return this.monetizationService.recordAdEvent(body);
  }

  @Public()
  @Get('campaigns')
  @ApiOperation({ summary: 'List active direct advertiser campaigns' })
  async getPublicCampaigns() {
    return this.adService.listCampaigns();
  }

  @Public()
  @Get('revenue')
  @ApiOperation({ summary: 'Get ad revenue summary & analytics' })
  async getRevenueSummary(@Query('period') period?: string) {
    return this.monetizationService.getAdRevenueSummary(period);
  }

  @Public()
  @Get('producer-revenue')
  @ApiOperation({ summary: 'Get producer 60% / MaxxPixels 40% revenue attribution statement' })
  async getProducerRevenue(
    @Query('producerId') producerId?: number,
    @Query('period') period?: string,
  ) {
    return this.monetizationService.getProducerRevenueReport(
      producerId ? Number(producerId) : undefined,
      period,
    );
  }

  @Public()
  @Get('content-analytics')
  @ApiOperation({ summary: 'Get ad performance and VAST plays grouped by content' })
  async getContentAdAnalyticsPublic() {
    return this.monetizationService.getContentAdAnalytics();
  }

  @Public()
  @Get(['vast', 'vast.xml'])
  @RawResponse()
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @ApiOperation({ summary: 'Generate IAB VAST 4.2 XML ad tag for video player' })
  async getVastXml(
    @Query('adType') adType?: string,
    @Query('contentId') contentId?: number,
    @Query('language') language?: string,
  ): Promise<string> {
    return this.adService.generateVastXml({
      adType,
      contentId: contentId ? Number(contentId) : undefined,
      language,
    });
  }

  @Public()
  @Get(['queue', 'ad-queue'])
  @ApiOperation({ summary: 'Get ad cue queue for video player (pre-roll, mid-roll, post-roll)' })
  async getAdQueue(
    @Query('video_id') videoId?: string,
    @Query('contentId') contentId?: string,
    @Query('device') device?: string,
  ) {
    const cid = Number(videoId || contentId || 0);
    if (cid > 0) {
      const cfg = await this.monetizationService.getAdConfigForContent(cid, undefined, device || 'MOBILE');
      if (cfg.eligible) {
        return {
          enabled: true,
          session_id: cfg.sessionId,
          gam_tag_url: cfg.gamTagUrl,
          fallback_vast_url: cfg.fallbackVastUrl,
          pre_roll: [{ id: 'preroll-gam', tag_url: cfg.gamTagUrl }],
          mid_roll: cfg.cuePoints.map((sec, idx) => ({
            id: `midroll-${idx}`,
            time_offset: sec,
            tag_url: cfg.gamTagUrl,
          })),
          post_roll: [],
        };
      }
    }
    return {
      enabled: false,
      session_id: `ad-session-${Date.now()}`,
      pre_roll: [],
      mid_roll: [],
      post_roll: [],
    };
  }

  @Public()
  @Post(['track', 'ad-track'])
  @ApiOperation({ summary: 'Track ad playback event' })
  async trackAd(@Body() body: any) {
    const adId = Number(body?.ad_id || body?.adId || 0);
    if (adId > 0) {
      await this.adService.recordImpression(adId).catch(() => {});
    }
    // Also track in monetization service if eventType provided
    if (body?.eventType) {
      await this.monetizationService.recordAdEvent(body).catch(() => {});
    }
    return { success: true, tracked: true };
  }

  @Public()
  @Get('track/impression/:id')
  @ApiOperation({ summary: 'Track VAST ad impression' })
  async trackImpression(@Param('id', ParseIntPipe) id: number) {
    await this.adService.recordImpression(id);
    return { tracked: true, type: 'IMPRESSION', campaignId: id };
  }

  @Public()
  @Get('track/click/:id')
  @ApiOperation({ summary: 'Track VAST ad click' })
  async trackClick(@Param('id', ParseIntPipe) id: number) {
    await this.adService.recordClick(id);
    return { tracked: true, type: 'CLICK', campaignId: id };
  }
}

@ApiTags('Admin Advertising Management (GAM, AdMob, InMobi & Campaigns)')
@ApiBearerAuth()
@Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN')
@Controller([
  'api/v1/admin/ads',
  'api/admin/ads',
  'admin/ads',
  'api/v1/admin/advertisements',
])
export class AdminAdController {
  constructor(
    private readonly adService: AdCampaignService,
    private readonly monetizationService: AdMonetizationService,
  ) {}

  // ==================== PROVIDER MANAGEMENT ====================
  @Get('providers')
  @ApiOperation({ summary: 'List all Ad Providers (GAM, AdMob, InMobi, Direct)' })
  async listProviders() {
    return this.monetizationService.listProviders();
  }

  @Post('providers')
  @ApiOperation({ summary: 'Create or configure an Ad Provider' })
  async createProvider(@Body() body: any) {
    return this.monetizationService.upsertProvider(body);
  }

  @Put('providers/:id')
  @ApiOperation({ summary: 'Update an Ad Provider configuration or toggle bidding' })
  async updateProvider(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.monetizationService.upsertProvider(body, id);
  }

  // ==================== PLACEMENT MANAGEMENT ====================
  @Get('placements')
  @ApiOperation({ summary: 'List all Ad Placements (Pre-roll, Mid-roll, Banner, etc.)' })
  async listPlacements() {
    return this.monetizationService.listPlacements();
  }

  @Post('placements')
  @ApiOperation({ summary: 'Create or update an Ad Placement' })
  async createPlacement(@Body() body: any) {
    return this.monetizationService.upsertPlacement(body);
  }

  @Put('placements/:id')
  @ApiOperation({ summary: 'Update an Ad Placement by ID' })
  async updatePlacement(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.monetizationService.upsertPlacement(body, id);
  }

  // ==================== CAMPAIGN MANAGEMENT ====================
  @Get(['campaigns', ''])
  @ApiOperation({ summary: 'List all VAST ad campaigns' })
  async listCampaigns() {
    return this.adService.listCampaigns();
  }

  @Post(['campaigns', ''])
  @ApiOperation({ summary: 'Create a VAST ad campaign' })
  async createCampaign(@Body() body: any) {
    return this.adService.upsertCampaign(body);
  }

  @Post(['campaigns/:id/toggle', ':id/toggle'])
  @ApiOperation({ summary: 'Toggle status of a VAST ad campaign' })
  async toggleCampaign(
    @Param('id', ParseIntPipe) id: number,
    @Query('status') queryStatus?: string,
    @Body() body?: any,
  ) {
    const status = queryStatus || body?.status || 'ACTIVE';
    return this.adService.upsertCampaign({ status, isActive: status === 'ACTIVE' }, id);
  }

  @Get(['campaigns/:id', ':id'])
  @ApiOperation({ summary: 'Get ad campaign details by ID' })
  async getCampaign(@Param('id', ParseIntPipe) id: number) {
    return this.adService.getCampaignById(id);
  }

  @Put(['campaigns/:id', ':id'])
  @ApiOperation({ summary: 'Update a VAST ad campaign' })
  async updateCampaign(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.adService.upsertCampaign(body, id);
  }

  @Delete(['campaigns/:id', ':id'])
  @ApiOperation({ summary: 'Delete a VAST ad campaign' })
  async deleteCampaign(@Param('id', ParseIntPipe) id: number) {
    return this.adService.deleteCampaign(id);
  }

  // ==================== REVENUE & PRODUCER SETTLEMENTS ====================
  @Get('revenue')
  @ApiOperation({ summary: 'Get detailed ad revenue analytics' })
  async getAdminRevenue(@Query('period') period?: string) {
    return this.monetizationService.getAdRevenueSummary(period);
  }

  @Get('producer-revenue')
  @ApiOperation({ summary: 'Get producer 60/40 revenue attribution statements' })
  async getAdminProducerRevenue(
    @Query('producerId') producerId?: number,
    @Query('period') period?: string,
  ) {
    return this.monetizationService.getProducerRevenueReport(
      producerId ? Number(producerId) : undefined,
      period,
    );
  }

  @Get('content-analytics')
  @ApiOperation({ summary: 'Get detailed ad performance and VAST plays by content' })
  async getAdminContentAdAnalytics() {
    return this.monetizationService.getContentAdAnalytics();
  }
}

@ApiTags('Public Ads.txt & App-Ads.txt')
@Controller()
export class AdsTxtController {
  @Public()
  @RawResponse()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=86400')
  @Get(['app-ads.txt', 'api/app-ads.txt', 'api/v1/app-ads.txt'])
  @ApiOperation({ summary: 'IAB app-ads.txt verification file for Google AdMob & InMobi' })
  getAppAdsTxt(): string {
    return `# Google AdMob & InMobi app-ads.txt Verification File
# MaxxPixels OTT (com.maxxpixels)
google.com, pub-2191993313473081, DIRECT, f08c47fec0942fa0
inmobi.com, b0e3f3a3b99e4ed7b9a82cd25cc59481, DIRECT, 83e75a7ae333ca9d
inmobi.com, 8839a620596f46169ed937f1568740db, DIRECT, 83e75a7ae333ca9d
`;
  }

  @Public()
  @RawResponse()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=86400')
  @Get(['ads.txt', 'api/ads.txt', 'api/v1/ads.txt'])
  @ApiOperation({ summary: 'IAB ads.txt verification file for Google AdSense/GAM & InMobi' })
  getAdsTxt(): string {
    return `# Google AdSense / Ad Manager & InMobi Ads.txt Verification File
google.com, pub-2191993313473081, DIRECT, f08c47fec0942fa0
inmobi.com, b0e3f3a3b99e4ed7b9a82cd25cc59481, DIRECT, 83e75a7ae333ca9d
inmobi.com, 8839a620596f46169ed937f1568740db, DIRECT, 83e75a7ae333ca9d
`;
  }
}
