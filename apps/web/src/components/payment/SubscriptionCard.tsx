'use client';

import { Check, Crown } from 'lucide-react';
import clsx from 'clsx';
import type { SubscriptionPackage } from '@ott/shared';

interface Props {
  pkg: SubscriptionPackage;
  selected?: boolean;
  onSelect?: (pkg: SubscriptionPackage) => void;
  onSubscribe: (pkg: SubscriptionPackage) => void;
  loading?: boolean;
  discountedPrice?: number;
  checkoutReady?: boolean;
}

export default function SubscriptionCard({
  pkg,
  selected = false,
  onSelect,
  onSubscribe,
  loading,
  discountedPrice,
  checkoutReady = true,
}: Props) {
  const isActive = pkg.is_active_plan === 1;
  const duration = pkg.duration ?? pkg.time;
  const durationType = pkg.duration_type ?? pkg.type ?? 'days';
  const basePrice = Number(pkg.price ?? 0);
  const showDiscount = discountedPrice !== undefined && discountedPrice < basePrice;

  const lowerName = String(pkg.name ?? '').toLowerCase();
  const isFeatured =
    !isActive &&
    (lowerName.includes('platinum') ||
      lowerName.includes('premium') ||
      lowerName.includes('annual'));

  const isFree = discountedPrice === 0;
  const pkgAny = pkg as any;
  const rawBp = (pkg.billing_period || pkgAny.billingPeriod || '').toUpperCase();

  let validityText = '';
  if (rawBp.includes('DAILY') || rawBp === 'DAY_1' || rawBp === '1_DAY') validityText = '1 Day';
  else if (rawBp.includes('WEEK') || rawBp === 'DAY_7' || rawBp === '7_DAYS') validityText = '7 Days';
  else if (rawBp.includes('MONTH') || rawBp === 'MONTH_1') validityText = 'Month';
  else if (rawBp.includes('QUART') || rawBp === 'MONTH_3') validityText = '3 Months';
  else if (rawBp.includes('YEAR') || rawBp.includes('ANNUAL') || rawBp === 'YEAR_1') validityText = 'Year';
  else if (rawBp === 'ONE_TIME' || rawBp === 'LIFETIME') validityText = 'Lifetime';
  else if (duration) validityText = `${duration} ${durationType}`;
  else validityText = rawBp || 'Plan';

  const resolution = String(pkgAny.maxResolution || pkgAny.max_resolution || '1080p').toUpperCase();
  const maxDevices = Number(pkgAny.maxDevices || pkgAny.max_devices || 2);
  const maxStreams = Number(pkgAny.maxConcurrentStreams || pkgAny.max_concurrent_streams || 1);
  const downloadsEnabled = pkgAny.downloadsEnabled ?? pkgAny.downloads_enabled ?? true;
  const adsEnabled = Boolean(pkgAny.adsEnabled ?? pkgAny.ads_enabled);

  const qualityLabel = resolution.includes('4K') || resolution.includes('2160')
    ? 'Best (4K + HDR)'
    : resolution.includes('1080')
    ? 'Great (Full HD)'
    : 'Good (HD)';

  const customFeatures =
    pkg.data && pkg.data.length > 0
      ? pkg.data.map((d: any) => String(d.title ?? '').trim()).filter(Boolean)
      : [];

  // Netflix-style gradient header band per tier (strictly in obsidian + theme orange spectrum)
  const headerGradient = isActive
    ? 'from-emerald-700 via-emerald-800 to-[#141414]'
    : isFeatured
    ? 'from-[#FF6D2E] via-[#C84312] to-[#3B1508]'
    : selected
    ? 'from-[#E85D1F] via-[#8F310E] to-[#26110A]'
    : 'from-[#2A2A2A] via-[#1F1F1F] to-[#141414]';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (onSelect) onSelect(pkg);
        else if (!isActive && !loading && (checkoutReady || isFree)) onSubscribe(pkg);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (onSelect) onSelect(pkg);
          else if (!isActive && !loading && (checkoutReady || isFree)) onSubscribe(pkg);
        }
      }}
      className={clsx(
        'relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-[#141414] transition-all duration-250 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6D2E]',
        isActive
          ? 'border-emerald-500/70 shadow-[0_16px_44px_rgba(16,185,129,0.16)]'
          : selected
          ? 'border-[#FF6D2E] shadow-[0_20px_50px_rgba(255,109,46,0.22)] ring-1 ring-[#FF6D2E]'
          : 'border-white/[0.12] hover:border-white/30',
      )}
    >
      {/* Netflix-style Top Popular / Active Strip */}
      {isActive ? (
        <div className="bg-emerald-600 py-1 text-center text-[10px] font-black uppercase tracking-[0.16em] text-white">
          Current Active Plan
        </div>
      ) : isFeatured ? (
        <div className="bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] py-1 text-center text-[10px] font-black uppercase tracking-[0.16em] text-white">
          Most Popular
        </div>
      ) : null}

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        {/* Netflix Signature Gradient Plan Header Card */}
        <div
          className={clsx(
            'relative overflow-hidden rounded-xl bg-gradient-to-br p-4 text-left',
            headerGradient,
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-black tracking-tight text-white">{pkg.name}</h3>
              <p className="mt-0.5 text-xs font-semibold text-white/80">{resolution}</p>
            </div>
            {isFeatured && !isActive && (
              <Crown size={16} className="shrink-0 text-white/90" />
            )}
          </div>

          {/* Crisp Selected Checkmark */}
          {(selected || isActive) && (
            <span className="absolute bottom-3 right-3 grid h-6 w-6 place-items-center rounded-full bg-white text-[#0A0A0A] shadow-md">
              <Check size={14} strokeWidth={3} />
            </span>
          )}
        </div>

        {/* Hairline-Separated Spec Rows (Exact Netflix Card Table) */}
        <div className="mt-2 flex-1 divide-y divide-white/[0.08] px-1.5 text-left">
          {/* Price Row */}
          <div className="py-3.5">
            <p className="text-[11px] font-medium text-zinc-400">Plan price</p>
            {showDiscount ? (
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="text-lg font-black text-white">
                  {pkg.currency_code ?? '₹'}
                  {discountedPrice}
                </span>
                <span className="text-xs text-zinc-500 line-through">
                  {pkg.currency_code ?? '₹'}
                  {basePrice}
                </span>
                <span className="text-xs font-medium text-zinc-400">/ {validityText}</span>
              </div>
            ) : (
              <p className="mt-0.5 text-lg font-black text-white">
                {pkg.currency_code ?? '₹'}
                {basePrice}{' '}
                <span className="text-xs font-medium text-zinc-400">/ {validityText}</span>
              </p>
            )}
          </div>

          {/* Video & Sound Quality */}
          <div className="py-3">
            <p className="text-[11px] font-medium text-zinc-400">Video and sound quality</p>
            <p className="mt-0.5 text-sm font-bold text-white">{qualityLabel}</p>
          </div>

          {/* Resolution */}
          <div className="py-3">
            <p className="text-[11px] font-medium text-zinc-400">Resolution</p>
            <p className="mt-0.5 text-sm font-bold text-white">{resolution}</p>
          </div>

          {/* Supported Devices */}
          <div className="py-3">
            <p className="text-[11px] font-medium text-zinc-400">Supported devices</p>
            <p className="mt-0.5 text-xs font-semibold text-zinc-200">
              TV, computer, mobile phone, tablet
            </p>
          </div>

          {/* Simultaneous Streams */}
          <div className="py-3">
            <p className="text-[11px] font-medium text-zinc-400">
              Devices you can watch at the same time
            </p>
            <p className="mt-0.5 text-sm font-bold text-white">{maxStreams}</p>
          </div>

          {/* Max Registered Devices & Ads/Downloads */}
          <div className="py-3">
            <p className="text-[11px] font-medium text-zinc-400">Registered devices &amp; perks</p>
            <p className="mt-0.5 text-xs font-semibold text-zinc-200">
              Up to {maxDevices} devices • {adsEnabled ? 'Ad-supported' : 'Ad-free'}
              {downloadsEnabled ? ' • Downloads' : ''}
            </p>
          </div>

          {customFeatures.length > 0 && (
            <div className="py-3">
              <p className="text-[11px] font-medium text-zinc-400">Included</p>
              <ul className="mt-1 space-y-1">
                {customFeatures.slice(0, 3).map((feat, idx) => (
                  <li key={idx} className="flex items-center gap-1.5 text-xs text-zinc-200">
                    <Check size={12} className="shrink-0 text-[#FF6D2E]" strokeWidth={2.5} />
                    <span className="truncate">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
