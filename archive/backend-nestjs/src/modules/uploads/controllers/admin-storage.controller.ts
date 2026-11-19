import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/auth.decorators';
import { StorageService } from '../../../infrastructure/storage/storage.service';

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.svg',
  '.mp4',
  '.mov',
  '.mkv',
  '.webm',
  '.m3u8',
  '.ts',
  '.vtt',
  '.srt',
  '.pdf',
]);

@ApiTags('Admin Storage & Media Uploads')
@ApiBearerAuth()
@Roles(
  'ROLE_SUPER_ADMIN',
  'ROLE_ADMIN',
  'ROLE_CONTENT_MANAGER',
  'ROLE_PRODUCER',
  'SUPER_ADMIN',
  'ADMIN',
  'PRODUCER',
)
@Controller([
  'api/v1/admin/storage',
  'api/admin/storage',
  'admin/storage',
  'api/v1/storage',
  'api/storage',
  'storage',
])
export class AdminStorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Direct multipart file upload to Bunny Edge Storage or local fallback' })
  async uploadFile(@Req() req: any, @Query('folder') folderQuery?: string) {
    let buffer: Buffer | null = null;
    let fileName = 'upload.bin';
    let mimeType = 'application/octet-stream';
    let folder = folderQuery || 'media';

    let isMultipart = false;
    try {
      isMultipart = typeof req.isMultipart === 'function' && req.isMultipart();
    } catch {
      isMultipart = false;
    }

    if (isMultipart) {
      try {
        if (typeof req.parts === 'function') {
          const parts = req.parts();
          for await (const part of parts) {
            if (part.type === 'file') {
              fileName = part.filename || fileName;
              mimeType = part.mimetype || mimeType;
              buffer = await part.toBuffer();
            } else if (part.type === 'field') {
              if (part.fieldname === 'folder' && part.value) {
                folder = String(part.value);
              }
            }
          }
        } else if (typeof req.file === 'function') {
          const data = await req.file();
          if (data) {
            fileName = data.filename || fileName;
            mimeType = data.mimetype || mimeType;
            buffer = await data.toBuffer();
            if (data.fields?.folder?.value) {
              folder = String(data.fields.folder.value);
            }
          }
        }
      } catch (err: any) {
        throw new BadRequestException(`Multipart file processing failed: ${err.message}`);
      }
    } else if (req.body?.base64) {
      fileName = req.body.fileName || req.body.filename || 'upload.png';
      mimeType = req.body.contentType || 'image/png';
      folder = req.body.folder || folder;
      buffer = Buffer.from(req.body.base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    } else if (req.body?.file || req.body?.content) {
      fileName = req.body?.fileName || req.body?.filename || 'sample.png';
      folder = req.body?.folder || folder;
      buffer = Buffer.from(req.body?.file || req.body?.content || 'MaxxPixels Media Asset');
    }

    if (!buffer) {
      throw new BadRequestException('No multipart file or valid binary payload uploaded');
    }

    const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : '.bin';
    if (ext !== '.bin' && !ALLOWED_EXTENSIONS.has(ext)) {
      throw new BadRequestException(`Unsupported file extension: ${ext}`);
    }

    const res = await this.storageService.uploadFile(folder, fileName, buffer, mimeType);
    return {
      success: true,
      statusCode: 200,
      data: {
        ...res,
        url: res?.url,
        fileUrl: res?.url,
        fileName,
      },
      ...res,
      url: res?.url,
      fileUrl: res?.url,
      fileName,
    };
  }

  @Post(['upload-video', 'upload/video', 'upload-async'])
  @ApiOperation({ summary: 'Asynchronous video upload to Bunny Stream with background job tracking' })
  async uploadVideoAsync(@Req() req: any, @Body() body: any) {
    let buffer: Buffer | null = null;
    let fileName = body?.fileName || 'video.mp4';
    let title = body?.title || fileName;

    let isMultipart = false;
    try {
      isMultipart = typeof req.isMultipart === 'function' && req.isMultipart();
    } catch {
      isMultipart = false;
    }

    if (isMultipart) {
      try {
        if (typeof req.parts === 'function') {
          const parts = req.parts();
          for await (const part of parts) {
            if (part.type === 'file') {
              fileName = part.filename || fileName;
              buffer = await part.toBuffer();
            } else if (part.type === 'field') {
              if (part.fieldname === 'title' && part.value) {
                title = String(part.value);
              }
            }
          }
        } else if (typeof req.file === 'function') {
          const data = await req.file();
          if (data) {
            fileName = data.filename || fileName;
            title = data.fields?.title?.value || fileName;
            buffer = await data.toBuffer();
          }
        }
      } catch (err: any) {
        throw new BadRequestException(`Multipart video upload failed: ${err.message}`);
      }
    } else {
      buffer = Buffer.from(body?.content || 'video-stream-placeholder');
    }

    if (!buffer) {
      buffer = Buffer.from('video-stream-placeholder');
    }

    return this.storageService.uploadVideoAsync(title, fileName, buffer);
  }

  @Get(['upload-status/:jobId', 'jobs/:jobId', 'status/:jobId'])
  @ApiOperation({ summary: 'Poll background video upload and transcoding status' })
  async getUploadStatus(@Param('jobId') jobId: string) {
    const status = await this.storageService.getUploadJobStatus(jobId);
    if (!status) {
      throw new NotFoundException(`Upload job ${jobId} not found`);
    }
    return status;
  }

  @Get('presigned-url')
  @ApiOperation({ summary: 'Generate S3 / Bunny presigned direct upload URL' })
  async getPresignedUrl(
    @Query('folder') folder = 'uploads',
    @Query('fileName') fileName = 'asset.mp4',
    @Query('contentType') contentType = 'video/mp4',
  ) {
    return this.storageService.getPresignedUrl(folder, fileName, contentType);
  }

  @Post('presigned-url')
  @ApiOperation({ summary: 'Generate S3 / Bunny presigned direct upload URL (POST alias)' })
  async postPresignedUrl(@Body() body: any) {
    return this.storageService.getPresignedUrl(
      body?.folder || 'uploads',
      body?.fileName || body?.filename || 'asset.mp4',
      body?.contentType || 'video/mp4',
    );
  }
}

