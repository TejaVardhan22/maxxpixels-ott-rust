import {
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  OptionalAuth,
  Roles,
  CurrentUser,
  AuthenticatedUser,
} from '../../../common/decorators/auth.decorators';
import { AnalyticsService } from '../services/analytics.service';

@ApiTags('Admin Analytics Dashboard & Realtime Telemetry')
@ApiBearerAuth()
@Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER', 'ROLE_PRODUCER', 'ADMIN', 'SUPER_ADMIN')
@Controller([
  'api/v1/admin/analytics',
  'api/admin/analytics',
  'admin/analytics',
  'api/v1/admin/dashboard',
  'api/admin/dashboard',
])
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get(['', 'overview', 'summary', 'stats', 'dashboard'])
  @ApiOperation({ summary: 'Get Executive Dashboard KPIs, DAU/MAU, Revenue, and Top Content' })
  async getOverview() {
    return this.analyticsService.getDashboardOverview();
  }

  @Get(['realtime', 'live-streams', 'live'])
  @ApiOperation({ summary: 'Get real-time active playback sessions and device breakdown' })
  async getRealtimeTelemetry() {
    return this.analyticsService.getRealtimeStreamTelemetry();
  }
}

@ApiTags('Public & Player Analytics Events')
@OptionalAuth()
@Controller(['api/v1/analytics', 'api/analytics', 'analytics'])
export class PublicAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post(['event', 'track', 'interaction'])
  @ApiOperation({ summary: 'Record user interaction event (VIEW, LIKE, SHARE, SEARCH)' })
  async recordEvent(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: any,
  ) {
    return this.analyticsService.recordInteraction(user?.id, body);
  }
}

