import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Public,
  OptionalAuth,
  CurrentUser,
  AuthenticatedUser,
} from '../../../common/decorators/auth.decorators';
import { resolveLanguage } from '../../../common/utils/language-resolver.util';
import { CatalogService } from '../services/catalog.service';
import { LiveDrmLegalService } from '../services/live-drm-legal.service';
import { SystemSettingService } from '../../uploads/services/system-setting.service';
import { Genre } from '../../categories/entities/genre.entity';
import { Category } from '../../categories/entities/category.entity';
import { ContentType } from '../../categories/entities/content-type.entity';
import { Language } from '../../languages/entities/language.entity';

@ApiTags('Public Content Catalog & Metadata')
@Controller([
  'api/v1/catalog',
  'api/catalog',
  'catalog',
  'api/v1/content',
  'api/content',
  'api/v1/contents',
  'api/contents',
])
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly liveDrmLegalService: LiveDrmLegalService,
    private readonly settingService: SystemSettingService,
    @InjectRepository(Genre)
    private readonly genreRepo: Repository<Genre>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(ContentType)
    private readonly contentTypeRepo: Repository<ContentType>,
    @InjectRepository(Language)
    private readonly languageRepo: Repository<Language>,
  ) {}

  @Public()
  @Get('genres')
  @ApiOperation({ summary: 'List all genres (public, for admin forms & client filters)' })
  async getGenres() {
    const rows = await this.genreRepo.find({ order: { name: 'ASC' } });
    return rows
      .filter((g) => (g as any).isActive !== false)
      .map((g) => ({ id: Number(g.id), name: g.name, slug: g.slug }));
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'List all categories (public, for admin forms & client filters)' })
  async getCategories() {
    const rows = await this.categoryRepo.find({ order: { displayOrder: 'ASC', name: 'ASC' } });
    return rows
      .filter((c) => c.isActive !== false)
      .map((c) => ({ id: Number(c.id), name: c.name, slug: c.slug, imageUrl: c.imageUrl }));
  }

  @Public()
  @Get('content-types')
  @ApiOperation({ summary: 'List all content types (public, for admin forms & client filters)' })
  async getContentTypes() {
    const rows = await this.contentTypeRepo.find({ order: { title: 'ASC' } });
    return rows
      .filter((t) => (t as any).isActive !== false)
      .map((t) => ({ id: Number(t.id), name: t.title, slug: t.slug }));
  }

  @Public()
  @Get('languages')
  @ApiOperation({ summary: 'List all languages (public, for admin forms & client filters)' })
  async getLanguages() {
    const rows = await this.languageRepo.find({ order: { name: 'ASC' } });
    return rows
      .filter((l) => (l as any).isActive !== false)
      .map((l) => ({ id: Number(l.id), name: l.name, code: l.code }));
  }

  @Public()
  @Get(['', 'content'])
  @ApiOperation({ summary: 'Browse and filter published OTT catalog (Movies & Series)' })
  async browseCatalog(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('type') type?: string,
    @Query('categoryId') categoryId?: number,
    @Query('genreId') genreId?: number,
    @Query('language') language?: string,
    @Query('accessType') accessType?: string,
    @Query('featured') featured?: string,
    @Query('trending') trending?: string,
    @Query('search') search?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const resolvedLang = resolveLanguage(language, acceptLanguage);
    return this.catalogService.browseCatalog({
      page,
      size,
      type,
      categoryId,
      genreId,
      language: resolvedLang,
      accessType,
      featured: featured !== undefined ? featured === 'true' : undefined,
      trending: trending !== undefined ? trending === 'true' : undefined,
      search,
    });
  }

  @Public()
  @Get('movies')
  @ApiOperation({ summary: 'Browse published Movies' })
  async browseMovies(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('categoryId') categoryId?: number,
    @Query('genreId') genreId?: number,
    @Query('language') language?: string,
    @Query('search') search?: string,
  ) {
    return this.catalogService.browseCatalog({
      page,
      size,
      type: 'MOVIE',
      categoryId,
      genreId,
      language,
      search,
    });
  }

  @Public()
  @Get('series')
  @ApiOperation({ summary: 'Browse published Web Series' })
  async browseSeries(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('categoryId') categoryId?: number,
    @Query('genreId') genreId?: number,
    @Query('language') language?: string,
    @Query('search') search?: string,
  ) {
    return this.catalogService.browseCatalog({
      page,
      size,
      type: 'SERIES',
      categoryId,
      genreId,
      language,
      search,
    });
  }

  @Public()
  @Get('trending')
  @ApiOperation({ summary: 'Get trending content' })
  async getTrending(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('language') language?: string,
  ) {
    return this.catalogService.browseCatalog({
      page,
      size,
      trending: true,
      language,
    });
  }

  @Public()
  @Get('featured')
  @ApiOperation({ summary: 'Get featured content' })
  async getFeatured(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('language') language?: string,
  ) {
    return this.catalogService.browseCatalog({
      page,
      size,
      featured: true,
      language,
    });
  }

  @Public()
  @Get('shorts')
  @ApiOperation({ summary: 'Get short-form vertical videos / shorts' })
  async getShorts(
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    return this.catalogService.browseCatalog({
      page,
      size: size || 20,
    });
  }

  @Public()
  @Get('by-language/:language')
  @ApiOperation({ summary: 'Get published content by language code or name' })
  async getByLanguage(
    @Param('language') language: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('type') type?: string,
  ) {
    return this.catalogService.browseCatalog({
      page,
      size: size || 50,
      language,
      type,
    });
  }

  @Public()
  @Get('non-kannada')
  @ApiOperation({ summary: 'Get published non-Kannada content' })
  async getNonKannada(
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    return this.catalogService.getNonKannadaContent(page, size);
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Full-text catalog search across titles, descriptions, and genres' })
  async searchCatalog(
    @Query('q') q?: string,
    @Query('query') query?: string,
    @Query('search') search?: string,
    @Query('name') name?: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    return this.catalogService.browseCatalog({
      page,
      size,
      search: q || query || search || name || '',
    });
  }

  @Public()
  @Get('metadata')
  @ApiOperation({ summary: 'Get active languages, categories, genres, and content types' })
  async getMetadata() {
    return this.catalogService.getPublicMetadata();
  }

  @Public()
  @Get(['config', 'settings'])
  @ApiOperation({ summary: 'Get public client configuration & app versioning settings' })
  async getPublicConfig() {
    return this.settingService.getPublicConfig();
  }

  @Public()
  @Get('legal')
  @ApiOperation({ summary: 'List all legal & policy pages' })
  async listLegalPages() {
    return this.liveDrmLegalService.listLegalPages();
  }

  @Public()
  @Get('legal/:slug')
  @ApiOperation({ summary: 'Get legal page by slug (privacy-policy, terms-of-use, refund-policy)' })
  async getLegalPage(@Param('slug') slug: string) {
    return this.liveDrmLegalService.getLegalPageBySlug(slug);
  }

  @OptionalAuth()
  @Get('rented')
  @ApiOperation({ summary: 'List rented TVOD content for user or available rental catalog' })
  async getRentedContent(@CurrentUser() user?: AuthenticatedUser) {
    return this.catalogService.getRentedContentList(user?.id);
  }

  @Public()
  @Get('series/:seriesId/seasons')
  @ApiOperation({ summary: 'Get seasons and episodes for a series' })
  async getSeasons(@Param('seriesId', ParseIntPipe) seriesId: number) {
    return this.catalogService.getSeasonsBySeries(seriesId);
  }

  @Public()
  @Get('seasons/:seasonId/episodes')
  @ApiOperation({ summary: 'Get episodes for a season' })
  async getEpisodes(@Param('seasonId', ParseIntPipe) seasonId: number) {
    return this.catalogService.getEpisodesBySeason(seasonId);
  }

  @OptionalAuth()
  @Get(['content/id/:id', 'content/:idOrSlug', 'id/:id', ':idOrSlug'])
  @ApiOperation({ summary: 'Get full content details by numeric ID or slug' })
  async getContentDetail(
    @Param('id') id?: string,
    @Param('idOrSlug') idOrSlug?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.catalogService.getContentDetail(id || idOrSlug || '', user?.id);
  }
}

@ApiTags('Public Discovery, Search, Settings, Legal & TVOD')
@Controller(['api/v1', 'api'])
export class PublicDiscoveryController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly liveDrmLegalService: LiveDrmLegalService,
    private readonly settingService: SystemSettingService,
  ) {}

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Full-text catalog search across titles, descriptions, and genres' })
  async search(
    @Query('q') q?: string,
    @Query('query') query?: string,
    @Query('search') search?: string,
    @Query('name') name?: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    return this.catalogService.browseCatalog({
      page,
      size,
      search: q || query || search || name || '',
    });
  }

  @Public()
  @Get(['settings', 'settings/public'])
  @ApiOperation({ summary: 'Get public platform settings and configuration' })
  async getSettings() {
    return this.settingService.getPublicConfig();
  }

  @Public()
  @Get('legal')
  @ApiOperation({ summary: 'List all legal & policy pages' })
  async listLegalPages() {
    return this.liveDrmLegalService.listLegalPages();
  }

  @Public()
  @Get('legal/:slug')
  @ApiOperation({ summary: 'Get legal page by slug' })
  async getLegalPage(@Param('slug') slug: string) {
    return this.liveDrmLegalService.getLegalPageBySlug(slug);
  }

  @OptionalAuth()
  @Get('tvod/products')
  @ApiOperation({ summary: 'List available TVOD rental products' })
  async getTvodProducts(@CurrentUser() user?: AuthenticatedUser) {
    return this.catalogService.getRentedContentList(user?.id);
  }

  @ApiBearerAuth()
  @Get('tvod/purchases')
  @ApiOperation({ summary: 'List authenticated user active TVOD purchases' })
  async getTvodPurchases(@CurrentUser() user: AuthenticatedUser) {
    return this.catalogService.getRentedContentList(user.id);
  }

  @ApiBearerAuth()
  @Post('tvod/purchase')
  @ApiOperation({ summary: 'Purchase or rent TVOD content' })
  async purchaseTvod(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any,
  ) {
    return this.catalogService.purchaseTvodContent(user.id, body);
  }
}
