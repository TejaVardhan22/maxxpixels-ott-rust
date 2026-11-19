import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentOrder } from './entities/payment-order.entity';
import { Payment } from './entities/payment.entity';
import { Plan } from '../subscriptions/entities/plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { TvodProduct } from '../subscriptions/entities/tvod-product.entity';
import { ContentPurchase } from '../subscriptions/entities/content-purchase.entity';
import { Content } from '../content/entities/content.entity';
import { PaymentService } from './services/payment.service';
import { PaymentController, AdminPaymentController } from './controllers/payment.controller';
import { RazorpayGateway } from './gateways/razorpay.gateway';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentOrder,
      Payment,
      Plan,
      Subscription,
      TvodProduct,
      ContentPurchase,
      Content,
    ]),
  ],
  controllers: [PaymentController, AdminPaymentController],
  providers: [PaymentService, RazorpayGateway, PaymentGatewayFactory],
  exports: [PaymentService, PaymentGatewayFactory],
})
export class PaymentsModule {}

