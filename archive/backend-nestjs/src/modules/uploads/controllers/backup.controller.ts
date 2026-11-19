import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { Roles } from '../../../common/decorators/auth.decorators';
import { DatabaseBackupService } from '../services/database-backup.service';

@ApiTags('Admin Database Backup & Recovery')
@ApiBearerAuth()
@Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'SUPER_ADMIN', 'ADMIN')
@Controller([
  'api/v1/backup',
  'api/backup',
  'backup',
  'api/v1/admin/backup',
  'api/admin/backup',
  'admin/backup',
])
export class BackupController {
  private readonly backupDir = path.join(process.cwd(), 'backups');

  constructor(private readonly backupService: DatabaseBackupService) {}

  @Get(['list', ''])
  @ApiOperation({ summary: 'List available database backup archives' })
  async listBackups() {
    const artifacts = await this.backupService.listBackups();
    return artifacts.map((a) => {
      const sizeKb = (a.sizeBytes / 1024).toFixed(1);
      const sizeMb = (a.sizeBytes / (1024 * 1024)).toFixed(2);
      const sizeFormatted = a.sizeBytes >= 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;
      const lastModified = new Date(a.createdAt).getTime();
      const lastModifiedDate = new Date(a.createdAt).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      return {
        filename: a.fileName,
        sizeBytes: a.sizeBytes,
        sizeFormatted,
        lastModified,
        lastModifiedDate,
        downloadUrl: `/api/v1/backup/download/${encodeURIComponent(a.fileName)}`,
        cdnUrl: a.cdnUrl,
        bunnyStorageUrl: a.cdnUrl,
        storedOnBunny: Boolean(a.cdnUrl),
        storedLocally: true,
        storageProvider: a.cdnUrl ? 'Bunny.net CDN + Local Disk' : 'Local Disk',
      };
    });
  }

  @Post(['export', 'trigger', 'run'])
  @ApiOperation({ summary: 'Trigger manual database snapshot export (.sql.gz)' })
  async triggerBackup(@Body() body?: any) {
    const result = await this.backupService.triggerBackup(body?.initiatedBy || 'MANUAL_ADMIN');
    const sizeKb = (result.sizeBytes / 1024).toFixed(1);
    const sizeMb = (result.sizeBytes / (1024 * 1024)).toFixed(2);
    const sizeFormatted = result.sizeBytes >= 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

    return {
      status: 'SUCCESS',
      filename: result.fileName,
      backupFile: result.fileName,
      sizeBytes: result.sizeBytes,
      sizeFormatted,
      storageBucket: 'db-backups',
      cdnUrl: result.cdnUrl,
      location: result.location,
      createdAt: result.createdAt,
    };
  }

  @Get('download/:filename')
  @ApiOperation({ summary: 'Download compressed database backup archive' })
  async downloadBackup(@Param('filename') filename: string, @Res() res: any) {
    const cleanName = path.basename(filename);
    const fullPath = path.join(this.backupDir, cleanName);

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException(`Backup file ${cleanName} not found`);
    }

    const stat = fs.statSync(fullPath);
    res.type('application/gzip');
    res.header('Content-Disposition', `attachment; filename="${cleanName}"`);
    res.header('Content-Length', stat.size);
    return res.send(fs.createReadStream(fullPath));
  }
}
