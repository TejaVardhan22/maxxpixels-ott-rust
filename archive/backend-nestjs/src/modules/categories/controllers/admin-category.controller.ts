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
import { Public, Roles } from '../../../common/decorators/auth.decorators';
import { MasterDataService } from '../services/master-data.service';
import { CatalogService } from '../../content/services/catalog.service';

@ApiTags('Categories & Taxonomy')
@Controller([
  'api/v1/admin/masters/categories',
  'api/admin/masters/categories',
  'admin/masters/categories',
  'api/v1/admin/categories',
  'api/admin/categories',
  'admin/categories',
  'api/v1/categories',
  'api/categories',
  'categories',
])
export class AdminCategoryController {
  constructor(
    private readonly masterDataService: MasterDataService,
    private readonly catalogService: CatalogService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all content categories' })
  async listCategories() {
    return this.masterDataService.listCategories(false);
  }

  @Public()
  @Get([':idOrSlug/content', ':idOrSlug', ':idOrSlug/movies'])
  @ApiOperation({ summary: 'Get published content by category ID or slug' })
  async getContentByCategory(
    @Param('idOrSlug') idOrSlug: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('language') language?: string,
  ) {
    return this.catalogService.getContentByCategorySlugOrId(idOrSlug, page, size, language);
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Post()
  @ApiOperation({ summary: 'Create a new content category' })
  async createCategory(@Body() body: any) {
    return this.masterDataService.createCategory(body);
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Put(':id')
  @ApiOperation({ summary: 'Update an existing content category' })
  async updateCategory(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.masterDataService.updateCategory(id, body);
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a content category' })
  async deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.masterDataService.deleteCategory(id);
  }
}
