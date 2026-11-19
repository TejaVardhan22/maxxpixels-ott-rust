'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check } from 'lucide-react';
import { useApplyCoupon, usePackages } from '@ott/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStoredUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

export default function StreamPlansPage() {
  const { user } = useStoredUser();
  const [coupon, setCoupon] = useState('');
  const [couponMsg, setCouponMsg] = useState('');
  const packagesQ = usePackages(user?.id);
  const applyCoupon = useApplyCoupon();
  const plans = packagesQ.data?.result ?? [];

  const handleCoupon = async () => {
    setCouponMsg('');
    if (!coupon.trim()) return;
    try {
      const res = await applyCoupon.mutateAsync({ coupon_code: coupon.trim(), user_id: user?.id ?? 0 });
      setCouponMsg(res.message || 'Coupon checked.');
    } catch (err) {
      setCouponMsg(err instanceof Error ? err.message : 'Coupon validation failed.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-12">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-3xl font-black tracking-tight">Choose your experience</h1>
        <p className="mt-2 text-desc-text">Plans and package benefits are loaded from the Spring Boot backend.</p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {packagesQ.isLoading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-80 animate-pulse rounded-xl bg-white/[0.06]" />
        ))}
        {!packagesQ.isLoading && plans.length === 0 && (
          <Card className="border-white/10 bg-white/[0.03] lg:col-span-3">
            <CardContent className="p-8 text-center text-sm text-desc-text">No packages returned by backend.</CardContent>
          </Card>
        )}
        {plans.map((plan, index) => {
          const highlighted = plan.is_active_plan === 1 || plan.is_buy === 1 || index === 1;
          const features = plan.data?.map((item) => String(item.title ?? '')).filter(Boolean) ?? [];
          return (
            <Card
              key={String(plan.id ?? plan.name)}
              className={cn('relative overflow-hidden border-white/10 bg-white/[0.03]', highlighted && 'shadow-glow ring-2 ring-gold/60')}
            >
              {highlighted && (
                <div className="absolute right-4 top-4 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
                  Popular
                </div>
              )}
              <CardHeader>
                <CardTitle className="font-display text-xl">{String(plan.name ?? 'Plan')}</CardTitle>
                <CardDescription>{plan.is_buy === 1 ? 'Current account plan' : 'Available package'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="font-display text-3xl font-bold">
                  {String(plan.currency_code ?? 'INR') === 'INR' ? '₹' : String(plan.currency_code ?? '')}
                  {String(plan.price ?? 0)}
                  <span className="text-base font-normal text-desc-text"> / {String(plan.duration_type ?? 'period')}</span>
                </p>
                <ul className="space-y-2 text-sm text-body-text">
                  {(features.length > 0 ? features : ['HD streaming', 'Multi-device playback', 'Premium catalog access']).map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant={highlighted ? 'default' : 'outline'} className="w-full rounded-full" asChild>
                  <Link href={`/subscription?package_id=${String(plan.id ?? '')}`}>{plan.is_buy === 1 ? 'Manage plan' : 'Select plan'}</Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Card className="mx-auto mt-10 max-w-xl border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">Coupon code</CardTitle>
          <CardDescription>Validate coupons against the backend before checkout.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Label htmlFor="c" className="sr-only">Coupon</Label>
            <Input id="c" value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Promo code" />
            <Button variant="secondary" type="button" disabled={applyCoupon.isPending} onClick={handleCoupon}>
              Apply
            </Button>
          </div>
          {couponMsg && <p className="text-sm text-desc-text">{couponMsg}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
