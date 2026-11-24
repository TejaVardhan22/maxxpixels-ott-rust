/**
 * Thin analytics wrapper for the web app.
 *
 * Covers:
 *   - Firebase / GA4, loaded lazily so the root layout chunk stays small.
 *   - Facebook Pixel, injected by the <Script> tag in layout.tsx.
 *
 * All functions are no-ops on the server or when SDKs are blocked.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Log a GA4 / GTM event.
 *
 * @param name Event name, preferably from the EVENTS constants.
 * @param params Optional key/value parameters attached to the event.
 */
export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (typeof window === 'undefined') return;

  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, params ?? {});
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: name, ...(params ?? {}) });
    }
  } catch {
    // ignore
  }

  Promise.all([
    import('firebase/analytics'),
    import('./firebase'),
  ])
    .then(([{ logEvent }, { getFirebaseAnalytics }]) => {
      const analytics = getFirebaseAnalytics();
      if (!analytics) return;
      logEvent(analytics, name, params ?? {});
    })
    .catch(() => {
      // Fail silently: ad blockers, unsupported browsers, SSR, etc.
    });
}

/**
 * Fire a Facebook Pixel standard or custom event.
 *
 * @param name Standard event name, such as PageView, ViewContent, Purchase.
 * @param params Optional parameter object.
 */
export function trackFbEvent(
  name: string,
  params?: Record<string, string | number | boolean | null | undefined | string[]>,
): void {
  try {
    if (typeof window === 'undefined' || !window.fbq) return;
    if (params) {
      window.fbq('track', name, params);
    } else {
      window.fbq('track', name);
    }
  } catch {
    // Fail silently.
  }
}
