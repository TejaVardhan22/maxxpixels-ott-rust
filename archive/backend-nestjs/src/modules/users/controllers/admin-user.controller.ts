import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser, AuthenticatedUser } from '../../../common/decorators/auth.decorators';
import { UsersService } from '../services/users.service';

@ApiTags('Admin User Management')
@ApiBearerAuth()
@Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN')
@Controller(['api/v1/admin/users', 'api/admin/users', 'admin/users'])
export class AdminUserController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List paginated platform users with search, status, and role filters' })
  async listUsers(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
  ) {
    return this.usersService.findAllUsers({ page, size, search, status, role });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed user account by ID' })
  async getUser(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user or admin account' })
  async createUser(@Body() body: any, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.createUser(body, actor?.email);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user details, status, or roles' })
  async updateUser(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.updateUser(id, body, actor?.email);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update user status (ACTIVE, BLOCKED, SUSPENDED)' })
  async patchStatus(
    @Param('id') id: string,
    @Body() body: any,
    @Query('status') statusQuery: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const status = body?.status || statusQuery || 'ACTIVE';
    return this.usersService.updateUserStatus(id, status, actor?.email);
  }

  @Post(':id/block')
  @ApiOperation({ summary: 'Block user account and terminate active playback sessions' })
  async blockUser(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.updateUserStatus(id, 'BLOCKED', actor?.email);
  }

  @Post(':id/unblock')
  @ApiOperation({ summary: 'Unblock user account' })
  async unblockUser(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.updateUserStatus(id, 'ACTIVE', actor?.email);
  }

  @Post([':id/reset-password', ':id/password'])
  @ApiOperation({ summary: 'Force reset a user password' })
  async resetPassword(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const newPassword = body?.newPassword || body?.password || 'MaxxOtt@123';
    return this.usersService.resetUserPassword(id, newPassword, actor?.email);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user and cascade-delete dependent sessions, history, and tokens' })
  async deleteUser(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.deleteUser(id, actor?.email);
  }
}

