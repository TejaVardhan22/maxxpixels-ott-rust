import { getApiClient, getJson } from './client';

// ── Types ────────────────────────────────────────────────────────────────

export interface PlayUrlResult {
  stream_url: string;
  fallback_stream_url?: string;
  fallback_mp4_url?: string;
  subtitle_tracks?: Array<{
    label: string;
    src: string;
    srclang?: string;
  }>;
  video_id: number;
  is_premium: number;
  quality: number;
  expires_in: number;
  /** Playback session token created by the authorize call (used by heartbeats/stop). */
  session_token?: string;
  sessionToken?: string;
  show_ads?: boolean;
  showAds?: boolean;
  vast_tag_url?: string | null;
  vastTagUrl?: string | null;
}

export interface SubscriptionStatus {
  is_subscribed: boolean;
  subscription: {
    package_id: number;
    package_name: string;
    expiry_date: string;
    days_remaining: number;
    is_expired: boolean;
  } | null;
}

// ── Video Access API ──────────────────────────────────────────────────────

export interface VideoMetadataResult {
  id: number;
  video_type: number;
  title: string;
  image: string;
  is_free: number;
  is_premium: number;
  trailer_url: string;
  trailer_type: string;
  video_upload_type: string;
}

export interface TrailerApiResult {
  trailer_url: string;
  trailer_type: string;
  trailer_thumbnail: string;
}

export const videoAccessApi = {
  /**
   * GET /api/video/{id}?video_type=
   * Public metadata (Api-Token only). No stream URLs.
   */
  async getVideoMetadata(videoId: number, videoType: number): Promise<VideoMetadataResult> {
    const res = await getJson<{
      status: number;
      result: VideoMetadataResult;
    }>(`video/${videoId}?video_type=${encodeURIComponent(String(videoType))}`);
    return res.result;
  },

  /**
   * GET /api/video/{id}/trailer?video_type=&sub_video_type=
   */
  async getTrailerPayload(videoId: number, videoType: number, subVideoType: number = 0): Promise<TrailerApiResult> {
    const res = await getJson<any>(
      `video/${videoId}/trailer?video_type=${encodeURIComponent(String(videoType))}&sub_video_type=${encodeURIComponent(String(subVideoType))}`,
    );
    const payload = res?.result ?? res?.data ?? res ?? {};
    return payload as TrailerApiResult;
  },

  /**
   * Request a secure, short-lived stream URL for a video.
   * Fails with HTTP 403 if the user lacks subscription for premium content.
   *
   * @param videoId    Numeric DB id of the content row
   * @param videoType  1=video, 2=tvshow episode, 8=short
   * @param quality    320|480|720|1080
   */
  async getPlayUrl(
    videoId: number,
    videoType: number = 1,
    quality: number = 720,
    options?: { episodeId?: number; contentId?: number },
  ): Promise<PlayUrlResult> {
    const res = await getApiClient().post<any>('video/play', {
      video_id: videoId,
      video_type: videoType,
      quality,
      device_type: 'WEB',
      deviceType: 'WEB',
      device: 'web',
      // The backend authorizes episodes through `episodeId` and resolves the
      // parent series for entitlement + view accounting.
      ...(options?.episodeId
        ? { episodeId: options.episodeId, episode_id: options.episodeId }
        : {}),
      ...(options?.contentId
        ? { contentId: options.contentId, content_id: options.contentId }
        : {}),
    });
    const payload = res.data?.result ?? res.data?.data ?? res.data;
    if (payload && typeof payload === 'object') {
      return {
        stream_url: payload.stream_url || payload.streamUrl || payload.manifest_url || payload.manifestUrl || payload.hls_url || payload.hlsUrl || payload.url || (payload.stream?.url) || '',
        fallback_stream_url: payload.fallback_stream_url || payload.fallbackStreamUrl || payload.direct_play_url || payload.directPlayUrl,
        fallback_mp4_url: payload.fallback_mp4_url || payload.fallbackMp4Url || payload.direct_play_url || payload.directPlayUrl,
        subtitle_tracks: payload.subtitle_tracks || payload.subtitles,
        video_id: Number(payload.video_id || payload.videoId || videoId),
        is_premium: Number(payload.is_premium ?? (payload.isPremium ? 1 : 0)),
        quality: Number(payload.quality || quality),
        expires_in: Number(payload.expires_in || payload.expiresIn || 14400),
        session_token:
          payload.session_token || payload.sessionToken || payload.session_id || payload.sessionId,
        show_ads: payload.show_ads ?? payload.showAds,
        vast_tag_url: payload.vast_tag_url || payload.vastTagUrl || null,
      };
    }
    return payload as PlayUrlResult;
  },

  /** Same as getPlayUrl but uses POST /api/video/{id}/play */
  async getPlayUrlByRoute(
    videoId: number,
    videoType: number = 1,
    quality: number = 720,
  ): Promise<PlayUrlResult> {
    const res = await getApiClient().post<any>(`video/${videoId}/play`, {
      video_type: videoType,
      quality,
      device_type: 'WEB',
      deviceType: 'WEB',
      device: 'web',
    });
    const payload = res.data?.result ?? res.data?.data ?? res.data;
    if (payload && typeof payload === 'object') {
      return {
        stream_url: payload.stream_url || payload.streamUrl || payload.manifest_url || payload.manifestUrl || payload.hls_url || payload.hlsUrl || payload.url || (payload.stream?.url) || '',
        fallback_stream_url: payload.fallback_stream_url || payload.fallbackStreamUrl || payload.direct_play_url || payload.directPlayUrl,
        fallback_mp4_url: payload.fallback_mp4_url || payload.fallbackMp4Url || payload.direct_play_url || payload.directPlayUrl,
        subtitle_tracks: payload.subtitle_tracks || payload.subtitles,
        video_id: Number(payload.video_id || payload.videoId || videoId),
        is_premium: Number(payload.is_premium ?? (payload.isPremium ? 1 : 0)),
        quality: Number(payload.quality || quality),
        expires_in: Number(payload.expires_in || payload.expiresIn || 14400),
        session_token:
          payload.session_token || payload.sessionToken || payload.session_id || payload.sessionId,
        show_ads: payload.show_ads ?? payload.showAds,
        vast_tag_url: payload.vast_tag_url || payload.vastTagUrl || null,
      };
    }
    return payload as PlayUrlResult;
  },

  /**
   * Fetch the current user's subscription status.
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    const res = await getApiClient().post<{ status: number } & SubscriptionStatus>(
      'subscription/status',
      {},
    );
    return {
      is_subscribed: res.data.is_subscribed,
      subscription: res.data.subscription,
    };
  },
};
