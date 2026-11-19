import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UnauthorizedException } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser, OptionalAuth } from '../../../common/decorators/auth.decorators';
import { PlaybackService } from '../../watch-history/services/playback.service';
import { WatchService } from '../../watch-history/services/watch.service';
import {
  PlaybackStreamType,
  WatchHistoryItemType,
  WatchProgressInput,
} from '../types/playback.types';

@Resolver()
export class PlaybackResolver {
  constructor(
    private readonly playbackService: PlaybackService,
    private readonly watchService: WatchService,
  ) {}

  @OptionalAuth()
  @Query(() => PlaybackStreamType, { description: 'Resolve authorized video playback stream, HLS URL and DRM' })
  async playbackStream(
    @Args('contentId', { type: () => ID }) contentId: string,
    @Args('episodeId', { type: () => ID, nullable: true }) episodeId?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<PlaybackStreamType> {
    const playbackInfo = await this.playbackService.authorizePlayback(user?.id, {
      contentId,
      episodeId,
      deviceId: 'mobile-app',
      deviceType: 'MOBILE',
    });

    return {
      contentId: String(contentId),
      title: playbackInfo.title || '',
      streamUrl: playbackInfo.playbackUrl || playbackInfo.streamUrl || playbackInfo.videoUrl || '',
      videoUrl: playbackInfo.videoUrl || playbackInfo.playbackUrl || '',
      token: playbackInfo.sessionToken || playbackInfo.token || '',
      drmEnabled: Boolean(playbackInfo.drm?.enabled || playbackInfo.drmEnabled),
      drmLicenseUrl: playbackInfo.drm?.licenseUri || playbackInfo.drmLicenseUrl || '',
      adTags: playbackInfo.adTagUrl ? [playbackInfo.adTagUrl] : [],
    };
  }

  @Query(() => [WatchHistoryItemType], { description: 'Get authenticated user watch history and resume points' })
  async watchHistory(
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<WatchHistoryItemType[]> {
    if (!user?.id) {
      throw new UnauthorizedException('Authentication required');
    }
    const history = await this.watchService.getWatchHistory(user.id, limit || 20);
    return (history || []).map((h: any) => ({
      id: String(h.id || h.contentId),
      contentId: String(h.contentId || h.content?.id),
      title: h.title || h.content?.title || '',
      posterUrl: h.posterUrl || h.content?.posterUrl || '',
      progressMs: Math.round(Number(h.watchedDurationSeconds || h.positionSeconds || 0) * 1000),
      durationMs: Math.round(Number(h.totalDurationSeconds || h.durationSeconds || 0) * 1000),
      completed: Boolean(h.isCompleted),
      updatedAt: h.lastWatchedAt ? new Date(h.lastWatchedAt).toISOString() : undefined,
    }));
  }

  @Mutation(() => Boolean, { description: 'Update current playback position and progress for content' })
  async updateWatchProgress(
    @Args('input') input: WatchProgressInput,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<boolean> {
    if (!user?.id) {
      throw new UnauthorizedException('Authentication required');
    }
    await this.watchService.saveWatchProgress(user.id, {
      contentId: input.contentId,
      episodeId: input.episodeId,
      watchedDurationSeconds: Math.floor(input.progressMs / 1000),
      totalDurationSeconds: Math.floor(input.durationMs / 1000),
    });
    return true;
  }
}

