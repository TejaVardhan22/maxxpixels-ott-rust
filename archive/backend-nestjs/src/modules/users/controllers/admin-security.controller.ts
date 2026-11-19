import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser, AuthenticatedUser } from '../../../common/decorators/auth.decorators';
import { UsersService } from '../services/users.service';

@ApiTags('Admin Security, RBAC Roles & Permission Matrix')
@ApiBearerAuth()
@Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN')
@Controller([
  'api/v1/admin/security',
  'api/admin/security',
  'admin/security',
  'api/v1/admin/roles',
  'api/admin/roles',
])
export class AdminSecurityController {
  constructor(private readonly usersService: UsersService) {}

  @Get(['roles'])
  @ApiOperation({ summary: 'List all RBAC roles with assigned permissions' })
  async listRoles() {
    return this.usersService.listRoles();
  }

  @Get('matrix')
  @ApiOperation({ summary: 'Get RBAC role-permission matrix' })
  async getMatrix() {
    return this.usersService.getPermissionMatrix();
  }

  @Put('matrix')
  @ApiOperation({ summary: 'Save RBAC role-permission matrix' })
  async saveMatrix(@Body() body: any) {
    return this.usersService.savePermissionMatrix(body);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get security & MFA policies' })
  async getSecuritySettings() {
    return this.usersService.getSecuritySettings();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Save security & MFA policies' })
  async saveSecuritySettings(@Body() body: any) {
    return this.usersService.saveSecuritySettings(body);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'List all granular RBAC permissions' })
  async listPermissions() {
    return this.usersService.listPermissions();
  }

  @Post(['roles', ''])
  @ApiOperation({ summary: 'Create or update an RBAC role' })
  async createRole(@Body() body: any, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.createOrUpdateRole(body, undefined, actor?.email);
  }

  @Put(['roles/:id', ':id'])
  @ApiOperation({ summary: 'Update an existing RBAC role and its permissions matrix' })
  async updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.createOrUpdateRole(body, id, actor?.email);
  }

  @Delete(['roles/:id', ':id'])
  @ApiOperation({ summary: 'Delete a custom RBAC role' })
  async deleteRole(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.deleteRole(id, actor?.email);
  }

  @Get(['audit-logs'])
  @ApiOperation({ summary: 'Retrieve security and administrative audit logs' })
  async getAuditLogs(@Query('limit') limit?: number) {
    return this.usersService.getAuditLogs(limit ? Number(limit) : 100);
  }
}

@ApiTags('Admin Security Audit Logs')
@ApiBearerAuth()
@Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN')
@Controller([
  'api/v1/admin/audit-logs',
  'api/admin/audit-logs',
  'admin/audit-logs',
])
export class AdminAuditLogController {
  constructor(private readonly usersService: UsersService) {}

  @Get(['', 'list'])
  @ApiOperation({ summary: 'Retrieve security and administrative audit logs' })
  async getAuditLogs(@Query('limit') limit?: number) {
    return this.usersService.getAuditLogs(limit ? Number(limit) : 100);
  }
}

