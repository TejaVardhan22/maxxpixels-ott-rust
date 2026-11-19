import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserInteraction } from './entities/user-interaction.entity';
import { User } from '../users/entities/user.entity';
import { Content } from '../content/entities/content.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Payment } from '../payments/entities/payment.entity';
import { PlaybackSession } from '../watch-history/entities/playback-session.entity';
import { AnalyticsService } from './services/analytics.service';
import {
  AdminAnalyticsController,
  PublicAnalyticsController,
} from './controllers/analytics.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserInteraction,
      User,
      Content,
      Subscription,
      Payment,
      PlaybackSession,
    ]),
  ],
  controllers: [AdminAnalyticsController, PublicAnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}

