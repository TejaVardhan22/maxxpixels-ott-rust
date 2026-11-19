import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { CircuitBreakerRegistry } from '../../common/utils/circuit-breaker.util';
import { IStorageProvider, UploadFileResult } from './storage-provider.interface';

export interface BunnyConfig {
  storageZoneName: string;
  storageApiKey: string;
  storageEndpoint: string;
  storageCdnUrl: string;
  streamLibraryId: string;
  streamApiKey: string;
  streamCdnHostname: string;
  streamTokenSecurityKey: string;
}

@Injectable()
export class BunnyService implements IStorageProvider {
  readonly providerName = 'BUNNY';
  private readonly logger = new Logger(BunnyService.name);
  private readonly breaker = CircuitBreakerRegistry.getOrCreate('bunny-cdn', {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
  });

  getDefaultConfig(): BunnyConfig {
    let endpoint = (process.env.BUNNY_STORAGE_ENDPOINT || 'https://storage.bunnycdn.com').trim().replace(/\/+$/, '');
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      endpoint = `https://${endpoint}`;
    }
    let cdnUrl = (process.env.BUNNY_STORAGE_CDN_URL || process.env.BUNNY_PULL_ZONE_DOMAIN || 'https://maxxpixels-images.b-cdn.net').trim().replace(/\/+$/, '');
    if (!cdnUrl.startsWith('http://') && !cdnUrl.startsWith('https://')) {
      cdnUrl = `https://${cdnUrl}`;
    }

    return {
      storageZoneName: process.env.BUNNY_STORAGE_ZONE || process.env.BUNNY_STORAGE_ZONE_NAME || 'maxxpixels-images',
      storageApiKey: process.env.BUNNY_STORAGE_API_KEY || process.env.BUNNY_STORAGE_ZONE_PASSWORD || '',
      storageEndpoint: endpoint,
      storageCdnUrl: cdnUrl,
      streamLibraryId: process.env.BUNNY_STREAM_LIBRARY_ID || '',
      streamApiKey: process.env.BUNNY_STREAM_API_KEY || '',
      streamCdnHostname: process.env.BUNNY_STREAM_CDN_HOSTNAME || 'vz-bb76d46f-94f.b-cdn.net',
      streamTokenSecurityKey: process.env.BUNNY_STREAM_TOKEN_KEY || process.env.BUNNY_STREAM_TOKEN_AUTH_KEY || '',
    };
  }

  generateSignedStreamUrl(videoGuid: string, expirationSeconds = 14400, customConfig?: Partial<BunnyConfig>): string {
    const cfg = { ...this.getDefaultConfig(), ...customConfig };
    if (!videoGuid) return '';

    if (videoGuid.startsWith('http://') || videoGuid.startsWith('https://')) {
      return videoGuid;
    }

    const hostname = cfg.streamCdnHostname.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const pathUrl = `/${videoGuid}/playlist.m3u8`;

    if (!cfg.streamTokenSecurityKey) {
      return `https://${hostname}${pathUrl}`;
    }

    const expires = Math.floor(Date.now() / 1000) + expirationSeconds;
    const hashableBase = `${cfg.streamTokenSecurityKey}${pathUrl}${expires}`;
    const sha256Hash = crypto.createHash('sha256').update(hashableBase).digest('base64');
    const token = sha256Hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    return `https://${hostname}${pathUrl}?token=${token}&expires=${expires}`;
  }

  async uploadFile(
    folder: string,
    fileName: string,
    buffer: Buffer,
    contentType = 'application/octet-stream',
  ): Promise<UploadFileResult> {
    const res = await this.uploadToStorage(folder, fileName, buffer, contentType);
    return {
      url: res.url,
      path: res.remotePath,
      bytes: buffer?.length,
    };
  }

  async uploadToStorage(
    folder: string,
    fileName: string,
    data: Buffer | fs.ReadStream,
    contentType = 'application/octet-stream',
    customConfig?: Partial<BunnyConfig>,
  ): Promise<{ url: string; remotePath: string; provider: string }> {
    const cfg = { ...this.getDefaultConfig(), ...customConfig };
    const sanitizedFolder = folder.replace(/^\/+|\/+$/g, '') || 'general';
    const uniqueFileName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const remotePath = `${sanitizedFolder}/${uniqueFileName}`;

    let endpoint = (cfg.storageEndpoint || 'https://storage.bunnycdn.com').trim().replace(/\/+$/, '');
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      endpoint = `https://${endpoint}`;
    }
    let cdnBase = (cfg.storageCdnUrl || 'https://maxxpixels-images.b-cdn.net').trim().replace(/\/+$/, '');
    if (!cdnBase.startsWith('http://') && !cdnBase.startsWith('https://')) {
      cdnBase = `https://${cdnBase}`;
    }

    if (cfg.storageApiKey && cfg.storageZoneName && Buffer.isBuffer(data)) {
      try {
        const uploadUrl = `${endpoint}/${cfg.storageZoneName}/${remotePath}`;

        await this.breaker.execute(async () => {
          const res = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              AccessKey: cfg.storageApiKey,
              'Content-Type': contentType,
            },
            body: new Uint8Array(data),
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
        });

        // Optional local mirror for legacy/local reads; primary URL is Bunny CDN.
        try {
          const localDir = path.join(process.cwd(), 'uploads', sanitizedFolder);
          await fs.promises.mkdir(localDir, { recursive: true });
          await fs.promises.writeFile(path.join(localDir, uniqueFileName), data);
        } catch (e: any) {
          this.logger.warn(`Failed writing local mirror for ${remotePath}: ${e.message}`);
        }

        return {
          url: this.buildMediaUrl(remotePath, cdnBase),
          remotePath,
          provider: 'BUNNY_STORAGE',
        };
      } catch (err: any) {
        this.logger.warn(`Bunny Storage upload failed (${err.message}), saving to local storage fallback.`);
      }
    }

    try {
      const localDir = path.join(process.cwd(), 'uploads', sanitizedFolder);
      await fs.promises.mkdir(localDir, { recursive: true });
      const localFilePath = path.join(localDir, uniqueFileName);

      if (Buffer.isBuffer(data)) {
        await fs.promises.writeFile(localFilePath, data);
      } else {
        await new Promise<void>((resolve, reject) => {
          const writeStream = fs.createWriteStream(localFilePath);
          data.pipe(writeStream);
          writeStream.on('finish', () => resolve());
          writeStream.on('error', reject);
        });
      }

      // Fallback: persist locally but prefer the public media URL shape when available.
      const fallbackBase = (process.env.PUBLIC_BASE_URL || 'https://api.maxxpixels.com').replace(/\/+$/, '');
      const fallbackUrl = cdnBase ? this.buildMediaUrl(remotePath, cdnBase) : `${fallbackBase}/api/v1/uploads/${remotePath}`;
      return {
        url: fallbackUrl,
        remotePath,
        provider: cdnBase ? 'LOCAL_STORAGE_MIRRORED' : 'LOCAL_STORAGE',
      };
    } catch (localErr: any) {
      this.logger.error(`Local storage fallback failed: ${localErr.message}`);
      return {
        url: this.buildMediaUrl(remotePath, cdnBase),
        remotePath,
        provider: 'BUNNY_STORAGE_ESTIMATED',
      };
    }
  }

  /**
   * Public URL for an uploaded object. The Bunny pull zone can be suspended (it answers
   * 403), so by default the URL points at the backend media proxy, which streams the object
   * from Bunny Storage. Set MEDIA_DIRECT_CDN=true to emit direct pull-zone URLs instead.
   */
  private buildMediaUrl(remotePath: string, cdnBase?: string): string {
    const rel = String(remotePath || '').replace(/^\/+/, '');
    const directCdnEnabled = /^(1|true|yes|on)$/i.test(
      String(process.env.MEDIA_DIRECT_CDN || process.env.BUNNY_CDN_ENABLED || '').trim(),
    );
    const cdn = (cdnBase || '').replace(/\/+$/, '');
    if (directCdnEnabled && cdn) return `${cdn}/${rel}`;
    let publicBase = (process.env.PUBLIC_BASE_URL || 'https://api.maxxpixels.com').replace(/\/+$/, '');
    if (
      process.env.NODE_ENV === 'production' &&
      /\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::|\/|$)/i.test(publicBase)
    ) {
      publicBase = 'https://api.maxxpixels.com';
    }
    return `${publicBase}/api/v1/uploads/${rel}`;
  }

  async uploadVideoToStream(
    title: string,
    data: Buffer,
    customConfig?: Partial<BunnyConfig>,
  ): Promise<{ videoGuid: string; hlsUrl: string; thumbnailUrl: string }> {
    const cfg = { ...this.getDefaultConfig(), ...customConfig };

    if (cfg.streamApiKey && cfg.streamLibraryId) {
      try {
        const createRes = await fetch(
          `https://video.bunnycdn.com/library/${cfg.streamLibraryId}/videos`,
          {
            method: 'POST',
            headers: {
              AccessKey: cfg.streamApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title }),
          },
        );

        if (!createRes.ok) {
          throw new Error(`Create video HTTP ${createRes.status}`);
        }
        const createdJson: any = await createRes.json();
        const videoGuid: string = createdJson.guid;

        const putRes = await fetch(
          `https://video.bunnycdn.com/library/${cfg.streamLibraryId}/videos/${videoGuid}`,
          {
            method: 'PUT',
            headers: {
              AccessKey: cfg.streamApiKey,
              'Content-Type': 'application/octet-stream',
            },
            body: new Uint8Array(data),
          },
        );
        if (!putRes.ok) {
          throw new Error(`Upload video HTTP ${putRes.status}`);
        }

        const hostname = cfg.streamCdnHostname.replace(/^https?:\/\//, '').replace(/\/$/, '');
        return {
          videoGuid,
          hlsUrl: `https://${hostname}/${videoGuid}/playlist.m3u8`,
          thumbnailUrl: `https://${hostname}/${videoGuid}/thumbnail.jpg`,
        };
      } catch (err: any) {
        this.logger.warn(`Bunny Stream upload failed (${err.message}), using storage fallback.`);
      }
    }

    const fallback = await this.uploadToStorage('videos', `${title}.mp4`, data, 'video/mp4', cfg);
    const pseudoGuid = `local-${Date.now()}`;
    return {
      videoGuid: pseudoGuid,
      hlsUrl: fallback.url,
      thumbnailUrl: `${fallback.url}.jpg`,
    };
  }
}
