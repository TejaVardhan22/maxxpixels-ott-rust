import { videoAccessApi } from './videoAccess';
import { OttApiError } from './errors';

type SecurePlaybackBase = {
  streamUrl: string;
  fallbackUrl?: string;
  subtitles?: Array<{ label: string; src: string; srclang?: string }>;
  /** Authorized playback session token; required for heartbeats and stop. */
  sessionToken?: string;
  showAds?: boolean;
  vastTagUrl?: string | null;
};

export type SecurePlayback =
  | ({ kind: 'hls' } & SecurePlaybackBase)
  | ({ kind: 'direct' } & SecurePlaybackBase);

type PlaybackCacheEntry = {
  value: SecurePlayback;
  expiresAt: number;
};

const PLAYBACK_CACHE_KEY = 'ott-secure-playback-cache';
const inMemoryPlaybackCache = new Map<string, PlaybackCacheEntry>();

function cacheKey(params: { videoId: number; videoType: number; quality?: number }): string {
  return `${params.videoType}:${params.videoId}:${params.quality ?? 720}`;
}

function readStoredCache(): Record<string, PlaybackCacheEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(PLAYBACK_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PlaybackCacheEntry>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredCache(entries: Record<string, PlaybackCacheEntry>): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(PLAYBACK_CACHE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage quota / privacy mode failures.
  }
}

function getCachedPlayback(key: string): SecurePlayback | null {
  const now = Date.now();
  const memory = inMemoryPlaybackCache.get(key);
  if (memory && memory.expiresAt > now) {
    return memory.value;
  }
  if (memory) {
    inMemoryPlaybackCache.delete(key);
  }

  const stored = readStoredCache();
  const entry = stored[key];
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    delete stored[key];
    writeStoredCache(stored);
    return null;
  }
  inMemoryPlaybackCache.set(key, entry);
  return entry.value;
}

function setCachedPlayback(key: string, value: SecurePlayback, expiresInSeconds?: number): void {
  const ttlMs = Math.max(30_000, (expiresInSeconds ?? 300) * 1000);
  const entry: PlaybackCacheEntry = {
    value,
    expiresAt: Date.now() + ttlMs,
  };
  inMemoryPlaybackCache.set(key, entry);

  const stored = readStoredCache();
  stored[key] = entry;
  writeStoredCache(stored);
}

function classifyStreamUrl(streamUrl: string): SecurePlayback['kind'] {
  const normalized = streamUrl.toLowerCase();
  if (
    normalized.includes('.m3u8') ||
    normalized.includes('manifest') ||
    normalized.includes('/api/v1/stream/') ||
    normalized.includes('/api/stream/') ||
    normalized.endsWith('/stream') ||
    normalized.includes('/stream/')
  ) {
    return 'hls';
  }
  return 'direct';
}

function normalizeStreamUrl(streamUrl: string | undefined): string | undefined {
  const value = (streamUrl ?? '').trim();
  if (!value) return undefined;
  if (/^(https?:|blob:|data:)/i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  const embeddedCdnUrl = value.match(/(?:^|\/)([a-z0-9.-]+\.b-cdn\.net\/.+)$/i)?.[1];
  if (embeddedCdnUrl) {
    const withProtocol = `https://${embeddedCdnUrl}`;
    if (value.includes('https://')) return value;
    return withProtocol;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(value)) return `https://${value}`;
  return value;
}

/**
 * Server-authoritative playback resolution for direct stream playback only.
 * Caller must already be authenticated (User-Token) and pass entitlement checks.
 */
export async function resolveSecurePlayback(params: {
  videoId: number;
  videoType: number;
  quality?: number;
  /** Set when `videoId` is an episode id. */
  episodeId?: number;
  /** Parent series/movie id, used for entitlement and view accounting. */
  contentId?: number;
}): Promise<SecurePlayback> {
  const vid = Number(params?.videoId);
  if (!Number.isFinite(vid) || vid <= 0) {
    throw new OttApiError('Invalid title ID for playback.', 400);
  }
  const q = params.quality ?? 720;
  const key = cacheKey({ ...params, videoId: vid, quality: q });
  const cached = getCachedPlayback(key);

  // Always authorize a new play. The authorize call creates a fresh playback
  // session and writes an idempotent view record; skipping it on a cache hit
  // silently undercounted repeat views. The cache is now a transient fallback
  // for rate limits/outages, not a replacement for authorization.
  try {
    const r = await videoAccessApi.getPlayUrl(params.videoId, params.videoType, q, {
      episodeId: params.episodeId,
      contentId: params.contentId,
    });
    const streamUrl = normalizeStreamUrl(r.stream_url);
    if (streamUrl) {
      const resolved: SecurePlayback = {
        kind: classifyStreamUrl(streamUrl),
        streamUrl,
        fallbackUrl: normalizeStreamUrl(r.fallback_mp4_url ?? r.fallback_stream_url),
        subtitles: r.subtitle_tracks,
        sessionToken: r.session_token,
        showAds: r.show_ads,
        vastTagUrl: r.vast_tag_url ?? null,
      };
      setCachedPlayback(key, resolved, r.expires_in);
      return resolved;
    }
  } catch (e) {
    const status = e instanceof OttApiError ? (e.status ?? 0) : 0;
    const transient = status === 0 || status === 429 || status >= 500 || status === 404 || status === 422;
    if (cached && transient) {
      return cached;
    }
    // Preserve actionable API failures (auth/subscription errors) instead of
    // masking them as "no playable stream".
    if (e instanceof OttApiError && status !== 404 && status !== 422) {
      throw e;
    }
  }

  const meta = await videoAccessApi.getVideoMetadata(params.videoId, params.videoType);
  throw new OttApiError('This title does not provide a playable stream.', 404, meta);
}
