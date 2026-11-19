import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public, Roles } from '../../../common/decorators/auth.decorators';
import { LiveDrmLegalService } from '../services/live-drm-legal.service';

@ApiTags('Live TV Channels & Live Events')
@Controller([
  'api/v1/live',
  'api/live',
  'live',
  'api/v1/admin/live',
  'api/admin/live',
  'api/v1/admin/live-channels',
  'api/admin/live-channels',
  'api/v1/live-channels',
  'api/live-channels',
])
export class LiveController {
  constructor(private readonly liveService: LiveDrmLegalService) {}

  @Public()
  @Get(['channels', ''])
  @ApiOperation({ summary: 'List active Live TV channels' })
  async listChannels() {
    return this.liveService.listLiveChannels(false);
  }

  @Public()
  @Get(['channels/:id', ':id'])
  @ApiOperation({ summary: 'Get Live TV channel details and stream URL' })
  async getChannel(@Param('id', ParseIntPipe) id: number) {
    return this.liveService.getLiveChannelById(id);
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Post(['channels', ''])
  @ApiOperation({ summary: 'Create a Live TV channel' })
  async createChannel(@Body() body: any) {
    return this.liveService.upsertLiveChannel(body);
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Put(['channels/:id', ':id'])
  @ApiOperation({ summary: 'Update a Live TV channel' })
  async updateChannel(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.liveService.upsertLiveChannel(body, id);
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Delete(['channels/:id', ':id'])
  @ApiOperation({ summary: 'Delete a Live TV channel' })
  async deleteChannel(@Param('id', ParseIntPipe) id: number) {
    return this.liveService.deleteLiveChannel(id);
  }

  @Public()
  @Get('events')
  @ApiOperation({ summary: 'List scheduled and live broadcast events' })
  async listEvents() {
    return this.liveService.listLiveEvents();
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Post('events')
  @ApiOperation({ summary: 'Schedule a live broadcast event' })
  async createEvent(@Body() body: any) {
    return this.liveService.upsertLiveEvent(body);
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Put('events/:id')
  @ApiOperation({ summary: 'Update a live broadcast event' })
  async updateEvent(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.liveService.upsertLiveEvent(body, id);
  }
}

