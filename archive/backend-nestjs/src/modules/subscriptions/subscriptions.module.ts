import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { Subscription } from './entities/subscription.entity';
import { Coupon } from './entities/coupon.entity';
import { TvodProduct } from './entities/tvod-product.entity';
import { ContentPurchase } from './entities/content-purchase.entity';
import { PlanService } from './services/plan.service';
import {
  PlanController,
  PublicCouponController,
  AdminPlanController,
  AdminCouponController,
} from './controllers/plan.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Plan, Subscription, Coupon, TvodProduct, ContentPurchase]),
  ],
  controllers: [
    PlanController,
    PublicCouponController,
    AdminPlanController,
    AdminCouponController,
  ],
  providers: [PlanService],
  exports: [PlanService, TypeOrmModule],
})
export class SubscriptionsModule {}
