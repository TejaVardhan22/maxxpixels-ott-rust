import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser, AuthenticatedUser } from '../../../common/decorators/auth.decorators';
import { UsersService } from '../services/users.service';

@ApiTags('Admin Device & Stream Session Management')
@ApiBearerAuth()
@Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN')
@Controller([
  'api/v1/admin/devices',
  'api/admin/devices',
  'admin/devices',
  'api/v1/admin/sessions',
])
export class AdminDeviceController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List registered user devices and live streaming status' })
  async listDevices(@Query('userId') userId?: string) {
    return this.usersService.listDevices(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a device or active stream session' })
  async revokeDevice(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.revokeDevice(id, actor?.email);
  }

  @Post([':id/revoke', ':id/disconnect'])
  @ApiOperation({ summary: 'Revoke a device or active stream session (POST alias)' })
  async revokeDevicePost(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.revokeDevice(id, actor?.email);
  }

  @Post('user/:userId/disconnect-all')
  @ApiOperation({ summary: 'Disconnect all active devices and streams for a user' })
  async disconnectAll(
    @Param('userId') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.disconnectAllUserSessions(userId, actor?.email);
  }
}

