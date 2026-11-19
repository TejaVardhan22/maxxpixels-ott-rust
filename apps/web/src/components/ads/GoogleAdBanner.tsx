'use client';

import React, { useEffect, useRef } from 'react';

export interface GoogleAdBannerProps {
  /**
   * Google AdSense Ad Slot ID.
   * If omitted, defaults to responsive auto format.
   */
  slot?: string;
  /**
   * Ad format: 'auto' | 'fluid' | 'rectangle' | 'horizontal' | 'vertical'
   */
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal' | 'vertical';
  /**
   * Whether to enable full width responsive ads (default true)
   */
  responsive?: boolean;
  /**
   * Layout key for in-feed native ads (data-ad-layout-key)
   */
  layoutKey?: string;
  /**
   * Optional custom CSS class name for outer wrapper
   */
  className?: string;
  /**
   * Optional inline styles for the ad unit container
   */
  style?: React.CSSProperties;
  /**
   * Optional content ID when banner is rendered in context of a movie/series/watch page
   */
  contentId?: number;
}

export default function GoogleAdBanner({
  slot,
  format = 'auto',
  responsive = true,
  layoutKey,
  className = '',
  style,
  contentId,
}: GoogleAdBannerProps) {
  const isPushedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT_ID || 'ca-pub-2191993313473081';

  // Google AdSense requires purely numeric 10-digit IDs for data-ad-slot (e.g. "8394857291").
  // Passing non-numeric string labels like "home-top-banner" causes Google AdSense server to return HTTP 400.
  const isNumericSlot = (val?: string): boolean => Boolean(val && /^\d+$/.test(val.trim()));
  const envKey = slot ? `NEXT_PUBLIC_ADSENSE_SLOT_${slot.toUpperCase().replace(/[^A-Z0-9]/g, '_')}` : '';
  const envSlot = envKey && typeof process !== 'undefined' ? process.env[envKey] : undefined;
  const defaultSlot = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_DEFAULT_SLOT : undefined;

  let resolvedNumericSlot: string | undefined = undefined;
  if (isNumericSlot(slot)) {
    resolvedNumericSlot = slot?.trim();
  } else if (isNumericSlot(envSlot)) {
    resolvedNumericSlot = envSlot?.trim();
  } else if (isNumericSlot(defaultSlot)) {
    resolvedNumericSlot = defaultSlot?.trim();
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Track banner ad impression to backend analytics if contentId is associated
    if (contentId && contentId > 0) {
      try {
        fetch('/api/v1/ads/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionToken: `web-banner-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            contentId,
            providerCode: 'ADMOB',
            eventType: 'IMPRESSION',
            metadata: {
              device: 'WEB',
              format: 'BANNER',
              slot: slot || 'default_banner',
              timestamp: Date.now(),
            },
          }),
        }).catch(() => {});
      } catch {}
    }

    // Avoid duplicate pushes for the same component lifecycle in Next.js SPA
    if (!isPushedRef.current) {
      try {
        const adsWindow = window as unknown as { adsbygoogle?: Array<Record<string, unknown>> };
        adsWindow.adsbygoogle = adsWindow.adsbygoogle || [];
        adsWindow.adsbygoogle.push({});
        isPushedRef.current = true;
      } catch (err) {
        // Suppress AdSense push collisions or ad blocker errors gracefully
      }
    }
  }, [contentId, slot]);

  return (
    <div
      ref={containerRef}
      className={`relative mx-auto my-4 w-full overflow-hidden rounded-xl border border-white/[0.06] bg-[#0c1017]/80 p-2.5 text-center transition-all ${className}`}
      style={style}
    >
      <div className="mb-1.5 flex items-center justify-center gap-1.5 text-[10px] font-semibold tracking-wider text-white/40 uppercase">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60" />
        Advertisement
      </div>

      <div className="flex min-h-[90px] w-full items-center justify-center overflow-hidden">
        <ins
          className="adsbygoogle"
          style={{
            display: 'block',
            width: '100%',
            minHeight: '90px',
            ...style,
          }}
          data-ad-client={clientId}
          data-ad-slot={resolvedNumericSlot || undefined}
          data-ad-format={format}
          data-full-width-responsive={responsive ? 'true' : 'false'}
          {...(layoutKey ? { 'data-ad-layout-key': layoutKey } : {})}
        />
      </div>
    </div>
  );
}

