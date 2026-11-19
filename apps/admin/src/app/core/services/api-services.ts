import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiResponse } from '../auth/auth-api.service';
import { environment } from '../../../environments/environment';

export interface PlaybackSessionRequest {
  contentId: string | number;
  profileId: string;
  deviceId: string;
  deviceType: string;
  capabilities: {
    maxResolution: string;
    widevine: boolean;
    hls: boolean;
    dash: boolean;
    hdr: boolean;
  };
}

export interface PlaybackSessionResponse {
  sessionId: string;
  contentId: string | number;
  allowed: boolean;
  accessType: 'AVOD' | 'SVOD' | 'TVOD' | 'FREE';
  stream: {
    manifestUrl: string;
    type: 'HLS' | 'DASH' | 'MP4';
    maxResolution: string;
    drm?: {
      enabled: boolean;
      type: string;
      licenseUrl: string;
    };
  };
  ads?: {
    enabled: boolean;
    mode: 'CSAI' | 'SSAI';
    scheduleUrl: string;
  };
  markers?: {
    introStart: number;
    introEnd: number;
    creditsStart: number;
  };
}

export interface AdTrackingEvent {
  sessionId: string;
  adId: string;
  eventType:
    | 'AD_IMPRESSION'
    | 'AD_STARTED'
    | 'AD_FIRST_QUARTILE'
    | 'AD_MIDPOINT'
    | 'AD_THIRD_QUARTILE'
    | 'AD_COMPLETED'
    | 'AD_SKIPPED'
    | 'AD_CLICKED'
    | 'AD_ERROR';
  timestamp: number;
}

export interface WatchProgressRequest {
  contentId: string | number;
  profileId: string;
  positionSeconds: number;
  durationSeconds: number;
  completed: boolean;
}

export interface UserDeviceItem {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  lastActive: string;
  isCurrent: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PlaybackApiService {
  private readonly http = inject(HttpClient);

  authorizePlayback(request: PlaybackSessionRequest): Observable<ApiResponse<PlaybackSessionResponse>> {
    return this.http.post<ApiResponse<PlaybackSessionResponse>>(`${environment.apiBaseUrl}/playback/sessions`, request);
  }

  getPlaybackInfo(id: string | number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${environment.apiBaseUrl}/contents/${id}`);
  }
}

@Injectable({
  providedIn: 'root'
})
export class AdApiService {
  private readonly http = inject(HttpClient);

  trackAdEvent(event: AdTrackingEvent): void {
    // Non-blocking asynchronous tracking ping
    this.http.post(`${environment.apiBaseUrl}/ads/track`, event).pipe(
      catchError(() => of(null))
    ).subscribe();
  }
}

@Injectable({
  providedIn: 'root'
})
export class WatchHistoryApiService {
  private readonly http = inject(HttpClient);
  private lastSyncTime = 0;

  syncProgressThrottled(request: WatchProgressRequest, force = false): void {
    const now = Date.now();
    // Sync every 15 seconds unless forced (on pause/unload)
    if (force || now - this.lastSyncTime >= 15000) {
      this.lastSyncTime = now;
      this.http.post(`${environment.apiBaseUrl}/watch-history/progress`, request).pipe(
        catchError(() => of(null))
      ).subscribe();
    }
  }
}

@Injectable({
  providedIn: 'root'
})
export class DeviceApiService {
  private readonly http = inject(HttpClient);

  getActiveDevices(): Observable<ApiResponse<UserDeviceItem[]>> {
    return this.http.get<ApiResponse<UserDeviceItem[]>>(`${environment.apiBaseUrl}/devices`);
  }

  revokeDevice(deviceId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/devices/${deviceId}`);
  }
}
