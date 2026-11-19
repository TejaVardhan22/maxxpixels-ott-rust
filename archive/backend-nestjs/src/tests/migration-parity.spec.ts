import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';

import { ApiResponse } from '../common/dto/api-response.dto';
import { PageResponse } from '../common/dto/page-response.dto';
import { ApiResponseInterceptor } from '../common/interceptors/api-response.interceptor';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RedisService } from '../infrastructure/redis/redis.service';
import { BunnyService } from '../infrastructure/storage/bunny.service';
import { ContentMapper } from '../modules/content/services/content.mapper';
import { HealthController } from '../health/health.controller';
import { AuthController } from '../modules/auth/controllers/auth.controller';
import { AuthService } from '../modules/auth/services/auth.service';
import { CatalogController, PublicDiscoveryController } from '../modules/content/controllers/catalog.controller';
import { CatalogService } from '../modules/content/services/catalog.service';
import { CmsController } from '../modules/content/controllers/cms.controller';
import { CmsService } from '../modules/content/services/cms.service';
import { LiveDrmLegalService } from '../modules/content/services/live-drm-legal.service';
import { WatchService } from '../modules/watch-history/services/watch.service';
import { PlanService } from '../modules/subscriptions/services/plan.service';
import { PlanController, PublicCouponController } from '../modules/subscriptions/controllers/plan.controller';
import { PaymentService } from '../modules/payments/services/payment.service';
import { SystemSettingService } from '../modules/uploads/services/system-setting.service';
import { MasterDataService } from '../modules/categories/services/master-data.service';
import { AdminCategoryController } from '../modules/categories/controllers/admin-category.controller';
import { AdminMasterDataController } from '../modules/categories/controllers/admin-master-data.controller';
import { PublicVastController } from '../modules/advertisements/controllers/ad.controller';
import { AdCampaignService } from '../modules/advertisements/services/ad-campaign.service';
import { AdMonetizationService } from '../modules/advertisements/services/ad-monetization.service';
import { KafkaService } from '../infrastructure/kafka/kafka.service';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

describe('MaxxPixels OTT — NestJS (Fastify) Migration Verification Suite', () => {
  let app: NestFastifyApplication;
  let redisService: RedisService;
  let bunnyService: BunnyService;

  const mockContentItem = {
    id: 101,
    title: 'Sher-E-Hindustan',
    slug: 'sher-e-hindustan',
    description: 'Action blockbuster in Bhojpuri and Hindi',
    shortDescription: 'Action blockbuster',
    type: 'MOVIE',
    status: 'PUBLISHED',
    accessType: 'PREMIUM',
    releaseYear: 2026,
    ageRating: 'U/A 13+',
    imdbRating: 8.4,
    posterUrl: 'https://maxxpixels.b-cdn.net/posters/101.jpg',
    backdropUrl: 'https://maxxpixels.b-cdn.net/backdrops/101.jpg',
    trailerUrl: 'https://vz-maxxpixels.b-cdn.net/101-trailer/playlist.m3u8',
    isFeatured: true,
    isTrending: true,
    isOriginal: true,
    viewCount: 15420,
    movie: {
      id: 101,
      durationMinutes: 142,
      videoUrl: 'https://vz-maxxpixels.b-cdn.net/101-main/playlist.m3u8',
      director: 'Rajan Verma',
    },
    genres: [{ id: 1, name: 'Action', slug: 'action' }],
    categories: [{ id: 1, name: 'Trending Now', slug: 'trending-now' }],
    languages: [{ code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' }],
    tvodProducts: [{ id: 1, price: 49, rentalDurationHours: 48 }],
  } as any;

  const mappedContentDto = ContentMapper.toDto(mockContentItem, {
    isRented: false,
    isWatchlisted: true,
  });

  beforeAll(async () => {
    process.env.SKIP_REDIS_CONNECT = 'true';
    process.env.SKIP_KAFKA_CONNECT = 'true';
    process.env.SKIP_DB_INIT = 'true';
    process.env.JWT_SECRET = 'TestSecretKeyForMaxxPixelsMigrationSuite2026!';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        HealthController,
        AuthController,
        CatalogController,
        PublicDiscoveryController,
        CmsController,
        PlanController,
        PublicCouponController,
        AdminCategoryController,
        AdminMasterDataController,
        PublicVastController,
      ],
      providers: [
        Reflector,
        RedisService,
        BunnyService,
        JwtAuthGuard,
        RolesGuard,
        RateLimitGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => def),
          },
        },
        {
          provide: DataSource,
          useValue: {
            isInitialized: true,
            query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
          },
        },
        {
          provide: KafkaService,
          useValue: {
            isHealthy: jest.fn().mockReturnValue(true),
            getMode: jest.fn().mockReturnValue('redis-streams'),
            publish: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AuthService,
          useValue: {
            sendOtp: jest.fn().mockResolvedValue({
              phone: '+919876543210',
              mobile: '+919876543210',
              otpSent: true,
              expiresInSeconds: 300,
              provider: 'MSG91',
            }),
            verifyOtp: jest.fn().mockResolvedValue({
              accessToken: 'jwt-access-token',
              token: 'jwt-access-token',
              refreshToken: 'refresh-token-123',
              user: { id: 'u-1', phone: '+919876543210', roles: ['ROLE_USER'] },
            }),
            login: jest.fn().mockResolvedValue({
              accessToken: 'jwt-access-token',
              token: 'jwt-access-token',
              user: { id: 'u-1', email: 'admin@maxxpixels.com', roles: ['ROLE_SUPER_ADMIN'] },
            }),
            getProfile: jest.fn().mockResolvedValue({
              id: 'u-1',
              email: 'viewer@maxxpixels.com',
              fullName: 'OTT Viewer',
              isSubscribed: true,
            }),
          },
        },
        {
          provide: CatalogService,
          useValue: {
            browseCatalog: jest.fn().mockResolvedValue(
              PageResponse.of([mappedContentDto], 1, 0, 20),
            ),
            getContentDetail: jest.fn().mockResolvedValue({
              ...mappedContentDto,
              relatedContent: [],
            }),
            getRentedContentList: jest.fn().mockResolvedValue([mappedContentDto]),
            getPublicMetadata: jest.fn().mockResolvedValue({
              languages: [{ code: 'hi', name: 'Hindi' }],
              categories: [{ id: 1, name: 'Trending Now' }],
              genres: [{ id: 1, name: 'Action' }],
              contentTypes: [{ id: 1, name: 'Movie' }],
            }),
            getEpisodesBySeason: jest.fn().mockResolvedValue([
              { id: 1, episodeNumber: 1, title: 'Pilot', videoUrl: 'https://vz-maxxpixels.b-cdn.net/ep1/playlist.m3u8' },
            ]),
            getContentByCategorySlugOrId: jest.fn().mockResolvedValue([mappedContentDto]),
            getNonKannadaContent: jest.fn().mockResolvedValue([mappedContentDto]),
            purchaseTvodContent: jest.fn().mockResolvedValue({ id: 1, status: 'ACTIVE' }),
          },
        },
        {
          provide: CmsService,
          useValue: {
            getBanners: jest.fn().mockResolvedValue([
              {
                id: 1,
                title: 'Sher-E-Hindustan',
                imageUrl: 'https://maxxpixels.b-cdn.net/backdrops/101.jpg',
                contentId: 101,
              },
            ]),
            getPageLayout: jest.fn().mockResolvedValue({
              id: 1,
              slug: 'home',
              title: 'Home',
              banners: [{ id: 1, title: 'Sher-E-Hindustan' }],
              sections: [{ id: 1, title: 'Trending Now', items: [mappedContentDto] }],
            }),
            getSections: jest.fn().mockResolvedValue([
              {
                id: 1,
                title: 'Trending Now',
                items: [mappedContentDto],
                data: [mappedContentDto],
              },
            ]),
          },
        },
        {
          provide: LiveDrmLegalService,
          useValue: {
            listLegalPages: jest.fn().mockResolvedValue([
              { slug: 'privacy-policy', title: 'Privacy Policy', content: '<p>Policy</p>' },
            ]),
            getLegalPageBySlug: jest.fn().mockResolvedValue({
              slug: 'privacy-policy',
              title: 'Privacy Policy',
              content: '<p>Policy</p>',
            }),
          },
        },
        {
          provide: WatchService,
          useValue: {
            toggleWatchlist: jest.fn().mockResolvedValue({
              contentId: 101,
              isWatchlisted: true,
              action: 'ADDED',
            }),
            getWatchlist: jest.fn().mockResolvedValue([mappedContentDto]),
            saveWatchProgress: jest.fn().mockResolvedValue({ saved: true }),
            removeWatchProgress: jest.fn().mockResolvedValue({ removed: true }),
          },
        },
        {
          provide: PlanService,
          useValue: {
            listPlans: jest.fn().mockResolvedValue([
              {
                id: 1,
                name: 'Super Quarterly',
                price: 299,
                discountPrice: 249,
                effectivePrice: 249,
                durationDays: 90,
              },
            ]),
            validateAndCalculateCoupon: jest.fn().mockResolvedValue({
              discountAmount: 50,
              finalAmount: 199,
            }),
          },
        },
        {
          provide: PaymentService,
          useValue: {
            verifyPayment: jest.fn().mockResolvedValue({
              verified: true,
              status: 'SUCCESS',
              orderId: 5001,
            }),
          },
        },
        {
          provide: SystemSettingService,
          useValue: {
            getPublicConfig: jest.fn().mockResolvedValue({
              APP_NAME: 'MaxxPixels OTT',
              DEFAULT_CURRENCY: 'INR',
            }),
          },
        },
        {
          provide: MasterDataService,
          useValue: {
            listCategories: jest.fn().mockResolvedValue([{ id: 1, name: 'Trending Now' }]),
            listLanguages: jest.fn().mockResolvedValue([{ code: 'hi', name: 'Hindi' }]),
            listGenres: jest.fn().mockResolvedValue([{ id: 1, name: 'Action' }]),
            listContentTypes: jest.fn().mockResolvedValue([{ id: 1, name: 'Movie' }]),
          },
        },
        {
          provide: AdMonetizationService,
          useValue: {},
        },
        {
          provide: AdCampaignService,
          useValue: {
            generateVastXml: jest.fn().mockResolvedValue(
              `<?xml version="1.0" encoding="UTF-8"?><VAST version="4.2"><Ad id="1"></Ad></VAST>`,
            ),
            recordImpression: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    const reflector = app.get(Reflector);
    app.useGlobalGuards(app.get(RateLimitGuard), app.get(JwtAuthGuard), app.get(RolesGuard));
    app.useGlobalInterceptors(new ApiResponseInterceptor(reflector));
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    redisService = app.get(RedisService);
    bunnyService = app.get(BunnyService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ==================== 1. UNIT TESTS: CORE UTILITIES & SERVICES ====================

  describe('1. Unit Tests — ApiResponse, ContentMapper, Bunny CDN Token Signer & Redis Lock', () => {
    it('should construct dual data/result ApiResponse envelope matching Spring Boot contract', () => {
      const res = ApiResponse.ok({ movieCount: 42 }, 'Catalog loaded');
      expect(res.success).toBe(true);
      expect(res.status).toBe(200);
      expect(res.message).toBe('Catalog loaded');
      expect(res.data).toEqual({ movieCount: 42 });
      expect(res.result).toEqual({ movieCount: 42 });
      expect(res.timestamp).toBeDefined();
    });

    it('should map Content entity to clean REST properties for Web, Mobile, and Admin', () => {
      expect(mappedContentDto.id).toBe(101);
      expect(mappedContentDto.videoId).toBe(101);
      expect(mappedContentDto.posterUrl).toMatch(/^https?:\/\/.+\/(?:uploads\/)?posters\/101\.jpg$/);
      expect(mappedContentDto.accessType).toBe('PREMIUM');
      expect(mappedContentDto.isPremium).toBe(true);
      expect(mappedContentDto.isWatchlisted).toBe(true);
      expect(mappedContentDto.rentPrice).toBe(49);
    });

    it('should generate deterministic SHA-256 signed Bunny CDN HLS playback URLs', () => {
      const signedUrl = bunnyService.generateSignedStreamUrl('9f8e7d6c-video-guid', 3600, {
        streamCdnHostname: 'vz-maxxpixels.b-cdn.net',
        streamTokenSecurityKey: 'bunny-secret-signing-key-2026',
      });
      expect(signedUrl).toContain('https://vz-maxxpixels.b-cdn.net/9f8e7d6c-video-guid/playlist.m3u8?token=');
      expect(signedUrl).toContain('&expires=');
    });

    it('should acquire and release distributed locks atomically via RedisService', async () => {
      const lockKey = 'test:payment:order_999';
      const token1 = await redisService.acquireLock(lockKey, 5000);
      expect(token1).toBeTruthy();

      const token2 = await redisService.acquireLock(lockKey, 5000);
      expect(token2).toBeNull();

      const released = await redisService.releaseLock(lockKey, token1!);
      expect(released).toBe(true);

      const token3 = await redisService.acquireLock(lockKey, 5000);
      expect(token3).toBeTruthy();
      await redisService.releaseLock(lockKey, token3!);
    });

    it('should enforce RBAC roles in RolesGuard', () => {
      const reflector = new Reflector();
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: any) => {
        if (key === 'isPublic') return false;
        if (key === 'roles') return ['ROLE_ADMIN'];
        return undefined;
      });
      const guard = new RolesGuard(reflector);

      const adminContext = {
        getType: () => 'http',
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ user: { id: '1', roles: ['ROLE_ADMIN'] } }),
        }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(adminContext)).toBe(true);

      const viewerContext = {
        getType: () => 'http',
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ user: { id: '2', roles: ['ROLE_USER'] } }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(viewerContext)).toThrow('Access denied: insufficient role privileges');
    });
  });

  // ==================== 2. INTEGRATION TESTS: REST ENDPOINTS ====================

  describe('2. API Integration Tests for Web, Mobile App, and Admin (Fastify HTTP Adapter)', () => {
    it('GET /api/v1/ping and /api/v1/health should return UP status wrapped in ApiResponse', async () => {
      const pingRes = await request(app.getHttpServer()).get('/api/v1/ping').expect(200);
      expect(pingRes.body.success).toBe(true);
      expect(pingRes.body.data.status).toBe('UP');
      expect(pingRes.body.result.status).toBe('UP');

      const healthRes = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
      expect(healthRes.body.success).toBe(true);
      expect(healthRes.body.data.components.db.status).toBe('UP');
    });

    it('GET /actuator/prometheus should return raw Prometheus text metrics (unwrapped)', async () => {
      const res = await request(app.getHttpServer()).get('/actuator/prometheus').expect(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toContain('process_cpu_');
    });

    it('GET /api/v1/ads/vast should return raw IAB VAST 4.2 XML (unwrapped)', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/ads/vast').expect(200);
      expect(res.headers['content-type']).toContain('application/xml');
      expect(res.text).toContain('<VAST version="4.2">');
    });

    it('GET /api/v1/catalog should return paginated catalog with dual data and result keys', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/catalog?page=0&size=20&language=hi')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toHaveLength(1);
      expect(res.body.result.content[0].title).toBe('Sher-E-Hindustan');
      expect(res.body.data.totalElements).toBe(1);
    });

    it('POST /api/v1/auth/send-otp and /api/v1/auth/verify-otp should issue tokens', async () => {
      const otpRes = await request(app.getHttpServer())
        .post('/api/v1/auth/send-otp')
        .send({ phone: '+919876543210' })
        .expect(201);

      expect(otpRes.body.success).toBe(true);
      expect(otpRes.body.data.otpSent).toBe(true);

      const verifyRes = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send({ phone: '+919876543210', otp: '123456' })
        .expect(201);

      expect(verifyRes.body.data.accessToken).toBe('jwt-access-token');
      expect(verifyRes.body.result.token).toBe('jwt-access-token');
    });

    it('GET /api/v1/auth/me should enforce Bearer JWT authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);

      const validToken = jwt.sign(
        { sub: 'viewer@maxxpixels.com', userId: 'u-1', roles: ['ROLE_USER'] },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' },
      );

      const resBearer = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
      expect(resBearer.body.data.id).toBe('u-1');
    });

    it('Web, Mobile & Admin REST Endpoints (/api/v1/cms/banners, /api/v1/cms/sections, /api/v1/tvod/products, /api/v1/plans, /api/v1/categories) should work cleanly', async () => {
      const bannerGet = await request(app.getHttpServer()).get('/api/v1/cms/banners').expect(200);
      expect(bannerGet.body.status).toBe(200);
      expect(Array.isArray(bannerGet.body.data)).toBe(true);
      expect(bannerGet.body.data[0].contentId).toBe(101);

      const sectionGet = await request(app.getHttpServer()).get('/api/v1/cms/sections').expect(200);
      expect(sectionGet.body.data[0].title).toBe('Trending Now');

      const tvodGet = await request(app.getHttpServer()).get('/api/v1/tvod/products').expect(200);
      expect(tvodGet.body.data[0].rentPrice).toBe(49);

      const plansGet = await request(app.getHttpServer()).get('/api/v1/plans').expect(200);
      expect(plansGet.body.data[0].name).toBe('Super Quarterly');

      const categoriesGet = await request(app.getHttpServer()).get('/api/v1/categories').expect(200);
      expect(categoriesGet.body.data[0].name).toBe('Trending Now');
    });
  });
});
