import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Content } from '../../content/entities/content.entity';
import { Episode } from '../../content/entities/episode.entity';
import { DrmRule } from '../../content/entities/drm-rule.entity';
import { Profile } from '../../users/entities/profile.entity';
import { PlaybackSession } from '../entities/playback-session.entity';
import { WatchHistory } from '../entities/watch-history.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { ContentPurchase } from '../../subscriptions/entities/content-purchase.entity';
import { AdCampaign } from '../../advertisements/entities/ad-campaign.entity';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { KafkaService } from '../../../infrastructure/kafka/kafka.service';
import { BunnyService } from '../../../infrastructure/storage/bunny.service';
import { BusinessException } from '../../../common/filters/global-exception.filter';

@Injectable()
export class PlaybackService {
  constructor(
    @InjectRepository(Content)
    private readonly contentRepo: Repository<Content>,
    @InjectRepository(Episode)
    private readonly episodeRepo: Repository<Episode>,
    @InjectRepository(DrmRule)
    private readonly drmRepo: Repository<DrmRule>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    @InjectRepository(PlaybackSession)
    private readonly sessionRepo: Repository<PlaybackSession>,
    @InjectRepository(WatchHistory)
    private readonly watchHistoryRepo: Repository<WatchHistory>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(ContentPurchase)
    private readonly purchaseRepo: Repository<ContentPurchase>,
    @InjectRepository(AdCampaign)
    private readonly adRepo: Repository<AdCampaign>,
    private readonly redisService: RedisService,
    private readonly kafkaService: KafkaService,
    private readonly bunnyService: BunnyService,
  ) {}

  /**
   * Authorizes video playback:
   * 1. Resolves Content & Episode metadata.
   * 2. Verifies SVOD (active Subscription), TVOD (active ContentPurchase), or AVOD/FREE entitlement.
   * 3. Acquires a Redis distributed lock per user to enforce maxConcurrentStreams without race conditions.
   * 4. Generates a Bunny CDN SHA-256 token-signed HLS URL.
   * 5. Returns DRM policy, VAST ad tag URL (if AVOD or plan hasAds), resume position, and sessionToken.
   */
  async authorizePlayback(
    userId: string | undefined,
    body: any,
    ipAddress?: string,
  ): Promise<any> {
    const contentId = body?.contentId || body?.video_id ? Number(body.contentId || body.video_id) : null;
    const episodeId = body?.episodeId || body?.episode_id ? Number(body.episodeId || body.episode_id) : null;
    const isTrailer = Boolean(body?.isTrailer ?? body?.trailer ?? false);
    const deviceId = String(body?.deviceId || body?.device_id || 'web-player');
    const deviceType = String(body?.deviceType || body?.device_type || 'WEB');

    let content: Content | null = null;
    let episode: Episode | null = null;

    if (episodeId) {
      episode = await this.episodeRepo.findOne({
        where: { id: episodeId },
        relations: ['season', 'season.series', 'season.series.content'],
      });
      if (!episode) {
        throw new NotFoundException(`Episode ${episodeId} not found`);
      }
      content = episode.season?.series?.content || null;
    }

    if (!content && contentId) {
      content = await this.contentRepo.findOne({
        where: { id: contentId },
        relations: ['movie'],
      });
    }

    if (!content) {
      throw new NotFoundException('Requested video content not found');
    }

    if (content.status !== 'PUBLISHED') {
      throw new NotFoundException('Content is not published yet');
    }

    const accessType = (episode?.accessType || content.accessType || 'PREMIUM').toUpperCase();
    const isFree =
      isTrailer ||
      accessType === 'FREE' ||
      accessType === 'AVOD' ||
      Boolean(episode?.isFreePreview);

    let activeSub: Subscription | null = null;
    let activeRental: ContentPurchase | null = null;
    let maxStreams = 2;
    let showAds = accessType === 'AVOD' || accessType === 'FREE';

    if (userId) {
      activeSub = await this.subscriptionRepo.findOne({
        where: { userId, status: 'ACTIVE' },
        relations: ['plan'],
        order: { endDate: 'DESC' },
      });
      if (activeSub && activeSub.endDate < new Date()) {
        activeSub = null;
      }

      if (activeSub?.plan) {
        maxStreams = activeSub.plan.maxConcurrentStreams || 2;
        showAds = Boolean(activeSub.plan.hasAds);
      }

      activeRental = await this.purchaseRepo.findOne({
        where: { userId, contentId: content.id, status: 'ACTIVE' },
      });
      if (activeRental && activeRental.expiresAt && activeRental.expiresAt < new Date()) {
        activeRental = null;
      }
    }

    if (!isFree) {
      if (!userId) {
        throw new BusinessException(
          'Please sign in to watch premium or rental content',
          'AUTHENTICATION_REQUIRED',
        );
      }

      if (accessType === 'TVOD' || accessType === 'RENT') {
        if (!activeRental && !activeSub) {
          throw new BusinessException(
            'This title requires a rental purchase or VIP subscription',
            'RENTAL_REQUIRED',
          );
        }
      } else {
        // PREMIUM / SVOD
        if (!activeSub && !activeRental) {
          throw new BusinessException(
            'An active subscription is required to stream this title',
            'SUBSCRIPTION_REQUIRED',
          );
        }
      }
    }

    // Enforce concurrent stream limit using Redis distributed lock when user is authenticated
    let sessionToken: string = crypto.randomUUID();
    if (userId && !isTrailer) {
      const lockToken = await this.redisService.acquireLock(`playback:init:${userId}`, 5000);
      try {
        // Expire stale sessions older than 2 minutes without heartbeat
        const staleCutoff = new Date(Date.now() - 120 * 1000);
        await this.sessionRepo
          .createQueryBuilder()
          .update(PlaybackSession)
          .set({ status: 'TERMINATED' })
          .where('user_id = :userId AND status = :activeStatus AND last_heartbeat < :cutoff', {
            userId,
            activeStatus: 'ACTIVE',
            cutoff: staleCutoff,
          })
          .execute();

        const activeSessions = await this.sessionRepo.find({
          where: { userId, status: 'ACTIVE' },
          order: { lastHeartbeat: 'ASC' },
        });

        // Reuse session if same deviceId is already streaming
        const sameDeviceSession = activeSessions.find((s) => s.deviceId === deviceId);
        if (sameDeviceSession) {
          sessionToken = sameDeviceSession.sessionId;
          sameDeviceSession.contentId = content.id;
          sameDeviceSession.episodeId = episode?.id || null;
          sameDeviceSession.lastHeartbeat = new Date();
          await this.sessionRepo.save(sameDeviceSession);
        } else {
          if (activeSessions.length >= maxStreams) {
            throw new BusinessException(
              `Concurrent stream limit (${maxStreams}) reached on your account. Please stop playback on another device.`,
              'CONCURRENT_STREAM_LIMIT_EXCEEDED',
            );
          }

          await this.sessionRepo.save(
            this.sessionRepo.create({
              sessionId: sessionToken,
              userId,
              contentId: content.id,
              episodeId: episode?.id || null,
              deviceId,
              deviceType,
              ipAddress: ipAddress || null,
              status: 'ACTIVE',
              startedAt: new Date(),
              lastHeartbeat: new Date(),
            }),
          );
        }
      } finally {
        if (lockToken) {
          await this.redisService.releaseLock(`playback:init:${userId}`, lockToken);
        }
      }
    }

    // Determine raw video source or Bunny Video GUID
    const rawSource = isTrailer
      ? content.trailerUrl
      : episode?.bunnyVideoGuid ||
        episode?.videoUrl ||
        content.movie?.bunnyVideoGuid ||
        content.movie?.videoUrl ||
        content.trailerUrl ||
        'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

    const signedStreamUrl = this.bunnyService.generateSignedStreamUrl(rawSource || '');

    // Fetch resume position from watch_history
    let resumePositionSeconds = 0;
    if (userId && !isTrailer) {
      try {
        const profile = await this.profileRepo.findOne({
          where: { userId: Number(userId) },
          order: { id: 'ASC' },
        });
        if (profile) {
          const history = await this.watchHistoryRepo.findOne({
            where: episode
              ? { profileId: profile.id, episodeId: episode.id }
              : { profileId: profile.id, contentId: content.id },
          });
          if (history && !history.completed) {
            resumePositionSeconds = history.positionSeconds || 0;
          }
        }
      } catch (e) {
        // Safe fallback
      }
    }

    // Fetch DRM rule
    const drmRule =
      content.drmRule ||
      (await this.drmRepo.findOne({ where: { isActive: true }, order: { id: 'ASC' } }));

    // Build VAST ad tag URL if ads apply
    const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:8080';
    const vastTagUrl = showAds ? `${baseUrl}/api/v1/ads/vast?contentId=${content.id}` : null;

    // Publish view event asynchronously via in-process event bus
    if (!isTrailer) {
      await this.kafkaService.publish('ott.content.views', String(content.id), {
        contentId: content.id,
        episodeId: episode?.id || null,
        userId: userId || null,
      });
    }

    return {
      sessionToken,
      session_token: sessionToken,
      contentId: content.id,
      episodeId: episode?.id || null,
      title: episode ? `${content.title} - ${episode.title}` : content.title,
      streamUrl: signedStreamUrl,
      stream_url: signedStreamUrl,
      video_url: signedStreamUrl,
      hlsUrl: signedStreamUrl,
      isTrailer,
      resumePositionSeconds,
      resume_position_seconds: resumePositionSeconds,
      heartbeatIntervalSeconds: 30,
      maxVideoQuality: activeSub?.plan?.maxVideoQuality || 'FHD_1080P',
      showAds,
      vastTagUrl,
      vast_tag_url: vastTagUrl,
      drm: drmRule
        ? {
            enabled: true,
            provider: drmRule.provider,
            widevineLicenseUrl: drmRule.widevineLicenseUrl,
            fairplayLicenseUrl: drmRule.fairplayLicenseUrl,
            fairplayCertificateUrl: drmRule.fairplayCertificateUrl,
            securityLevel: drmRule.securityLevel,
            hdcpLevel: drmRule.hdcpLevel,
            blockScreenRecording: drmRule.blockScreenRecording,
            dynamicWatermarking: drmRule.dynamicWatermarking,
          }
        : { enabled: false },
    };
  }

  /**
   * High-frequency playback heartbeat (every 30s).
   * Publishes `ott.telemetry.heartbeat` asynchronously via in-process event bus for non-blocking persistence.
   */
  async recordHeartbeat(userId: string | undefined, body: any): Promise<any> {
    const sessionToken = body?.sessionToken || body?.session_token;
    const contentId = body?.contentId || body?.video_id ? Number(body.contentId || body.video_id) : null;
    const episodeId = body?.episodeId || body?.episode_id ? Number(body.episodeId || body.episode_id) : null;
    const currentPositionSeconds = Number(
      body?.currentPositionSeconds ?? body?.positionSeconds ?? body?.watchedDurationSeconds ?? 0,
    );
    const totalDurationSeconds = Number(body?.totalDurationSeconds ?? body?.durationSeconds ?? 0);

    await this.kafkaService.publish('ott.telemetry.heartbeat', sessionToken || userId || 'anon', {
      sessionToken,
      userId,
      contentId,
      episodeId,
      currentPositionSeconds,
      totalDurationSeconds,
    });

    return {
      acknowledged: true,
      sessionToken,
      currentPositionSeconds,
      timestamp: new Date().toISOString(),
    };
  }

  async stopPlayback(userId: string | undefined, body: any): Promise<any> {
    const sessionToken = body?.sessionToken || body?.session_token;
    if (sessionToken) {
      await this.sessionRepo.update({ sessionId: sessionToken }, { status: 'TERMINATED' });
    } else if (userId && body?.deviceId) {
      await this.sessionRepo.update({ userId, deviceId: String(body.deviceId) }, { status: 'TERMINATED' });
    }

    if (userId && (body?.contentId || body?.episodeId)) {
      await this.recordHeartbeat(userId, body);
    }

    return { stopped: true, sessionToken };
  }
}
