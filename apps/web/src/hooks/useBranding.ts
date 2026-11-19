'use client';

import { useGeneralSettings } from '@ott/shared';
import { parseBrandSettings } from '@/lib/branding';

export function useBranding() {
  const settingsQ = useGeneralSettings();
  return {
    ...parseBrandSettings(settingsQ.data?.result),
    isLoading: settingsQ.isLoading,
  };
}
