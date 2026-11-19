import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './movie-api.service';

export interface IntroVideo {
  id?: number | string;
  title: string;
  description?: string;
  videoUrl: string;
  posterUrl?: string;
  ctaLabel?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PortalBanner {
  id?: number | string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  mobileImageUrl?: string;
  targetUrl: string;
  portalKey: string;
  buttonLabel?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class HomeContentApiService {
  private readonly http = inject(HttpClient);
  private readonly adminBase = `${environment.apiBaseUrl}/admin`;

  listIntroVideos(): Observable<ApiResponse<IntroVideo[]>> {
    return this.http.get<ApiResponse<IntroVideo[]>>(`${this.adminBase}/intro-video`);
  }

  createIntroVideo(payload: Partial<IntroVideo>): Observable<ApiResponse<IntroVideo>> {
    return this.http.post<ApiResponse<IntroVideo>>(`${this.adminBase}/intro-video`, payload);
  }

  updateIntroVideo(id: number | string, payload: Partial<IntroVideo>): Observable<ApiResponse<IntroVideo>> {
    return this.http.put<ApiResponse<IntroVideo>>(`${this.adminBase}/intro-video/${id}`, payload);
  }

  activateIntroVideo(id: number | string): Observable<ApiResponse<IntroVideo>> {
    return this.http.post<ApiResponse<IntroVideo>>(`${this.adminBase}/intro-video/${id}/activate`, {});
  }

  deleteIntroVideo(id: number | string): Observable<ApiResponse<{ id: number | string; deleted: boolean }>> {
    return this.http.delete<ApiResponse<{ id: number | string; deleted: boolean }>>(`${this.adminBase}/intro-video/${id}`);
  }

  listPortalBanners(): Observable<ApiResponse<PortalBanner[]>> {
    return this.http.get<ApiResponse<PortalBanner[]>>(`${this.adminBase}/portal-banners`);
  }

  createPortalBanner(payload: Partial<PortalBanner>): Observable<ApiResponse<PortalBanner>> {
    return this.http.post<ApiResponse<PortalBanner>>(`${this.adminBase}/portal-banners`, payload);
  }

  updatePortalBanner(id: number | string, payload: Partial<PortalBanner>): Observable<ApiResponse<PortalBanner>> {
    return this.http.put<ApiResponse<PortalBanner>>(`${this.adminBase}/portal-banners/${id}`, payload);
  }

  togglePortalBanner(id: number | string): Observable<ApiResponse<PortalBanner>> {
    return this.http.post<ApiResponse<PortalBanner>>(`${this.adminBase}/portal-banners/${id}/toggle-status`, {});
  }

  deletePortalBanner(id: number | string): Observable<ApiResponse<{ id: number | string; deleted: boolean }>> {
    return this.http.delete<ApiResponse<{ id: number | string; deleted: boolean }>>(`${this.adminBase}/portal-banners/${id}`);
  }
}
