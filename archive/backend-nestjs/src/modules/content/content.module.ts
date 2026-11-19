import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Content } from './entities/content.entity';
import { Movie } from './entities/movie.entity';
import { Series } from './entities/series.entity';
import { Season } from './entities/season.entity';
import { Episode } from './entities/episode.entity';
import { MediaAsset } from './entities/media-asset.entity';
import { Page } from './entities/page.entity';
import { Section } from './entities/section.entity';
import { SectionItem } from './entities/section-item.entity';
import { Banner } from './entities/banner.entity';
import { LiveChannel } from './entities/live-channel.entity';
import { LiveEvent } from './entities/live-event.entity';
import { LegalPage } from './entities/legal-page.entity';
import { DrmRule } from './entities/drm-rule.entity';
import { Genre } from '../categories/entities/genre.entity';
import { Category } from '../categories/entities/category.entity';
import { ContentType } from '../categories/entities/content-type.entity';
import { Person } from '../categories/entities/person.entity';
import { ContentCast } from '../categories/entities/content-cast.entity';
import { Language } from '../languages/entities/language.entity';
import { TvodProduct } from '../subscriptions/entities/tvod-product.entity';
import { ContentPurchase } from '../subscriptions/entities/content-purchase.entity';
import { Watchlist } from '../watch-history/entities/watchlist.entity';
import { CatalogService } from './services/catalog.service';
import { CmsService } from './services/cms.service';
import { AdminContentService } from './services/admin-content.service';
import { LiveDrmLegalService } from './services/live-drm-legal.service';
import { CatalogController, PublicDiscoveryController } from './controllers/catalog.controller';
import { CmsController } from './controllers/cms.controller';
import { LiveController } from './controllers/live.controller';
import { AdminMovieController } from './controllers/admin-movie.controller';
import { AdminSeriesController } from './controllers/admin-series.controller';
import { AdminCmsController } from './controllers/admin-cms.controller';
import { AdminDrmLegalController } from './controllers/admin-drm-legal.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Content,
      Movie,
      Series,
      Season,
      Episode,
      MediaAsset,
      Page,
      Section,
      SectionItem,
      Banner,
      LiveChannel,
      LiveEvent,
      LegalPage,
      DrmRule,
      Genre,
      Category,
      ContentType,
      Person,
      ContentCast,
      Language,
      TvodProduct,
      ContentPurchase,
      Watchlist,
    ]),
  ],
  controllers: [
    CatalogController,
    PublicDiscoveryController,
    CmsController,
    LiveController,
    AdminMovieController,
    AdminSeriesController,
    AdminCmsController,
    AdminDrmLegalController,
  ],
  providers: [
    CatalogService,
    CmsService,
    AdminContentService,
    LiveDrmLegalService,
  ],
  exports: [
    CatalogService,
    CmsService,
    AdminContentService,
    LiveDrmLegalService,
  ],
})
export class ContentModule {}

