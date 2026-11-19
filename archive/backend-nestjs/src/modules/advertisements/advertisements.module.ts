import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdCampaign } from './entities/ad-campaign.entity';
import { AdProvider } from './entities/ad-provider.entity';
import { AdProviderConfig } from './entities/ad-provider-config.entity';
import { AdPlacement } from './entities/ad-placement.entity';
import { AdRule } from './entities/ad-rule.entity';
import { AdSession } from './entities/ad-session.entity';
import { AdEvent } from './entities/ad-event.entity';
import { AdRevenue } from './entities/ad-revenue.entity';
import { ProducerAdRevenue } from './entities/producer-ad-revenue.entity';
import { Content } from '../content/entities/content.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { AdCampaignService } from './services/ad-campaign.service';
import { AdMonetizationService } from './services/ad-monetization.service';
import { PublicVastController, AdminAdController, AdsTxtController } from './controllers/ad.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdCampaign,
      AdProvider,
      AdProviderConfig,
      AdPlacement,
      AdRule,
      AdSession,
      AdEvent,
      AdRevenue,
      ProducerAdRevenue,
      Content,
      Subscription,
    ]),
  ],
  controllers: [PublicVastController, AdminAdController, AdsTxtController],
  providers: [AdCampaignService, AdMonetizationService],
  exports: [AdCampaignService, AdMonetizationService],
})
export class AdvertisementsModule {}
