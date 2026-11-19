import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, Roles, CurrentUser, AuthenticatedUser } from '../../../common/decorators/auth.decorators';
import { SystemSettingService } from '../services/system-setting.service';
import { DatabaseBackupService } from '../services/database-backup.service';

@ApiTags('Admin System Settings & Backups')
@ApiBearerAuth()
@Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN')
@Controller(['api/v1/admin/settings', 'api/admin/settings', 'admin/settings'])
export class AdminSettingsController {
  constructor(
    private readonly settingService: SystemSettingService,
    private readonly backupService: DatabaseBackupService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all system settings (secrets masked)' })
  async getAllSettings(@Query('group') group?: string) {
    return this.settingService.getAllSettings(group, true);
  }

  @Get('group/:group')
  @ApiOperation({ summary: 'Get system settings by group' })
  async getSettingsByGroup(@Param('group') group: string) {
    return this.settingService.getAllSettings(group, true);
  }

  @Put()
  @ApiOperation({ summary: 'Update one or more system settings' })
  async updateSettings(
    @Body() body: any,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.settingService.updateSettings(body, user?.email || 'admin@maxxpixels.com', req?.ip);
  }

  @Post()
  @ApiOperation({ summary: 'Update one or more system settings (POST alias)' })
  async updateSettingsPost(
    @Body() body: any,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.settingService.updateSettings(body, user?.email || 'admin@maxxpixels.com', req?.ip);
  }

  @Post([
    'test-connection',
    'test',
    'test-bunny-storage',
    'test-bunny-stream',
    'test-s3',
    'test-razorpay',
    'test-stripe',
  ])
  @ApiOperation({ summary: 'Test live connection to Bunny CDN, S3, Razorpay, Stripe, or Storage' })
  async testConnection(
    @Body() body: any,
    @Req() req: any,
    @Query('provider') providerQuery?: string,
  ) {
    const url = req?.url || '';
    let provider = body?.provider || body?.type || providerQuery || 'BUNNY';
    if (url.includes('test-bunny-storage')) provider = 'BUNNY_STORAGE';
    else if (url.includes('test-bunny-stream')) provider = 'BUNNY_STREAM';
    else if (url.includes('test-s3')) provider = 'S3';
    else if (url.includes('test-razorpay')) provider = 'RAZORPAY';
    else if (url.includes('test-stripe')) provider = 'STRIPE';

    return this.settingService.testConnection(provider, body);
  }

  @Get(['audit-logs', 'history'])
  @ApiOperation({ summary: 'Get system settings change audit history' })
  async getAuditHistory(@Query('limit') limit?: number) {
    return this.settingService.getAuditHistory(limit ? Number(limit) : 50);
  }

  @Post('rollback/:auditId')
  @ApiOperation({ summary: 'Rollback a system setting to its previous value from audit log' })
  async rollbackSetting(
    @Param('auditId', ParseIntPipe) auditId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingService.rollbackSetting(auditId, user?.email || 'admin@maxxpixels.com');
  }

  @Post('backups/trigger')
  @ApiOperation({ summary: 'Trigger an immediate PostgreSQL database backup' })
  async triggerBackup(@CurrentUser() user: AuthenticatedUser) {
    return this.backupService.triggerBackup(user?.email || 'MANUAL_ADMIN');
  }

  @Get('backups')
  @ApiOperation({ summary: 'List available database backup archives' })
  async listBackups() {
    return this.backupService.listBackups();
  }
}

