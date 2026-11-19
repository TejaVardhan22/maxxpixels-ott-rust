import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Movie {
  id?: number | string;
  title: string;
  contentType?: string;
  description?: string;
  releaseDate?: string;
  originalLanguage: string;
  maturityRating: string;
  durationMinutes: number;
  durationTime?: string;
  status: string;
  producer?: string;
  producerId?: string;
  posterUrl?: string;
  bannerUrl?: string;
  trailerUrl?: string;
  masterPlaylistUrl?: string;
  bunnyVideoId?: string;
  video320Url?: string;
  video480Url?: string;
  video720Url?: string;
  video1080Url?: string;
  video2kUrl?: string;
  video4kUrl?: string;
  genres?: string[];
  category?: string[];
  categories?: string[];
  cast?: any[];
  castMembers?: any[];
  monetization?: string;
  isPremium?: boolean;
  rentPrice?: number;
  validityHours?: number;
  media_asset?: any;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class MovieApiService {
  private readonly http = inject(HttpClient);

  getMovies(page = 0, size = 20, search = '', contentType = '', status = ''): Observable<ApiResponse<PageResponse<Movie>>> {
    let url = `${environment.apiBaseUrl}/admin/movies?page=${page}&size=${size}&search=${encodeURIComponent(search)}`;
    if (contentType && contentType !== 'ALL') {
      url += `&contentType=${encodeURIComponent(contentType)}`;
    }
    if (status && status !== 'ALL') {
      url += `&status=${encodeURIComponent(status)}`;
    }
    return this.http.get<ApiResponse<PageResponse<Movie>>>(url).pipe(map(res => ({
      ...res,
      data: { ...res.data, content: (res.data?.content || []).map(normalizeMovie) }
    })));
  }

  getMovieById(id: number | string): Observable<ApiResponse<Movie>> {
    return this.http.get<any>(`${environment.apiBaseUrl}/admin/movies/${id}`).pipe(
      map(res => {
        const rawItem = res?.data ?? res?.movie ?? res;
        const item = rawItem?.data && typeof rawItem.data === 'object' && (rawItem.data.id || rawItem.data.title)
          ? rawItem.data
          : rawItem;
        return {
          success: true,
          data: normalizeMovie(item),
          message: 'Movie retrieved successfully'
        };
      })
    );
  }

  createMovie(movie: Movie): Observable<ApiResponse<Movie>> {
    return this.http.post<ApiResponse<Movie>>(`${environment.apiBaseUrl}/admin/movies`, movie);
  }

  updateMovie(id: number | string, movie: Movie): Observable<ApiResponse<Movie>> {
    return this.http.put<ApiResponse<Movie>>(`${environment.apiBaseUrl}/admin/movies/${id}`, movie);
  }

  updateMovieStatus(id: number | string, status: string): Observable<ApiResponse<Movie>> {
    return this.http.patch<ApiResponse<Movie>>(`${environment.apiBaseUrl}/admin/movies/${id}/status`, { status });
  }

  deleteMovie(id: number | string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/admin/movies/${id}`);
  }
}

export function resolveAdminImageUrl(path?: string | null): string {
  if (!path) return '';
  const trimmed = path.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;

  const apiBase = (environment.apiBaseUrl || '/api/v1').replace(/\/+$/, '');
  // Backend proxy endpoint that streams the full image bytes from Bunny Storage/CDN.
  const proxyBase = `${apiBase}/uploads`;
  const mediaBase = proxyBase;

  // Bunny Stream HLS/embed URLs must never be rewritten.
  const isStreamUrl =
    /(?:^|\/\/)(?:vz-|video\.bunnycdn\.com)/i.test(trimmed) || /\.m3u8(?:$|[?#])/i.test(trimmed);
  if (isStreamUrl) return trimmed;

  const stripMediaPrefix = (p: string) =>
    p.replace(/^\/+/, '').replace(/^uploads\//i, '').replace(/^storage\//i, '');

  const rewriteStorageCdnHost = (url: string): string => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const cdnHost = '';
      const isBunnyStorageHost =
        host === 'maxxpixels-images.b-cdn.net' ||
        host === 'bunnycdn.com' ||
        host.endsWith('.bunnycdn.com') ||
        (!!cdnHost && host === cdnHost) ||
        (host.endsWith('.b-cdn.net') && !host.startsWith('vz-'));
      if (!isBunnyStorageHost) return url;
      if (parsed.pathname.startsWith('/api/v1/uploads/')) return url;
      const rel = stripMediaPrefix(parsed.pathname);
      return rel ? `${mediaBase}/${rel}` : mediaBase;
    } catch {
      return url;
    }
  };

  // Absolute URLs.
  if (/^https?:\/\//i.test(trimmed)) {
    // Backend/API upload URLs.
    const apiUploadMatch = trimmed.match(
      /^https?:\/\/(?:localhost|127\.0\.0\.1|admin\.maxxpixels\.com|api\.maxxpixels\.com|www\.maxxpixels\.com|maxxpixels\.com)(?::\d+)?\/(?:api\/v1\/)?(?:uploads\/|storage\/|posters\/|banners\/)?(.*)$/i,
    );
    if (apiUploadMatch) {
      const rel = stripMediaPrefix(apiUploadMatch[1] || '');
      return rel ? `${mediaBase}/${rel}` : mediaBase;
    }
    return rewriteStorageCdnHost(trimmed);
  }

  const rel = stripMediaPrefix(trimmed);
  if (!rel) return '';
  return `${mediaBase}/${rel}`;
}

function formatIsoDate(d: any): string {
  if (!d) return '';
  if (typeof d === 'string') {
    const trimmed = d.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (trimmed.includes('T')) return trimmed.split('T')[0];
  }
  try {
    const dt = new Date(d);
    if (!isNaN(dt.getTime())) {
      return dt.toISOString().split('T')[0];
    }
  } catch {}
  return '';
}

function normalizeMovie(raw: any): Movie {
  if (!raw) return {} as Movie;
  const masterUrl = raw.masterPlaylistUrl || raw.master_playlist_url || raw.videoAssetId || raw.video_asset_id || raw.videoUrl || raw.video_url || raw.hls_manifest_url || raw.media_asset?.hls_manifest_url || raw.video4kUrl || raw.video1080Url || raw.video720Url || '';
  const bunnyId = raw.bunnyVideoId || raw.bunny_video_id || raw.streamVideoId || raw.stream_video_id || raw.media_asset?.bunny_video_id || '';
  const rawCat = raw.category || raw.categories;
  const categoryList = Array.isArray(rawCat)
    ? rawCat.map((c: any) => (typeof c === 'string' ? c : c?.name || c?.slug)).filter(Boolean)
    : (rawCat ? [String(rawCat)] : []);

  const rawCast = raw.cast || raw.castMembers;
  const castList = (Array.isArray(rawCast) ? rawCast : []).map((c: any) =>
    typeof c === 'string' ? c : (c?.name || c?.characterName || c?.person?.name)
  ).filter(Boolean);

  const relDate = formatIsoDate(raw.releaseDate || raw.release_date) || (raw.createdAt ? formatIsoDate(raw.createdAt) : '2024-08-24');

  return {
    ...raw,
    id: raw.id ?? raw._id,
    title: raw.title || raw.name || 'Untitled',
    contentType: raw.contentType || raw.content_type || raw.type || 'MOVIE',
    originalLanguage: raw.originalLanguage || raw.originalLanguageCode || raw.original_language || raw.language || '',
    maturityRating: raw.maturityRating || raw.maturity_rating || raw.age_rating || raw.ageRating || '',
    durationMinutes: raw.durationMinutes ?? (raw.duration_minutes ? Number(raw.duration_minutes) : (raw.duration_seconds ? Number(raw.duration_seconds) / 60 : 0)),
    durationTime: raw.durationTime || raw.duration_time || '',
    status: (raw.status || 'DRAFT').toUpperCase(),
    producer: raw.producer || raw.productionHouse || raw.production_house || raw.studio || raw.producerName || raw.producer_name || '',
    producerId: raw.producerId || raw.producer_id || '',
    posterUrl: resolveAdminImageUrl(raw.posterUrl || raw.poster_url || raw.poster || raw.thumbnail || raw.thumbnailUrl || raw.thumbnail_url || ''),
    bannerUrl: resolveAdminImageUrl(raw.bannerUrl || raw.bannerImageUrl || raw.banner_url || raw.landscape_image_url || raw.landscape || raw.backdropUrl || raw.banner || ''),
    trailerUrl: raw.trailerUrl || raw.trailer_url || '',
    masterPlaylistUrl: masterUrl,
    bunnyVideoId: bunnyId,
    video320Url: raw.video320Url || raw.video_320_url || '',
    video480Url: raw.video480Url || raw.video_480_url || '',
    video720Url: raw.video720Url || raw.video_720_url || '',
    video1080Url: raw.video1080Url || raw.video_1080_url || '',
    video2kUrl: raw.video2kUrl || raw.video_2k_url || '',
    video4kUrl: raw.video4kUrl || raw.video_4k_url || '',
    releaseDate: relDate,
    category: categoryList,
    categories: categoryList,
    cast: castList,
    castMembers: castList,
    genres: (Array.isArray(raw.genres) ? raw.genres : []).map((g: any) => typeof g === 'string' ? g : g?.name || g?.genre_name).filter(Boolean)
  };
}
