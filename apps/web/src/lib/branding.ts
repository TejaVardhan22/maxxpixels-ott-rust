import type { GeneralSettingRow } from '@ott/shared';

export type BrandSettings = {
  name: string;
  logoUrl: string | null;
  description: string;
};

export const FALLBACK_BRAND: BrandSettings = {
  name: 'MaxxPixels',
  logoUrl: '/logo.png',
  description: 'Stream movies, short films, and web series anytime, anywhere.',
};

export function parseBrandSettings(rows?: any): BrandSettings {
  if (!rows) return FALLBACK_BRAND;

  let settings: Record<string, string> = {};

  if (Array.isArray(rows)) {
    if (rows.length === 0) return FALLBACK_BRAND;
    // Check if it's an array of { key, value } objects or an array with an object
    if (rows[0] && typeof rows[0] === 'object' && 'key' in rows[0]) {
      settings = Object.fromEntries(
        rows
          .filter((row: any) => row && row.key)
          .map((row: any) => [String(row.key), String(row.value ?? '').trim()])
      );
    } else if (rows[0] && typeof rows[0] === 'object') {
      settings = { ...rows[0] };
    }
  } else if (typeof rows === 'object') {
    settings = { ...rows };
  }

  const name =
    settings.app_name ||
    settings.platform_name ||
    settings.app_short_name ||
    settings.appName ||
    settings.appShortName ||
    FALLBACK_BRAND.name;

  let logoUrl =
    settings.app_logo ||
    settings.logo_url ||
    settings.dark_logo_url ||
    settings.logoUrl ||
    settings.darkLogoUrl ||
    '/logo.png';

  if (logoUrl && typeof logoUrl === 'string' && !logoUrl.startsWith('http://') && !logoUrl.startsWith('https://') && !logoUrl.startsWith('/')) {
    logoUrl = '/' + logoUrl;
  }

  const description =
    settings.app_desripation ||
    settings.app_description ||
    settings.seo_description ||
    settings.seoDescription ||
    FALLBACK_BRAND.description;

  return {
    name,
    logoUrl,
    description,
  };
}
