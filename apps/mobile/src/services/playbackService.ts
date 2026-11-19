import { Platform } from 'react-native';
import { parseAdQueue, PlaybackAd } from './adPlayback';
import { VastService } from './vastService';
import { CatalogItem, PlaybackConfig } from '../types';
import { ApiClient } from './apiClient';
import { AuthService } from './authService';
import { AppConfig } from '../core/config';
import { GraphQLService } from './graphqlService';

export class PlaybackService {
  public static normalizePlaybackUrl(rawUrl?: any): string {
    const value = rawUrl ? String(rawUrl).trim() : '';
    if (!value) return '';
    if (/^(https?:|blob:|data:)/i.test(value)) return value;
    if (value.startsWith('//')) return `https:${value}`;

    const match = /(?:^|\/)([a-z0-9.-]+\.b-cdn\.net\/.+)$/i.exec(value);
    if (match && match[1]) {
      return value.includes('https://') ? value : `https://${match[1]}`;
    }

    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(value)) {
      return `https://${value}`;
    }

    const normalized = AppConfig.normalizeMediaUrl(value);
    return normalized || value;
  }

  public static isHlsStream(url: string): boolean {
    return /\.m3u8($|[?#])|manifest|\/stream(\/|$|\?)/i.test(url);
  }

  public static async requestSecurePlayUrl(
    itemOrId: CatalogItem | number | string,
  ): Promise<PlaybackConfig> {
    const item = typeof itemOrId === 'object' ? itemOrId : undefined;
    const rawId = item?.id ?? (item as any)?.videoId ?? (item as any)?.contentId ?? (item as any)?.slug ?? itemOrId;
    const cleanId = String(rawId ?? '').trim();
    if (!cleanId || cleanId === '0' || cleanId === 'NaN' || cleanId === 'undefined')
      throw new Error('No playable title was selected.');
    const devType = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
    const result = await ApiClient.postApi(
      'video/play',
      {
        video_id: cleanId,
        content_id: cleanId,
        slug: item?.slug || cleanId,
        video_type: item?.videoType || 1,
        quality: 'auto',
        device: 'mobile',
        device_type: devType,
        deviceType: devType,
        device_id: `mobile-${Platform.OS}-${AuthService.user?.id || 'client'}`,
      },
      { userToken: AuthService.authToken || undefined },
    );
    const response = result?.data || result;
    const raw =
      response?.stream_url ||
      response?.streamUrl ||
      response?.manifestUrl ||
      response?.manifest_url ||
      response?.hls_url ||
      response?.hlsUrl ||
      item?.videoUrl ||
      item?.streamUrl ||
      (item as any)?.movie?.videoAssetId;
    if (!raw) throw new Error('The server did not provide a playable stream.');
    const streamUrl = this.normalizePlaybackUrl(raw);
    let queue = response?.ads?.queue || response?.adQueue || response?.ad_queue;
    if (response?.ads?.enabled === false) {
      queue = {};
    } else if (!queue || (!queue.pre_roll && !queue.mid_roll && !queue.preroll && !queue.midroll)) {
      try {
        const resultQueue = await ApiClient.getApi('ads/queue', {
          queryParams: { video_id: cleanId, device: 'mobile' },
          userToken: AuthService.authToken || undefined,
        });
        const fetched = resultQueue?.data || resultQueue;
        if (fetched && (fetched.pre_roll || fetched.mid_roll || fetched.preroll || fetched.midroll)) {
          queue = fetched;
        }
      } catch {
        /* fallback to existing queue */
      }
    }
    const rawAds = parseAdQueue(queue, url => this.normalizePlaybackUrl(url));
    const ads: PlaybackAd[] = [];

    for (const ad of rawAds) {
      if (ad.isVast && ad.tagUrl) {
        try {
          const resolved = await VastService.resolveVastUrl(ad.tagUrl);
          if (resolved) {
            ads.push({
              ...ad,
              url: resolved.mediaUrl,
              title: resolved.title || ad.title,
              skipAfter: resolved.skipOffsetSeconds ?? ad.skipAfter ?? 5,
              clickThroughUrl: resolved.clickThroughUrl,
              clickTrackingUrls: resolved.clickTrackingUrls,
              impressionUrls: resolved.impressionUrls,
              trackingEvents: resolved.trackingEvents,
            });
            continue;
          }
        } catch (e: any) {
          console.warn('[PlaybackService] Failed to resolve VAST tag for ad:', ad.id, e?.message);
        }
      }
      ads.push(ad);
    }

    // InMobi VAST Integration: If no video ads were returned in server queue,
    // inject InMobi pre-roll video ad.
    if (ads.length === 0 && response?.ads?.enabled !== false && !response?.is_premium) {
      try {
        const inmobiTagUrl = VastService.buildInMobiVastTagUrl({ contentId: cleanId });
        const inmobiAd = await VastService.resolveVastUrl(inmobiTagUrl);
        if (inmobiAd) {
          ads.push({
            key: 'inmobi-preroll-0',
            id: inmobiAd.id,
            url: inmobiAd.mediaUrl,
            tagUrl: inmobiTagUrl,
            isVast: true,
            at: 0,
            placement: 'pre',
            title: inmobiAd.title || 'InMobi Video Ad',
            skipAfter: inmobiAd.skipOffsetSeconds ?? 5,
            clickThroughUrl: inmobiAd.clickThroughUrl,
            clickTrackingUrls: inmobiAd.clickTrackingUrls,
            impressionUrls: inmobiAd.impressionUrls,
            trackingEvents: inmobiAd.trackingEvents,
          });
        }
      } catch (err: any) {
        console.log('[PlaybackService] InMobi VAST tag unfulfilled:', err?.message);
      }
    }

    return {
      streamUrl,
      ads,
      adMarkers: ads.filter(ad => ad.placement === 'mid').map(ad => ad.at),
      adSessionId: response?.ads?.session_id || response?.sessionId,
      isHls: this.isHlsStream(streamUrl),
      sessionToken:
        response?.sessionToken || response?.session_token || response?.sessionId || response?.session_id,
      contentId: (response?.contentId ?? response?.content_id ?? cleanId) as number | string,
      episodeId: response?.episodeId ?? response?.episode_id ?? undefined,
      showAds: response?.showAds ?? response?.show_ads,
    };
  }

  public static async recordAdImpression(
    adId: string,
    videoId: number | string,
    sessionId?: string,
    extra?: { providerCode?: string; eventType?: string },
  ): Promise<void> {
    if (!adId) return;
    const numericAdId = Number(adId);
    const campaignId = Number.isFinite(numericAdId) && numericAdId > 0 ? numericAdId : undefined;
    try {
      // `ads/track` increments the campaign impression counter and, because we
      // now send eventType + sessionToken, also writes an attributed
      // ad_events row (revenue) through the monetization service.
      await ApiClient.postApi(
        'ads/track',
        {
          ad_id: campaignId,
          campaignId,
          video_id: videoId,
          content_id: videoId,
          contentId: videoId,
          sessionToken: sessionId,
          session_id: sessionId,
          providerCode: extra?.providerCode || 'DIRECT',
          eventType: extra?.eventType || 'IMPRESSION',
          metadata: { device: Platform.OS, format: 'VIDEO' },
        },
        { userToken: AuthService.authToken || undefined },
      );
    } catch {
      /* Analytics must not interrupt playback. */
    }
  }

  public static async sendHeartbeat(
    sessionToken: string,
    params?: {
      contentId?: number | string;
      episodeId?: number;
      positionSeconds?: number;
      durationSeconds?: number;
    },
  ): Promise<void> {
    if (!sessionToken) return;
    const devType = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
    try {
      await ApiClient.postApi(
        'playback/heartbeat',
        {
          sessionToken,
          session_token: sessionToken,
          contentId: params?.contentId,
          content_id: params?.contentId,
          episodeId: params?.episodeId,
          currentPositionSeconds: Math.max(0, Math.floor(params?.positionSeconds || 0)),
          totalDurationSeconds: Math.max(0, Math.floor(params?.durationSeconds || 0)),
          deviceType: devType,
          device_type: devType,
        },
        { userToken: AuthService.authToken || undefined },
      );
    } catch {}
  }

  /** Releases the concurrency slot created by POST /video/play. */
  public static async stopPlayback(
    sessionToken?: string,
    params?: {
      contentId?: number | string;
      episodeId?: number;
      positionSeconds?: number;
      durationSeconds?: number;
    },
  ): Promise<void> {
    if (!sessionToken) return;
    const devType = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
    try {
      await ApiClient.postApi(
        'playback/stop',
        {
          sessionToken,
          session_token: sessionToken,
          contentId: params?.contentId,
          content_id: params?.contentId,
          episodeId: params?.episodeId,
          positionSeconds: Math.max(0, Math.floor(params?.positionSeconds || 0)),
          durationSeconds: Math.max(0, Math.floor(params?.durationSeconds || 0)),
          deviceType: devType,
          device_type: devType,
        },
        { userToken: AuthService.authToken || undefined },
      );
    } catch {}
  }

  public static async recordProgress(params: {
    contentId: number | string;
    episodeId?: number;
    positionSeconds: number;
    durationSeconds: number;
  }): Promise<void> {
    try {
      // Direct REST playback progress tracking
      const devType = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
      await ApiClient.postApi(
        'playback/progress',
        {
          contentId: params.contentId,
          content_id: params.contentId,
          video_id: params.contentId,
          episodeId: params.episodeId,
          positionSeconds: params.positionSeconds,
          stop_time: params.positionSeconds,
          durationSeconds: params.durationSeconds,
          video_duration: params.durationSeconds,
          device_type: devType,
          deviceType: devType,
          device: 'mobile',
          device_id: `mobile-${Platform.OS}-${AuthService.user?.id || 'client'}`,
        },
        { userToken: AuthService.authToken || undefined },
      );
    } catch {}
  }
}
