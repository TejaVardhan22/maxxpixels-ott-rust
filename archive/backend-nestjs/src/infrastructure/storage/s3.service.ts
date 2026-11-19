import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BunnyService } from './bunny.service';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private s3Client: S3Client | null = null;

  constructor(private readonly bunnyService: BunnyService) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';
    const region = process.env.AWS_REGION || 'ap-south-1';
    const endpoint = process.env.AWS_S3_ENDPOINT || undefined;

    if (accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region,
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: Boolean(endpoint),
      });
    }
  }

  async generatePresignedUploadUrl(
    folder: string,
    fileName: string,
    contentType = 'application/octet-stream',
  ): Promise<{ uploadUrl: string; publicUrl: string; key: string; provider: string }> {
    const sanitizedFolder = folder.replace(/^\/+|\/+$/g, '') || 'uploads';
    const key = `${sanitizedFolder}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const bucket = process.env.AWS_S3_BUCKET || 'maxxpixels-ott';

    if (this.s3Client) {
      try {
        const command = new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          ContentType: contentType,
        });
        const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
        const publicBase = process.env.AWS_S3_PUBLIC_URL || `https://${bucket}.s3.amazonaws.com`;
        return {
          uploadUrl,
          publicUrl: `${publicBase.replace(/\/$/, '')}/${key}`,
          key,
          provider: 'S3',
        };
      } catch (err: any) {
        this.logger.warn(`S3 presigned URL generation failed (${err.message}), returning direct upload endpoint.`);
      }
    }

    const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:8080';
    const bunnyCfg = this.bunnyService.getDefaultConfig();
    return {
      uploadUrl: `${baseUrl}/api/v1/admin/storage/upload?folder=${encodeURIComponent(sanitizedFolder)}`,
      publicUrl: `${bunnyCfg.storageCdnUrl.replace(/\/$/, '')}/${key}`,
      key,
      provider: 'BUNNY_FALLBACK',
    };
  }
}

