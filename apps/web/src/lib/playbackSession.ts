'use client';

/** Ephemeral hand-off so signed URLs never live in the browser address bar / share links. */
export const PENDING_PLAYBACK_KEY = 'ott-pending-playback';
const LAST_PLAYBACK_KEY = 'ott-last-playback';

export type PendingPlayback = {
  kind: 'hls' | 'direct';
  url: string;
  fallbackUrl?: string;
  subtitles?: Array<{ label: string; src: string; srclang?: string }>;
  /** Catalogue / episode id - when set, player can run ads */
  videoId?: number;
  /** video_type param (1=Movie, 2=TVShow, 8=Shorts) - needed for /api/stream skip endpoint */
  videoType?: number;
  /** Backend type/category bucket used by detail/watchlist APIs */
  typeId?: number;
  categoryId?: string;
  resumeAt?: number;
  title?: string;
  poster?: string;
  /** Authorized playback session token from POST /api/v1/video/play */
  sessionToken?: string;
  showAds?: boolean;
  vastTagUrl?: string | null;
  ts: number;
};

const HANDOFF_TTL_MS = 120_000;
const LAST_PLAYBACK_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * In development, React 18 Strict Mode remounts once; a second
 * `consumePendingPlayback` would read empty sessionStorage. We memoize
 * the first result until the next `setPendingPlayback` handoff.
 */
let _consumedHandoff: PendingPlayback | null | undefined;
export type PendingPlaybackInput = Omit<PendingPlayback, 'ts'>;

export function setPendingPlayback(p: PendingPlaybackInput): void {
  if (typeof window === 'undefined') return;
  _consumedHandoff = undefined;
  const payload: PendingPlayback = { ...p, ts: Date.now() } as PendingPlayback;
  const serialized = JSON.stringify(payload);
  sessionStorage.setItem(PENDING_PLAYBACK_KEY, serialized);
  localStorage.setItem(LAST_PLAYBACK_KEY, serialized);
}

function readStoredPlayback(raw: string | null, ttlMs: number): PendingPlayback | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as PendingPlayback;
    if (Date.now() - (p as { ts: number }).ts > ttlMs) {
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function consumePendingPlayback(): PendingPlayback | null {
  if (typeof window === 'undefined') return null;
  if (_consumedHandoff !== undefined) {
    return _consumedHandoff;
  }
  const pendingRaw = sessionStorage.getItem(PENDING_PLAYBACK_KEY);
  sessionStorage.removeItem(PENDING_PLAYBACK_KEY);
  const pending = readStoredPlayback(pendingRaw, HANDOFF_TTL_MS);
  if (pending) {
    _consumedHandoff = pending;
    return pending;
  }

  const last = readStoredPlayback(localStorage.getItem(LAST_PLAYBACK_KEY), LAST_PLAYBACK_TTL_MS);
  if (!last) {
    localStorage.removeItem(LAST_PLAYBACK_KEY);
  }
  _consumedHandoff = last;
  return last;
}

export function clearPendingPlayback(): void {
  if (typeof window === 'undefined') return;
  _consumedHandoff = null;
  sessionStorage.removeItem(PENDING_PLAYBACK_KEY);
  localStorage.removeItem(LAST_PLAYBACK_KEY);
}
