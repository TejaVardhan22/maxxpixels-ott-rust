import { CatalogItem, SubscriptionPlan, parseSubscriptionPlan } from '../types';
import { ApiClient } from './apiClient';
import { AuthService } from './authService';
import { GraphQLService } from './graphqlService';

export class PaymentService {
  public static async validateCoupon(code: string, amountInPaise: number, planId?: string | number): Promise<number> {
    const amountInRupees = amountInPaise / 100;
    const result = await ApiClient.getApi('coupons/validate', {
      queryParams: {
        code: code.trim().toUpperCase(),
        amount: amountInRupees,
        ...(planId != null ? { planId } : {}),
      },
    });
    const discount = typeof result === 'number' ? result : Number((result as any)?.discountAmount ?? result);
    if (!Number.isFinite(discount) || discount < 0) {
      throw new Error('The coupon service returned an invalid discount.');
    }
    return discount;
  }

  public static async getPlans(): Promise<SubscriptionPlan[]> {
    const result = await ApiClient.getApi('plans', { userToken: AuthService.authToken || undefined });
    if (!Array.isArray(result)) throw new Error('Unable to load subscription plans.');
    return result.map((p: any) => parseSubscriptionPlan(p));
  }

  public static async getCurrentSubscription(): Promise<{
    is_buy: number;
    isBuy: number;
    isSubscribed: boolean;
    package_id: number;
    planId: number;
    package_name: string;
    packageName: string;
    expire_date: string;
    expiryDate: string;
    subscription?: any;
  }> {
    try {
      const raw = await ApiClient.getApi('payments/my-subscription', { userToken: AuthService.authToken || undefined });
      const result = Array.isArray(raw) ? raw[0] : (raw?.data || raw?.result || raw || {});
      const isBuy = Number(result?.is_buy ?? result?.isBuy ?? (result?.isSubscribed || result?.is_subscribed ? 1 : 0)) === 1 ? 1 : 0;
      const pkgId = Number(result?.package_id ?? result?.planId ?? result?.plan_id ?? 0);
      const pkgName = String(result?.package_name ?? result?.packageName ?? result?.planName ?? result?.plan?.name ?? (isBuy === 1 ? 'VIP Membership' : 'Free'));
      const expDate = String(result?.expire_date ?? result?.expiryDate ?? result?.end_date ?? result?.endDate ?? '');
      return {
        is_buy: isBuy,
        isBuy,
        isSubscribed: isBuy === 1,
        package_id: pkgId,
        planId: pkgId,
        package_name: pkgName,
        packageName: pkgName,
        expire_date: expDate,
        expiryDate: expDate,
        subscription: result?.subscription || result,
      };
    } catch (e) {
      console.warn('getCurrentSubscription error:', e);
      return {
        is_buy: 0,
        isBuy: 0,
        isSubscribed: false,
        package_id: 0,
        planId: 0,
        package_name: 'Free',
        packageName: 'Free',
        expire_date: '',
        expiryDate: '',
      };
    }
  }

  public static async createSubscriptionOrder(params: {
    planId: string | number;
    amountInPaise: number;
    currency?: string;
    couponCode?: string;
    enableAutopay?: boolean;
  }): Promise<{ orderId: string; gatewayOrderId?: string; dbOrderId?: string; subscriptionId?: string; keyId: string; amount: number; currency: string; autopay?: boolean; isFree?: boolean; status?: string }> {
    try {
      const result = await ApiClient.postApi(
        'payments/create-order',
        {
          plan_id: Number(params.planId) || params.planId,
          planId: Number(params.planId) || params.planId,
          amount: params.amountInPaise > 0 ? (params.amountInPaise > 1000 ? Math.round(params.amountInPaise / 100) : params.amountInPaise) : undefined,
          user_id: AuthService.currentUser?.id,
          userId: AuthService.currentUser?.id,
          email: AuthService.currentUser?.email,
          mobile_number: AuthService.currentUser?.phoneNumber || (AuthService.currentUser as any)?.mobile_number,
          phone: AuthService.currentUser?.phoneNumber || (AuthService.currentUser as any)?.mobile_number,
          name: AuthService.currentUser?.fullName || (AuthService.currentUser as any)?.name,
          full_name: AuthService.currentUser?.fullName || (AuthService.currentUser as any)?.name,
          provider: 'RAZORPAY',
          gateway: 'RAZORPAY',
          coupon_code: params.couponCode,
          couponCode: params.couponCode,
          enableAutopay: Boolean(params.enableAutopay),
          enable_autopay: Boolean(params.enableAutopay),
          autopay_enabled: Boolean(params.enableAutopay),
          autopayEnabled: Boolean(params.enableAutopay),
          autopay: Boolean(params.enableAutopay),
          isAutopayEligible: Boolean(params.enableAutopay),
          is_autopay_eligible: Boolean(params.enableAutopay),
        },
        { userToken: AuthService.authToken || undefined }
      );

      const orderData = result?.data || result?.result || result;
      const order = Array.isArray(orderData) ? orderData[0] : orderData;

      if (order && (order.orderId || order.order_id || order.gateway_order_id || order.gatewayOrderId || order.id || order.providerOrderId || order.subscriptionId || order.subscription_id)) {
        const amount = Number(order.amount ?? 0);
        const isFree = amount <= 0 || order.status === 'SUCCESS' || order.provider === 'COUPON_100_PERCENT';
        const subId = order.subscriptionId || order.subscription_id || order.razorpay_subscription_id;

        const rzpOrderId =
          (order.gatewayOrderId && String(order.gatewayOrderId).startsWith('order_') ? String(order.gatewayOrderId) : null) ||
          (order.gateway_order_id && String(order.gateway_order_id).startsWith('order_') ? String(order.gateway_order_id) : null) ||
          (order.razorpayOrderId && String(order.razorpayOrderId).startsWith('order_') ? String(order.razorpayOrderId) : null) ||
          (order.razorpay_order_id && String(order.razorpay_order_id).startsWith('order_') ? String(order.razorpay_order_id) : null) ||
          (order.providerOrderId && String(order.providerOrderId).startsWith('order_') ? String(order.providerOrderId) : null) ||
          (order.order_id && String(order.order_id).startsWith('order_') ? String(order.order_id) : null) ||
          (order.orderId && String(order.orderId).startsWith('order_') ? String(order.orderId) : null) ||
          undefined;

        const dbId = order.dbOrderId || order.id || order.order_id || order.orderId || rzpOrderId;

        return {
          orderId: rzpOrderId || String(dbId),
          gatewayOrderId: rzpOrderId,
          dbOrderId: String(dbId),
          subscriptionId: subId || undefined,
          keyId: order.keyId || order.key || order.key_id || order.razorpay_key || 'free_key',
          amount: isFree ? 0 : amount,
          currency: order.currency || 'INR',
          autopay: Boolean(subId || order.autopay || order.autopay_enabled),
          isFree,
          status: order.status,
        };
      }
    } catch (e) {
      console.warn('createSubscriptionOrder notice:', e);
      throw e;
    }

    throw new Error('Unable to create a payment order.');
  }

  public static async verifyPayment(params: {
    orderId: string;
    subscriptionId?: string;
    paymentId: string;
    signature?: string;
    transactionType?: string;
  }): Promise<boolean> {
    try {
      if (!params.signature || !params.paymentId || (!params.orderId && !params.subscriptionId)) throw new Error('Payment confirmation is incomplete.');
      const result = await ApiClient.postApi(
        'payments/verify',
        {
          providerOrderId: params.orderId,
          providerPaymentId: params.paymentId,
          order_id: params.orderId,
          orderId: params.orderId,
          razorpay_order_id: params.orderId,
          subscription_id: params.subscriptionId,
          subscriptionId: params.subscriptionId,
          razorpay_subscription_id: params.subscriptionId,
          gateway_payment_id: params.paymentId,
          razorpay_payment_id: params.paymentId,
          paymentId: params.paymentId,
          gateway_signature: params.signature,
          razorpay_signature: params.signature,
          signature: params.signature,
        },
        {
          queryParams: { provider: 'RAZORPAY' },
          userToken: AuthService.authToken || undefined,
        }
      );
      const isConfirmed =
        result?.verified === true ||
        result?.data?.verified === true ||
        result?.status === 'SUCCESS' ||
        result?.data?.status === 'SUCCESS' ||
        result?.subscription_active === true ||
        result?.data?.subscription_active === true ||
        result?.rent_active === true ||
        result?.data?.rent_active === true ||
        result?.is_rented === 1 ||
        result?.data?.is_rented === 1 ||
        result?.data?.success === true ||
        result?.success === true ||
        result?.result?.[0]?.subscription_active === true ||
        result?.result?.[0]?.rent_active === true;
      if (!isConfirmed) throw new Error('Payment confirmation could not be verified.');
      return true;
    } catch (e) {
      throw new Error('Payment could not be verified. Please try again.');
    }
  }

  public static async createRentOrder(item: CatalogItem): Promise<{
    orderId: string;
    gatewayOrderId?: string;
    keyId: string;
    amount: number;
    currency: string;
    isFree?: boolean;
    status?: string;
  }> {
    const user = AuthService.currentUser;
    const token = AuthService.authToken || undefined;
    const isTvod = item.isRent === 1 || (item as any).is_rent === 1 || String(item.monetization || (item as any).monetization || '').toUpperCase() === 'TVOD';
    const price = isTvod ? (item.rentPrice ?? (item as any).price ?? 99) : 99;
    const rentDays = item.rentDay ?? ((item as any).validity_hours ? Math.ceil(Number((item as any).validity_hours) / 24) : 2);
    const validityHours = rentDays * 24;

    const result = await ApiClient.postApi(
      'payments/create-order',
      {
        transaction_type: 'rent',
        type: 'rent',
        content_id: item.id,
        contentId: item.id,
        video_id: item.id,
        price: price,
        validity_hours: validityHours,
        user_id: user?.id,
        userId: user?.id,
        email: user?.email,
        mobile_number: user?.phoneNumber || (user as any)?.mobile_number,
        phone: user?.phoneNumber || (user as any)?.mobile_number,
        name: user?.fullName || (user as any)?.name,
        full_name: user?.fullName || (user as any)?.name,
        provider: 'RAZORPAY',
        gateway: 'RAZORPAY',
      },
      { userToken: token }
    );

    const orderData = result?.data || result?.result || result;
    const order = Array.isArray(orderData) ? orderData[0] : orderData;

    if (order && (order.orderId || order.order_id || order.gateway_order_id || order.gatewayOrderId || order.id || order.providerOrderId)) {
      const amount = Number(order.amount ?? price);
      const isFree = amount <= 0 || order.status === 'SUCCESS' || order.provider === 'COUPON_100_PERCENT';
      const rzpOrderId =
        (order.gatewayOrderId && String(order.gatewayOrderId).startsWith('order_') ? String(order.gatewayOrderId) : null) ||
        (order.gateway_order_id && String(order.gateway_order_id).startsWith('order_') ? String(order.gateway_order_id) : null) ||
        (order.razorpayOrderId && String(order.razorpayOrderId).startsWith('order_') ? String(order.razorpayOrderId) : null) ||
        (order.razorpay_order_id && String(order.razorpay_order_id).startsWith('order_') ? String(order.razorpay_order_id) : null) ||
        (order.providerOrderId && String(order.providerOrderId).startsWith('order_') ? String(order.providerOrderId) : null) ||
        (order.order_id && String(order.order_id).startsWith('order_') ? String(order.order_id) : null) ||
        (order.orderId && String(order.orderId).startsWith('order_') ? String(order.orderId) : null) ||
        undefined;
      const dbId = order.dbOrderId || order.id || order.order_id || order.orderId || rzpOrderId;
      return {
        orderId: rzpOrderId || String(dbId),
        gatewayOrderId: rzpOrderId,
        keyId: order.keyId || order.key || order.key_id || order.razorpay_key || 'free_key',
        amount: isFree ? 0 : amount,
        currency: order.currency || 'INR',
        isFree,
        status: order.status,
      };
    }

    throw new Error('Unable to create a rental payment order.');
  }

  public static async addRentTransaction(item: CatalogItem, transactionId?: string): Promise<number> {
    const token = AuthService.authToken || undefined;
    const price = item.rentPrice || (item as any).price || 99;
    const rentDays = item.rentDay ?? ((item as any).validity_hours ? Math.ceil(Number((item as any).validity_hours) / 24) : 2);
    const validityHours = rentDays * 24;

    try {
      const result = await ApiClient.postApi(
        'tvod/purchase',
        {
          contentId: item.id,
          price,
          validityHours,
          transactionId: transactionId || ('MOB-' + Date.now()),
        },
        {
          queryParams: {
            contentId: item.id,
          },
          userToken: token,
        }
      );
      if (result) return 1;
    } catch (e) {
      console.warn('tvod/purchase notice:', e);
    }

    return 1;
  }
}
