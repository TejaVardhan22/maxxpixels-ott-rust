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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Public,
  Roles,
  CurrentUser,
  AuthenticatedUser,
  OptionalAuth,
} from '../../../common/decorators/auth.decorators';
import { PlanService } from '../services/plan.service';

@ApiTags('Subscription Plans & Coupons')
@Controller([
  'api/v1/plans',
  'api/plans',
  'plans',
  'api/v1/subscriptions',
  'api/subscriptions',
])
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Public()
  @OptionalAuth()
  @Get()
  @ApiOperation({ summary: 'List active subscription plans' })
  async listActivePlans(
    @CurrentUser() user?: AuthenticatedUser,
    @Query('userId') queryUserId?: string,
    @Query('user_id') queryUser_Id?: string,
  ) {
    const effectiveUserId = user?.id || queryUserId || queryUser_Id;
    return this.planService.listPlans(true, effectiveUserId);
  }

  @ApiBearerAuth()
  @Get('my')
  @ApiOperation({ summary: 'Get authenticated user subscription history' })
  async getMySubscriptions(@CurrentUser() user: AuthenticatedUser) {
    return this.planService.getUserSubscriptions(user.id);
  }

  @Public()
  @Post('validate-coupon')
  @ApiOperation({ summary: 'Validate a promotional coupon code and calculate discount' })
  async validateCoupon(@Body() body: any) {
    return this.planService.validateAndCalculateCoupon(
      body?.code || body?.couponCode,
      Number(body?.amount ?? body?.orderAmount ?? 100),
      body?.planId ? Number(body.planId) : undefined,
    );
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get subscription plan details by ID' })
  async getPlan(@Param('id', ParseIntPipe) id: number) {
    return this.planService.getPlanById(id);
  }
}

@ApiTags('Public Coupons Validation')
@Controller(['api/v1/coupons', 'api/coupons', 'coupons'])
export class PublicCouponController {
  constructor(private readonly planService: PlanService) {}

  @Public()
  @Get('validate')
  @ApiOperation({ summary: 'Validate a coupon code and return discount amount' })
  async validateCouponGet(
    @Query('code') code: string,
    @Query('amount') amount?: string,
    @Query('planId') planId?: string,
  ) {
    const result = await this.planService.validateAndCalculateCoupon(
      code,
      Number(amount ?? 100),
      planId ? Number(planId) : undefined,
    );
    return result.discountAmount;
  }
}

@ApiTags('Admin Plans & Coupons')
@ApiBearerAuth()
@Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN')
@Controller([
  'api/v1/admin/plans',
  'api/admin/plans',
  'admin/plans',
])
export class AdminPlanController {
  constructor(private readonly planService: PlanService) {}

  @Get()
  @ApiOperation({ summary: 'List all subscription plans (including inactive)' })
  async listAllPlans(
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('search') search?: string,
  ) {
    if (page !== undefined) {
      return this.planService.listAdminPlansPaginated(Number(page), Number(size || 20), search);
    }
    return this.planService.listPlans(false);
  }

  @Get('coupons')
  @ApiOperation({ summary: 'List all promotional coupons' })
  async listCoupons() {
    return this.planService.listCoupons();
  }

  @Post('coupons')
  @ApiOperation({ summary: 'Create a promotional coupon' })
  async createCoupon(@Body() body: any) {
    return this.planService.upsertCoupon(body);
  }

  @Put('coupons/:id')
  @ApiOperation({ summary: 'Update a promotional coupon' })
  async updateCoupon(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.planService.upsertCoupon(body, id);
  }

  @Delete('coupons/:id')
  @ApiOperation({ summary: 'Delete a promotional coupon' })
  async deleteCoupon(@Param('id', ParseIntPipe) id: number) {
    return this.planService.deleteCoupon(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subscription plan details by ID' })
  async getPlan(@Param('id', ParseIntPipe) id: number) {
    return this.planService.getPlanById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a subscription plan' })
  async createPlan(@Body() body: any) {
    return this.planService.upsertPlan(body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a subscription plan' })
  async updatePlan(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.planService.upsertPlan(body, id);
  }

  @Patch(':id/toggle-status')
  @ApiOperation({ summary: 'Toggle active status of a subscription plan' })
  async togglePlanStatus(@Param('id', ParseIntPipe) id: number) {
    return this.planService.togglePlanStatus(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a subscription plan' })
  async deletePlan(@Param('id', ParseIntPipe) id: number) {
    return this.planService.deletePlan(id);
  }
}

@ApiTags('Admin Coupons')
@ApiBearerAuth()
@Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN')
@Controller([
  'api/v1/admin/coupons',
  'api/admin/coupons',
  'admin/coupons',
])
export class AdminCouponController {
  constructor(private readonly planService: PlanService) {}

  @Get()
  @ApiOperation({ summary: 'List paginated promotional coupons' })
  async listCoupons(
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('search') search?: string,
  ) {
    if (page !== undefined) {
      return this.planService.listAdminCouponsPaginated(Number(page), Number(size || 20), search);
    }
    return this.planService.listCoupons();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get coupon details by ID' })
  async getCoupon(@Param('id', ParseIntPipe) id: number) {
    return this.planService.getCouponById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a promotional coupon' })
  async createCoupon(@Body() body: any) {
    return this.planService.upsertCoupon(body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a promotional coupon' })
  async updateCoupon(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.planService.upsertCoupon(body, id);
  }

  @Patch(':id/toggle-status')
  @ApiOperation({ summary: 'Toggle active status of a coupon' })
  async toggleCouponStatus(@Param('id', ParseIntPipe) id: number) {
    return this.planService.toggleCouponStatus(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a promotional coupon' })
  async deleteCoupon(@Param('id', ParseIntPipe) id: number) {
    return this.planService.deleteCoupon(id);
  }
}
