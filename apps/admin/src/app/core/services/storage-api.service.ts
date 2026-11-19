import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType, HttpHeaders, HttpRequest } from '@angular/common/http';
import { Observable, map, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../auth/auth-api.service';

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  objectKey: string;
  expiresInSeconds: string;
}

export interface DirectUploadResponse {
  url: string;
  filename: string;
}

export type StorageFolder =
  | 'posters'
  | 'banners'
  | 'avatars'
  | 'videos'
  | 'trailers'
  | 'subtitles'
  | 'docs'
  | 'backups';

@Injectable({
  providedIn: 'root'
})
export class StorageApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/storage`;

  /**
   * Method 1: Request Pre-signed S3 Upload URL & Upload File Directly from Admin Frontend to AWS S3 Bucket
   * Supports Images (posters, banners), Videos (4K movies, trailers, shorts), Documents, and DB Backups.
   */
  uploadDirectToS3(
    file: File,
    folder: StorageFolder = 'posters'
  ): Observable<{ progress: number; fileUrl?: string }> {
    const contentType = file.type || 'application/octet-stream';
    const filename = file.name;

    return this.getPresignedUrl(folder, filename, contentType).pipe(
      switchMap((presignedRes) => {
        const presignedData = presignedRes.data;
        const uploadUrl = presignedData?.uploadUrl;
        const finalFileUrl = presignedData?.fileUrl;

        if (!uploadUrl) {
          throw new Error('Failed to obtain pre-signed S3 upload URL from server');
        }

        const headers = new HttpHeaders({
          'Content-Type': contentType
        });

        const req = new HttpRequest('PUT', uploadUrl, file, {
          headers,
          reportProgress: true
        });

        return this.http.request(req).pipe(
          map((event: HttpEvent<any>) => {
            switch (event.type) {
              case HttpEventType.UploadProgress:
                const percent = event.total ? Math.round((100 * event.loaded) / event.total) : 0;
                return { progress: percent };
              case HttpEventType.Response:
                return { progress: 100, fileUrl: finalFileUrl };
              default:
                return { progress: 0 };
            }
          })
        );
      })
    );
  }

  /**
   * Method 2: Request Pre-signed S3 Upload URL
   */
  getPresignedUrl(folder: string, filename: string, contentType: string): Observable<ApiResponse<PresignedUrlResponse>> {
    return this.http.post<ApiResponse<PresignedUrlResponse>>(`${this.baseUrl}/presigned-url`, {
      folder,
      filename,
      contentType
    });
  }

  /**
   * Method 3: Direct Multipart File Upload to Backend Storage
   */
  uploadMultipart(file: File, folder: StorageFolder = 'posters'): Observable<{ progress: number; url?: string }> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('folder', folder);

    const req = new HttpRequest('POST', `${this.baseUrl}/upload`, formData, {
      reportProgress: true
    });

    return this.http.request<ApiResponse<DirectUploadResponse>>(req).pipe(
      map((event: HttpEvent<ApiResponse<DirectUploadResponse>>) => {
        switch (event.type) {
          case HttpEventType.UploadProgress:
            const percent = event.total ? Math.round((100 * event.loaded) / event.total) : 0;
            return { progress: percent };
          case HttpEventType.Response:
            const rawUrl = event.body?.data?.url || '';
            const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${environment.apiBaseUrl.replace('/api/v1', '')}${rawUrl}`;
            return { progress: 100, url: fullUrl };
          default:
            return { progress: 0 };
        }
      })
    );
  }

  /**
   * Universal file uploader for Producer Portal & Admin (Posters, Banners, Avatars, Docs)
   */
  uploadFile(file: File, folder: StorageFolder = 'posters'): Observable<{ progress: number; fileUrl?: string; url?: string }> {
    return this.uploadMultipart(file, folder).pipe(
      map(res => ({
        progress: res.progress,
        fileUrl: res.url,
        url: res.url
      }))
    );
  }

  /**
   * Method 4: Direct Bunny.net Stream Video Uploader
   * Automatically creates the video asset in Bunny Stream and uploads binary data
   */
  uploadVideoToBunnyStream(file: File, title?: string): Observable<{
    progress: number;
    fileUrl?: string;
    url?: string;
    videoId?: string;
    hlsUrl?: string;
    directPlayUrl?: string;
    thumbnailUrl?: string;
    uploadedToBunny?: boolean;
  }> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    if (title) {
      formData.append('title', title);
    }

    const req = new HttpRequest('POST', `${this.baseUrl}/upload-video`, formData, {
      reportProgress: true
    });

    return this.http.request<ApiResponse<any>>(req).pipe(
      map((event: HttpEvent<ApiResponse<any>>) => {
        switch (event.type) {
          case HttpEventType.UploadProgress:
            const percent = event.total ? Math.round((100 * event.loaded) / event.total) : 0;
            return { progress: percent };
          case HttpEventType.Response:
            const data = event.body?.data || (event.body as any) || {};
            const playUrl = data.directPlayUrl || data.hlsUrl || data.streamUrl || data.url || data.fileUrl || '';
            return {
              progress: 100,
              url: playUrl,
              fileUrl: playUrl,
              videoId: data.videoId,
              hlsUrl: data.hlsUrl,
              directPlayUrl: data.directPlayUrl,
              thumbnailUrl: data.thumbnailUrl,
              uploadedToBunny: data.uploadedToBunny
            };
          default:
            return { progress: 0 };
        }
      })
    );
  }

  /**
   * Method 5: Trigger PostgreSQL Database Backup to S3 Bucket
   */
  triggerDatabaseBackup(): Observable<ApiResponse<{ status: string; backupFile: string; storageBucket: string }>> {
    return this.http.post<ApiResponse<{ status: string; backupFile: string; storageBucket: string }>>(
      `${environment.apiBaseUrl}/admin/backup/trigger`,
      {}
    );
  }
}
