import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Roles,
  CurrentUser,
  AuthenticatedUser,
} from '../../../common/decorators/auth.decorators';
import { NotificationService } from '../services/notification.service';

@ApiTags('Admin Multi-Channel Notifications (Push, SMS, WhatsApp, Email)')
@ApiBearerAuth()
@Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN')
@Controller([
  'api/v1/admin/notifications',
  'api/admin/notifications',
  'admin/notifications',
])
export class AdminNotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get(['history'])
  @ApiOperation({ summary: 'List notification broadcast history' })
  async listHistory(@Query('limit') limit?: number) {
    return this.notificationService.listNotificationHistory(limit);
  }

  @Get('config')
  @ApiOperation({ summary: 'Get multi-channel gateway configuration' })
  async getConfig() {
    return this.notificationService.getChannelConfig();
  }

  @Post(['config/:channel', 'config'])
  @ApiOperation({ summary: 'Save channel gateway configuration' })
  async saveConfig(
    @Param('channel') channel: string,
    @Body() body: any,
  ) {
    return this.notificationService.saveChannelConfig(channel || body?.channel, body);
  }

  @Post('test')
  @ApiOperation({ summary: 'Test / ping notification gateway' })
  async testGateway(@Body() body: any) {
    return this.notificationService.testGateway(body);
  }

  @Post('push/topic')
  @ApiOperation({ summary: 'Broadcast push notification to topic' })
  async pushTopic(@Body() body: any, @CurrentUser() actor: AuthenticatedUser) {
    return this.notificationService.sendNotification({
      channel: 'PUSH',
      targetAudience: body?.topic || 'ALL',
      title: body?.title,
      message: body?.message,
      imageUrl: body?.imageUrl,
      deepLinkUrl: body?.actionUrl,
    }, actor?.email);
  }

  @Post('push/user/:userId')
  @ApiOperation({ summary: 'Send push notification to specific user' })
  async pushUser(
    @Param('userId') userId: string,
    @Body() body: any,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.notificationService.sendNotification({
      channel: 'PUSH',
      targetUserId: userId,
      targetAudience: 'USER',
      title: body?.title,
      message: body?.message,
      imageUrl: body?.imageUrl,
    }, actor?.email);
  }

  @Post(['sms/send', 'sms/bulk'])
  @ApiOperation({ summary: 'Send direct or bulk SMS' })
  async sendSms(@Body() body: any, @CurrentUser() actor: AuthenticatedUser) {
    return this.notificationService.sendNotification({
      channel: 'SMS',
      title: 'SMS Alert',
      message: body?.message,
      targetAudience: body?.phoneNumbers ? 'BULK' : 'PHONE',
      phoneNumbers: body?.phoneNumbers || [body?.phoneNumber],
    }, actor?.email);
  }

  @Post(['whatsapp/send', 'whatsapp/bulk'])
  @ApiOperation({ summary: 'Send direct or bulk WhatsApp message' })
  async sendWhatsApp(@Body() body: any, @CurrentUser() actor: AuthenticatedUser) {
    return this.notificationService.sendNotification({
      channel: 'WHATSAPP',
      title: 'WhatsApp Message',
      message: body?.message,
      targetAudience: body?.phoneNumbers ? 'BULK' : 'PHONE',
      phoneNumbers: body?.phoneNumbers || [body?.phoneNumber],
      imageUrl: body?.mediaUrl,
    }, actor?.email);
  }

  @Post(['email/send', 'email/bulk'])
  @ApiOperation({ summary: 'Send direct or bulk Email' })
  async sendEmail(@Body() body: any, @CurrentUser() actor: AuthenticatedUser) {
    return this.notificationService.sendNotification({
      channel: 'EMAIL',
      title: body?.subject || 'MaxxPixels Update',
      message: body?.body || body?.message,
      targetAudience: body?.toEmails ? 'BULK' : 'EMAIL',
      recipientEmails: body?.toEmails || [body?.toEmail],
      deepLinkUrl: body?.actionUrl,
    }, actor?.email);
  }

  @Post('all/user/:userId')
  @ApiOperation({ summary: 'Broadcast across all channels to a specific user' })
  async sendAllChannels(
    @Param('userId') userId: string,
    @Body() body: any,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.notificationService.sendNotification({
      channel: 'ALL',
      targetUserId: userId,
      title: body?.title,
      message: body?.message,
    }, actor?.email);
  }

  @Post(['send', 'broadcast', ''])
  @ApiOperation({ summary: 'Dispatch a Push, SMS, WhatsApp, or Email notification asynchronously' })
  async sendNotification(
    @Body() body: any,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.notificationService.sendNotification(body, actor?.email);
  }

  @Get('devices')
  @ApiOperation({ summary: 'List active devices with registered FCM push tokens' })
  async listDevices() {
    return this.notificationService.listRegisteredFcmDevices();
  }
}

@ApiTags('User Notification Inbox')
@ApiBearerAuth()
@Controller(['api/v1/notifications', 'api/notifications', 'notifications'])
export class UserNotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get authenticated user notification inbox' })
  async getInbox(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationService.getUserInbox(user.id);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notificationService.markAsRead(user.id, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for authenticated user' })
  async markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationService.markAllAsRead(user.id);
  }
}

