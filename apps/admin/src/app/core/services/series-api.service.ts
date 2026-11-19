import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PageResponse, resolveAdminImageUrl } from './movie-api.service';

export interface Episode {
  id?: number | string;
  episodeNumber: number;
  title: string;
  description?: string;
  durationSeconds?: number;
  videoAssetId?: string;
  stillImageUrl?: string;
  isPremium?: boolean;
}

export interface Season {
  id?: number | string;
  seasonNumber: number;
  title: string;
  description?: string;
  posterUrl?: string;
  episodes?: Episode[];
}

export interface Series {
  id?: number | string;
  contentType?: string;
  title: string;
  originalLanguage: string;
  maturityRating: string;
  totalSeasons?: number;
  totalEpisodes?: number;
  status: string;
  posterUrl?: string;
  bannerUrl?: string;
  description?: string;
  isPremium?: boolean;
  genres?: string[];
  category?: string[];
  seasons?: Season[];
}

@Injectable({
  providedIn: 'root'
})
export class SeriesApiService {
  private readonly http = inject(HttpClient);

  getSeries(page = 0, size = 20, search = ''): Observable<ApiResponse<PageResponse<Series>>> {
    return this.http.get<ApiResponse<PageResponse<Series>>>(
      `${environment.apiBaseUrl}/admin/series?page=${page}&size=${size}&search=${search}`
    ).pipe(map(res => ({
      ...res,
      data: { ...res.data, content: (res.data?.content || []).map(normalizeSeries) }
    })));
  }

  getSeriesById(id: number | string): Observable<ApiResponse<Series>> {
    return this.http.get<ApiResponse<Series>>(`${environment.apiBaseUrl}/admin/series/${id}`).pipe(
      map(res => ({ ...res, data: normalizeSeries(res.data) }))
    );
  }

  createSeries(series: Series): Observable<ApiResponse<Series>> {
    return this.http.post<ApiResponse<Series>>(`${environment.apiBaseUrl}/admin/series`, series);
  }

  updateSeries(id: number | string, series: Series): Observable<ApiResponse<Series>> {
    return this.http.put<ApiResponse<Series>>(`${environment.apiBaseUrl}/admin/series/${id}`, series);
  }

  deleteSeries(id: number | string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/admin/series/${id}`);
  }

  addSeason(seriesId: number | string, season: Season): Observable<ApiResponse<Season>> {
    return this.http.post<ApiResponse<Season>>(`${environment.apiBaseUrl}/admin/series/${seriesId}/seasons`, season);
  }

  addEpisode(seasonId: number | string, episode: Episode): Observable<ApiResponse<Episode>> {
    return this.http.post<ApiResponse<Episode>>(`${environment.apiBaseUrl}/admin/series/seasons/${seasonId}/episodes`, episode);
  }
}

function normalizeSeries(raw: any): Series {
  if (!raw) return raw;
  return {
    ...raw,
    originalLanguage: raw.originalLanguage || raw.original_language || '',
    maturityRating: raw.maturityRating || raw.age_rating || '',
    posterUrl: resolveAdminImageUrl(raw.posterUrl || raw.poster_url || raw.poster || raw.thumbnail || ''),
    bannerUrl: resolveAdminImageUrl(raw.bannerUrl || raw.banner_url || raw.landscape_image_url || raw.landscape || raw.banner || ''),
    genres: (raw.genres || []).map((g: any) => typeof g === 'string' ? g : g.name).filter(Boolean)
  };
}
