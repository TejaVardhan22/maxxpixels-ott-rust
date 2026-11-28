import { resolveImageUrl } from '@ott/shared';

export type BrandSettings = {
  name: string;
  shortName: string;
  companyName: string;
  logoUrl: string | null;
  lightLogoUrl: string | null;
  darkLogoUrl: string | null;
  faviconUrl: string | null;
  seoTitle: string;
  description: string;
  supportEmail: string;
  supportPhone: string;
  websiteUrl: string;
  androidAppUrl: string;
  iosAppUrl: string;
};

export const FALLBACK_BRAND: BrandSettings = {
  name: 'MaxxPixels',
  shortName: 'MaxxPixels',
  companyName: 'MaxxPixels Entertainment Pvt Ltd',
  logoUrl: '/logo.png',
  lightLogoUrl: '/logo.png',
  darkLogoUrl: '/logo.png',
  faviconUrl: '/logo.png',
  seoTitle: 'MaxxPixels - Stream Movies, Short Films & Web Series',
  description: 'Stream movies, short films, and web series anytime, anywhere.',
  supportEmail: 'support@maxxpixels.com',
  supportPhone: '',
  websiteUrl: 'https://maxxpixels.com',
  androidAppUrl: 'https://play.google.com/store/apps/details?id=com.maxxpixels',
  iosAppUrl: '',
};

function cleanAssetUrl(raw?: string | null): string | null {
  const val = String(raw ?? '').trim();
  if (!val) return null;
  if (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:')) {
    return val;
  }
  if (val.startsWith('/')) {
    return val;
  }
  return resolveImageUrl(val) || `/${val}`;
}

export function parseBrandSettings(rows?: any): BrandSettings {
  if (!rows) return FALLBACK_BRAND;

  let settings: Record<string, string> = {};

  if (Array.isArray(rows)) {
    if (rows.length === 0) return FALLBACK_BRAND;
    if (rows[0] && typeof rows[0] === 'object' && ('key' in rows[0] || 'settingKey' in rows[0])) {
      settings = Object.fromEntries(
        rows
          .filter((row: any) => row && (row.key || row.settingKey))
          .map((row: any) => [
            String(row.key || row.settingKey),
            String(row.value ?? row.settingValue ?? '').trim(),
          ]),
      );
    } else if (rows[0] && typeof rows[0] === 'object') {
      settings = { ...rows[0] };
    }
  } else if (typeof rows === 'object') {
    const inner = rows.data ?? rows.result ?? rows;
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const nested = inner.settings && typeof inner.settings === 'object' && !Array.isArray(inner.settings)
        ? inner.settings
        : null;
      settings = nested ? { ...inner, ...nested } : { ...inner };
    } else {
      settings = { ...rows };
    }
  }

  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const v = settings[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        return String(v).trim();
      }
    }
    return '';
  };

  const shortName =
    pick('app_short_name', 'appShortName', 'app_name', 'appName', 'platform_name', 'platformName') ||
    FALLBACK_BRAND.shortName;

  const name =
    pick('app_short_name', 'appShortName', 'app_name', 'appName', 'platform_name', 'platformName') ||
    FALLBACK_BRAND.name;

  const companyName =
    pick('company_name', 'companyName') || FALLBACK_BRAND.companyName;

  const darkLogoUrl = cleanAssetUrl(
    pick('darkLogoUrl', 'dark_logo_url', 'logoUrl', 'logo_url', 'APP_LOGO_URL', 'app_logo'),
  );
  const lightLogoUrl = cleanAssetUrl(
    pick('logoUrl', 'logo_url', 'APP_LOGO_URL', 'darkLogoUrl', 'dark_logo_url', 'app_logo'),
  );
  const logoUrl = darkLogoUrl || lightLogoUrl || FALLBACK_BRAND.logoUrl;
  const faviconUrl = cleanAssetUrl(pick('faviconUrl', 'favicon_url')) || logoUrl;

  const seoTitle =
    pick('seo_title', 'seoTitle') || `${name} - Stream Movies, Short Films & Web Series`;

  const description =
    pick('seo_description', 'seoDescription', 'app_description', 'app_desripation') ||
    FALLBACK_BRAND.description;

  const supportEmail = pick('support_email', 'supportEmail') || FALLBACK_BRAND.supportEmail;
  const supportPhone = pick('support_phone', 'supportPhone') || '';
  const websiteUrl = pick('website_url', 'websiteUrl') || FALLBACK_BRAND.websiteUrl;
  const androidAppUrl =
    pick('android_app_url', 'androidAppUrl', 'play_store_url', 'playStoreUrl') ||
    FALLBACK_BRAND.androidAppUrl;
  const iosAppUrl = pick('ios_app_url', 'iosAppUrl') || '';

  return {
    name,
    shortName,
    companyName,
    logoUrl,
    lightLogoUrl,
    darkLogoUrl,
    faviconUrl,
    seoTitle,
    description,
    supportEmail,
    supportPhone,
    websiteUrl,
    androidAppUrl,
    iosAppUrl,
  };
}
