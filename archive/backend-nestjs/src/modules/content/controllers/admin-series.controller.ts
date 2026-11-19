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
import { AdminContentService } from '../services/admin-content.service';
import { CatalogService } from '../services/catalog.service';

@ApiTags('Admin Series, Seasons & Episodes Management')
@ApiBearerAuth()
@Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER', 'ROLE_PRODUCER')
@Controller(['api/v1/admin/series', 'api/admin/series', 'admin/series'])
export class AdminSeriesController {
  constructor(
    private readonly adminContentService: AdminContentService,
    private readonly catalogService: CatalogService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List paginated web series (including seasons & episodes)' })
  async listSeries(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.adminContentService.listSeries({ page, size, search, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get web series details with seasons and episodes' })
  async getSeries(@Param('id', ParseIntPipe) id: number) {
    return this.catalogService.getContentDetail(id, undefined, true);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new web series' })
  async createSeries(@Body() body: any) {
    return this.adminContentService.createOrUpdateSeries(body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing web series' })
  async updateSeries(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.adminContentService.createOrUpdateSeries(body, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a web series and all its seasons/episodes' })
  async deleteSeries(@Param('id', ParseIntPipe) id: number) {
    return this.adminContentService.deleteContent(id);
  }

  // ==================== SEASONS ====================

  @Get(':seriesId/seasons')
  @ApiOperation({ summary: 'List seasons for a web series' })
  async listSeasons(@Param('seriesId', ParseIntPipe) seriesId: number) {
    return this.catalogService.getSeasonsBySeries(seriesId);
  }

  @Post(':seriesId/seasons')
  @ApiOperation({ summary: 'Create a season for a web series' })
  async createSeason(
    @Param('seriesId', ParseIntPipe) seriesId: number,
    @Body() body: any,
  ) {
    return this.adminContentService.createOrUpdateSeason(seriesId, body);
  }

  @Put([':seriesId/seasons/:seasonId', 'seasons/:seasonId'])
  @ApiOperation({ summary: 'Update a season' })
  async updateSeason(
    @Param('seasonId', ParseIntPipe) seasonId: number,
    @Body() body: any,
    @Param('seriesId') seriesId?: string,
  ) {
    return this.adminContentService.createOrUpdateSeason(
      seriesId ? Number(seriesId) : Number(body?.seriesId || 0),
      body,
      seasonId,
    );
  }

  @Delete([':seriesId/seasons/:seasonId', 'seasons/:seasonId'])
  @ApiOperation({ summary: 'Delete a season and its episodes' })
  async deleteSeason(@Param('seasonId', ParseIntPipe) seasonId: number) {
    return this.adminContentService.deleteSeason(seasonId);
  }

  // ==================== EPISODES ====================

  @Get('seasons/:seasonId/episodes')
  @ApiOperation({ summary: 'List episodes for a season' })
  async listEpisodes(@Param('seasonId', ParseIntPipe) seasonId: number) {
    return this.catalogService.getEpisodesBySeason(seasonId);
  }

  @Post([':seriesId/seasons/:seasonId/episodes', 'seasons/:seasonId/episodes'])
  @ApiOperation({ summary: 'Create an episode in a season' })
  async createEpisode(
    @Param('seasonId', ParseIntPipe) seasonId: number,
    @Body() body: any,
  ) {
    return this.adminContentService.createOrUpdateEpisode(seasonId, body);
  }

  @Put(['seasons/:seasonId/episodes/:episodeId', 'episodes/:episodeId'])
  @ApiOperation({ summary: 'Update an episode' })
  async updateEpisode(
    @Param('episodeId', ParseIntPipe) episodeId: number,
    @Body() body: any,
    @Param('seasonId') seasonId?: string,
  ) {
    return this.adminContentService.createOrUpdateEpisode(
      seasonId ? Number(seasonId) : Number(body?.seasonId || 0),
      body,
      episodeId,
    );
  }

  @Delete(['seasons/:seasonId/episodes/:episodeId', 'episodes/:episodeId'])
  @ApiOperation({ summary: 'Delete an episode' })
  async deleteEpisode(@Param('episodeId', ParseIntPipe) episodeId: number) {
    return this.adminContentService.deleteEpisode(episodeId);
  }
}

