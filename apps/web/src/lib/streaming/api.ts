import {
  catalogApi,
  getJson,
  getContentImagePath,
  posterFallback,
  resolveImageUrl,
  type ApiListResponse,
  type ContentItem,
  type Section,
  type SessionContext,
} from '@ott/shared';
import type { HomeRow, StreamTitle } from '@/lib/streaming/types';

const guest: SessionContext = { userId: 0, deviceId: 'web' };

export type SpringBootContentSummary = {
  id: number;
  title: string;
  slug?: string;
  contentType?: string;
  content_type?: string;
  description?: string;
  shortDescription?: string;
  posterUrl?: string;
  landscapeImageUrl?: string;
  releaseYear?: number;
  durationSeconds?: number;
  ageRating?: string;
  language?: string;
  isPremium?: boolean;
  monetization?: string;
  genres?: string[];
  aspectRatio?: string;
  isAiGenerated?: boolean;
  videoAssetId?: string;
  name?: string;
  image?: string;
  landscape?: string;
  thumbnail?: string;
  video_id?: number;
  video_type?: number;
  type_id?: number;
  release_year?: string;
  video_duration?: number;
  is_premium?: number;
  stop_time?: number;
  rating?: number;
  imdb_rating?: number;
  total_rating?: number;
  language_name?: string;
  category_name?: string;
  is_bookmark?: number;
  is_original?: number;
  cast?: Array<{ id?: number | string; name?: string; type?: string; role?: string; image?: string; photo?: string }>;
};

export type SpringBootSection = {
  id: number;
  title: string;
  type?: string;
  layout?: string;
  screen_layout?: string;
  section_type?: number;
  items?: SpringBootContentSummary[];
  data?: SpringBootContentSummary[];
  slug?: string;
};

export type SpringBootBanner = {
  id: number;
  title?: string;
  name?: string;
  imageUrl?: string;
  image?: string;
  actionUrl?: string;
  content?: SpringBootContentSummary;
  video_id?: number;
  video_type?: number;
  type_id?: number;
};

export type SpringBootHomeResponse = {
  banners?: SpringBootBanner[];
  continueWatching?: SpringBootContentSummary[];
  featured?: SpringBootContentSummary[];
  latest?: SpringBootContentSummary[];
  sections?: SpringBootSection[];
  categories?: unknown[];
};

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function parseStreamTitleId(id: string): { videoType: number; typeId: number; videoId: number } {
  const parts = id.split('-').map((part) => Number(part));
  if (parts.length >= 3) {
    const [videoType, typeId, videoId] = parts;
    return {
      videoType: Number.isFinite(videoType) && videoType > 0 ? videoType : 1,
      typeId: Number.isFinite(typeId) && typeId > 0 ? typeId : 1,
      videoId: Number.isFinite(videoId) && videoId > 0 ? videoId : 0,
    };
  }
  const numeric = Number(id);
  return {
    videoType: 1,
    typeId: 1,
    videoId: Number.isFinite(numeric) && numeric > 0 ? numeric : 0,
  };
}

function titleId(item: SpringBootContentSummary | ContentItem): string {
  const id = asNumber((item as any).video_id ?? item.id);
  const videoType = asNumber((item as any).video_type, 1);
  const typeId = asNumber((item as any).type_id, 1);
  return [videoType, typeId, id].join('-');
}

function kindFrom(item: SpringBootContentSummary | ContentItem): StreamTitle['kind'] {
  const vType = asNumber((item as any).video_type);
  const cType = String((item as any).contentType || (item as any).content_type || '').toUpperCase();
  if (vType === 2 || cType === 'SERIES' || cType === 'TV_SHOW') return 'series';
  if (vType === 6 || cType === 'LIVE') return 'live';
  return 'movie';
}

export function mapContentSummaryToStreamTitle(item: SpringBootContentSummary | ContentItem, rank?: number): StreamTitle {
  const title = String((item as any).title ?? (item as any).name ?? 'Untitled');
  const posterCandidate = (item as any).posterUrl ?? (item as any).poster_url ?? (item as any).image ?? (item as any).thumbnail;
  const backdropCandidate = (item as any).landscapeImageUrl ?? (item as any).landscape_image_url ?? (item as any).landscape ?? (item as any).banner ?? posterCandidate;
  const posterPath = getContentImagePath(item as any, 'portrait') || posterCandidate;
  const backdropPath = getContentImagePath(item as any, 'landscape') || backdropCandidate;

  const durationSeconds = asNumber((item as any).durationSeconds ?? (item as any).video_duration ?? 0);
  const year = asNumber((item as any).releaseYear ?? (item as any).release_year, new Date().getFullYear());
  const id = (item as any).slug || titleId(item);
  const videoId = asNumber((item as any).video_id ?? item.id);
  const isSeries = kindFrom(item) === 'series';
  const videoType = asNumber((item as any).video_type, isSeries ? 2 : 1);
  const typeId = asNumber((item as any).type_id, 1);

  const rawGenres: string[] = Array.isArray((item as any).genres)
    ? (item as any).genres
    : (item as any).category_name ? [String((item as any).category_name)] : ['Featured'];

  const rawLanguages: string[] = Array.isArray((item as any).languages) && (item as any).languages.length > 0
    ? (item as any).languages.map((l: any) => (typeof l === 'string' ? l : (l.name || l.code))).filter(Boolean)
    : (item as any).language
    ? [String((item as any).language)]
    : (item as any).language_name
    ? [String((item as any).language_name)]
    : (item as any).originalLanguageCode
    ? [String((item as any).originalLanguageCode)]
    : (item as any).original_language_code
    ? [String((item as any).original_language_code)]
    : ['Kannada'];

  const isPrem = (item as any).isPremium === true || asNumber((item as any).is_premium) === 1;

  const castMembers = Array.isArray((item as any).cast)
    ? (item as any).cast.map((member: any, index: number) => ({
        id: String(member.id ?? member.name ?? `cast-${index}`),
        name: String(member.name ?? 'Cast'),
        role: String(member.role ?? member.type ?? 'Cast'),
        imageUrl: resolveImageUrl(member.imageUrl || member.photo || member.image) || posterFallback(String(member.name ?? 'C')),
      }))
    : [];

  return {
    id,
    videoId,
    videoType,
    typeId,
    title,
    kind: kindFrom(item),
    posterUrl: resolveImageUrl(posterPath) || posterFallback(title),
    backdropUrl: resolveImageUrl(backdropPath) || resolveImageUrl(posterPath) || posterFallback(title),
    synopsis: String((item as any).description ?? (item as any).shortDescription ?? 'Stream this title on MaxxPixels.'),
    rating: asNumber((item as any).rating ?? (item as any).imdb_rating ?? (item as any).total_rating, 7.8),
    year,
    durationMin: durationSeconds > 0 ? Math.max(1, Math.round(durationSeconds / 60)) : undefined,
    languages: rawLanguages.filter(Boolean),
    genres: rawGenres.filter(Boolean),
    maturity: String((item as any).ageRating ?? (item as any).maturity_rating ?? 'U/A 13+'),
    progressPercent: asNumber((item as any).stop_time) > 0 && durationSeconds > 0
      ? Math.min(100, Math.round((asNumber((item as any).stop_time) / durationSeconds) * 100))
      : undefined,
    requiresPlan: isPrem ? 'premium' : 'free',
    top10Rank: rank,
    isOriginal: (item as any).isAiGenerated === true || asNumber((item as any).is_original) === 1,
    liveBadge: kindFrom(item) === 'live' ? 'LIVE' : undefined,
    episodes: [],
    cast: castMembers,
    relatedIds: [],
    isBookmarked: asNumber((item as any).is_bookmark) === 1,
  };
}

export async function fetchSpringHome(): Promise<SpringBootHomeResponse> {
  try {
    const res = await getJson<any>('api/v1/home');
    const data = res?.data ?? res?.result ?? res;
    if (data && typeof data === 'object') {
      return data as SpringBootHomeResponse;
    }
  } catch {
    try {
      const [bannersRes, sectionsRes] = await Promise.all([
        getJson<any>('api/v1/cms/banners'),
        getJson<any>('api/v1/cms/sections'),
      ]);
      return {
        banners: bannersRes?.data ?? bannersRes?.result ?? (Array.isArray(bannersRes) ? bannersRes : []),
        sections: sectionsRes?.data ?? sectionsRes?.result ?? (Array.isArray(sectionsRes) ? sectionsRes : []),
      };
    } catch {
      // Return empty home safely
    }
  }
  return { banners: [], sections: [] };
}

export async function fetchCatalog(signal?: AbortSignal, ctx: SessionContext = guest): Promise<StreamTitle[]> {
  void signal; void ctx;
  try {
    const res = await getJson<any>('api/v1/catalog/content?size=60');
    const list: SpringBootContentSummary[] = res?.content ?? res?.data?.content ?? res?.result ?? res?.data ?? (Array.isArray(res) ? res : []);
    if (Array.isArray(list) && list.length > 0) {
      const seen = new Set<string>();
      return list.map((item, index) => mapContentSummaryToStreamTitle(item, index + 1)).filter((title) => {
        if (seen.has(title.id)) return false;
        seen.add(title.id);
        return true;
      });
    }
  } catch {
    // fallback
  }

  const home = await fetchSpringHome();
  const seen = new Set<string>();
  const allItems: SpringBootContentSummary[] = [
    ...(home.featured ?? []),
    ...(home.latest ?? []),
    ...(home.sections ?? []).flatMap((s) => s.items ?? s.data ?? []),
  ];

  return allItems.map((item, index) => mapContentSummaryToStreamTitle(item, index + 1)).filter((title) => {
    if (seen.has(title.id)) return false;
    seen.add(title.id);
    return true;
  });
}

export async function fetchStreamHome(ctx: SessionContext = guest): Promise<{ featured: StreamTitle | null; rows: Array<{ row: HomeRow; items: StreamTitle[] }> }> {
  void ctx;
  const home = await fetchSpringHome();

  const heroTitles: StreamTitle[] = (home.banners ?? []).map((b) => {
    if (b.content) return mapContentSummaryToStreamTitle(b.content);
    return mapContentSummaryToStreamTitle({
      id: b.video_id ?? b.id,
      title: b.title ?? b.name ?? 'Featured',
      posterUrl: b.imageUrl ?? b.image,
      landscapeImageUrl: b.imageUrl ?? b.image,
      video_type: b.video_type ?? 1,
      type_id: b.type_id ?? 1,
    });
  });

  const rows: Array<{ row: HomeRow; items: StreamTitle[] }> = [];

  // Add CMS Sections
  (home.sections ?? []).forEach((section, index) => {
    const rawItems = section.items ?? section.data ?? [];
    if (!Array.isArray(rawItems) || rawItems.length === 0) return;

    const isLandscape = String(section.layout ?? section.screen_layout ?? '').toLowerCase().includes('landscape') || Number(section.section_type) === 2;
    const isTop10 = String(section.title ?? '').toLowerCase().includes('top') || index === 1;

    rows.push({
      row: {
        id: section.slug || String(section.id ?? index),
        title: section.title || 'Featured Rail',
        variant: isTop10 ? 'top10' : isLandscape ? 'landscape' : 'standard',
        titleIds: [],
      } satisfies HomeRow,
      items: rawItems.map((item, itemIndex) => mapContentSummaryToStreamTitle(item, isTop10 ? itemIndex + 1 : undefined)),
    });
  });

  // If no CMS sections, add Featured / Latest rails
  if (rows.length === 0) {
    if (home.featured && home.featured.length > 0) {
      rows.push({
        row: { id: 'featured', title: 'Featured Cinema', variant: 'landscape', titleIds: [] },
        items: home.featured.map((item) => mapContentSummaryToStreamTitle(item)),
      });
    }
    if (home.latest && home.latest.length > 0) {
      rows.push({
        row: { id: 'latest', title: 'New Releases & Trending', variant: 'standard', titleIds: [] },
        items: home.latest.map((item) => mapContentSummaryToStreamTitle(item)),
      });
    }
  }

  return {
    featured: heroTitles[0] ?? rows[0]?.items[0] ?? null,
    rows,
  };
}

export async function fetchTitleById(id: string, ctx: SessionContext = guest): Promise<StreamTitle | null> {
  void ctx;
  if (!id) return null;

  // Try fetching by slug or ID
  try {
    const isNum = /^\d+$/.test(id);
    const parsed = parseStreamTitleId(id);
    const targetPath = isNum
      ? `api/v1/catalog/content/id/${id}`
      : parsed.videoId > 0
        ? `api/v1/catalog/content/id/${parsed.videoId}`
        : `api/v1/catalog/content/${encodeURIComponent(id)}`;

    const res = await getJson<any>(targetPath);
    const data = res?.data ?? res?.result ?? res;
    if (data && (data.id || data.title || data.name)) {
      return mapContentSummaryToStreamTitle(data);
    }
  } catch {
    // Fallback: search or catalog
  }

  const catalog = await fetchCatalog();
  return catalog.find((item) => item.id === id || String(item.videoId) === id) ?? null;
}

export async function fetchStreamWatchlist(ctx: SessionContext): Promise<StreamTitle[]> {
  try {
    const res = await catalogApi.getBookmarkVideo({
      user_id: ctx.userId,
      device_id: ctx.deviceId,
    });
    const items = ((res as any)?.result ?? (res as any)?.data ?? (Array.isArray(res) ? res : [])) as ContentItem[];
    const seen = new Set<string>();
    return items
      .map((item, index) => mapContentSummaryToStreamTitle(item, index + 1))
      .filter((title) => {
        if (seen.has(title.id)) return false;
        seen.add(title.id);
        return true;
      });
  } catch {
    return [];
  }
}

export async function fetchStreamContinueWatching(ctx: SessionContext): Promise<StreamTitle[]> {
  try {
    const res = await catalogApi.getContinueWatching({
      user_id: ctx.userId,
      device_id: ctx.deviceId,
    });
    const items = ((res as any)?.result ?? (res as any)?.data ?? (Array.isArray(res) ? res : [])) as ContentItem[];
    const seen = new Set<string>();
    return items
      .map((item, index) => mapContentSummaryToStreamTitle(item, index + 1))
      .filter((title) => {
        if (seen.has(title.id)) return false;
        seen.add(title.id);
        return true;
      });
  } catch {
    return [];
  }
}

export async function fetchCategories(): Promise<ApiListResponse<unknown[]>> {
  return catalogApi.getCategory() as Promise<ApiListResponse<unknown[]>>;
}

export async function fetchContentByLanguage(language: string | number): Promise<StreamTitle[]> {
  try {
    const res = await catalogApi.contentByLanguage(language);
    const items = ((res as any)?.result ?? (res as any)?.data ?? (Array.isArray(res) ? res : [])) as ContentItem[];
    return items.map((item, index) => mapContentSummaryToStreamTitle(item, index + 1));
  } catch {
    return [];
  }
}

export async function fetchContentNonKannada(): Promise<StreamTitle[]> {
  try {
    const res = await catalogApi.contentNonKannada();
    const items = ((res as any)?.result ?? (res as any)?.data ?? (Array.isArray(res) ? res : [])) as ContentItem[];
    return items.map((item, index) => mapContentSummaryToStreamTitle(item, index + 1));
  } catch {
    return [];
  }
}
