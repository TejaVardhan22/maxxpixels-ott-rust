import {
  Controller,
  Get,
  Headers,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/auth.decorators';
import { resolveLanguage } from '../../../common/utils/language-resolver.util';
import { CmsService } from '../services/cms.service';

@ApiTags('Public CMS (Home Layout, Hero Banners, Curated Sections)')
@Public()
@Controller(['api/v1/cms', 'api/cms', 'cms', 'api/v1', 'api'])
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get(['home', 'pages/home'])
  @ApiOperation({ summary: 'Get Home page hero banners and curated content rails' })
  async getHomeLayout(
    @Query('language') language?: string,
    @Query('typeId') typeId?: number,
    @Query('type') type?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.cmsService.getPageLayout('home', resolveLanguage(language, acceptLanguage), typeId ? Number(typeId) : undefined, type);
  }

  @Get('pages/:slug')
  @ApiOperation({ summary: 'Get dynamic CMS page layout by slug (home, movies, series, free)' })
  async getPageBySlug(
    @Param('slug') slug: string,
    @Query('language') language?: string,
    @Query('typeId') typeId?: number,
    @Query('type') type?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.cmsService.getPageLayout(slug, resolveLanguage(language, acceptLanguage), typeId ? Number(typeId) : undefined, type);
  }

  @Get('banners')
  @ApiOperation({ summary: 'Get active hero banners for a page' })
  async getBanners(
    @Query('page') pageSlug = 'home',
    @Query('language') language?: string,
    @Query('typeId') typeId?: number,
    @Query('type') type?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.cmsService.getBanners(pageSlug, resolveLanguage(language, acceptLanguage), typeId ? Number(typeId) : undefined, type);
  }

  @Get('sections')
  @ApiOperation({ summary: 'Get active curated and dynamic sections' })
  async getSections(
    @Query('pageId') pageId?: number,
    @Query('page') pageSlug = 'home',
    @Query('language') language?: string,
    @Query('typeId') typeId?: number,
    @Query('type') type?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.cmsService.getSections(
      pageId ? Number(pageId) : undefined,
      pageSlug,
      resolveLanguage(language, acceptLanguage),
      typeId ? Number(typeId) : undefined,
      type,
    );
  }
}
