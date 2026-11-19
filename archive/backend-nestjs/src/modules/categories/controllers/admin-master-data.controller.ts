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

@ApiTags('Master Data (Languages, Genres, Content Types, Cast)')
@Controller([
  'api/v1/admin/masters',
  'api/admin/masters',
  'admin/masters',
  'api/v1/masters',
  'api/masters',
  'masters',
  'api/v1/admin/master-data',
  'api/admin/master-data',
  'admin/master-data',
  'api/v1/admin',
  'api/admin',
  'api/v1',
  'api',
])
export class AdminMasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}

  // ==================== LANGUAGES ====================

  @Public()
  @Get('languages')
  @ApiOperation({ summary: 'List all platform languages' })
  async listLanguages() {
    return this.masterDataService.listLanguages(false);
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Post('languages')
  @ApiOperation({ summary: 'Create or update a platform language' })
  async createLanguage(@Body() body: any) {
    return this.masterDataService.upsertLanguage(body);
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Put('languages/:code')
  @ApiOperation({ summary: 'Update a platform language by code' })
  async updateLanguage(@Param('code') code: string, @Body() body: any) {
    return this.masterDataService.upsertLanguage(body, code);
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Post('languages/consolidate-duplicates')
  @ApiOperation({ summary: 'Consolidate duplicate languages and remap canonical references' })
  async consolidateDuplicateLanguages() {
    return this.masterDataService.consolidateDuplicateLanguages();
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Delete('languages/:code')
  @ApiOperation({ summary: 'Delete a language by code' })
  async deleteLanguage(@Param('code') code: string) {
    return this.masterDataService.deleteLanguage(code);
  }

  // ==================== GENRES ====================

  @Public()
  @Get('genres')
  @ApiOperation({ summary: 'List all genres' })
  async listGenres() {
    return this.masterDataService.listGenres(false);
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Post('genres')
  @ApiOperation({ summary: 'Create a genre' })
  async createGenre(@Body() body: any) {
    return this.masterDataService.upsertGenre(body);
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Put('genres/:id')
  @ApiOperation({ summary: 'Update a genre by ID' })
  async updateGenre(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.masterDataService.upsertGenre(body, id);
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Delete('genres/:id')
  @ApiOperation({ summary: 'Delete a genre by ID' })
  async deleteGenre(@Param('id', ParseIntPipe) id: number) {
    return this.masterDataService.deleteGenre(id);
  }

  // ==================== CONTENT TYPES ====================

  @Public()
  @Get(['content-types', 'types'])
  @ApiOperation({ summary: 'List all content types' })
  async listContentTypes() {
    return this.masterDataService.listContentTypes(false);
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Post(['content-types', 'types'])
  @ApiOperation({ summary: 'Create a content type' })
  async createContentType(@Body() body: any) {
    return this.masterDataService.upsertContentType(body);
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Put(['content-types/:id', 'types/:id'])
  @ApiOperation({ summary: 'Update a content type by ID' })
  async updateContentType(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.masterDataService.upsertContentType(body, id);
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Delete(['content-types/:id', 'types/:id'])
  @ApiOperation({ summary: 'Delete a content type by ID' })
  async deleteContentType(@Param('id', ParseIntPipe) id: number) {
    return this.masterDataService.deleteContentType(id);
  }

  // ==================== CAST / PERSONS ====================

  @Public()
  @Get(['cast', 'persons', 'people'])
  @ApiOperation({ summary: 'List cast and crew members' })
  async listPersons(@Query('search') search?: string) {
    return this.masterDataService.listPersons(search);
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Post(['cast', 'persons', 'people'])
  @ApiOperation({ summary: 'Create a cast/crew person profile' })
  async createPerson(@Body() body: any) {
    return this.masterDataService.upsertPerson(body);
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Put(['cast/:id', 'persons/:id', 'people/:id'])
  @ApiOperation({ summary: 'Update a cast/crew person profile' })
  async updatePerson(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.masterDataService.upsertPerson(body, id);
  }

  @ApiBearerAuth()
  @Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER')
  @Delete(['cast/:id', 'persons/:id', 'people/:id'])
  @ApiOperation({ summary: 'Delete a cast/crew person profile' })
  async deletePerson(@Param('id', ParseIntPipe) id: number) {
    return this.masterDataService.deletePerson(id);
  }
}
