import { contentTypes } from '../constants/theme';

export function videoTypeLabel(videoType?: number): string {
  switch (videoType) {
    case contentTypes.movieContentType: return 'Movie';
    case contentTypes.showContentType: return 'Show';
    case contentTypes.genresType: return 'Genre';
    case contentTypes.languageType: return 'Language';
    case contentTypes.upcomingContentType: return 'Upcoming';
    case contentTypes.channelContentType: return 'Channel';
    case contentTypes.kidsContentType: return 'Kids';
    case contentTypes.clipsContentType: return 'Clips';
    default: return 'Content';
  }
}

export function formatDuration(seconds?: number | string | null): string {
  const total = Number(seconds) || 0;
  if (total <= 0) return '';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export function progressPercent(stopTime?: number | string, duration?: number | string): number {
  const s = Number(stopTime) || 0;
  const d = Number(duration) || 0;
  if (d <= 0) return 0;
  return Math.min(Math.round((s / d) * 100), 100);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function getBestVideoUrl(item: Record<string, unknown>): string {
  return (
    (item.video_4k as string) ||
    (item.video4kUrl as string) ||
    (item.video_2k as string) ||
    (item.video2kUrl as string) ||
    (item.video_1080 as string) ||
    (item.video1080Url as string) ||
    (item.video_720 as string) ||
    (item.video720Url as string) ||
    (item.masterPlaylistUrl as string) ||
    (item.master_playlist_url as string) ||
    (item.videoAssetId as string) ||
    (item.video_asset_id as string) ||
    (item.stream_url as string) ||
    (item.streamUrl as string) ||
    (item.video_480 as string) ||
    (item.video480Url as string) ||
    (item.video_360 as string) ||
    (item.video_240 as string) ||
    (item.video_320 as string) ||
    (item.video320Url as string) ||
    (item.video_url as string) ||
    (item.videoUrl as string) ||
    (item.rawVideoUrl as string) ||
    (item.raw_video_url as string) ||
    ''
  );
}

/**
 * Progressive/HLS URL for the **main** feature only (never use trailer_url here —
 * trailers use getTrailerUrl / GET /api/video/{id}/trailer).
 * Catalog responses strip direct URLs; this remains for legacy/local fixtures.
 */
export function getPlayableStreamUrl(item: Record<string, unknown>): string | undefined {
  const chain = [
    item.video_4k,
    item.video4kUrl,
    item.video_2k,
    item.video2kUrl,
    item.video_1080,
    item.video1080Url,
    item.video_720,
    item.video720Url,
    item.masterPlaylistUrl,
    item.master_playlist_url,
    item.videoAssetId,
    item.video_asset_id,
    item.stream_url,
    item.streamUrl,
    item.video_480,
    item.video480Url,
    item.video_360,
    item.video_240,
    item.video_320,
    item.video320Url,
    item.video_url,
    item.videoUrl,
    item.rawVideoUrl,
    item.raw_video_url,
  ];
  const found = chain.find((v) => typeof v === 'string' && (v as string).trim().length > 0);
  return found as string | undefined;
}

/** Trailer asset URL from a content row (when API still exposes it for preview UIs). */
export function getTrailerUrl(item: Record<string, unknown>): string | undefined {
  const u = item.trailer_url || item.trailerUrl || (item as any)?.trailer;
  return typeof u === 'string' && u.trim().length > 0 ? u.trim() : undefined;
}

export type TrailerTypeHint = 'youtube' | 'mp4' | 'hls' | 'external' | 'server_video' | string;

export function normalizeTrailerType(raw?: string | null): TrailerTypeHint {
  const t = String(raw ?? '').toLowerCase();
  if (t.includes('youtube')) return 'youtube';
  if (t === 'server_video' || t === 'external') return t;
  if (t === 'hls' || t === 'm3u8') return 'hls';
  if (t === 'mp4') return 'mp4';
  return t || 'external';
}

export function getYear(dateStr?: string | null): string {
  if (!dateStr) return '';
  const match = dateStr.match(/^\d{4}/);
  return match ? match[0] : '';
}

type ContentImageItem = {
  thumbnail?: string;
  landscape?: string;
  image?: string;
  imageUrl?: string;
  image_url?: string;
  poster?: string;
  posterUrl?: string;
  poster_url?: string;
  backdropUrl?: string;
  backdrop_url?: string;
  landscapeImageUrl?: string;
  landscape_image_url?: string;
  banner?: string;
  bannerUrl?: string;
  banner_url?: string;
  [key: string]: any;
};

const LANDSCAPE_IMAGE_KEYS: (keyof ContentImageItem)[] = [
  'bannerImageUrl',
  'banner_image_url',
  'bannerUrl',
  'banner_url',
  'banner',
  'landscapeImageUrl',
  'landscape_image_url',
  'landscape',
  'backdropUrl',
  'backdrop_url',
];

const PORTRAIT_IMAGE_KEYS: (keyof ContentImageItem)[] = [
  'thumbnail',
  'poster',
  'poster_url',
  'posterUrl',
  'image',
  'imageUrl',
  'image_url',
];

// These legacy landscape URLs are still written into backend responses for older titles,
// but the files no longer exist. Skip them so the backend's poster URL is used instead.
const STALE_LANDSCAPE_HOSTS = new Set([
  'api.maxxpixels.com',
  'maxxpixels.com',
  'www.maxxpixels.com',
]);

function isStaleLandscapeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      STALE_LANDSCAPE_HOSTS.has(parsed.hostname.toLowerCase()) &&
      /\/uploads\/banners\//i.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

/**
 * Ordered raw image URLs from API content rows. Landscape requests keep landscape fields
 * first but end with the backend's poster URL, so a stale/missing wide asset can fall back
 * to artwork the backend actually serves.
 */
export function getContentImageCandidates(
  item?: ContentImageItem | null,
  prefer: 'portrait' | 'landscape' = 'portrait',
): string[] {
  if (!item) return [];
  const keys = prefer === 'landscape'
    ? [...LANDSCAPE_IMAGE_KEYS, ...PORTRAIT_IMAGE_KEYS]
    : [...PORTRAIT_IMAGE_KEYS, ...LANDSCAPE_IMAGE_KEYS];
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const key of keys) {
    const value = item[key];
    if (typeof value !== 'string') continue;
    const url = value.trim();
    if (!url || seen.has(url)) continue;
    if (prefer === 'landscape' && LANDSCAPE_IMAGE_KEYS.includes(key) && isStaleLandscapeUrl(url)) {
      continue;
    }
    seen.add(url);
    candidates.push(url);
  }
  return candidates;
}

/** Raw image path from API content rows. Kept for existing consumers. */
export function getContentImagePath(
  item?: ContentImageItem | null,
  prefer: 'portrait' | 'landscape' = 'portrait',
): string | undefined {
  return getContentImageCandidates(item, prefer)[0];
}

export function getContentId(item: Record<string, any> | null | undefined): number | undefined {
  if (!item) return undefined;
  const raw =
    item.id ??
    item.video_id ??
    item.videoId ??
    item.content_id ??
    item.contentId ??
    item.resource_id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function getContentSlug(item: Record<string, any> | null | undefined): string {
  if (!item) return '';
  const rawSlug = item.slug || (typeof item.id === 'string' && isNaN(Number(item.id)) ? item.id : '');
  if (rawSlug && typeof rawSlug === 'string' && rawSlug.trim() !== '' && rawSlug !== 'NaN' && rawSlug !== 'undefined') {
    return rawSlug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  const title = item.name || item.title || '';
  if (title) {
    const slugified = String(title).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (slugified) return slugified;
  }
  const numericId = getContentId(item);
  if (numericId && numericId > 0) {
    return String(numericId);
  }
  return '';
}

/**
 * Hotstar / OTT canonical content URL structure:
 * - Movies:  /movies/{title-slug}
 * - Series:  /shows/{title-slug}
 * - Default: /movies/{title-slug}
 */
export function getContentUrl(item: Record<string, any> | null | undefined): string {
  if (!item) return '/';
  const slug = getContentSlug(item);
  const id = getContentId(item);
  const vType = Number(item.video_type || item.videoType || 1);
  const cType = String(item.content_type || item.contentType || '').toUpperCase();

  const isSeries = vType === 2 || vType === 6 || cType === 'SERIES' || cType === 'TV_SHOW' || cType === 'SHOW';

  if (!slug && !id) return '/';
  const effectiveSlug = slug || String(id);

  if (isSeries) {
    return `/shows/${effectiveSlug}`;
  }
  return `/movies/${effectiveSlug}`;
}

/**
 * Hotstar / OTT canonical watch URL structure:
 * - Movies:  /movies/{title-slug}/watch
 * - Series:  /shows/{title-slug}/watch?ep={episodeId}
 * - Others:  /watch/{title-slug}?ep={episodeId}
 */
export function getWatchUrl(
  item: Record<string, any> | null | undefined,
  episodeId?: number,
  resumeAt?: number,
): string {
  if (!item) return '/';
  const slug = getContentSlug(item);
  const id = getContentId(item);
  if (!slug && !id) return '/';
  const effectiveSlug = slug || String(id);

  const vType = Number(item.video_type || item.videoType || 1);
  const cType = String(item.content_type || item.contentType || '').toUpperCase();
  const isSeries = vType === 2 || vType === 6 || cType === 'SERIES' || cType === 'TV_SHOW' || cType === 'SHOW';

  const params = new URLSearchParams();
  if (episodeId && episodeId > 0) params.set('ep', String(episodeId));
  if (resumeAt && resumeAt > 0) params.set('t', String(resumeAt));
  const qs = params.toString();

  const basePath = isSeries ? `/shows/${effectiveSlug}/watch` : `/movies/${effectiveSlug}/watch`;
  return `${basePath}${qs ? `?${qs}` : ''}`;
}

export function getGenreSlug(category: Record<string, any> | string | null | undefined): string {
  if (!category) return '';
  if (typeof category === 'string') {
    return category.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  const raw = category.slug || category.name || category.title || category.id;
  return String(raw ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function getGenreUrl(category: Record<string, any> | string | null | undefined): string {
  const slug = getGenreSlug(category);
  return slug ? `/genres/${slug}` : '/genres';
}

export function getLanguageSlug(language: Record<string, any> | string | null | undefined): string {
  if (!language) return '';
  if (typeof language === 'string') {
    return language.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  const raw = language.slug || language.param || language.code || language.name || language.id;
  return String(raw ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function getLanguageUrl(language: Record<string, any> | string | null | undefined): string {
  const slug = getLanguageSlug(language);
  return slug ? `/languages/${slug}` : '/languages';
}

export function getChannelUrl(channel: Record<string, any> | string | null | undefined): string {
  if (!channel) return '/channels';
  if (typeof channel === 'string') {
    const slug = channel.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug ? `/channels/${slug}` : '/channels';
  }
  const slug = (channel.slug || channel.name || channel.id || '').toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
  return slug ? `/channels/${slug}` : '/channels';
}

export function getCastUrl(cast: Record<string, any> | string | null | undefined): string {
  if (!cast) return '/cast';
  if (typeof cast === 'string') {
    const slug = cast.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug ? `/cast/${slug}` : '/cast';
  }
  const slug = (cast.slug || cast.name || cast.title || cast.id || '').toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
  return slug ? `/cast/${slug}` : '/cast';
}
