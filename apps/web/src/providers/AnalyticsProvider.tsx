'use client';

/**
 * AnalyticsProvider
 *
 * Wraps the app and automatically fires a `page_view` GA4 event +
 * a Facebook `PageView` event on every client-side route change.
 *
 * It also bootstraps Firebase Analytics on first mount (browser-only).
 */

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { trackEvent, trackFbEvent } from '@/lib/analytics';
import { EVENTS } from '@ott/shared';

const SENSITIVE_PARAMS = ['phone', 'otp', 'token', 'code', 'payment_id', 'razorpay_payment_id'];

function sanitizePath(fullPath: string): string {
  try {
    const url = new URL(fullPath, 'https://placeholder.com');
    SENSITIVE_PARAMS.forEach(p => url.searchParams.delete(p));
    return url.pathname + (url.search ? url.search : '');
  } catch {
    return fullPath.split('?')[0]; // fallback: strip all query params
  }
}

// Inner component needs useSearchParams, which requires Suspense boundary
function PageTracker() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  // Defer Firebase Analytics until the browser is idle (or shortly after paint)
  useEffect(() => {
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      import('@/lib/firebase')
        .then(({ initFirebaseAnalytics }) => initFirebaseAnalytics())
        .catch(() => null);
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(run, { timeout: 2500 });
    } else {
      timeoutId = setTimeout(run, 1);
    }

    return () => {
      if (idleId !== undefined && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  // Track every navigation (pathname OR query string changes)
  useEffect(() => {
    const fullPath = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    // Sanitize path to remove PII query params before sending to analytics
    const safePath = sanitizePath(fullPath);
    trackEvent(EVENTS.PAGE_VIEW, { page_path: safePath });
    trackFbEvent('PageView');
  }, [pathname, searchParams]);

  return null;
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Suspense required because useSearchParams() suspends during SSR */}
      <Suspense fallback={null}>
        <PageTracker />
      </Suspense>
      {children}
    </>
  );
}
