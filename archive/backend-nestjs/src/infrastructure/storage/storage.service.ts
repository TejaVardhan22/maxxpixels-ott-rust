import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { BunnyService } from './bunny.service';
import { S3Service } from './s3.service';
import { RedisService } from '../redis/redis.service';

export interface UploadJobStatus {
  jobId: string;
  fileName: string;
  folder: string;
  status: 'PENDING' | 'UPLOADING' | 'COMPLETED' | 'FAILED';
  progress: number;
  url?: string;
  videoGuid?: string;
  thumbnailUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class StorageService {
  constructor(
    private readonly bunnyService: BunnyService,
    private readonly s3Service: S3Service,
    private readonly redisService: RedisService,
  ) {}

  async uploadFile(
    folder: string,
    fileName: string,
    buffer: Buffer,
    contentType = 'application/octet-stream',
  ) {
    return this.bunnyService.uploadToStorage(folder, fileName, buffer, contentType);
  }

  async uploadVideoAsync(
    title: string,
    fileName: string,
    buffer: Buffer,
  ): Promise<UploadJobStatus> {
    const jobId = crypto.randomUUID();
    const initialStatus: UploadJobStatus = {
      jobId,
      fileName,
      folder: 'videos',
      status: 'UPLOADING',
      progress: 15,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.redisService.set(`upload:job:${jobId}`, initialStatus, 86400);

    // Run non-blocking upload in background
    setImmediate(async () => {
      try {
        const res = await this.bunnyService.uploadVideoToStream(title || fileName, buffer);
        const completed: UploadJobStatus = {
          ...initialStatus,
          status: 'COMPLETED',
          progress: 100,
          url: res.hlsUrl,
          videoGuid: res.videoGuid,
          thumbnailUrl: res.thumbnailUrl,
          updatedAt: new Date().toISOString(),
        };
        await this.redisService.set(`upload:job:${jobId}`, completed, 86400);
      } catch (err: any) {
        const failed: UploadJobStatus = {
          ...initialStatus,
          status: 'FAILED',
          progress: 0,
          error: err.message,
          updatedAt: new Date().toISOString(),
        };
        await this.redisService.set(`upload:job:${jobId}`, failed, 86400);
      }
    });

    return initialStatus;
  }

  async getUploadJobStatus(jobId: string): Promise<UploadJobStatus | null> {
    return this.redisService.get<UploadJobStatus>(`upload:job:${jobId}`);
  }

  async getPresignedUrl(folder: string, fileName: string, contentType?: string) {
    return this.s3Service.generatePresignedUploadUrl(folder, fileName, contentType);
  }
}

