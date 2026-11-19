import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/auth.decorators';
import { LiveDrmLegalService } from '../services/live-drm-legal.service';

@ApiTags('Admin DRM Policies & Legal Pages')
@ApiBearerAuth()
@Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
@Controller(['api/v1/admin', 'api/admin', 'admin'])
export class AdminDrmLegalController {
  constructor(private readonly service: LiveDrmLegalService) {}

  // ==================== DRM RULES ====================

  @Get(['drm/rules', 'drm-rules', 'drm', 'rules'])
  @ApiOperation({ summary: 'List all DRM protection rules' })
  async listDrmRules() {
    return this.service.listDrmRules();
  }

  @Post(['drm/rules', 'drm-rules', 'drm', 'rules'])
  @ApiOperation({ summary: 'Create or bulk-update DRM protection rules' })
  async createDrmRule(@Body() body: any) {
    return this.service.upsertDrmRule(body);
  }

  @Put(['drm/rules/:id', 'drm-rules/:id', 'drm/:id', 'rules/:id'])
  @ApiOperation({ summary: 'Update a DRM protection rule' })
  async updateDrmRule(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.upsertDrmRule(body, id);
  }

  @Delete(['drm/rules/:id', 'drm-rules/:id', 'drm/:id', 'rules/:id'])
  @ApiOperation({ summary: 'Delete a DRM protection rule' })
  async deleteDrmRule(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteDrmRule(id);
  }

  // ==================== LEGAL PAGES ====================

  @Get(['legal-pages', 'legal'])
  @ApiOperation({ summary: 'List all legal & policy pages' })
  async listLegalPages() {
    return this.service.listLegalPages();
  }

  @Get(['legal-pages/:slug', 'legal/:slug'])
  @ApiOperation({ summary: 'Get a legal page by slug' })
  async getLegalPage(@Param('slug') slug: string) {
    return this.service.getLegalPageBySlug(slug);
  }

  @Post(['legal-pages', 'legal'])
  @ApiOperation({ summary: 'Create or update a legal page' })
  async createLegalPage(@Body() body: any) {
    return this.service.upsertLegalPage(body);
  }

  @Put(['legal-pages/:slugOrId', 'legal/:slugOrId'])
  @ApiOperation({ summary: 'Update a legal page by slug or ID' })
  async updateLegalPage(@Param('slugOrId') slugOrId: string, @Body() body: any) {
    return this.service.upsertLegalPage(body, slugOrId);
  }

  @Delete(['legal-pages/:id', 'legal/:id'])
  @ApiOperation({ summary: 'Delete a legal page by ID' })
  async deleteLegalPage(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteLegalPage(id);
  }
}

