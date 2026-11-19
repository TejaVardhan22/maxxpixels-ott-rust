import { IsOptional, IsString } from 'class-validator';

export class CreatePaymentOrderDto {
  @IsOptional()
  planId?: number | string;

  @IsOptional()
  contentId?: number | string;

  @IsOptional()
  amount?: number | string;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  gateway?: string;

  // Aliases supported for mobile & web payloads
  @IsOptional()
  plan_id?: number | string;

  @IsOptional()
  package_id?: number | string;

  @IsOptional()
  packageId?: number | string;

  @IsOptional()
  video_id?: number | string;

  @IsOptional()
  content_id?: number | string;

  @IsOptional()
  coupon_code?: string;

  @IsOptional()
  user_id?: any;

  @IsOptional()
  userId?: any;

  @IsOptional()
  email?: string;

  @IsOptional()
  mobile_number?: string;

  @IsOptional()
  phone?: string;

  @IsOptional()
  name?: string;

  @IsOptional()
  full_name?: string;

  @IsOptional()
  enableAutopay?: any;

  @IsOptional()
  enable_autopay?: any;

  @IsOptional()
  autopay_enabled?: any;

  @IsOptional()
  autopayEnabled?: any;

  @IsOptional()
  autopay?: any;

  @IsOptional()
  isAutopayEligible?: any;

  @IsOptional()
  is_autopay_eligible?: any;

  @IsOptional()
  transaction_type?: string;

  @IsOptional()
  type?: string;

  @IsOptional()
  price?: number | string;

  @IsOptional()
  validity_hours?: number | string;
}

