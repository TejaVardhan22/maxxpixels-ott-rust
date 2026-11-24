'use client';

import { useEffect } from 'react';
import { useGeneralSettings } from '@ott/shared';
import { parseBrandSettings } from '@/lib/branding';

export function useBranding() {
  const settingsQ = useGeneralSettings();
  const raw = (settingsQ.data as any)?.result ?? (settingsQ.data as any)?.data ?? settingsQ.data;
  const brand = parseBrandSettings(raw);

  // Sync browser favicon dynamically when Branding & Identity is updated in Admin Settings
  useEffect(() => {
    if (!brand.faviconUrl || typeof document === 'undefined') return;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    if (link.href !== brand.faviconUrl) {
      link.href = brand.faviconUrl;
    }
  }, [brand.faviconUrl]);

  return {
    ...brand,
    isLoading: settingsQ.isLoading,
  };
}
