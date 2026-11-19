import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Public,
  Roles,
  CurrentUser,
  AuthenticatedUser,
  OptionalAuth,
} from '../../../common/decorators/auth.decorators';
import { PaymentService } from '../services/payment.service';
import { CreatePaymentOrderDto } from '../dto/create-order.dto';
import { VerifyPaymentDto } from '../dto/verify-payment.dto';

@ApiTags('Payments, Checkout & Webhooks')
@Controller(['api/v1/payments', 'api/payments', 'payments'])
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @ApiBearerAuth()
  @OptionalAuth()
  @Post(['create-order', 'orders', 'initiate'])
  @ApiOperation({ summary: 'Create a Razorpay/Stripe checkout order for SVOD Plan or TVOD Rental' })
  async createOrder(@CurrentUser() user: AuthenticatedUser, @Body() body: CreatePaymentOrderDto) {
    const effectiveUserId = user?.id || (body as any)?.userId || (body as any)?.user_id;
    if (!effectiveUserId) {
      throw new UnauthorizedException('Authentication required to create a payment order');
    }
    return this.paymentService.createOrder(effectiveUserId, body);
  }

  @ApiBearerAuth()
  @OptionalAuth()
  @Post(['verify', 'verify-payment', 'confirm'])
  @ApiOperation({ summary: 'Verify payment signature and activate subscription or TVOD rental' })
  async verifyPayment(@CurrentUser() user: AuthenticatedUser, @Body() body: VerifyPaymentDto) {
    const effectiveUserId = user?.id || (body as any)?.userId || (body as any)?.user_id;
    return this.paymentService.verifyPayment(effectiveUserId, body);
  }

  @ApiBearerAuth()
  @Get(['my-transactions', 'history'])
  @ApiOperation({ summary: 'Get authenticated user payment transaction history' })
  async getMyTransactions(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentService.getUserTransactions(user.id);
  }

  @ApiBearerAuth()
  @Get(['my-subscription', 'subscription'])
  @ApiOperation({ summary: 'Get authenticated user active subscription status' })
  async getMySubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentService.getUserActiveSubscription(user.id);
  }

  @Public()
  @Post(['webhook/razorpay', 'webhooks/razorpay'])
  @ApiOperation({ summary: 'Razorpay asynchronous webhook endpoint' })
  async razorpayWebhook(
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Body() body: any,
    @Req() req: any,
  ) {
    const rawBody = req?.rawBody ? req.rawBody.toString() : JSON.stringify(body || {});
    return this.paymentService.handleWebhook('RAZORPAY', rawBody, signature, body);
  }

  @Public()
  @Post(['webhook/stripe', 'webhooks/stripe'])
  @ApiOperation({ summary: 'Stripe asynchronous webhook endpoint' })
  async stripeWebhook(
    @Headers('stripe-signature') signature: string | undefined,
    @Body() body: any,
    @Req() req: any,
  ) {
    const rawBody = req?.rawBody ? req.rawBody.toString() : JSON.stringify(body || {});
    return this.paymentService.handleWebhook('STRIPE', rawBody, signature, body);
  }
}

@ApiTags('Admin Payments, Revenue Analytics & Refunds')
@ApiBearerAuth()
@Roles('ROLE_SUPER_ADMIN', 'ROLE_ADMIN')
@Controller([
  'api/v1/admin/payments',
  'api/admin/payments',
  'admin/payments',
])
export class AdminPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  @ApiOperation({ summary: 'List paginated payment transactions' })
  async listTransactions(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.paymentService.listAdminTransactions({ page, size, status, search });
  }

  @Get(['analytics', 'summary', 'stats'])
  @ApiOperation({ summary: 'Get SQL-aggregated revenue, refund, subscription, and TVOD metrics' })
  async getAnalyticsSummary() {
    return this.paymentService.getPaymentAnalyticsSummary();
  }

  @Get('tvod')
  @ApiOperation({ summary: 'List paginated TVOD content purchases' })
  async listTvodPurchases(
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Query('search') search?: string,
  ) {
    return this.paymentService.listAdminTvodPurchases({ page, size, search });
  }

  @Post(':id/refund')
  @ApiOperation({ summary: 'Initiate refund for a payment transaction' })
  async refundPayment(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.paymentService.refundPayment(id, body?.reason);
  }
}

