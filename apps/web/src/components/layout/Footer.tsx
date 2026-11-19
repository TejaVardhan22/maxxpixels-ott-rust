'use client';

import Link from 'next/link';
import { Facebook, Instagram, Twitter, Youtube } from 'lucide-react';
import { useSocialLinks } from '@ott/shared';
import type { SocialLink } from '@ott/shared';
import { useBranding } from '@/hooks/useBranding';
import { useLegalPages } from '@/lib/legal-api';

const cols = [
  {
    heading: 'Explore',
    links: [
      { label: 'Home',         href: '/' },
      { label: 'Movies',       href: '/movies' },
      { label: 'TV Shows',     href: '/shows' },
      { label: 'Genres',       href: '/genres' },
      { label: 'Languages',    href: '/languages' },
      { label: 'Search',       href: '/search' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'My Space',      href: '/myspace' },
      { label: 'Watchlist',     href: '/watchlist' },
      { label: 'Subscription',  href: '/subscription' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'About',         href: '/about' },
      { label: 'Settings',      href: '/settings' },
      { label: 'TV Activate',   href: '/tvactivate' },
      { label: 'Refer & Earn',  href: '/referandearn' },
    ],
  },
];

function socialIcon(name?: string) {
  const normalized = String(name ?? '').toLowerCase();
  if (normalized.includes('instagram')) return <Instagram size={17} strokeWidth={1.8} />;
  if (normalized.includes('youtube')) return <Youtube size={17} strokeWidth={1.8} />;
  if (normalized.includes('facebook')) return <Facebook size={17} strokeWidth={1.8} />;
  return <Twitter size={17} strokeWidth={1.8} />;
}

function normalizePageTitle(value?: string) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export default function Footer() {
  const brand = useBranding();
  const socialQ = useSocialLinks();
  const { pages } = useLegalPages();
  const rawSocials = (socialQ.data as any);
  const socials: SocialLink[] = (
    Array.isArray(rawSocials?.result) ? rawSocials.result
    : Array.isArray(rawSocials) ? rawSocials
    : []
  ).filter((item: SocialLink) => Boolean(item && item.url));
  const usingDemoSocials = socials.length === 0;
  const displaySocials: SocialLink[] = usingDemoSocials
    ? [
        { id: -1, name: 'Instagram', url: 'https://www.instagram.com/' },
        { id: -2, name: 'YouTube', url: 'https://www.youtube.com/' },
        { id: -3, name: 'Facebook', url: 'https://www.facebook.com/' },
        { id: -4, name: 'Twitter', url: 'https://x.com/' },
      ]
    : socials;
  const pagesList = Array.isArray(pages) ? pages : [];
  const policyLink = (match: string) =>
    (() => {
      const page = pagesList.find((item) => normalizePageTitle(item?.title).includes(normalizePageTitle(match)));
      return page?.slug ? `/legal/${page.slug}` : '/about';
    })();

  return (
    <footer id="site-footer" className="mt-24 border-t border-white/[0.06] bg-[#080D15]">
      <div className="mx-auto max-w-[1400px] px-5 py-10 sm:px-7 lg:px-12 lg:py-12">
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr_1fr_1fr_1.1fr]">
          <div className="max-w-sm">
            <Link href="/" className="inline-block">
              {brand.logoUrl ? (
                <img src={brand.logoUrl} alt={brand.name} className="h-9 max-w-[160px] object-contain" />
              ) : (
                <span className="text-xl font-black tracking-[-0.05em] text-white">{brand.name}</span>
              )}
            </Link>
            <p className="mt-4 text-sm leading-6 text-white/38">
              {brand.description}
            </p>
            <p className="mt-5 text-xs font-medium text-white/25">
              Movies, series and stories—wherever you are.
            </p>
          </div>

          {cols.map((col) => (
            <div key={col.heading}>
              <h2 className="mb-4 text-sm font-bold text-white/80">
                {col.heading}
              </h2>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-white/38 transition hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="lg:justify-self-end">
            <h2 className="mb-4 text-sm font-bold text-white/80">Connect</h2>
            <div className="flex items-center gap-2">
              {displaySocials.map((social) => (
                <a
                  key={social.id ?? social.url}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name ?? 'Social link'}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-white/42 transition hover:border-primary/40 hover:text-primary-light"
                >
                  {socialIcon(social.name)}
                </a>
              ))}
            </div>
            {usingDemoSocials && <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-white/20">Demo links</p>}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-5 border-t border-white/[0.06] pt-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {pagesList.length > 0 ? pagesList.map((page) => (
              <Link key={page.slug} href={`/legal/${page.slug}`} className="text-xs text-white/30 transition hover:text-white">
                {page.title}
              </Link>
            )) : (
              <>
                <Link href={policyLink('privacy')} className="text-xs text-white/30 transition hover:text-white">Privacy Policy</Link>
                <Link href={policyLink('terms')} className="text-xs text-white/30 transition hover:text-white">Terms of Use</Link>
              </>
            )}
          </div>
          <p className="shrink-0 text-xs text-white/25">
            &copy; {new Date().getFullYear()} {brand.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
