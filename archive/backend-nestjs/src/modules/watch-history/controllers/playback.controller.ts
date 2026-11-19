import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  OptionalAuth,
  CurrentUser,
  AuthenticatedUser,
} from '../../../common/decorators/auth.decorators';
import { PlaybackService } from '../services/playback.service';
import { WatchService } from '../services/watch.service';

@ApiTags('Playback Authorization, DRM & Stream Heartbeats')
@Controller(['api/v1/playback', 'api/playback', 'playback', 'api/v1/video', 'api/video', 'video'])
export class PlaybackController {
  constructor(
    private readonly playbackService: PlaybackService,
    private readonly watchService: WatchService,
  ) {}

  @OptionalAuth()
  @Post(['authorize', 'sessions', 'start', 'init', 'play'])
  @ApiOperation({ summary: 'Authorize video playback, check concurrency & entitlements, and issue signed HLS URL' })
  async authorizePlayback(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.playbackService.authorizePlayback(user?.id, body, req?.ip);
  }

  @OptionalAuth()
  @Get(['authorize/:contentId', 'stream/:contentId'])
  @ApiOperation({ summary: 'Authorize video playback by contentId (GET alias)' })
  async authorizePlaybackGet(
    @Param('contentId', ParseIntPipe) contentId: number,
    @Query('episodeId') episodeId?: number,
    @Query('trailer') trailer?: string,
    @Query('deviceId') deviceId?: string,
    @CurrentUser() user?: AuthenticatedUser,
    @Req() req?: any,
  ) {
    return this.playbackService.authorizePlayback(
      user?.id,
      {
        contentId,
        episodeId: episodeId ? Number(episodeId) : undefined,
        isTrailer: trailer === 'true',
        deviceId,
      },
      req?.ip,
    );
  }

  @ApiBearerAuth()
  @Post('progress')
  @ApiOperation({ summary: 'Sync playback progress position' })
  async syncProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any,
  ) {
    return this.watchService.saveWatchProgress(user.id, body);
  }

  @ApiBearerAuth()
  @OptionalAuth()
  @Post(['heartbeat', 'sessions/:sessionId/heartbeat'])
  @ApiOperation({ summary: 'Record 30-second playback heartbeat and sync resume position asynchronously' })
  async heartbeat(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: any,
    @Param('sessionId') sessionId?: string,
  ) {
    const payload = {
      ...(body || {}),
      sessionToken: sessionId || body?.sessionId || body?.sessionToken,
      sessionId: sessionId || body?.sessionId || body?.sessionToken,
    };
    return this.playbackService.recordHeartbeat(user?.id, payload);
  }

  @ApiBearerAuth()
  @OptionalAuth()
  @Post('stop')
  @ApiOperation({ summary: 'Release active playback stream slot on player exit' })
  async stopPlayback(@CurrentUser() user: AuthenticatedUser | undefined, @Body() body: any) {
    return this.playbackService.stopPlayback(user?.id, body);
  }
}
