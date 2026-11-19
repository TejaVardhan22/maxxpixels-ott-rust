import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import kafkaConfig from './config/kafka.config';

import { DatabaseModule } from './infrastructure/database/database.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { KafkaModule } from './infrastructure/kafka/kafka.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { LoggingModule } from './infrastructure/logging/logging.module';
import { WebsocketModule } from './infrastructure/websocket/websocket.module';

import { HealthModule } from './health/health.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { LanguagesModule } from './modules/languages/languages.module';
import { ContentModule } from './modules/content/content.module';
import { WatchHistoryModule } from './modules/watch-history/watch-history.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProducersModule } from './modules/producers/producers.module';
import { AdvertisementsModule } from './modules/advertisements/advertisements.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { MaintenanceModeInterceptor } from './common/interceptors/maintenance-mode.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, kafkaConfig],
    }),
    ScheduleModule.forRoot(),
    LoggingModule,
    DatabaseModule,
    RedisModule,
    KafkaModule,
    StorageModule,
    WebsocketModule,
    HealthModule,
    UploadsModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    LanguagesModule,
    ContentModule,
    WatchHistoryModule,
    SubscriptionsModule,
    PaymentsModule,
    ProducersModule,
    AdvertisementsModule,
    NotificationsModule,
    AnalyticsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MaintenanceModeInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}

