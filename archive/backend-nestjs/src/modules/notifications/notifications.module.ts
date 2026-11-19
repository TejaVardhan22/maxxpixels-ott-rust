import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { UserNotification } from './entities/user-notification.entity';
import { Device } from '../users/entities/device.entity';
import { User } from '../users/entities/user.entity';
import { NotificationService } from './services/notification.service';
import {
  AdminNotificationController,
  UserNotificationController,
} from './controllers/notification.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, UserNotification, Device, User]),
  ],
  controllers: [AdminNotificationController, UserNotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}

