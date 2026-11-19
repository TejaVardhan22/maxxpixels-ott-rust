import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/auth.decorators';
import { WatchService } from '../services/watch.service';

@ApiTags('Watch History & Continue Watching')
@ApiBearerAuth()
@Controller([
  'api/v1/watch',
  'api/watch',
  'watch',
  'api/v1/watch-history',
  'api/watch-history',
])
export class WatchController {
  constructor(private readonly watchService: WatchService) {}

  @Get(['continue-watching', 'continue'])
  @ApiOperation({ summary: 'Get Continue Watching rail for authenticated user' })
  async getContinueWatching(
    @CurrentUser() user: AuthenticatedUser,
    @Query('profileId') profileId?: string,
  ) {
    return this.watchService.getContinueWatching(user.id, profileId);
  }

  @Get(['history', ''])
  @ApiOperation({ summary: 'Get full watch history for authenticated user' })
  async getWatchHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: number,
  ) {
    return this.watchService.getWatchHistory(user.id, limit);
  }

  @Post(['progress', 'history'])
  @ApiOperation({ summary: 'Save watch progress for movie or episode' })
  async saveProgress(@CurrentUser() user: AuthenticatedUser, @Body() body: any) {
    return this.watchService.saveWatchProgress(user.id, body);
  }

  @Delete('history/:id')
  @ApiOperation({ summary: 'Remove item from Continue Watching / Watch History' })
  async removeHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.watchService.removeWatchProgress(user.id, id);
  }

  @Get('watchlist')
  @ApiOperation({ summary: 'Get user watchlist / bookmarked content' })
  async getWatchlist(@CurrentUser() user: AuthenticatedUser) {
    return this.watchService.getWatchlist(user.id);
  }

  @Post(['watchlist', 'watchlist/:contentId'])
  @ApiOperation({ summary: 'Add or toggle content in user watchlist' })
  async toggleWatchlist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('contentId') paramId?: string,
    @Body() body?: any,
  ) {
    const contentId = Number(paramId || body?.contentId);
    return this.watchService.toggleWatchlist(user.id, contentId, body?.profileId);
  }

  @Delete('watchlist/:contentId')
  @ApiOperation({ summary: 'Remove content from user watchlist' })
  async removeFromWatchlist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('contentId', ParseIntPipe) contentId: number,
  ) {
    return this.watchService.removeFromWatchlist(user.id, contentId);
  }
}

@ApiTags('Watchlist & Profile Continue Watching')
@ApiBearerAuth()
@Controller(['api/v1/watchlist', 'api/watchlist', 'watchlist'])
export class WatchlistController {
  constructor(private readonly watchService: WatchService) {}

  @Get()
  @ApiOperation({ summary: 'Get user watchlist' })
  async getWatchlist(@CurrentUser() user: AuthenticatedUser) {
    return this.watchService.getWatchlist(user.id);
  }

  @Post(['', ':contentId'])
  @ApiOperation({ summary: 'Add or toggle content in user watchlist' })
  async addToWatchlist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('contentId') paramId?: string,
    @Body() body?: any,
  ) {
    const contentId = Number(paramId || body?.contentId);
    return this.watchService.toggleWatchlist(user.id, contentId, body?.profileId);
  }

  @Delete(['', ':contentId'])
  @ApiOperation({ summary: 'Remove content from user watchlist' })
  async removeFromWatchlist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('contentId') paramId?: string,
    @Query('contentId') queryContentId?: string,
  ) {
    const contentId = Number(paramId || queryContentId);
    return this.watchService.removeFromWatchlist(user.id, contentId);
  }
}

@ApiTags('Profile Continue Watching')
@ApiBearerAuth()
@Controller(['api/v1/profiles', 'api/profiles'])
export class ProfileWatchController {
  constructor(private readonly watchService: WatchService) {}

  @Get(':profileId/continue-watching')
  @ApiOperation({ summary: 'Get Continue Watching rail for a specific user profile' })
  async getProfileContinueWatching(
    @CurrentUser() user: AuthenticatedUser,
    @Param('profileId') profileId: string,
  ) {
    return this.watchService.getContinueWatching(user.id, profileId);
  }
}
