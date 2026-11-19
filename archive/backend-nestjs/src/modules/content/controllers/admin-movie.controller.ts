import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/auth.decorators';
import { AdminContentService } from '../services/admin-content.service';
import { CatalogService } from '../services/catalog.service';

@ApiTags('Admin Movies Management')
@ApiBearerAuth()
@Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_CONTENT_MANAGER', 'ROLE_PRODUCER')
@Controller([
  'api/v1/admin/movies',
  'api/admin/movies',
  'admin/movies',
])
export class AdminMovieController {
  private readonly logger = new Logger(AdminMovieController.name);

  constructor(
    private readonly adminContentService: AdminContentService,
    private readonly catalogService: CatalogService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List paginated movies and content catalog (including drafts)' })
  async listMovies(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('contentType') contentType?: string,
    @Query('type') type?: string,
  ) {
    return this.adminContentService.listMovies({
      page,
      size,
      search,
      status,
      contentType: contentType || type,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get movie details by ID' })
  async getMovie(@Param('id', ParseIntPipe) id: number) {
    const res = await this.catalogService.getContentDetail(id, undefined, true);
    return {
      success: true,
      statusCode: 200,
      data: res,
      message: 'Movie retrieved successfully',
      ...res,
    };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Quick toggle content status (DRAFT / PUBLISHED / ARCHIVED)' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
  ) {
    try {
      const res = await this.adminContentService.updateContentStatus(id, status);
      return {
        success: true,
        statusCode: 200,
        data: res,
        message: `Content status updated to ${status}`,
        ...res,
      };
    } catch (err: any) {
      this.logger.error(`Failed to update status for content ${id}: ${err.message}`, err.stack);
      throw err;
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create a new movie with metadata, genres, languages, cast, and TVOD pricing' })
  async createMovie(@Body() body: any) {
    try {
      const res = await this.adminContentService.createOrUpdateMovie(body);
      return {
        success: true,
        statusCode: 200,
        data: res,
        message: 'Movie created successfully',
        ...res,
      };
    } catch (err: any) {
      this.logger.error(`Failed to create movie: ${err.message}`, err.stack);
      throw err;
    }
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing movie' })
  async updateMovie(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    try {
      const res = await this.adminContentService.createOrUpdateMovie(body, id);
      return {
        success: true,
        statusCode: 200,
        data: res,
        message: 'Movie updated successfully',
        ...res,
      };
    } catch (err: any) {
      this.logger.error(`Failed to update movie ${id}: ${err.message}`, err.stack);
      throw err;
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a movie and its dependent assets' })
  async deleteMovie(@Param('id', ParseIntPipe) id: number) {
    return this.adminContentService.deleteContent(id);
  }
}

