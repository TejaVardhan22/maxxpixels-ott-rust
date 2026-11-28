'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Facebook, Instagram, Linkedin, Send, Youtube } from 'lucide-react';
import { useGeneralSettings, useLanguages, useSocialLinks } from '@ott/shared';
import type { Language, SocialLink } from '@ott/shared';
import { useBranding } from '@/hooks/useBranding';
import { useLegalPages } from '@/lib/legal-api';
import { useStoredUser } from '@/lib/auth';
import { userPageHref } from '@/lib/userRoutes';
import type { UserScopedPage } from '@/lib/userRoutes';

interface MainContentType {
  id: number;
  slug: string;
  title?: string | null;
  name?: string | null;
}

const DEFAULT_ANDROID_APP_URL =
  process.env.NEXT_PUBLIC_ANDROID_APP_URL ||
  'https://play.google.com/store/apps/details?id=com.maxxpixels';

const accountLinks: Array<{ label: string; page?: UserScopedPage; href?: string }> = [
  { label: 'My Space & Watchlist', page: 'myspace' },
  { label: 'Membership', page: 'subscription' },
  { label: 'Refer & Earn', page: 'referandearn' },
  { label: 'Activate Smart TV', page: 'tvactivate' },
  { label: 'About', href: '/about' },
];

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function socialIcon(name?: string) {
  const normalized = String(name ?? '').toLowerCase();
  if (normalized.includes('facebook')) return <Facebook size={18} strokeWidth={1.9} />;
  if (normalized.includes('instagram')) return <Instagram size={18} strokeWidth={1.9} />;
  if (normalized.includes('youtube')) return <Youtube size={19} strokeWidth={1.9} />;
  if (normalized.includes('linkedin')) return <Linkedin size={17} strokeWidth={1.9} />;
  if (normalized.includes('telegram') || normalized.includes('whatsapp')) {
    return <Send size={17} strokeWidth={1.9} />;
  }
  return <XIcon size={16} />;
}

function GooglePlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M3.609 1.814L13.792 12 3.61 22.186a1.96 1.96 0 0 1-.61-1.424V3.238c0-.546.224-1.057.609-1.424z"
      />
      <path
        fill="#34A853"
        d="M17.209 8.583L13.792 12 3.61 1.814A1.99 1.99 0 0 1 5.016 1.25c.35 0 .703.092 1.022.275l11.171 7.058z"
      />
      <path
        fill="#FBBC05"
        d="M20.382 10.587c.824.474.824 2.352 0 2.826l-3.173 1.829L13.792 12l3.417-3.417 3.173 2.004z"
      />
      <path
        fill="#EA4335"
        d="M13.792 12l3.417 3.242-11.171 7.233a2.01 2.01 0 0 1-2.429-.289L13.792 12z"
      />
    </svg>
  );
}

function extractSettingValue(raw: unknown, keys: string[]): string {
  if (!raw) return '';
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const k = String((item as any)?.key ?? (item as any)?.settingKey ?? '').trim();
      if (keys.includes(k) && ((item as any)?.value ?? (item as any)?.settingValue)) {
        return String((item as any).value ?? (item as any).settingValue).trim();
      }
    }
    return '';
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const k of keys) {
      if (typeof obj[k] === 'string' && String(obj[k]).trim()) {
        return String(obj[k]).trim();
      }
    }
  }
  return '';
}

export default function Footer() {
  const brand = useBranding();
  const { user } = useStoredUser();
  const settingsQ = useGeneralSettings();
  const socialQ = useSocialLinks();
  const languagesQ = useLanguages();
  const { pages } = useLegalPages();
  const [logoError, setLogoError] = useState(false);

  // Dynamic backend Main Types (shared cache key with Navbar)
  const contentTypesQ = useQuery<MainContentType[]>({
    queryKey: ['navbar-content-types'],
    queryFn: async () => {
      const res = await fetch('/api/v1/content-types', { cache: 'no-store' });
      if (!res.ok) return [];
      const json = await res.json();
      const list = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.result)
        ? json.result
        : Array.isArray(json)
        ? json
        : [];
      return list.filter(
        (t: any) =>
          t &&
          t.isActive !== false &&
          t.is_active !== false &&
          (t.slug || t.id) &&
          (t.title || t.name),
      );
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const mainTypes = contentTypesQ.data ?? [];

  // Deduplicated backend Languages (Kannada first)
  const apiLanguages = useMemo<Language[]>(() => {
    const raw = languagesQ.data as any;
    const list: Language[] = Array.isArray(raw?.result)
      ? raw.result
      : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw)
      ? raw
      : [];
    const seen = new Set<string>();
    const out: Language[] = [];
    for (const l of list) {
      const name = String(l?.name ?? '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(l);
    }
    out.sort((a, b) =>
      String(a.name ?? '').toLowerCase() === 'kannada'
        ? -1
        : String(b.name ?? '').toLowerCase() === 'kannada'
        ? 1
        : 0,
    );
    return out;
  }, [languagesQ.data]);

  const rawSettings = useMemo(() => {
    const outer = (settingsQ.data as any)?.result ?? (settingsQ.data as any)?.data ?? settingsQ.data;
    if (outer && typeof outer === 'object' && outer.settings && typeof outer.settings === 'object') {
      return { ...outer, ...outer.settings };
    }
    return outer;
  }, [settingsQ.data]);

  const androidAppUrl = useMemo(() => {
    if (brand.androidAppUrl) return brand.androidAppUrl;
    const configured = extractSettingValue(rawSettings, [
      'androidAppUrl',
      'android_app_url',
      'playStoreUrl',
      'play_store_url',
      'ANDROID_APP_URL',
      'PLAY_STORE_URL',
    ]);
    return configured || DEFAULT_ANDROID_APP_URL;
  }, [brand.androidAppUrl, rawSettings]);

  // Resolve social media links from API array, system settings keys, or sensible defaults
  const socials = useMemo<SocialLink[]>(() => {
    const rawSocials = socialQ.data as any;
    const listFromApi: SocialLink[] = (
      Array.isArray(rawSocials?.result)
        ? rawSocials.result
        : Array.isArray(rawSocials?.data)
        ? rawSocials.data
        : Array.isArray(rawSocials)
        ? rawSocials
        : []
    ).filter((item: SocialLink) => Boolean(item && item.url));

    if (listFromApi.length > 0) return listFromApi;

    const fb = extractSettingValue(rawSettings, [
      'facebookUrl',
      'facebook_url',
      'FACEBOOK_URL',
      'socialFacebook',
      'social_facebook',
    ]);
    const ig = extractSettingValue(rawSettings, [
      'instagramUrl',
      'instagram_url',
      'INSTAGRAM_URL',
      'socialInstagram',
      'social_instagram',
    ]);
    const tw = extractSettingValue(rawSettings, [
      'twitterUrl',
      'twitter_url',
      'TWITTER_URL',
      'xUrl',
      'x_url',
      'socialTwitter',
      'social_twitter',
    ]);
    const yt = extractSettingValue(rawSettings, [
      'youtubeUrl',
      'youtube_url',
      'YOUTUBE_URL',
      'socialYoutube',
      'social_youtube',
    ]);
    const li = extractSettingValue(rawSettings, [
      'linkedinUrl',
      'linkedin_url',
      'LINKEDIN_URL',
      'socialLinkedin',
    ]);

    const handle = (brand.shortName || brand.name || 'maxxpixels')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');

    const resolved: SocialLink[] = [
      {
        id: 1,
        name: 'Facebook',
        url: fb || `https://www.facebook.com/${handle}`,
      },
      {
        id: 2,
        name: 'Instagram',
        url: ig || `https://www.instagram.com/${handle}`,
      },
      {
        id: 3,
        name: 'X (Twitter)',
        url: tw || `https://x.com/${handle}`,
      },
      {
        id: 4,
        name: 'YouTube',
        url: yt || `https://www.youtube.com/@${handle}`,
      },
    ];

    if (li) {
      resolved.push({ id: 5, name: 'LinkedIn', url: li });
    }

    return resolved;
  }, [brand.name, brand.shortName, rawSettings, socialQ.data]);

  const pagesList = Array.isArray(pages) ? pages : [];

  return (
    <footer
      id="site-footer"
      className="relative z-20 mt-12 border-t border-white/[0.08] bg-[#0A0A0A] pb-20 text-[#808080] lg:pb-0"
    >
      <div className="mx-auto max-w-[1180px] px-5 py-12 sm:px-8 lg:px-10 lg:py-14">
        {/* Top Row: Netflix-Style Social Media Buttons + Questions / Support Contact + Google Play */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-5">
          <div className="flex flex-wrap items-center gap-6">
            {/* Social Media Icons Row */}
            <div className="flex items-center gap-3">
              {socials.map((social) => (
                <a
                  key={social.id ?? social.url}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name ?? 'Social link'}
                  title={social.name ?? 'Follow us'}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#141414] text-white/90 transition-all duration-200 hover:border-[#FF6D2E] hover:bg-[#FF6D2E] hover:text-white"
                >
                  {socialIcon(social.name)}
                </a>
              ))}
            </div>

            {(brand.supportEmail || brand.supportPhone) && (
              <p className="text-[13px] text-[#808080]">
                Questions? Contact{' '}
                {brand.supportEmail && (
                  <a
                    href={`mailto:${brand.supportEmail}`}
                    className="text-zinc-300 underline-offset-2 transition hover:text-[#FF6D2E] hover:underline"
                  >
                    {brand.supportEmail}
                  </a>
                )}
                {brand.supportEmail && brand.supportPhone && <span> • </span>}
                {brand.supportPhone && (
                  <a
                    href={`tel:${brand.supportPhone}`}
                    className="text-zinc-300 underline-offset-2 transition hover:text-[#FF6D2E] hover:underline"
                  >
                    {brand.supportPhone}
                  </a>
                )}
              </p>
            )}
          </div>

          {/* Compact Google Play Download Badge */}
          <a
            href={androidAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 rounded-md border border-white/15 bg-[#141414] px-3.5 py-2 transition hover:border-[#FF6D2E]/60 hover:bg-[#1A1A1A]"
          >
            <GooglePlayIcon />
            <div className="text-left leading-tight">
              <span className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                Get it on
              </span>
              <span className="block text-xs font-bold text-white">Google Play</span>
            </div>
          </a>
        </div>

        {/* Netflix-Style 4-Column Link Grid */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 text-[13px] sm:grid-cols-4">
          {/* Column 1: Browse Main Types */}
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">
              Browse
            </p>
            <ul className="space-y-2.5">
              <li>
                <Link href="/" className="transition hover:text-white hover:underline">
                  Home
                </Link>
              </li>
              {mainTypes.map((ct) => (
                <li key={ct.id ?? ct.slug}>
                  <Link
                    href={`/kannada/${encodeURIComponent(ct.slug)}`}
                    className="transition hover:text-white hover:underline"
                  >
                    {ct.title || ct.name || ct.slug}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/search" className="transition hover:text-white hover:underline">
                  Search
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Languages */}
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">
              Languages
            </p>
            <ul className="space-y-2.5">
              {apiLanguages.slice(0, 6).map((lang) => {
                const slug = String(lang.name ?? '').toLowerCase().trim();
                return (
                  <li key={lang.id ?? slug}>
                    <Link
                      href={slug === 'kannada' ? '/' : `/${encodeURIComponent(slug)}`}
                      className="transition hover:text-white hover:underline"
                    >
                      {lang.name}
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link href="/all-indian" className="transition hover:text-white hover:underline">
                  All Indian Languages
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Account */}
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">
              Account
            </p>
            <ul className="space-y-2.5">
              {accountLinks.map((link) => {
                const targetHref = link.page ? userPageHref(user, link.page) : (link.href ?? '/');
                return (
                  <li key={link.label}>
                    <Link href={targetHref} className="transition hover:text-white hover:underline">
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Column 4: Legal & Social Connect */}
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">
              Legal &amp; Connect
            </p>
            <ul className="space-y-2.5">
              {pagesList.map((page) => (
                <li key={page.slug}>
                  <Link
                    href={`/legal/${page.slug}`}
                    className="transition hover:text-white hover:underline"
                  >
                    {page.title}
                  </Link>
                </li>
              ))}
              {pagesList.length === 0 && (
                <>
                  <li>
                    <Link
                      href="/legal/terms-of-service"
                      className="transition hover:text-white hover:underline"
                    >
                      Terms of Use
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/legal/privacy-policy"
                      className="transition hover:text-white hover:underline"
                    >
                      Privacy Policy
                    </Link>
                  </li>
                </>
              )}
              {socials.map((social) => (
                <li key={`link-${social.id ?? social.name}`}>
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 transition hover:text-[#FF6D2E] hover:underline"
                  >
                    <span>{social.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Brand + Copyright Line */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] pt-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex items-center">
              {brand.logoUrl && !logoError ? (
                <img
                  src={brand.logoUrl}
                  alt={brand.name}
                  className="h-7 max-w-[140px] object-contain opacity-90 transition hover:opacity-100"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span className="text-sm font-black tracking-tight text-white/90">{brand.name}</span>
              )}
            </Link>
            {brand.description && (
              <span className="hidden max-w-md truncate text-xs text-[#666666] sm:inline">
                — {brand.description}
              </span>
            )}
          </div>

          <p className="text-xs text-[#808080]">
            &copy; {new Date().getFullYear()} {brand.companyName || brand.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
