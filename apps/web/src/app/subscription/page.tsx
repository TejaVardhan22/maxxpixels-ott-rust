'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import {
  usePackages, useCreateRazorpayOrder,
  useVerifyRazorpayPayment, useApplyCoupon, useValidateCouponV1, authApi,
  EVENTS,
} from '@ott/shared';
import type { SubscriptionPackage, Coupon, LoginUserResult } from '@ott/shared';
import SubscriptionCard from '@/components/payment/SubscriptionCard';
import { PageShell } from '@/components/layout/PageChrome';
import { useStoredUser, setStoredUser } from '@/lib/auth';
import { useBranding } from '@/hooks/useBranding';
import { ArrowLeft, Tag, X, Shield, Crown, Check, Loader2, LogOut } from 'lucide-react';
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
  const { user, logout } = useStoredUser();
  const brand        = useBranding();
  const [logoError, setLogoError] = useState(false);
  const [wtLoading, setWtLoading]   = useState(false);
  const wtAttempted  = useRef(false);
  const isVip        = Number(user?.is_buy ?? 0) === 1;

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
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  useEffect(() => {
    if (!packages.length || selectedPlanId !== null) return;
    const fromQuery = searchParams.get('package_id');
    const queryMatch = fromQuery ? packages.find((p) => String(p.id) === fromQuery) : undefined;
    const featured = packages.find((p) =>
      /platinum|premium|annual/i.test(String(p.name ?? '')) && p.is_active_plan !== 1,
    );
    const firstNonActive = packages.find((p) => p.is_active_plan !== 1);
    const initial = queryMatch || featured || firstNonActive || packages[0];
    if (initial?.id != null) setSelectedPlanId(Number(initial.id));
  }, [packages, selectedPlanId, searchParams]);

  const selectedPkg =
    packages.find((p) => Number(p.id) === selectedPlanId) ?? packages[0] ?? null;

  const handleApplyCoupon = async () => {
    const cleanCode = couponCode.trim().toUpperCase();
    if (!cleanCode) return;
    setCouponError('');
    try {
      const targetPkg = selectedPkg ?? packages[0];
      if (!targetPkg) throw new Error('Select a subscription plan before applying a coupon.');
      const basePrice = Number(targetPkg.price ?? 0);

      // Primary: Rust API GET /api/v1/coupons/validate (supports planId + amount)
      try {
        const v1Res = await validateCouponV1.mutateAsync({
          code: cleanCode,
          amount: basePrice,
          planId: targetPkg.id,
        });
        setDiscountAmountV1(v1Res.data);
        setValidatedPlanId(Number(targetPkg.id));
        setApplied({ code: cleanCode, discount_amount: v1Res.data } as Coupon);
        setCouponCode('');
        return;
      } catch (v1Err) {
        // Fallback: POST /api/v1/plans/validate-coupon
        setDiscountAmountV1(null);
        setValidatedPlanId(null);
        try {
          const res = await applyCouponMut.mutateAsync({
            code: cleanCode,
            unique_id: cleanCode,
            user_id: userId,
            planId: targetPkg.id,
            plan_id: targetPkg.id,
            package_id: targetPkg.id,
            amount: basePrice,
            apply_coupon_type: 1,
          });
          const rawCoupon: any = (res as any)?.data ?? (Array.isArray(res.result) ? res.result[0] : res.result);
          const disc = Number(rawCoupon?.discountAmount ?? rawCoupon?.discount_amount ?? NaN);
          if (Number.isFinite(disc)) {
            setDiscountAmountV1(disc);
            setValidatedPlanId(Number(targetPkg.id));
            setApplied({ code: cleanCode, discount_amount: disc } as Coupon);
            setCouponCode('');
            return;
          }
          throw new Error(res.message || (v1Err instanceof Error ? v1Err.message : 'Invalid coupon code.'));
        } catch (fallbackErr) {
          throw fallbackErr instanceof Error ? fallbackErr : v1Err;
        }
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
          planId: pkg.id,
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
            color: '#FF6D2E',
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
      <PageShell className="grid min-h-[calc(100vh-5rem)] place-items-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-11 w-11 animate-spin rounded-full border-2 border-[#FF6D2E]/30 border-t-[#FF6D2E]" />
          <p className="text-sm font-semibold text-white">Setting up your session…</p>
        </div>
      </PageShell>
    );
  }

  const gridColsClass =
    packages.length >= 4
      ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 max-w-[1360px]'
      : packages.length === 2
      ? 'grid-cols-1 md:grid-cols-2 max-w-3xl'
      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-5xl';

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

      <div className="min-h-screen bg-[#0A0A0A] text-white">
        {/* Minimal Netflix-Style Subscription Header (No Full Navbar or Footer) */}
        <header className="border-b border-white/[0.08] bg-[#0A0A0A]/95 backdrop-blur-xl">
          <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
            {isVip ? (
              <Link href="/" className="inline-flex items-center focus:outline-none">
                {brand.logoUrl && !logoError ? (
                  <img
                    src={brand.logoUrl}
                    alt={brand.name}
                    onError={() => setLogoError(true)}
                    className="h-9 max-w-[170px] object-contain sm:h-11 sm:max-w-[200px]"
                  />
                ) : (
                  <span className="text-xl font-black tracking-tight text-white sm:text-2xl">
                    {brand.name}
                  </span>
                )}
              </Link>
            ) : (
              <div className="inline-flex items-center select-none">
                {brand.logoUrl && !logoError ? (
                  <img
                    src={brand.logoUrl}
                    alt={brand.name}
                    onError={() => setLogoError(true)}
                    className="h-9 max-w-[170px] object-contain sm:h-11 sm:max-w-[200px]"
                  />
                ) : (
                  <span className="text-xl font-black tracking-tight text-white sm:text-2xl">
                    {brand.name}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              {isVip && (
                <Link
                  href="/"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 text-xs font-semibold text-white transition hover:bg-white/15"
                >
                  <ArrowLeft size={14} />
                  <span>Back to Home</span>
                </Link>
              )}

              {userId ? (
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    router.replace('/login');
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 text-xs font-bold text-white/90 transition hover:border-white/35 hover:bg-white/15 hover:text-white"
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              ) : (
                <Link
                  href="/login?redirect=/subscription"
                  className="inline-flex h-9 items-center rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-4 text-xs font-bold text-white transition hover:brightness-110"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </header>

        <PageShell className="pb-20 pt-8 sm:pt-12">
        <div className="mx-auto max-w-[1200px]">
          {/* Netflix-Style Left-Aligned Plan Picker Header */}
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#FF8A54]">
              Choose your plan
            </p>
            <h1 className="mt-1.5 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Choose the plan that&apos;s right for you
            </h1>
            <ul className="mt-4 space-y-1.5 text-sm text-zinc-300">
              {[
                'Watch all you want — movies, series, short films & originals.',
                'Stream across Smart TV, Web, and Mobile devices.',
                'Change or cancel your plan anytime.',
              ].map((line) => (
                <li key={line} className="flex items-center gap-2.5">
                  <Check size={16} className="shrink-0 text-[#FF6D2E]" strokeWidth={2.5} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Guest prompt if not signed in */}
          {!userId && (
            <div className="mb-6 flex max-w-md items-center justify-between gap-3 rounded-xl border border-white/[0.1] bg-[#141414] px-5 py-3.5">
              <div className="flex items-center gap-3">
                <Shield size={18} className="shrink-0 text-[#FF6D2E]" />
                <div className="text-left">
                  <p className="text-xs font-bold text-white">Already a member?</p>
                  <p className="text-[11px] text-zinc-400">Sign in to activate or renew your plan</p>
                </div>
              </div>
              <button
                onClick={() => router.push('/login?redirect=/subscription')}
                className="shrink-0 rounded-md bg-white px-4 py-1.5 text-xs font-bold text-zinc-950 transition hover:bg-zinc-200"
              >
                Sign In
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 flex max-w-2xl items-start gap-3 rounded-lg border border-[#FF6D2E]/40 bg-[#FF6D2E]/12 px-4 py-3 text-sm text-[#FFB088]">
              <X size={16} className="mt-0.5 shrink-0" strokeWidth={2.5} />
              <span>{error}</span>
            </div>
          )}

          {/* Plans Grid */}
          {packagesQ.isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[460px] animate-pulse rounded-2xl border border-white/[0.08] bg-[#141414] p-4">
                  <div className="mb-5 h-24 rounded-xl bg-white/[0.07]" />
                  <div className="space-y-4 px-2">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <div key={j} className="h-8 rounded bg-white/[0.06]" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : packagesQ.isError ? (
            <div className="py-12 text-center">
              <p className="text-sm text-red-400">Unable to load subscription plans.</p>
              <button
                onClick={() => packagesQ.refetch()}
                className="mt-4 rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-6 py-2.5 text-xs font-bold text-white"
              >
                Try again
              </button>
            </div>
          ) : packages.length > 0 ? (
            <>
              <div className={`grid gap-4 ${gridColsClass}`}>
                {packages.map((pkg, i) => (
                  <SubscriptionCard
                    key={pkg.id ?? i}
                    pkg={pkg}
                    selected={Number(pkg.id) === selectedPlanId}
                    onSelect={(p) => setSelectedPlanId(Number(p.id))}
                    onSubscribe={handleSubscribe}
                    loading={processingId === pkg.id}
                    checkoutReady={razorpayReady && processingId === null}
                    discountedPrice={
                      appliedCoupon && (discountAmountV1 === null || validatedPlanId === Number(pkg.id))
                        ? effectivePrice(pkg.price as number)
                        : undefined
                    }
                  />
                ))}
              </div>

              {/* Compact Coupon Bar + Centered Netflix-Style Next/Subscribe CTA */}
              <div className="mx-auto mt-10 max-w-md space-y-5">
                <div className="rounded-xl border border-white/[0.1] bg-[#141414] p-3">
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between rounded-lg border border-[#FF6D2E]/35 bg-[#FF6D2E]/10 px-3.5 py-2">
                      <div className="flex items-center gap-2">
                        <Tag size={14} className="text-[#FF8A54]" />
                        <span className="text-xs font-bold text-[#FF8A54]">
                          {appliedCoupon.unique_id ?? appliedCoupon.code}
                        </span>
                        <span className="text-xs text-zinc-300">
                          — ₹{Number(appliedCoupon.discount_amount ?? 0).toFixed(2)} off
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setApplied(null);
                          setDiscountAmountV1(null);
                          setValidatedPlanId(null);
                        }}
                        className="text-zinc-400 transition hover:text-white"
                        aria-label="Remove coupon"
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Tag
                          size={14}
                          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#FF8A54]"
                        />
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => {
                            setCouponCode(e.target.value.toUpperCase());
                            setCouponError('');
                          }}
                          placeholder="Have a coupon code?"
                          className="h-10 w-full rounded-md border border-white/15 bg-[#181818] pl-9 pr-3 text-xs font-semibold uppercase tracking-wider text-white placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-500 focus:border-[#FF6D2E] focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={
                          applyCouponMut.isPending || validateCouponV1.isPending || !couponCode.trim()
                        }
                        className="h-10 shrink-0 rounded-md bg-white/[0.1] px-4 text-xs font-bold text-white transition hover:bg-white/[0.18] disabled:opacity-40"
                      >
                        {applyCouponMut.isPending || validateCouponV1.isPending ? '…' : 'Apply'}
                      </button>
                    </div>
                  )}
                  {couponError && <p className="mt-2 px-1 text-xs text-[#FFB088]">{couponError}</p>}
                </div>

                {selectedPkg && (
                  <button
                    type="button"
                    disabled={
                      selectedPkg.is_active_plan === 1 ||
                      processingId !== null ||
                      (!razorpayReady && effectivePrice(Number(selectedPkg.price ?? 0)) > 0)
                    }
                    onClick={() => handleSubscribe(selectedPkg)}
                    className="flex h-14 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] text-base font-bold text-white shadow-[0_10px_30px_rgba(255,109,46,0.45)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {processingId === selectedPkg.id ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Starting Checkout...</span>
                      </>
                    ) : selectedPkg.is_active_plan === 1 ? (
                      <span>Current Active Plan</span>
                    ) : (
                      <span>
                        Continue with {selectedPkg.name} • {selectedPkg.currency_code ?? '₹'}
                        {appliedCoupon && (discountAmountV1 === null || validatedPlanId === Number(selectedPkg.id))
                          ? effectivePrice(Number(selectedPkg.price ?? 0))
                          : selectedPkg.price}
                      </span>
                    )}
                  </button>
                )}

                <p className="text-center text-[11px] leading-relaxed text-zinc-500">
                  Secure checkout powered by Razorpay. HD &amp; 4K availability depends on your
                  internet service and device capabilities.
                </p>
              </div>
            </>
          ) : (
            <div className="mx-auto max-w-md rounded-xl border border-white/[0.1] bg-[#141414] py-14 text-center">
              <Crown size={32} className="mx-auto mb-3 text-[#FF8A54]" />
              <p className="text-lg font-bold text-white">No plans available</p>
              <p className="mt-1 text-xs text-zinc-400">Please check back later.</p>
            </div>
          )}
        </div>
      </PageShell>
      </div>
    </>
  );
}
