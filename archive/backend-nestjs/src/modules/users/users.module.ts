import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { Profile } from './entities/profile.entity';
import { Device } from './entities/device.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuditLog } from './entities/audit-log.entity';
import { PlaybackSession } from '../watch-history/entities/playback-session.entity';
import { UsersService } from './services/users.service';
import { AdminUserController } from './controllers/admin-user.controller';
import { AdminDeviceController } from './controllers/admin-device.controller';
import { AdminSecurityController, AdminAuditLogController } from './controllers/admin-security.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      Permission,
      Profile,
      Device,
      RefreshToken,
      AuditLog,
      PlaybackSession,
    ]),
  ],
  controllers: [AdminUserController, AdminDeviceController, AdminSecurityController, AdminAuditLogController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

