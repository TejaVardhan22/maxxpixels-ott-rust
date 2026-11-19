import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProducerProfile } from './entities/producer-profile.entity';
import { Content } from '../content/entities/content.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { AdCampaign } from '../advertisements/entities/ad-campaign.entity';
import { AdEvent } from '../advertisements/entities/ad-event.entity';
import { PlaybackSession } from '../watch-history/entities/playback-session.entity';
import { ProducerService } from './services/producer.service';
import { AdminProducerController } from './controllers/admin-producer.controller';
import { ProducerPortalController } from './controllers/producer-portal.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProducerProfile, Content, User, Role, AdCampaign, AdEvent, PlaybackSession])],
  controllers: [AdminProducerController, ProducerPortalController],
  providers: [ProducerService],
  exports: [ProducerService],
})
export class ProducersModule {}
