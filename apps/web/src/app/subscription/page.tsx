'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import {
  usePackages, useCreateRazorpayOrder,
  useVerifyRazorpayPayment, useApplyCoupon, useValidateCouponV1, authApi,
  EVENTS,
} from '@ott/shared';
import type { SubscriptionPackage, Coupon, LoginUserResult } from '@ott/shared';
import SubscriptionCard from '@/components/payment/SubscriptionCard';
import { useStoredUser, setStoredUser } from '@/lib/auth';
import { Tag, X, Shield, CheckCircle } from 'lucide-react';
import { trackEvent, trackFbEvent } from '@/lib/analytics';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" aria-busy="true" />}>
      <SubscriptionContent />
    </Suspense>
  );
}

function SubscriptionContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user }     = useStoredUser();
  const [wtLoading, setWtLoading]   = useState(false);
  const wtAttempted  = useRef(false);

  // Track page view on mount
  useEffect(() => {
    trackEvent(EVENTS.SUBSCRIPTION_VIEW);
    trackFbEvent('ViewContent', { content_name: 'subscription_plans', content_type: 'product' });
  }, []);

  // Mobile → Web bridge
  useEffect(() => {
    if (wtAttempted.current || user?.id) return;
    const wt = searchParams.get('wt');
    if (!wt) return;
    wtAttempted.current = true;
    setWtLoading(true);
    authApi.consumeWebToken(wt)
      .then((res) => {
        const profile = Array.isArray(res.result) ? res.result[0] : res.result;
        if (profile && (profile as LoginUserResult).id) {
          setStoredUser(profile as LoginUserResult);
        }
        // Remove the one-time token from the browser URL / history
        window.history.replaceState({}, '', window.location.pathname);
      })
      .catch(() => {})
      .finally(() => setWtLoading(false));
  }, [searchParams, user?.id]);

  const userId = user?.id;

  const [error,        setError]      = useState('');
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [processingId, setProcessing] = useState<number | null>(null);
  const [couponCode,   setCouponCode] = useState('');
  const [appliedCoupon,setApplied]    = useState<Coupon | null>(null);
  const [couponError,  setCouponError]= useState('');

  const createOrder      = useCreateRazorpayOrder();

  const verifyPayment    = useVerifyRazorpayPayment();
  const applyCouponMut   = useApplyCoupon();
  const validateCouponV1 = useValidateCouponV1();
  const packagesQ        = usePackages(userId);
  const packages         = (packagesQ.data?.result ?? []) as SubscriptionPackage[];

  // State for V1 discount (backend Express)
  const [discountAmountV1, setDiscountAmountV1] = useState<number | null>(null);
  const [validatedPlanId, setValidatedPlanId] = useState<number | null>(null);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError('');
    try {
      const selectedPkg = packages.find(p => String(p.id) === searchParams.get('package_id')) ?? packages[0];
      if (!selectedPkg) throw new Error('Select a subscription plan before applying a coupon.');
      const basePrice = Number(selectedPkg.price ?? 0);

      // Primary: try new Express backend /api/v1/coupons/validate
      try {
        const v1Res = await validateCouponV1.mutateAsync({ code: couponCode.trim(), amount: basePrice });
        setDiscountAmountV1(v1Res.data);
        setValidatedPlanId(Number(selectedPkg.id));
        setApplied({ code: couponCode.trim().toUpperCase(), discount_amount: v1Res.data } as Coupon);
        setCouponCode('');
        return;
      } catch {
        // Fall through to legacy API
        setDiscountAmountV1(null);
        setValidatedPlanId(null);
      }

      // Fallback: legacy apply_coupon endpoint
      const selectedPackageId = Number(searchParams.get('package_id') || packages[0]?.id || 0);
      if (!selectedPackageId) throw new Error('Select a subscription plan before applying a coupon.');
      const res = await applyCouponMut.mutateAsync({
        unique_id: couponCode.trim(),
        user_id: userId,
        package_id: selectedPackageId,
        apply_coupon_type: 1,
      });
      if (res.status === 200 && res.result) {
        const coupon = Array.isArray(res.result) ? res.result[0] : res.result;
        setApplied(coupon as Coupon);
        setCouponCode('');
      } else {
        setCouponError(res.message || 'Invalid coupon code.');
      }
    } catch (err: unknown) {
      setCouponError(err instanceof Error ? err.message : 'Failed to apply coupon.');
    }
  };

  const effectivePrice = (base: number) => {
    if (!appliedCoupon) return base;
    // V1 backend: discount_amount is the absolute discount in INR
    if (discountAmountV1 !== null) return Math.max(0, base - discountAmountV1);
    if (appliedCoupon.discount_amount !== undefined)
      return Math.max(0, base - Number(appliedCoupon.discount_amount));
    if (appliedCoupon.discount_type === 1)
      return Math.max(0, base - Number(appliedCoupon.discount ?? 0));
    return Math.max(0, base - (base * Number(appliedCoupon.discount ?? 0)) / 100);
  };

function loadRazorpay(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as any).Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      if ((window as any).Razorpay) return resolve(true);
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

  const handleSubscribe = async (pkg: SubscriptionPackage) => {
    if (!userId) { router.push(`/login?redirect=/subscription&package_id=${pkg.id}`); return; }
    setError('');
    setProcessing(pkg.id ?? null);
    try {
      let price = effectivePrice(Number(pkg.price ?? 0));
      let couponForTransaction = appliedCoupon;
      if (discountAmountV1 !== null && validatedPlanId !== Number(pkg.id) && appliedCoupon?.code) {
        const validation = await validateCouponV1.mutateAsync({
          code: appliedCoupon.code,
          amount: Number(pkg.price ?? 0),
        });
        price = Math.max(0, Number(pkg.price ?? 0) - validation.data);
      }
      if (appliedCoupon?.unique_id) {
        const couponRes = await applyCouponMut.mutateAsync({
          unique_id: appliedCoupon.unique_id,
          user_id: userId,
          package_id: pkg.id,
          apply_coupon_type: 1,
        });
        couponForTransaction = (Array.isArray(couponRes.result)
          ? couponRes.result[0]
          : couponRes.result) as Coupon;
        const discVal = Number(couponForTransaction.discount_amount ?? couponForTransaction.discount ?? 0);
        price = Math.max(0, Number(pkg.price ?? 0) - discVal);
      }

      const orderRes = await createOrder.mutateAsync({
        user_id: userId,
        email: user?.email,
        mobile_number: user?.mobile_number,
        phone: user?.mobile_number,
        name: user?.full_name,
        full_name: user?.full_name,
        plan_id: pkg.id,
        package_id: pkg.id,
        amount: price,
        transaction_type: 'subscription',
        coupon_code: couponForTransaction?.code || couponForTransaction?.unique_id || '',
      });
      const orderPayload: any = (orderRes as any)?.data ?? (orderRes as any)?.result ?? orderRes;
      const order = Array.isArray(orderPayload) ? orderPayload[0] : orderPayload;

      const rzpOrderId =
        (order?.gatewayOrderId && String(order.gatewayOrderId).startsWith('order_') ? String(order.gatewayOrderId) : null) ||
        (order?.gateway_order_id && String(order.gateway_order_id).startsWith('order_') ? String(order.gateway_order_id) : null) ||
        (order?.razorpayOrderId && String(order.razorpayOrderId).startsWith('order_') ? String(order.razorpayOrderId) : null) ||
        (order?.razorpay_order_id && String(order.razorpay_order_id).startsWith('order_') ? String(order.razorpay_order_id) : null) ||
        (order?.providerOrderId && String(order.providerOrderId).startsWith('order_') ? String(order.providerOrderId) : null) ||
        (order?.order_id && String(order.order_id).startsWith('order_') ? String(order.order_id) : null) ||
        (order?.orderId && String(order.orderId).startsWith('order_') ? String(order.orderId) : null) ||
        undefined;

      const orderId = rzpOrderId || order?.id || order?.order_id || order?.orderId;
      const keyId = order?.key_id || order?.keyId || order?.key || order?.razorpay_key;
      const orderAmountINR = order?.amount !== undefined ? (Number(order.amount) > 1000 ? Number(order.amount) / 100 : Number(order.amount)) : price;
      const amountInPaise = Math.round(orderAmountINR * 100);

      // If order is 100% free / discounted or already marked SUCCESS by backend
      if (price <= 0 || orderAmountINR <= 0 || order?.status === 'SUCCESS' || order?.provider === 'COUPON_100_PERCENT') {
        try {
          await verifyPayment.mutateAsync({
            user_id: userId,
            order_id: orderId || `free_${Date.now()}`,
            razorpay_order_id: orderId || `free_${Date.now()}`,
            subscription_id: '',
            razorpay_payment_id: `pay_free_${Date.now()}`,
            razorpay_signature: 'free_coupon_100',
          });
        } catch {}

        if (user) {
          setStoredUser({
            ...user,
            is_buy: 1,
            package_name: pkg.name || 'VIP Membership',
          });
        }

        trackEvent(EVENTS.SUBSCRIPTION_PURCHASE, {
          package_id: pkg.id ?? null,
          package_name: String(pkg.name ?? ''),
          value: 0,
          currency: 'INR',
        });
        trackFbEvent('Purchase', { value: 0, currency: 'INR', content_name: String(pkg.name ?? '') });

        router.push('/paymentsuccess');
        return;
      }

      const isReady = await loadRazorpay();
      if (!isReady || !window.Razorpay) {
        throw new Error('Unable to initialize secure Razorpay gateway. Please disable ad-blockers and try again.');
      }

      if (!orderId || !keyId) {
        throw new Error('The payment gateway returned an invalid order. Please try again.');
      }
      const isAutopay = Boolean(order?.subscriptionId || order?.subscription_id);
      const subId = order?.subscriptionId || order?.subscription_id;
      const validityText = order?.validity_text || order?.validityText || (pkg.duration ? `${pkg.duration} ${pkg.duration_type ?? 'days'}` : (pkg.time ? `${pkg.time} ${pkg.type ?? 'days'}` : '1 Month'));

      await new Promise<void>((resolve, reject) => {
        const rzpOptions: any = {
          key: keyId,
          currency: order?.currency ?? 'INR',
          name: 'MaxxPixels Subscription',
          description: isAutopay ? `${String(pkg.name ?? 'VIP Membership')} • Auto-renews every ${validityText}` : `${String(pkg.name ?? 'VIP Membership')} • ${validityText} access`,
          prefill: {
            name: user?.full_name ?? user?.user_name ?? user?.mobile_number ?? 'Subscriber',
            contact: user?.mobile_number ?? '',
            email: user?.email ?? '',
          },
          notes: {
            user_id: String(userId),
            user_name: user?.full_name ?? user?.user_name ?? 'Subscriber',
            mobile_number: user?.mobile_number ?? '',
            email: user?.email ?? '',
            plan_id: String(pkg.id ?? ''),
            plan_name: String(pkg.name ?? ''),
            billing_period: String(order?.billing_period || order?.billingPeriod || pkg.billing_period || pkg.billingPeriod || ''),
            validity_text: String(validityText),
            autopay_enabled: String(isAutopay),
            recurring: String(isAutopay ? 1 : 0),
          },
          theme: {
            color: '#e50914',
          },
          ...(isAutopay
            ? {
                subscription_id: subId,
                recurring: 1,
              }
            : {
                amount: amountInPaise,
                ...(rzpOrderId ? { order_id: rzpOrderId } : {}),
              }),
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id?: string;
            razorpay_subscription_id?: string;
            razorpay_signature?: string;
          }) => {
            try {
              const activeSubId = response.razorpay_subscription_id || subId;
              const verification = await verifyPayment.mutateAsync({
                user_id: userId,
                order_id: response.razorpay_order_id || activeSubId || orderId,
                razorpay_order_id: response.razorpay_order_id || activeSubId || orderId,
                subscription_id: activeSubId,
                razorpay_subscription_id: activeSubId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature || '',
              });
              if (verification.status !== 200) throw new Error(verification.message || 'Payment verification failed');
              if (user) {
                setStoredUser({
                  ...user,
                  is_buy: 1,
                  package_name: pkg.name || 'VIP Membership',
                });
              }
              // Fire analytics purchase events before redirecting
              trackEvent(EVENTS.SUBSCRIPTION_PURCHASE, {
                package_id: pkg.id ?? null,
                package_name: String(pkg.name ?? ''),
                value: price,
                currency: 'INR',
              });
              trackFbEvent('Purchase', { value: price, currency: 'INR', content_name: String(pkg.name ?? '') });
              resolve();
              router.push('/paymentsuccess');
            } catch (err) { reject(err); }
          },
          modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
        };

        const rzp = new (window as any).Razorpay(rzpOptions);
        if (typeof rzp.on === 'function') {
          rzp.on('payment.failed', function (resp: any) {
            const msg = resp?.error?.description || resp?.error?.reason || 'Payment failed. Please check your bank or card details.';
            reject(new Error(msg));
          });
        }
        rzp.open();
      });
    } catch (err) {
      if (err instanceof Error && err.message !== 'Payment cancelled')
        setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  if (wtLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white font-semibold">Setting up your session…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setRazorpayReady(true)}
        onError={() => {
          setRazorpayReady(false);
          setError('Unable to load Razorpay checkout. Disable content blocking and try again.');
        }}
      />

      <div className="min-h-screen pt-24 pb-20">
        {/* Hero header */}
        <div className="text-center mb-10 px-4">
          <span className="inline-block text-xs font-bold tracking-widest uppercase text-primary border border-primary/30 px-3 py-1 rounded-full mb-4">
            Subscription Plans
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
            Choose Your Plan
          </h1>
          <p className="text-muted-text text-base max-w-lg mx-auto">
            Unlock unlimited entertainment. Cancel anytime.
          </p>
        </div>

        {/* Guest prompt if not signed in */}
        {!userId && (
          <div className="max-w-md mx-auto mb-8 bg-surface/90 border border-primary/30 rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <Shield size={20} className="text-primary flex-shrink-0" />
              <div className="text-left">
                <p className="text-xs font-bold text-white">Already have an account?</p>
                <p className="text-[11px] text-muted-text">Sign in to activate or renew your subscription</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/login?redirect=/subscription')}
              className="btn-primary text-xs font-bold px-4 py-2 rounded-lg shrink-0 ml-3"
            >
              Sign In
            </button>
          </div>
        )}

        <div className="page-section">
          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-6 mb-10">
            {[
              { icon: <CheckCircle size={14} className="text-primary" />, text: 'HD & 4K Streaming' },
              { icon: <CheckCircle size={14} className="text-primary" />, text: 'Cancel Anytime' },
              { icon: <CheckCircle size={14} className="text-primary" />, text: 'Multi-Device' },
              { icon: <CheckCircle size={14} className="text-primary" />, text: 'Offline Downloads' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2 text-sm text-body-text">
                {item.icon} {item.text}
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/8 px-5 py-4 text-sm text-accent max-w-2xl mx-auto">
              <X size={16} className="flex-shrink-0 mt-0.5" strokeWidth={2.5} />
              {error}
            </div>
          )}

          {/* Coupon section */}
          <div className="max-w-sm mx-auto mb-10">
            <div className="bg-surface border border-ott-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Tag size={14} className="text-primary" strokeWidth={2} />
                <p className="text-sm font-semibold text-white">Have a coupon?</p>
              </div>
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-xl px-4 py-2.5">
                  <div>
                    <span className="text-xs font-bold text-primary">{appliedCoupon.unique_id ?? appliedCoupon.code}</span>
                    <span className="text-xs text-desc-text ml-2">
                      — ₹{Number(appliedCoupon.discount_amount ?? 0).toFixed(2)} off
                    </span>
                  </div>
                  <button onClick={() => { setApplied(null); setDiscountAmountV1(null); setValidatedPlanId(null); }} className="text-muted-text hover:text-accent transition-colors">
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                    placeholder="COUPON CODE"
                    className="ott-input text-sm tracking-widest uppercase flex-1 min-w-0"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={applyCouponMut.isPending || validateCouponV1.isPending || !couponCode.trim()}
                    className="btn-primary px-4 py-2.5 rounded-lg text-sm disabled:opacity-40"
                  >
                    {(applyCouponMut.isPending || validateCouponV1.isPending) ? '…' : 'Apply'}
                  </button>
                </div>
              )}
              {couponError && (
                <p className="text-accent text-xs mt-2">{couponError}</p>
              )}
            </div>
          </div>

          {/* Plans grid */}
          {packagesQ.isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface rounded-2xl p-6 animate-pulse h-64">
                  <div className="h-5 bg-shimmer rounded w-1/2 mb-4" />
                  <div className="h-10 bg-shimmer rounded w-1/3 mb-2" />
                  <div className="h-3 bg-shimmer rounded w-1/4 mb-8" />
                  <div className="space-y-2">
                    {[1,2,3].map(j => <div key={j} className="h-3 bg-shimmer rounded" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : packagesQ.isError ? (
            <div className="text-center py-12">
              <p className="text-accent">Unable to load subscription plans.</p>
              <button onClick={() => packagesQ.refetch()} className="btn-primary mt-4 px-6 py-3">Try again</button>
            </div>
          ) : packages.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
              {packages.map((pkg, i) => (
                <SubscriptionCard
                  key={pkg.id ?? i}
                  pkg={pkg}
                  onSubscribe={handleSubscribe}
                  loading={processingId === pkg.id}
                  checkoutReady={razorpayReady && processingId === null}
                  discountedPrice={appliedCoupon && (discountAmountV1 === null || validatedPlanId === Number(pkg.id))
                    ? effectivePrice(pkg.price as number)
                    : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-5xl mb-4">📋</p>
              <p className="text-xl font-bold text-white mb-2">No plans available</p>
              <p className="text-muted-text">Please check back later</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
