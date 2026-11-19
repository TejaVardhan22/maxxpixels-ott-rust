import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser, Roles, Public } from '../../../common/decorators/auth.decorators';
import { ProducerService } from '../services/producer.service';

@ApiTags('Producer Studio Portal')
@ApiBearerAuth()
@Roles('ROLE_PRODUCER', 'PRODUCER', 'ROLE_ADMIN', 'ADMIN', 'ROLE_SUPER_ADMIN', 'SUPER_ADMIN')
@Controller([
  'api/v1/producer',
  'api/producer',
  'producer',
])
export class ProducerPortalController {
  constructor(private readonly producerService: ProducerService) {}

  private isUserAdmin(user: AuthenticatedUser): boolean {
    const roles = Array.isArray(user?.roles) ? user.roles.map((r: any) => String(r?.name || r).toUpperCase()) : [];
    return roles.some((r) => r.includes('ADMIN'));
  }

  private resolveProducerId(user: AuthenticatedUser, producerId?: string): number | undefined {
    if (!this.isUserAdmin(user)) {
      return undefined;
    }
    return producerId && producerId !== 'ALL' && !isNaN(Number(producerId)) ? Number(producerId) : undefined;
  }

  @Public()
  @Post(['register', 'signup'])
  @ApiOperation({ summary: 'Register a new content producer studio' })
  async registerProducerStudio(@Body() body: any) {
    return this.producerService.createOrUpdateProducer(body);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get studio profile for authenticated producer' })
  async getProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Query('producerId') producerId?: string,
  ) {
    const pId = this.resolveProducerId(user, producerId);
    return this.producerService.getProducerProfileForUser(user, pId);
  }

  @Post(['kyc/documents', 'kyc'])
  @ApiOperation({ summary: 'Upload or update KYC document URLs' })
  async updateKycDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any,
    @Query('producerId') producerId?: string,
  ) {
    const pId = this.resolveProducerId(user, producerId);
    return this.producerService.updateKycDocuments(user, body, pId);
  }

  @Get('submissions')
  @ApiOperation({ summary: 'Get submitted media assets for studio' })
  async getMySubmissions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('producerId') producerId?: string,
  ) {
    const pId = this.resolveProducerId(user, producerId);
    return this.producerService.getMySubmissions(user, pId);
  }

  @Post('submissions')
  @ApiOperation({ summary: 'Submit new media asset for ingestion and review' })
  async submitContent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any,
  ) {
    return this.producerService.submitContentFromPortal(user, body);
  }

  @Get('agreement')
  @ApiOperation({ summary: 'Get digital distribution & licensing agreement' })
  async getAgreement(
    @CurrentUser() user: AuthenticatedUser,
    @Query('producerId') producerId?: string,
  ) {
    const pId = this.resolveProducerId(user, producerId);
    return this.producerService.getProducerAgreement(user, pId);
  }

  @Post(['agreement/upload', 'agreement'])
  @ApiOperation({ summary: 'Upload and confirm signed producer agreement' })
  async uploadAgreement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: any,
    @Query('producerId') producerId?: string,
  ) {
    const pId = this.resolveProducerId(user, producerId);
    const url = body?.signedAgreementUrl || body?.agreementUrl || body?.url;
    return this.producerService.uploadSignedAgreement(user, url, pId);
  }

  @Get('analytics/movies')
  @ApiOperation({ summary: 'Get movie assets performance, stream views, and SSAI ad telemetry' })
  async getMovieAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Query('producerId') producerId?: string,
  ) {
    const effectiveProducerId = this.isUserAdmin(user) ? producerId : undefined;
    return this.producerService.getMovieAnalytics(user, effectiveProducerId);
  }

  @Get('analytics/dashboard')
  @ApiOperation({ summary: 'Get studio dashboard analytics overview' })
  async getDashboardAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Query('producerId') producerId?: string,
  ) {
    const effectiveProducerId = this.isUserAdmin(user) ? producerId : undefined;
    return this.producerService.getDashboardAnalytics(user, effectiveProducerId);
  }

  @Get('analytics/content-overview')
  @ApiOperation({
    summary:
      'Producer dashboard data: per-content name, total + unique views, VAST ad runs (pre/mid/post roll), day-wise views & ads charts',
  })
  async getContentOverview(
    @CurrentUser() user: AuthenticatedUser,
    @Query('producerId') producerId?: string,
    @Query('contentId') contentId?: string,
  ) {
    const effectiveProducerId = this.isUserAdmin(user) ? producerId : undefined;
    return this.producerService.getProducerContentOverview(
      user,
      effectiveProducerId,
      contentId && !isNaN(Number(contentId)) && Number(contentId) > 0 ? Number(contentId) : undefined,
    );
  }

  @Get('analytics/ad-breakdown')
  @ApiOperation({ summary: 'Get active SSAI ad run breakdown' })
  async getAdRunBreakdown(@CurrentUser() user: AuthenticatedUser) {
    return this.producerService.getAdRunBreakdown(user);
  }
}

