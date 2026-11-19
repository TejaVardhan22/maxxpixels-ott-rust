/**
 * Payment Gateway Contract (SOLID: Interface Segregation & Dependency Inversion)
 * Enables multi-provider scalability (Razorpay, Stripe, PhonePe, Cashfree, In-App Purchases)
 * without modifying the core payment fulfillment logic.
 */

export interface CreateGatewayOrderParams {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
  isAutopay?: boolean;
  planId?: string;
  razorpayPlanId?: string;
  billingPeriod?: string;
  planName?: string;
}

export interface GatewayOrderResult {
  orderId: string;
  subscriptionId?: string;
  isLive: boolean;
  rawResponse?: any;
}

export interface VerifyGatewayPaymentParams {
  paymentId: string;
  orderId: string;
  signature: string;
  subscriptionId?: string;
}

export interface IPaymentGateway {
  readonly providerCode: string;
  createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResult>;
  verifyPayment(params: VerifyGatewayPaymentParams): Promise<boolean>;
}
