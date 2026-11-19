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
import { Roles } from '../../../common/decorators/auth.decorators';
import { CmsService } from '../services/cms.service';

@ApiTags('Admin CMS (Pages, Sections, Hero Banners)')
@ApiBearerAuth()
@Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
@Controller(['api/v1/admin/cms', 'api/admin/cms', 'admin/cms'])
export class AdminCmsController {
  constructor(private readonly cmsService: CmsService) {}

  // ==================== PAGES ====================

  @Get('pages')
  @ApiOperation({ summary: 'List all CMS pages and their sections' })
  async listPages() {
    return this.cmsService.listPagesAdmin();
  }

  @Post('pages')
  @ApiOperation({ summary: 'Create a CMS page' })
  async createPage(@Body() body: any) {
    return this.cmsService.upsertPage(body);
  }

  @Put('pages/:id')
  @ApiOperation({ summary: 'Update a CMS page' })
  async updatePage(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.cmsService.upsertPage(body, id);
  }

  @Delete('pages/:id')
  @ApiOperation({ summary: 'Delete a CMS page' })
  async deletePage(@Param('id', ParseIntPipe) id: number) {
    return this.cmsService.deletePage(id);
  }

  // ==================== SECTIONS ====================

  @Get('sections')
  @ApiOperation({ summary: 'List CMS sections (optionally filtered by pageId)' })
  async listSections(@Query('pageId') pageId?: number) {
    return this.cmsService.listSectionsAdmin(pageId ? Number(pageId) : undefined);
  }

  @Post('sections')
  @ApiOperation({ summary: 'Create a CMS rail/section' })
  async createSection(@Body() body: any) {
    return this.cmsService.upsertSection(body);
  }

  @Put('sections/:id')
  @ApiOperation({ summary: 'Update a CMS rail/section and its assigned content items' })
  async updateSection(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.cmsService.upsertSection(body, id);
  }

  @Delete('sections/:id')
  @ApiOperation({ summary: 'Delete a CMS rail/section' })
  async deleteSection(@Param('id', ParseIntPipe) id: number) {
    return this.cmsService.deleteSection(id);
  }

  // ==================== BANNERS ====================

  @Get('banners')
  @ApiOperation({ summary: 'List all hero banners' })
  async listBanners() {
    return this.cmsService.listBannersAdmin();
  }

  @Post('banners')
  @ApiOperation({ summary: 'Create a hero banner' })
  async createBanner(@Body() body: any) {
    return this.cmsService.upsertBanner(body);
  }

  @Put('banners/:id')
  @ApiOperation({ summary: 'Update a hero banner' })
  async updateBanner(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.cmsService.upsertBanner(body, id);
  }

  @Delete('banners/:id')
  @ApiOperation({ summary: 'Delete a hero banner' })
  async deleteBanner(@Param('id', ParseIntPipe) id: number) {
    return this.cmsService.deleteBanner(id);
  }
}

