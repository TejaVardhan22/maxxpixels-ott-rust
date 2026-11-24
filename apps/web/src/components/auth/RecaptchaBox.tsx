'use client';

import { useEffect, useId, useRef, useState } from 'react';

export const DEFAULT_RECAPTCHA_SITE_KEY =
  process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ||
  '6Le3Di8uAAAAACkUTTU7cl19KOTyzt2zDzq0-VRS';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      render: (
        container: HTMLElement | string,
        parameters: {
          sitekey: string;
          theme?: 'dark' | 'light';
          size?: 'normal' | 'compact' | 'invisible';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        },
      ) => number;
      reset: (opt_widget_id?: number) => void;
      execute?: (
        siteKeyOrWidgetId?: string | number,
        options?: { action: string },
      ) => Promise<string>;
    };
    __onRecaptchaLoadCallback?: () => void;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadRecaptchaScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.grecaptcha && typeof window.grecaptcha.render === 'function') {
    return Promise.resolve();
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="google.com/recaptcha/api.js"]',
    );
    if (existing) {
      if (window.grecaptcha && typeof window.grecaptcha.ready === 'function') {
        window.grecaptcha.ready(() => resolve());
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('reCAPTCHA script failed')), {
        once: true,
      });
      return;
    }

    window.__onRecaptchaLoadCallback = () => {
      resolve();
    };

    const script = document.createElement('script');
    script.src =
      'https://www.google.com/recaptcha/api.js?onload=__onRecaptchaLoadCallback&render=explicit';
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Failed to load Google reCAPTCHA'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

interface RecaptchaBoxProps {
  onVerify: (token: string | null) => void;
  siteKey?: string;
  resetSignal?: number;
}

export default function RecaptchaBox({
  onVerify,
  siteKey = DEFAULT_RECAPTCHA_SITE_KEY,
  resetSignal = 0,
}: RecaptchaBoxProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const onVerifyRef = useRef(onVerify);
  const reactId = useId();
  const [fallbackMode, setFallbackMode] = useState(false);

  useEffect(() => {
    onVerifyRef.current = onVerify;
  }, [onVerify]);

  useEffect(() => {
    if (!siteKey) {
      onVerifyRef.current('unconfigured');
      return;
    }

    let cancelled = false;

    loadRecaptchaScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.grecaptcha) return;
        window.grecaptcha.ready(() => {
          if (cancelled || !containerRef.current || !window.grecaptcha) return;
          if (widgetIdRef.current !== null) return;

          try {
            const id = window.grecaptcha.render(containerRef.current, {
              sitekey: siteKey,
              theme: 'dark',
              size: 'normal',
              callback: (token: string) => {
                onVerifyRef.current(token);
              },
              'expired-callback': () => {
                onVerifyRef.current(null);
              },
              'error-callback': () => {
                // If site key is v3/invisible or domain not yet whitelisted in localhost dev
                setFallbackMode(true);
                onVerifyRef.current('recaptcha-fallback');
              },
            });
            widgetIdRef.current = id;
          } catch {
            setFallbackMode(true);
            onVerifyRef.current('recaptcha-fallback');
          }
        });
      })
      .catch(() => {
        if (!cancelled) {
          setFallbackMode(true);
          onVerifyRef.current('recaptcha-fallback');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current !== null && window.grecaptcha) {
      try {
        window.grecaptcha.reset(widgetIdRef.current);
        onVerifyRef.current(null);
      } catch {
        /* ignore */
      }
    }
  }, [resetSignal]);

  if (!siteKey || fallbackMode) return null;

  return (
    <div className="flex flex-col items-center justify-center pt-1">
      <div
        id={`recaptcha-${reactId}`}
        ref={containerRef}
        className="min-h-[78px] overflow-hidden rounded-md"
      />
    </div>
  );
}
