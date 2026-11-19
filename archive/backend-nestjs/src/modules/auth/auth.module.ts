import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { Profile } from '../users/entities/profile.entity';
import { Device } from '../users/entities/device.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SmsService } from './services/sms.service';
import { AuthService } from './services/auth.service';
import { UserProfileService } from './services/user-profile.service';
import { UserDeviceService } from './services/user-device.service';
import { AuthController, ProfileDeviceController } from './controllers/auth.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, Profile, Device, RefreshToken, Subscription]),
  ],
  controllers: [AuthController, ProfileDeviceController],
  providers: [SmsService, AuthService, UserProfileService, UserDeviceService],
  exports: [SmsService, AuthService, UserProfileService, UserDeviceService],
})
export class AuthModule {}
