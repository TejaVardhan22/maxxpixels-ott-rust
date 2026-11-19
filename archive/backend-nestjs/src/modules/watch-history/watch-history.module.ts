import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaybackSession } from './entities/playback-session.entity';
import { WatchHistory } from './entities/watch-history.entity';
import { Watchlist } from './entities/watchlist.entity';
import { Profile } from '../users/entities/profile.entity';
import { Content } from '../content/entities/content.entity';
import { Episode } from '../content/entities/episode.entity';
import { DrmRule } from '../content/entities/drm-rule.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { ContentPurchase } from '../subscriptions/entities/content-purchase.entity';
import { AdCampaign } from '../advertisements/entities/ad-campaign.entity';
import { PlaybackService } from './services/playback.service';
import { WatchService } from './services/watch.service';
import { PlaybackController } from './controllers/playback.controller';
import {
  WatchController,
  WatchlistController,
  ProfileWatchController,
} from './controllers/watch.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlaybackSession,
      WatchHistory,
      Watchlist,
      Profile,
      Content,
      Episode,
      DrmRule,
      Subscription,
      ContentPurchase,
      AdCampaign,
    ]),
  ],
  controllers: [
    PlaybackController,
    WatchController,
    WatchlistController,
    ProfileWatchController,
  ],
  providers: [PlaybackService, WatchService],
  exports: [PlaybackService, WatchService],
})
export class WatchHistoryModule {}
