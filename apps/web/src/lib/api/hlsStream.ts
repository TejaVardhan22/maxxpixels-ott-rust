import { normalizeApiBaseUrl } from '@ott/shared';

const BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1');
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN ?? '';
const STITCHED_CACHE_TTL_MS = 10_000;

const stitchedInFlight = new Map<string, Promise<StitchedStreamResult>>();
const stitchedCache = new Map<string, { expiresAt: number; value: StitchedStreamResult }>();
const skipInFlight = new Map<string, Promise<string>>();

function authHeaders(userToken: string): HeadersInit {
  return {
    'Api-Token': API_TOKEN,
    'User-Token': userToken,
  };
}

function requestKey(url: URL, userToken: string): string {
  return `${userToken}:${url.toString()}`;
}

export interface FallbackAd {
  ad_id: number;
  placement_id: number;
  video_url: string;
  placement: 'pre_roll' | 'mid_roll' | 'post_roll';
  duration?: number;
  skip_after?: number | null;
  title?: string;
  thumbnail?: string | null;
  time_marker?: number;
}

export interface StitchedStreamResult {
  m3u8Text: string;
  sessionId: string;
  fallbackAds: FallbackAd[] | null;
  /** Total pre-roll ad duration in seconds (0 when no pre-roll was stitched) */
  preRollEndSeconds: number;
  /** True when the manifest contains any EXT-X-DISCONTINUITY / stitched ad blocks */
  hasStitchedAds: boolean;
}

/**
 * Parse the first ad block duration from a stitched m3u8.
 * Ad segments live between the 1st and 2nd EXT-X-DISCONTINUITY tags.
 */
function parseAdBlocks(m3u8: string): { preRollEndSeconds: number; hasStitchedAds: boolean } {
  const lines = m3u8.split('\n');
  let discontinuityCount = 0;
  let inPreRoll = false;
  let preRollSecs = 0;
  let nextDuration: number | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '#EXT-X-DISCONTINUITY') {
      discontinuityCount++;
      inPreRoll = discontinuityCount === 1; // first gap = pre-roll start
      if (discontinuityCount === 2) inPreRoll = false; // second gap = pre-roll end
    } else if (line.startsWith('#EXTINF:')) {
      nextDuration = parseFloat(line.slice(8).split(',')[0]);
    } else if (!line.startsWith('#') && line !== '' && nextDuration !== null) {
      if (inPreRoll) preRollSecs += nextDuration;
      nextDuration = null;
    }
  }

  return { preRollEndSeconds: preRollSecs, hasStitchedAds: discontinuityCount > 0 };
}

export class StreamError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'StreamError';
  }
}

/**
 * Fetch the server-stitched HLS manifest for a video.
 * The returned .m3u8 text already has pre/mid/post-roll ads merged in.
 */
export async function fetchStitchedStream(
  videoId: number,
  userToken: string,
  options: { videoType?: number; quality?: number; sourceUrl?: string } = {},
): Promise<StitchedStreamResult> {
  const { videoType = 1, quality = 0, sourceUrl } = options;

  const url = new URL(`${BASE_URL}/stream/${videoId}`, window.location.origin);
  url.searchParams.set('video_type', String(videoType));
  url.searchParams.set('quality', String(quality));
  url.searchParams.set('device', 'web');
  if (sourceUrl) {
    url.searchParams.set('source_url', sourceUrl);
  }

  const key = requestKey(url, userToken);
  const cached = stitchedCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const existing = stitchedInFlight.get(key);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    const res = await fetch(url.toString(), {
      headers: authHeaders(userToken),
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('ott:auth-expired'));
      }
      throw new StreamError(res.status, await res.text());
    }

    const m3u8Text = await res.text();
    const sessionId = res.headers.get('x-session-id') ?? '';

    const fallbackB64 = res.headers.get('x-fallback-ads');
    let fallbackAds: FallbackAd[] | null = null;
    if (fallbackB64) {
      try {
        fallbackAds = JSON.parse(atob(fallbackB64)) as FallbackAd[];
      } catch {
        fallbackAds = null;
      }
    }

    const adInfo = parseAdBlocks(m3u8Text);
    const result = { m3u8Text, sessionId, fallbackAds, ...adInfo };
    stitchedCache.set(key, {
      expiresAt: Date.now() + STITCHED_CACHE_TTL_MS,
      value: result,
    });
    return result;
  })();

  stitchedInFlight.set(key, request);
  try {
    return await request;
  } finally {
    stitchedInFlight.delete(key);
  }
}

/**
 * Fetch a content-only manifest starting at fromSeconds.
 * Used by the skip-ad button so the player resumes content without re-fetching ad segments.
 */
export async function fetchSkipManifest(
  videoId: number,
  userToken: string,
  fromSeconds: number,
  options: { videoType?: number; quality?: number; sourceUrl?: string } = {},
): Promise<string> {
  const { videoType = 1, quality = 720, sourceUrl } = options;

  const url = new URL(
    `${BASE_URL}/stream/${videoId}/skip`,
    window.location.origin,
  );
  url.searchParams.set('from_seconds', String(Math.floor(fromSeconds)));
  url.searchParams.set('video_type', String(videoType));
  url.searchParams.set('quality', String(quality));
  url.searchParams.set('device', 'web');
  if (sourceUrl) {
    url.searchParams.set('source_url', sourceUrl);
  }

  const key = requestKey(url, userToken);
  const existing = skipInFlight.get(key);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    const res = await fetch(url.toString(), {
      headers: authHeaders(userToken),
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('ott:auth-expired'));
      }
      throw new StreamError(res.status, await res.text());
    }

    return res.text();
  })();

  skipInFlight.set(key, request);
  try {
    return await request;
  } finally {
    skipInFlight.delete(key);
  }
}

export function streamErrorMessage(status: number): string {
  switch (status) {
    case 401: return 'Session expired. Please log in again.';
    case 404: return 'Video not found.';
    case 502: return 'Stream unavailable. Please try again.';
    case 429: return 'Too many requests. Please wait a moment.';
    default:  return 'An error occurred loading the video.';
  }
}
