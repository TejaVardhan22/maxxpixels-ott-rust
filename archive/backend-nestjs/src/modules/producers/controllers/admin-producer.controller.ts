import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/auth.decorators';
import { ProducerService } from '../services/producer.service';

@ApiTags('Admin & Studio Producer Management')
@ApiBearerAuth()
@Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_PRODUCER', 'ROLE_CONTENT_MANAGER', 'SUPER_ADMIN', 'ADMIN', 'PRODUCER')
@Controller([
  'api/v1/admin/producers',
  'api/admin/producers',
  'admin/producers',
  'api/v1/producers',
  'api/v1/admin/content/submissions',
  'api/admin/content/submissions',
  'admin/content/submissions',
])
export class AdminProducerController {
  constructor(private readonly producerService: ProducerService) {}

  @Get('submissions')
  @ApiOperation({ summary: 'List media submissions for admin review' })
  async listSubmissions(@Query('status') status?: string) {
    return this.producerService.listSubmissions(status);
  }

  @Get('onboardings')
  @ApiOperation({ summary: 'Get pending and active producer KYC onboardings' })
  async getPendingOnboardings() {
    return this.producerService.getPendingOnboardings();
  }

  @Get(['', 'list'])
  @ApiOperation({ summary: 'List submissions or producers depending on route' })
  async listProducersOrSubmissions(
    @Req() req: any,
    @Query('kycStatus') kycStatus?: string,
    @Query('status') status?: string,
  ) {
    const url = req?.url || '';
    if (url.includes('submissions') || url.includes('content')) {
      return this.producerService.listSubmissions(status);
    }
    return this.producerService.listProducers(kycStatus || status);
  }

  @Post(['onboardings/:id/review', 'onboardings/:id', ':id/kyc/review', ':id/review'])
  @ApiOperation({ summary: 'Review producer KYC onboarding or submission' })
  async reviewProducerOnboarding(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req: any,
  ) {
    const url = req?.url || '';
    if (url.includes('submissions') || url.includes('content')) {
      return this.producerService.reviewSubmission(id, body);
    }
    return this.producerService.reviewProducerOnboarding(id, body);
  }

  @Post(['onboard', 'onboarding'])
  @ApiOperation({ summary: 'Onboard a new producer studio' })
  async onboardProducerStudio(@Body() body: any) {
    return this.producerService.createOrUpdateProducer(body);
  }

  @Post(':id/toggle-status')
  @ApiOperation({ summary: 'Toggle producer active status' })
  async toggleProducerStatus(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const producer = await this.producerService.getProducerById(id);
    const newStatus = body?.status !== undefined ? body.status === 'ACTIVE' : !producer.isActive;
    return this.producerService.createOrUpdateProducer({ isActive: newStatus }, id);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Reset producer account password' })
  async resetProducerPassword(
    @Param('id', ParseIntPipe) id: number,
    @Query('newPassword') newPasswordQuery?: string,
    @Body() body?: any,
  ) {
    const newPassword = body?.newPassword || body?.password || newPasswordQuery || 'Producer@2026';
    const msg = await this.producerService.resetProducerPassword(id, newPassword);
    return {
      success: true,
      statusCode: 200,
      message: msg,
      data: { id, password: newPassword },
      password: newPassword,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get producer profile, KYC status, catalog, and revenue share analytics' })
  async getProducer(@Param('id', ParseIntPipe) id: number) {
    return this.producerService.getProducerById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Onboard a new content producer' })
  async createProducer(@Body() body: any) {
    return this.producerService.createOrUpdateProducer(body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a producer profile, revenue share, or agreement' })
  async updateProducer(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.producerService.createOrUpdateProducer(body, id);
  }

  @Patch([':id/kyc', ':id/verify'])
  @ApiOperation({ summary: 'Approve or reject producer KYC and agreement status' })
  async reviewKyc(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.producerService.reviewKyc(
      id,
      body?.kycStatus || body?.status || 'VERIFIED',
      body?.agreementStatus,
    );
  }

  @Post(':id/submissions')
  @ApiOperation({ summary: 'Submit a new movie or series from producer studio portal' })
  async submitContent(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.producerService.submitProducerContent(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a producer profile' })
  async deleteProducer(@Param('id', ParseIntPipe) id: number) {
    return this.producerService.deleteProducer(id);
  }
}
