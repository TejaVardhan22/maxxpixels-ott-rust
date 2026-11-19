import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface RuntimePublicConfig {
  bunnyStreamLibraryId: string;
  bunnyStreamCdnHostname: string;
  bunnyStorageZoneName: string;
  publicBaseUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class RuntimeConfigService {
  private http = inject(HttpClient);
  private loaded = false;

  private config: RuntimePublicConfig = {
    bunnyStreamLibraryId: '',
    bunnyStreamCdnHostname: '',
    bunnyStorageZoneName: '',
    publicBaseUrl: ''
  };

  constructor() {
    this.load();
  }

  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.http.get<any>(`${environment.apiBaseUrl}/settings`).subscribe({
      next: (res) => {
        const d = res?.data ?? res ?? {};
        const rawHost = String(d.bunnyStreamCdnHostname || d.bunny_stream_cdn_hostname || '').trim();
        this.config = {
          bunnyStreamLibraryId: String(d.bunnyStreamLibraryId || d.bunny_stream_library_id || '').trim(),
          bunnyStreamCdnHostname: rawHost.replace(/^https?:\/\//i, '').replace(/\/+$/, ''),
          bunnyStorageZoneName: String(d.bunnyStorageZoneName || d.bunny_storage_zone_name || '').trim(),
          publicBaseUrl: String(d.publicBaseUrl || d.public_base_url || '').trim().replace(/\/+$/, '')
        };
      },
      error: () => {
        this.loaded = false;
      }
    });
  }

  get bunnyStreamLibraryId(): string {
    return this.config.bunnyStreamLibraryId;
  }

  get bunnyStreamCdnHostname(): string {
    return this.config.bunnyStreamCdnHostname;
  }

  get bunnyStorageZoneName(): string {
    return this.config.bunnyStorageZoneName;
  }

  get publicBaseUrl(): string {
    return this.config.publicBaseUrl;
  }
}
