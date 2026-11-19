import { User } from '../../../modules/users/entities/user.entity';
import { Role } from '../../../modules/users/entities/role.entity';
import { Permission } from '../../../modules/users/entities/permission.entity';
import { Profile } from '../../../modules/users/entities/profile.entity';
import { Device } from '../../../modules/users/entities/device.entity';
import { RefreshToken } from '../../../modules/users/entities/refresh-token.entity';
import { AuditLog } from '../../../modules/users/entities/audit-log.entity';
import { ProducerProfile } from '../../../modules/producers/entities/producer-profile.entity';
import { Category } from '../../../modules/categories/entities/category.entity';
import { Genre } from '../../../modules/categories/entities/genre.entity';
import { ContentType } from '../../../modules/categories/entities/content-type.entity';
import { Person } from '../../../modules/categories/entities/person.entity';
import { ContentCast } from '../../../modules/categories/entities/content-cast.entity';
import { Language } from '../../../modules/languages/entities/language.entity';
import { Content } from '../../../modules/content/entities/content.entity';
import { Movie } from '../../../modules/content/entities/movie.entity';
import { Series } from '../../../modules/content/entities/series.entity';
import { Season } from '../../../modules/content/entities/season.entity';
import { Episode } from '../../../modules/content/entities/episode.entity';
import { MediaAsset } from '../../../modules/content/entities/media-asset.entity';
import { Page } from '../../../modules/content/entities/page.entity';
import { Section } from '../../../modules/content/entities/section.entity';
import { SectionItem } from '../../../modules/content/entities/section-item.entity';
import { Banner } from '../../../modules/content/entities/banner.entity';
import { LiveChannel } from '../../../modules/content/entities/live-channel.entity';
import { LiveEvent } from '../../../modules/content/entities/live-event.entity';
import { LegalPage } from '../../../modules/content/entities/legal-page.entity';
import { DrmRule } from '../../../modules/content/entities/drm-rule.entity';
import { Plan } from '../../../modules/subscriptions/entities/plan.entity';
import { Subscription } from '../../../modules/subscriptions/entities/subscription.entity';
import { Coupon } from '../../../modules/subscriptions/entities/coupon.entity';
import { TvodProduct } from '../../../modules/subscriptions/entities/tvod-product.entity';
import { ContentPurchase } from '../../../modules/subscriptions/entities/content-purchase.entity';
import { PaymentOrder } from '../../../modules/payments/entities/payment-order.entity';
import { Payment } from '../../../modules/payments/entities/payment.entity';
import { AdCampaign } from '../../../modules/advertisements/entities/ad-campaign.entity';
import { AdProvider } from '../../../modules/advertisements/entities/ad-provider.entity';
import { AdProviderConfig } from '../../../modules/advertisements/entities/ad-provider-config.entity';
import { AdPlacement } from '../../../modules/advertisements/entities/ad-placement.entity';
import { AdRule } from '../../../modules/advertisements/entities/ad-rule.entity';
import { AdSession } from '../../../modules/advertisements/entities/ad-session.entity';
import { AdEvent } from '../../../modules/advertisements/entities/ad-event.entity';
import { AdRevenue } from '../../../modules/advertisements/entities/ad-revenue.entity';
import { ProducerAdRevenue } from '../../../modules/advertisements/entities/producer-ad-revenue.entity';
import { PlaybackSession } from '../../../modules/watch-history/entities/playback-session.entity';
import { WatchHistory } from '../../../modules/watch-history/entities/watch-history.entity';
import { Watchlist } from '../../../modules/watch-history/entities/watchlist.entity';
import { Notification } from '../../../modules/notifications/entities/notification.entity';
import { UserNotification } from '../../../modules/notifications/entities/user-notification.entity';
import { UserInteraction } from '../../../modules/analytics/entities/user-interaction.entity';
import { SystemSetting } from '../../../modules/uploads/entities/system-setting.entity';
import { OutboxEvent } from './outbox-event.entity';

export {
  User,
  Role,
  Permission,
  Profile,
  Device,
  RefreshToken,
  AuditLog,
  ProducerProfile,
  Category,
  Genre,
  ContentType,
  Person,
  ContentCast,
  Language,
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
  Plan,
  Subscription,
  Coupon,
  TvodProduct,
  ContentPurchase,
  PaymentOrder,
  Payment,
  AdCampaign,
  AdProvider,
  AdProviderConfig,
  AdPlacement,
  AdRule,
  AdSession,
  AdEvent,
  AdRevenue,
  ProducerAdRevenue,
  PlaybackSession,
  WatchHistory,
  Watchlist,
  Notification,
  UserNotification,
  UserInteraction,
  SystemSetting,
  OutboxEvent,
};

export const ALL_ENTITIES = [
  User,
  Role,
  Permission,
  Profile,
  Device,
  RefreshToken,
  AuditLog,
  ProducerProfile,
  Category,
  Genre,
  ContentType,
  Person,
  ContentCast,
  Language,
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
  Plan,
  Subscription,
  Coupon,
  TvodProduct,
  ContentPurchase,
  PaymentOrder,
  Payment,
  AdCampaign,
  AdProvider,
  AdProviderConfig,
  AdPlacement,
  AdRule,
  AdSession,
  AdEvent,
  AdRevenue,
  ProducerAdRevenue,
  PlaybackSession,
  WatchHistory,
  Watchlist,
  Notification,
  UserNotification,
  UserInteraction,
  SystemSetting,
  OutboxEvent,
];

