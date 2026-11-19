import { IsOptional, IsString } from 'class-validator';

export class VerifyPaymentDto {
  @IsOptional()
  @IsString()
  providerOrderId?: string;

  @IsOptional()
  @IsString()
  providerPaymentId?: string;

  @IsOptional()
  @IsString()
  signature?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  // Razorpay and mobile aliases
  @IsOptional()
  @IsString()
  order_id?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  razorpay_order_id?: string;

  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsOptional()
  @IsString()
  payment_id?: string;

  @IsOptional()
  @IsString()
  gateway_payment_id?: string;

  @IsOptional()
  @IsString()
  razorpay_payment_id?: string;

  @IsOptional()
  @IsString()
  gateway_signature?: string;

  @IsOptional()
  @IsString()
  razorpay_signature?: string;

  @IsOptional()
  @IsString()
  subscription_id?: string;

  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @IsOptional()
  @IsString()
  razorpay_subscription_id?: string;

  @IsOptional()
  planId?: any;

  @IsOptional()
  plan_id?: any;

  @IsOptional()
  package_id?: any;

  @IsOptional()
  packageId?: any;

  @IsOptional()
  contentId?: any;

  @IsOptional()
  content_id?: any;

  @IsOptional()
  video_id?: any;

  @IsOptional()
  transactionType?: string;

  @IsOptional()
  transaction_type?: string;

  @IsOptional()
  paymentMethod?: string;

  @IsOptional()
  payment_method?: string;
}

