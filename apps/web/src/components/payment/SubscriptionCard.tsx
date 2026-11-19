'use client';

import { Check, Crown, Zap } from 'lucide-react';
import clsx from 'clsx';
import type { SubscriptionPackage } from '@ott/shared';

interface Props {
  pkg:              SubscriptionPackage;
  onSubscribe:      (pkg: SubscriptionPackage) => void;
  loading?:         boolean;
  discountedPrice?: number;
  checkoutReady?:   boolean;
}

export default function SubscriptionCard({ pkg, onSubscribe, loading, discountedPrice, checkoutReady = true }: Props) {
  const isActive    = pkg.is_active_plan === 1;
  const duration    = pkg.duration ?? pkg.time;
  const durationType = pkg.duration_type ?? pkg.type ?? 'days';
  const basePrice   = pkg.price as number;
  const showDiscount = discountedPrice !== undefined && discountedPrice < basePrice;

  // Highlight the "middle" plan visually
  const isFeatured = !isActive && (pkg.name?.toLowerCase().includes('premium') || pkg.name?.toLowerCase().includes('annual'));

  const isFree = discountedPrice === 0;
  const canInteract = !isActive && !loading && (checkoutReady || isFree);

  const pkgAny = pkg as any;
  const rawBp = (pkg.billing_period || pkgAny.billingPeriod || '').toUpperCase();
  let validityText = '';
  if (rawBp.includes('DAILY') || rawBp === 'DAY_1' || rawBp === '1_DAY') validityText = '1 Day Pass (24 Hours)';
  else if (rawBp.includes('WEEK') || rawBp === 'DAY_7' || rawBp === '7_DAYS') validityText = '7 Days Pass';
  else if (rawBp.includes('MONTH') || rawBp === 'MONTH_1') validityText = '1 Month Access';
  else if (rawBp.includes('QUART') || rawBp === 'MONTH_3') validityText = '3 Months Access';
  else if (rawBp.includes('YEAR') || rawBp.includes('ANNUAL') || rawBp === 'YEAR_1') validityText = '1 Year (Annual Pass)';
  else if (rawBp === 'ONE_TIME' || rawBp === 'LIFETIME') validityText = 'Lifetime Access';
  else if (duration) validityText = `${duration} ${durationType}`;
  else validityText = rawBp || 'Active Subscription';

  const features = (pkg.data && pkg.data.length > 0)
    ? pkg.data
    : [
        { id: 1, title: `${pkgAny.maxResolution || pkgAny.max_resolution || '1080p Full HD'} streaming` },
        { id: 2, title: `Watch on ${pkgAny.maxDevices || pkgAny.max_devices || 2} allowed devices` },
        { id: 3, title: `${pkgAny.maxConcurrentStreams || pkgAny.max_concurrent_streams || 1} concurrent stream(s)` },
        (pkgAny.downloadsEnabled ?? pkgAny.downloads_enabled ?? true) ? { id: 4, title: 'Offline video downloads' } : null,
        (pkgAny.adsEnabled ?? pkgAny.ads_enabled) ? { id: 5, title: 'Contains ads (AVOD)' } : { id: 5, title: '100% Ad-free streaming' },
        (pkgAny.trialDays > 0 || pkgAny.trial_days > 0) ? { id: 6, title: `${pkgAny.trialDays || pkgAny.trial_days} days free trial` } : null,
      ].filter(Boolean) as { id: number; title: string }[];

  return (
    <div
      role={isActive ? undefined : 'button'}
      tabIndex={isActive ? -1 : 0}
      aria-disabled={!canInteract}
      onClick={() => {
        if (canInteract) onSubscribe(pkg);
      }}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && canInteract) {
          event.preventDefault();
          onSubscribe(pkg);
        }
      }}
      className={clsx(
        'relative rounded-2xl p-6 flex flex-col transition-all duration-300 overflow-hidden',
        isFeatured
          ? 'bg-[#111827] border-2 border-primary/60 shadow-glow'
          : 'bg-surface border border-ott-border hover:border-white/20',
        isActive && 'border-2 border-primary',
        isFree && !isActive && 'border-2 border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.2)]',
        canInteract && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      )}
    >
      {/* Featured / Free ribbon */}
      {isFree && !isActive ? (
        <div className="absolute top-0 right-0">
          <div className="bg-emerald-500 text-black text-[9px] font-black tracking-widest uppercase px-4 py-1.5 rounded-bl-xl shadow-md">
            100% FREE COUPON
          </div>
        </div>
      ) : isFeatured && !isActive && (
        <div className="absolute top-0 right-0">
          <div className="bg-primary text-white text-[9px] font-black tracking-widest uppercase px-4 py-1.5 rounded-bl-xl">
            MOST POPULAR
          </div>
        </div>
      )}

      {/* Active plan badge */}
      {isActive && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
      )}

      {/* Plan name + icon */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className={clsx(
            'w-9 h-9 rounded-xl flex items-center justify-center',
            isFree ? 'bg-emerald-500/20 text-emerald-400' : isFeatured ? 'bg-primary/20 text-primary' : 'bg-surface-light text-desc-text',
          )}>
            {isFeatured
              ? <Crown size={16} strokeWidth={2} />
              : <Zap size={16} strokeWidth={2} />}
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{pkg.name}</h3>
            {isActive && (
              <span className="text-[10px] font-semibold text-primary">Active Plan</span>
            )}
          </div>
        </div>
      </div>

      {/* Price */}
      <div className="mb-5">
        {showDiscount ? (
          <div className="flex items-baseline gap-2">
            <span className={clsx('text-4xl font-black', isFree ? 'text-emerald-400' : isFeatured ? 'text-primary' : 'text-white')}>
              {pkg.currency_code ?? '₹'}{discountedPrice}
            </span>
            <span className="text-desc-text line-through text-lg">
              {pkg.currency_code ?? '₹'}{basePrice}
            </span>
            {isFree && (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded ml-1">
                FREE
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className={clsx('text-4xl font-black', isFeatured ? 'text-primary' : 'text-white')}>
              {pkg.currency_code ?? '₹'}{basePrice}
            </span>
          </div>
        )}
        <p className="text-xs text-muted-text mt-1">
          for {validityText}
        </p>
      </div>

      {/* Features list */}
      {features.length > 0 && (
        <ul className="space-y-2.5 mb-6 flex-1">
          {features.map((d, i) => (
            <li key={d.id ?? i} className="flex items-start gap-2.5 text-sm">
              <Check size={14} className={isFree ? "text-emerald-400 flex-shrink-0 mt-0.5" : "text-primary flex-shrink-0 mt-0.5"} strokeWidth={2.5} />
              <span className="text-body-text">{d.title}</span>
            </li>
          ))}
        </ul>
      )}

      {/* CTA button */}
      <button
        onClick={(event) => {
          event.stopPropagation();
          if (canInteract) onSubscribe(pkg);
        }}
        disabled={!canInteract}
        className={clsx(
          'w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-200 mt-auto',
          isActive
            ? 'bg-surface-light text-desc-text cursor-default'
            : isFree
              ? 'bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold shadow-lg shadow-emerald-500/25 hover:shadow-none'
              : isFeatured
                ? 'bg-primary hover:bg-primary-dark text-white shadow-glow hover:shadow-none'
                : 'bg-surface-light hover:bg-surface-hover text-white border border-ott-border hover:border-white/20',
          loading && 'opacity-60 cursor-wait',
        )}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Processing…
          </span>
        ) : (!isActive && !checkoutReady && !isFree) ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Loading payment…
          </span>
        ) : isActive ? (
          'Current Plan'
        ) : isFree ? (
          'Claim Free Plan (100% OFF)'
        ) : (
          'Get Started'
        )}
      </button>
    </div>
  );
}
