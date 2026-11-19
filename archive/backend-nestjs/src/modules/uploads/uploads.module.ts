import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemSetting } from './entities/system-setting.entity';
import { AuditLog } from '../users/entities/audit-log.entity';
import { SystemSettingService } from './services/system-setting.service';
import { DatabaseBackupService } from './services/database-backup.service';
import { AdminSettingsController } from './controllers/admin-settings.controller';
import { AdminStorageController } from './controllers/admin-storage.controller';
import { BackupController } from './controllers/backup.controller';
import { PublicMediaController } from './controllers/public-media.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SystemSetting, AuditLog])],
  controllers: [
    AdminSettingsController,
    AdminStorageController,
    BackupController,
    PublicMediaController,
  ],
  providers: [SystemSettingService, DatabaseBackupService],
  exports: [SystemSettingService, DatabaseBackupService],
})
export class UploadsModule {}
