'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Crown,
  Film,
  Globe,
  Home,
  LogOut,
  Menu,
  Search,
  Settings,
  Tv,
  User,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useStoredUser } from '@/lib/auth';
import { getUserScopedPageFromPath, USER_SCOPED_PAGES, userPageHref } from '@/lib/userRoutes';
import {
  avatarUrl,
  getContentUrl,
  resolveImageUrl,
  useLanguages,
  useNotifications,
  useReadNotification,
} from '@ott/shared';
import type { Language, Notification } from '@ott/shared';
import { useBranding } from '@/hooks/useBranding';

interface MainContentType {
  id: number;
  slug: string;
  title?: string | null;
  name?: string | null;
}

const DEFAULT_LANGUAGE = 'kannada';

const STATIC_ROOT_SEGMENTS = new Set([
  'about', 'auth', 'avatar', 'bycast', 'bycategory', 'bychannel', 'bylanguage',
  'cast', 'category', 'channels', 'commanpages', 'continuewatching', 'details',
  'downloads', 'editprofile', 'genres', 'languages', 'legal', 'login', 'movie',
  'movies', 'myspace', 'notifications', 'pages', 'paymentcancel', 'paymentsuccess',
  'player', 'profile', 'referandearn', 'register', 'related', 'search', 'sections',
  'series', 'settings', 'shorts', 'shows', 'store', 'stream', 'subscription',
  'title', 'tvactivate', 'wallet', 'wallethistory', 'watch', 'watchlist', 'apple-design',
]);

function normalizeTypeSlug(raw: string | null | undefined): string {
  if (!raw) return '';
  const v = raw.toLowerCase().trim();
  if (v === '1' || v === 'movies' || v === 'movie') return 'movie';
  if (v === '2' || v === 'songs' || v === 'albums' || v === 'album' || v === 'music') return 'album';
  if (v === '3' || v === 'short-films' || v === 'short_film' || v === 'shorts' || v === 'short') return 'short_film';
  if (v === '4' || v === 'microdrama' || v === 'micro-drama' || v === 'micro_drama') return 'microdrama';
  if (v === '5' || v === 'podcasts' || v === 'podcast') return 'podcast';
  if (v === '6' || v === 'series' || v === 'web-series' || v === 'shows' || v === 'show') return 'series';
  return v;
}

function NavbarContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pathSegments = useMemo(
    () => (pathname || '').split('/').filter(Boolean).map((s) => decodeURIComponent(s).toLowerCase()),
    [pathname],
  );
  const activeUserPage = getUserScopedPageFromPath(pathname);
  const isUserScopedPath =
    pathSegments.length === 2 && USER_SCOPED_PAGES.has(pathSegments[1]);
  const isLanguageRoute =
    !isUserScopedPath &&
    pathSegments.length >= 1 &&
    pathSegments.length <= 2 &&
    !STATIC_ROOT_SEGMENTS.has(pathSegments[0]);

  const rawTypeParam = searchParams?.get('type') ?? '';
  const activeTypeSlug = useMemo(() => {
    if (isLanguageRoute && pathSegments[1]) return normalizeTypeSlug(pathSegments[1]);
    if (pathname === '/movies') return 'movie';
    if (pathname === '/shows') return 'series';
    return normalizeTypeSlug(rawTypeParam);
  }, [isLanguageRoute, pathSegments, pathname, rawTypeParam]);

  const rawLangParam = (
    (isLanguageRoute ? pathSegments[0] : '') ||
    searchParams?.get('lang') ||
    ''
  )
    .toLowerCase()
    .trim();
  const activeLang = rawLangParam || DEFAULT_LANGUAGE;

  const { isLoggedIn, user, session, logout } = useStoredUser();
  const brand = useBranding();
  const languagesQ = useLanguages();
  const notifsQ = useNotifications(session);
  const readNotifMut = useReadNotification();
  const navNotifications = ((notifsQ.data as any)?.result ?? (notifsQ.data as any)?.data ?? []) as Notification[];
  const unreadNotifCount = navNotifications.filter(
    (n) => Number((n as any).is_read ?? (n as any).read ?? 0) === 0,
  ).length;

  // Fetch Main Content Types dynamically from backend (/api/v1/content-types)
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
      const filtered = list.filter(
        (t: any) =>
          t &&
          t.isActive !== false &&
          t.is_active !== false &&
          (t.slug || t.id) &&
          (t.title || t.name),
      );
      try {
        sessionStorage.removeItem('maxxpixels.nav.contentTypes');
      } catch {}
      return filtered;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const mainTypes = contentTypesQ.data ?? [];

  // Deduplicate backend languages by lowercase name and put Kannada first (default)
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
    const deduped: Language[] = [];
    for (const lang of list) {
      const name = String(lang?.name ?? '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(lang);
    }

    deduped.sort((a, b) => {
      const aKn = String(a.name ?? '').toLowerCase() === DEFAULT_LANGUAGE ? 0 : 1;
      const bKn = String(b.name ?? '').toLowerCase() === DEFAULT_LANGUAGE ? 0 : 1;
      return aKn - bKn;
    });

    return deduped;
  }, [languagesQ.data]);

  const [mounted, setMounted] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedNavQuery, setDebouncedNavQuery] = useState('');

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setDebouncedNavQuery('');
      return;
    }
    const timer = setTimeout(() => setDebouncedNavQuery(trimmed), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const navSearchQ = useQuery<any[]>({
    queryKey: ['navbar-live-search', debouncedNavQuery],
    enabled: searchOpen && debouncedNavQuery.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(debouncedNavQuery)}&size=6`);
      if (!res.ok) return [];
      const json = await res.json();
      const data = json?.data ?? json?.result ?? json;
      if (Array.isArray(data?.content)) return data.content;
      if (Array.isArray(data)) return data;
      return [];
    },
  });
  const navSearchResults = navSearchQ.data ?? [];

  const profileRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Optimistic active tab tracking for instant zero-lag navbar click feedback
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    setOptimisticHref(null);
  }, [pathname, searchParams]);

  // Prefetch all primary navbar destinations as soon as content types or language change
  useEffect(() => {
    const cleanLang = (activeLang || DEFAULT_LANGUAGE).toLowerCase().trim();
    const homeHref = cleanLang === DEFAULT_LANGUAGE ? '/' : `/${encodeURIComponent(cleanLang)}`;
    router.prefetch(homeHref);
    for (const ct of mainTypes) {
      const slug = normalizeTypeSlug(ct.slug);
      if (slug) {
        router.prefetch(`/${encodeURIComponent(cleanLang)}/${encodeURIComponent(slug)}`);
      }
    }
  }, [activeLang, mainTypes, router]);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.image]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setProfileOpen(false);
    setLangOpen(false);
    setMoreOpen(false);
    setNotifOpen(false);
    setMobileMenuOpen(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
      if (langRef.current && !langRef.current.contains(target)) setLangOpen(false);
      if (moreRef.current && !moreRef.current.contains(target)) setMoreOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
      if (searchWrapRef.current && !searchWrapRef.current.contains(target) && !searchQuery.trim()) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchQuery]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 40);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setProfileOpen(false);
        setLangOpen(false);
        setMoreOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
    setSearchOpen(false);
  };

  // Build clean SEO URL: /<language>/<contentType> (or /<language> / / for Home)
  const buildBrowseUrl = (langParam: string, typeSlug?: string) => {
    const cleanLang = (langParam || DEFAULT_LANGUAGE).toLowerCase().trim();
    if (typeSlug) {
      return `/${encodeURIComponent(cleanLang)}/${encodeURIComponent(typeSlug)}`;
    }
    return cleanLang === DEFAULT_LANGUAGE ? '/' : `/${encodeURIComponent(cleanLang)}`;
  };

  const selectedLanguageLabel = useMemo(() => {
    if (activeLang === 'all-indian' || activeLang === 'all') return 'All Indian';
    const match = apiLanguages.find(
      (l) =>
        String(l.name ?? '').toLowerCase() === activeLang ||
        String((l as any).code ?? '').toLowerCase() === activeLang,
    );
    return match?.name ?? activeLang.charAt(0).toUpperCase() + activeLang.slice(1);
  }, [activeLang, apiLanguages]);

  const isAuth = mounted && isLoggedIn;
  const isVip = isAuth && user?.is_buy === 1;
  const userInitial = (user?.full_name || user?.email || 'U').trim().charAt(0).toUpperCase();
  const showAvatarPhoto = Boolean(user?.image && !avatarError);

  // Split backend main types: first 5 inline, remaining in "More" dropdown so navbar stays crisp
  const primaryMainTypes = mainTypes.slice(0, 5);
  const overflowMainTypes = mainTypes.slice(5);
  const isOverflowActive = overflowMainTypes.some(
    (ct) => normalizeTypeSlug(ct.slug) === activeTypeSlug,
  );

  const isHomeActive =
    ((pathname === '/' || pathname === '') || (isLanguageRoute && pathSegments.length === 1)) &&
    !activeTypeSlug;

  return (
    <>
      {/* ===================================================================== */}
      {/* AHA-STYLE HORIZONTAL TOP NAVBAR (LANGUAGE-FIRST + DYNAMIC MAIN TYPES) */}
      {/* ===================================================================== */}
      <header
        className={clsx(
          'fixed left-0 right-0 top-0 z-50 transition-all duration-300',
          scrolled
            ? 'border-b border-white/[0.07] bg-[#0A0A0A]/95 shadow-[0_10px_34px_rgba(0,0,0,0.85)] backdrop-blur-2xl'
            : 'bg-gradient-to-b from-black/95 via-black/75 to-transparent',
        )}
      >
        <div className="mx-auto flex h-[54px] max-w-[1680px] items-center justify-between gap-2 px-3.5 sm:h-[66px] sm:gap-4 sm:px-6 lg:h-[72px] lg:px-12">
          {/* LEFT: TABLET MENU DRAWER TRIGGER + BRAND LOGO + DESKTOP NAVIGATION */}
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-4 lg:gap-8 xl:gap-9">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-white/90 backdrop-blur-md transition hover:bg-white/15 active:scale-95 sm:flex lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu size={18} />
            </button>

            <Link
              href={buildBrowseUrl(activeLang)}
              className="flex h-9 min-w-[96px] flex-shrink-0 items-center gap-2 transition-transform duration-200 hover:scale-[1.02] focus:outline-none sm:h-11 sm:min-w-[124px]"
              aria-label={brand.name}
            >
              {brand.logoUrl && !logoError ? (
                <img
                  src={brand.logoUrl}
                  alt={brand.name}
                  className="h-9 max-w-[144px] object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:h-11 sm:max-w-[200px]"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span className="text-lg font-black tracking-tight text-white sm:text-2xl">
                  {brand.name}
                </span>
              )}
            </Link>

            <nav className="hidden items-center gap-5 lg:flex xl:gap-7" aria-label="Primary Navigation">
              {(() => {
                const homeUrl = buildBrowseUrl(activeLang);
                const homeActive = optimisticHref ? optimisticHref === homeUrl : isHomeActive;
                return (
                  <Link
                    href={homeUrl}
                    prefetch={true}
                    onClick={() => setOptimisticHref(homeUrl)}
                    className={clsx(
                      'relative whitespace-nowrap py-2 text-[14px] font-semibold tracking-[0.01em] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] transition-colors duration-150',
                      homeActive ? 'text-white' : 'text-white/75 hover:text-white',
                    )}
                  >
                    Home
                    {homeActive && (
                      <motion.span
                        layoutId="navbar-active-underline"
                        transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 0.7 }}
                        className="pointer-events-none absolute -bottom-0.5 left-0 right-0 h-[2.5px] rounded-full bg-[#FF6D2E] shadow-[0_0_10px_rgba(255,109,46,0.85)]"
                      />
                    )}
                  </Link>
                );
              })()}

              {primaryMainTypes.map((ct) => {
                const slug = normalizeTypeSlug(ct.slug);
                const label = ct.title || ct.name || ct.slug;
                const itemUrl = buildBrowseUrl(activeLang, slug);
                const active = optimisticHref
                  ? optimisticHref === itemUrl
                  : activeTypeSlug === slug;
                return (
                  <Link
                    key={ct.id ?? ct.slug}
                    href={itemUrl}
                    prefetch={true}
                    onClick={() => setOptimisticHref(itemUrl)}
                    className={clsx(
                      'relative whitespace-nowrap py-2 text-[14px] font-semibold tracking-[0.01em] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] transition-colors duration-150',
                      active ? 'text-white' : 'text-white/75 hover:text-white',
                    )}
                  >
                    {label}
                    {active && (
                      <motion.span
                        layoutId="navbar-active-underline"
                        transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 0.7 }}
                        className="pointer-events-none absolute -bottom-0.5 left-0 right-0 h-[2.5px] rounded-full bg-[#FF6D2E] shadow-[0_0_10px_rgba(255,109,46,0.85)]"
                      />
                    )}
                  </Link>
                );
              })}

              {overflowMainTypes.length > 0 && (
                <div className="relative" ref={moreRef}>
                  <button
                    type="button"
                    onClick={() => setMoreOpen((o) => !o)}
                    className={clsx(
                      'relative inline-flex items-center gap-1 whitespace-nowrap py-2 text-[14px] font-semibold tracking-[0.01em] drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] transition-colors duration-150',
                      isOverflowActive ? 'text-white' : 'text-white/75 hover:text-white',
                    )}
                  >
                    <span>More</span>
                    <ChevronDown
                      size={14}
                      className={clsx('transition-transform', moreOpen && 'rotate-180')}
                    />
                    {isOverflowActive && !optimisticHref && (
                      <motion.span
                        layoutId="navbar-active-underline"
                        transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 0.7 }}
                        className="pointer-events-none absolute -bottom-0.5 left-0 right-0 h-[2.5px] rounded-full bg-[#FF6D2E] shadow-[0_0_10px_rgba(255,109,46,0.85)]"
                      />
                    )}
                  </button>

                  <AnimatePresence>
                    {moreOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute left-0 top-full z-50 mt-3 w-52 rounded-xl border border-white/12 bg-[#161920]/95 p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.92)] backdrop-blur-2xl"
                      >
                        {overflowMainTypes.map((ct) => {
                          const slug = normalizeTypeSlug(ct.slug);
                          const label = ct.title || ct.name || ct.slug;
                          const itemUrl = buildBrowseUrl(activeLang, slug);
                          const active = optimisticHref
                            ? optimisticHref === itemUrl
                            : activeTypeSlug === slug;
                          return (
                            <Link
                              key={ct.id ?? ct.slug}
                              href={itemUrl}
                              prefetch={true}
                              onClick={() => {
                                setOptimisticHref(itemUrl);
                                setMoreOpen(false);
                              }}
                              className={clsx(
                                'flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition',
                                active
                                  ? 'bg-[#FF6D2E] text-white'
                                  : 'text-white/80 hover:bg-white/[0.08] hover:text-white',
                              )}
                            >
                              <span>{label}</span>
                              {active && <Check size={13} />}
                            </Link>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </nav>
          </div>

          {/* RIGHT: SEARCH (sm+) + LANGUAGE SELECTOR + SUBSCRIBE (sm+) + BELL + PROFILE */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            {/* Expandable Search (sm+; mobile uses bottom nav Search tab to avoid top bar clutter) */}
            <div ref={searchWrapRef} className="relative hidden sm:flex items-center">
              {searchOpen ? (
                <div className="relative">
                  <form
                    onSubmit={handleSearchSubmit}
                    className="flex w-56 items-center rounded-full border border-[#FF6D2E]/70 bg-[#1A1D24] px-3.5 py-1.5 shadow-lg lg:w-72"
                  >
                    <Search size={15} className="shrink-0 text-[#FF6D2E]" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search movies, series..."
                      className="w-full bg-transparent px-2.5 text-xs font-medium text-white placeholder-zinc-400 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setDebouncedNavQuery('');
                        setSearchOpen(false);
                      }}
                      className="text-zinc-400 hover:text-white"
                      aria-label="Close search"
                    >
                      <X size={14} />
                    </button>
                  </form>

                  {/* Debounced Live Search Results Dropdown */}
                  {debouncedNavQuery.length >= 2 && (
                    <div className="absolute right-0 top-full z-50 mt-2.5 w-80 overflow-hidden rounded-2xl border border-white/15 bg-[#1A1D24] shadow-[0_24px_60px_rgba(0,0,0,0.92)] ring-1 ring-black/60">
                      {navSearchQ.isFetching ? (
                        <div className="px-4 py-5 text-center text-xs text-zinc-400">
                          Searching…
                        </div>
                      ) : navSearchResults.length === 0 ? (
                        <div className="px-4 py-5 text-center text-xs text-zinc-400">
                          No titles found for &ldquo;{debouncedNavQuery}&rdquo;
                        </div>
                      ) : (
                        <div className="divide-y divide-white/[0.06]">
                          {navSearchResults.slice(0, 6).map((item: any, idx: number) => {
                            const thumb = resolveImageUrl(
                              item.posterUrl || item.thumbnail || item.bannerUrl || item.landscapeImageUrl,
                            );
                            return (
                              <Link
                                key={item.id ?? idx}
                                href={getContentUrl(item)}
                                onClick={() => {
                                  setSearchOpen(false);
                                  setSearchQuery('');
                                  setDebouncedNavQuery('');
                                }}
                                className="flex items-center gap-3 px-3.5 py-2.5 transition hover:bg-white/[0.06]"
                              >
                                <div className="h-11 w-8 shrink-0 overflow-hidden rounded-md bg-[#14161A]">
                                  {thumb ? (
                                    <img
                                      src={thumb}
                                      alt={item.title || item.name || ''}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="grid h-full w-full place-items-center text-zinc-500">
                                      <Film size={13} />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-bold text-white">
                                    {item.title || item.name}
                                  </p>
                                  <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                                    {item.contentType || item.type || 'Title'}
                                    {item.releaseYear ? ` · ${item.releaseYear}` : ''}
                                  </p>
                                </div>
                              </Link>
                            );
                          })}
                          <Link
                            href={`/search?q=${encodeURIComponent(debouncedNavQuery)}`}
                            onClick={() => setSearchOpen(false)}
                            className="block bg-[#14161A]/80 px-4 py-2.5 text-center text-xs font-bold text-[#FF8A54] transition hover:bg-[#FF6D2E]/15"
                          >
                            View all results for &ldquo;{debouncedNavQuery}&rdquo; →
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(true);
                    setTimeout(() => searchInputRef.current?.focus(), 40);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white/85 drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)] transition-colors duration-200 hover:bg-white/10 hover:text-white"
                  aria-label="Search"
                >
                  <Search size={19} />
                </button>
              )}
            </div>

            {/* Language Selector (Minimal Subtle Pill) */}
            <div className="relative" ref={langRef}>
              <button
                type="button"
                onClick={() => setLangOpen((o) => !o)}
                className="flex h-8 items-center gap-1 rounded-full bg-white/[0.08] px-2.5 text-[11px] font-semibold text-white/95 backdrop-blur-md transition-colors duration-200 hover:bg-white/[0.15] sm:h-9 sm:gap-1.5 sm:px-3 sm:text-xs"
                aria-expanded={langOpen}
              >
                <Globe size={13} className="text-[#FF6D2E]" />
                <span className="max-w-[68px] truncate sm:max-w-[92px]">{selectedLanguageLabel}</span>
                <ChevronDown
                  size={11}
                  className={clsx('text-white/70 transition-transform', langOpen && 'rotate-180')}
                />
              </button>

              <AnimatePresence>
                {langOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute right-0 top-full z-50 mt-2.5 w-56 rounded-xl border border-white/[0.12] bg-[#141414]/95 p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.92)] backdrop-blur-2xl"
                  >
                    <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                      Select Language
                    </p>
                    <div className="max-h-72 space-y-0.5 overflow-y-auto">
                      {apiLanguages.map((lang) => {
                        const slug = String(lang.name ?? '').toLowerCase().trim();
                        const active = activeLang === slug;
                        return (
                          <Link
                            key={lang.id ?? slug}
                            href={buildBrowseUrl(slug, activeTypeSlug || undefined)}
                            onClick={() => setLangOpen(false)}
                            className={clsx(
                              'flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium transition',
                              active
                                ? 'bg-[#FF6D2E] font-semibold text-white'
                                : 'text-white/80 hover:bg-white/[0.07] hover:text-white',
                            )}
                          >
                            <span>{lang.name}</span>
                            {active && <Check size={13} />}
                          </Link>
                        );
                      })}
                      <div className="my-1 border-t border-white/10" />
                      <Link
                        href={buildBrowseUrl('all-indian', activeTypeSlug || undefined)}
                        onClick={() => setLangOpen(false)}
                        className={clsx(
                          'flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-semibold transition',
                          activeLang === 'all-indian'
                            ? 'bg-[#FF6D2E] text-white'
                            : 'text-white/80 hover:bg-white/[0.07] hover:text-white',
                        )}
                      >
                        <span>All Indian (Excl. Kannada)</span>
                        {activeLang === 'all-indian' && <Check size={13} />}
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Signature Theme Orange Subscribe Pill (sm+; mobile uses bottom nav VIP tab) */}
            <Link
              href={userPageHref(user, 'subscription')}
              className={clsx(
                'hidden h-9 items-center gap-1.5 rounded-full px-4 text-xs font-bold tracking-wide transition-all duration-200 sm:inline-flex',
                mounted && isVip
                  ? 'border border-[#FF6D2E]/50 bg-[#FF6D2E]/15 text-[#FF8C5A] backdrop-blur-md hover:bg-[#FF6D2E]/25'
                  : 'bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] text-white shadow-[0_4px_18px_rgba(255,109,46,0.45)] hover:scale-[1.03] hover:brightness-110 active:scale-[0.98]',
              )}
            >
              <Crown size={12} fill="currentColor" />
              <span>{mounted && isVip ? 'VIP Active' : 'Subscribe'}</span>
            </Link>

            {/* Netflix-Style Notifications Bell Popover */}
            {isAuth && (
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => setNotifOpen((o) => !o)}
                  className="relative flex h-8 w-8 items-center justify-center rounded-full text-white/85 drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)] transition-colors duration-200 hover:bg-white/10 hover:text-white sm:h-9 sm:w-9"
                  aria-label="Notifications"
                  aria-expanded={notifOpen}
                >
                  <Bell size={17} />
                  {unreadNotifCount > 0 && (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#FF6D2E] ring-2 ring-[#0A0A0A]" />
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-full z-50 mt-3 w-[310px] overflow-hidden rounded-xl border border-white/[0.12] border-t-2 border-t-[#FF6D2E] bg-[#141414]/95 shadow-[0_24px_64px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:w-[390px]">
                    <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-300">
                        Notifications
                      </span>
                      {unreadNotifCount > 0 && (
                        <span className="rounded bg-[#FF6D2E]/15 px-2 py-0.5 text-[10px] font-bold text-[#FF8A54]">
                          {unreadNotifCount} new
                        </span>
                      )}
                    </div>

                    {navNotifications.length === 0 ? (
                      <div className="px-6 py-10 text-center">
                        <Bell size={24} className="mx-auto mb-2.5 text-zinc-600" />
                        <p className="text-xs font-semibold text-zinc-300">No recent notifications</p>
                        <p className="mt-1 text-[11px] text-zinc-500">
                          New releases &amp; reminders will appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-[380px] divide-y divide-white/[0.08] overflow-y-auto">
                        {navNotifications.slice(0, 6).map((n) => {
                          const href = n.video_id
                            ? getContentUrl({
                                id: n.video_id,
                                video_id: n.video_id,
                                video_type: n.video_type,
                                name: (n as any).title,
                              })
                            : userPageHref(user, 'notifications');
                          const isUnread = Number((n as any).is_read ?? (n as any).read ?? 0) === 0;
                          return (
                            <Link
                              key={n.id}
                              href={href}
                              onClick={() => {
                                if (user?.id) {
                                  readNotifMut.mutate({ user_id: user.id, notification_id: n.id });
                                }
                                setNotifOpen(false);
                              }}
                              className="flex items-start gap-3.5 px-4 py-3.5 transition-colors hover:bg-white/[0.06]"
                            >
                              {n.image ? (
                                <img
                                  src={resolveImageUrl(n.image)}
                                  alt=""
                                  className="h-14 w-24 shrink-0 rounded-md bg-[#0A0A0A] object-cover"
                                />
                              ) : (
                                <div className="grid h-14 w-24 shrink-0 place-items-center rounded-md bg-white/[0.05] text-[#FF8A54]">
                                  <Bell size={18} />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  {isUnread && (
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6D2E]" />
                                  )}
                                  <p className="truncate text-xs font-bold text-white">{n.title}</p>
                                </div>
                                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-400">
                                  {n.message}
                                </p>
                                {n.created_at && (
                                  <p className="mt-1 text-[10px] text-zinc-500">{n.created_at}</p>
                                )}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}

                    <Link
                      href={userPageHref(user, 'notifications')}
                      onClick={() => setNotifOpen(false)}
                      className="block border-t border-white/[0.08] py-2.5 text-center text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      View all notifications
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Clean Circular Avatar / Sign In */}
            {isAuth ? (
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((o) => !o)}
                  className="flex items-center gap-1 rounded-full p-0.5 transition-all duration-200 hover:ring-2 hover:ring-[#FF6D2E]/80"
                  aria-label="Account menu"
                >
                  {showAvatarPhoto ? (
                    <img
                      src={avatarUrl(user?.image)}
                      alt={user?.full_name ?? 'Profile'}
                      onError={() => setAvatarError(true)}
                      className="h-7 w-7 rounded-full object-cover sm:h-8 sm:w-8"
                    />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#FF6D2E] to-[#FF5500] text-xs font-black text-white sm:h-8 sm:w-8">
                      {userInitial}
                    </span>
                  )}
                  <ChevronDown
                    size={12}
                    className={clsx('hidden text-white/60 transition-transform sm:block', profileOpen && 'rotate-180')}
                  />
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-xl border border-white/[0.12] bg-[#141414]/95 shadow-[0_24px_64px_rgba(0,0,0,0.95)] backdrop-blur-2xl"
                    >
                      {/* User Identity Header */}
                      <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3.5">
                        {showAvatarPhoto ? (
                          <img
                            src={avatarUrl(user?.image)}
                            alt={user?.full_name ?? 'Profile'}
                            onError={() => setAvatarError(true)}
                            className="h-9 w-9 shrink-0 rounded-md object-cover ring-1 ring-white/15"
                          />
                        ) : (
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-gradient-to-br from-[#FF6D2E] to-[#FF5500] text-sm font-black text-white">
                            {userInitial}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-bold text-white">
                              {user?.full_name || 'Member'}
                            </p>
                            {isVip && (
                              <span className="shrink-0 rounded bg-[#FF6D2E]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#FF8A54]">
                                VIP
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-zinc-400">
                            {user?.email || user?.mobile_number || ''}
                          </p>
                        </div>
                      </div>

                      {/* Clean Netflix-Style Menu Rows */}
                      <div className="py-1.5">
                        <Link
                          href={userPageHref(user, 'myspace')}
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-zinc-200 transition hover:bg-white/[0.07] hover:text-white"
                        >
                          <Bookmark size={16} className="shrink-0 text-zinc-400" />
                          <span>My Space &amp; Watchlist</span>
                        </Link>
                        <Link
                          href={userPageHref(user, 'subscription')}
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-zinc-200 transition hover:bg-white/[0.07] hover:text-white"
                        >
                          <Crown size={16} className="shrink-0 text-[#FF8A54]" />
                          <span>Membership</span>
                        </Link>
                      </div>

                      {/* Centered Netflix-Style Sign Out Footer */}
                      <div className="border-t border-white/[0.08]">
                        <button
                          type="button"
                          onClick={() => {
                            logout();
                            setProfileOpen(false);
                            router.replace('/login');
                          }}
                          className="flex w-full items-center justify-center gap-2 px-4 py-3 text-[13px] font-semibold text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                        >
                          <LogOut size={14} />
                          <span>Sign out of {brand.shortName || brand.name}</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-8 items-center gap-1 rounded-full border border-white/20 bg-white/[0.07] px-3 text-[11px] font-bold text-white transition hover:border-white/40 hover:bg-white/15 sm:h-9 sm:gap-1.5 sm:px-4 sm:text-xs"
              >
                <User size={12} />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>

        {/* MOBILE & TABLET NETFLIX-STYLE FROSTED CATEGORY PILL CHIPS (<1024px) */}
        <div className="lg:hidden">
          <nav
            className="mx-auto flex max-w-[1680px] items-center gap-1.5 overflow-x-auto px-3.5 pb-2 pt-0.5 scrollbar-hide sm:gap-2 sm:px-6"
            aria-label="Mobile Category Pills"
          >
            {(() => {
              const homeUrl = buildBrowseUrl(activeLang);
              const homeActive = optimisticHref ? optimisticHref === homeUrl : isHomeActive;
              return (
                <Link
                  href={homeUrl}
                  prefetch={true}
                  onClick={() => setOptimisticHref(homeUrl)}
                  className={clsx(
                    'relative shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[11.5px] font-bold tracking-wide transition-all duration-200 active:scale-95 sm:px-3.5 sm:py-1.5 sm:text-xs',
                    homeActive
                      ? 'bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] text-white shadow-[0_4px_14px_rgba(255,109,46,0.45)]'
                      : 'border border-white/[0.1] bg-[#141414]/85 text-white/75 backdrop-blur-md hover:border-white/25 hover:text-white',
                  )}
                >
                  All
                </Link>
              );
            })()}

            {mainTypes.map((ct) => {
              const slug = normalizeTypeSlug(ct.slug);
              const label = ct.title || ct.name || ct.slug;
              const itemUrl = buildBrowseUrl(activeLang, slug);
              const active = optimisticHref
                ? optimisticHref === itemUrl
                : activeTypeSlug === slug;
              return (
                <Link
                  key={`mob-pill-${ct.id ?? ct.slug}`}
                  href={itemUrl}
                  prefetch={true}
                  onClick={() => setOptimisticHref(itemUrl)}
                  className={clsx(
                    'relative shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[11.5px] font-bold tracking-wide transition-all duration-200 active:scale-95 sm:px-3.5 sm:py-1.5 sm:text-xs',
                    active
                      ? 'bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] text-white shadow-[0_4px_14px_rgba(255,109,46,0.45)]'
                      : 'border border-white/[0.1] bg-[#141414]/85 text-white/75 backdrop-blur-md hover:border-white/25 hover:text-white',
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* MOBILE SLIDE-OUT FULL MENU DRAWER (ALL CATEGORIES, LANGUAGES & VIP)   */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 38 }}
              className="fixed bottom-0 left-0 top-0 z-[80] flex w-[285px] max-w-[84vw] flex-col border-r border-white/[0.1] bg-[#0A0A0A] shadow-[20px_0_60px_rgba(0,0,0,0.95)] lg:hidden"
              aria-label="Mobile Menu Drawer"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-4">
                <Link
                  href={buildBrowseUrl(activeLang)}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2"
                >
                  {brand.logoUrl && !logoError ? (
                    <img
                      src={brand.logoUrl}
                      alt={brand.name}
                      className="h-8 max-w-[140px] object-contain"
                    />
                  ) : (
                    <span className="text-lg font-black text-white">{brand.name}</span>
                  )}
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.07] text-white/80 transition hover:bg-white/15 hover:text-white"
                  aria-label="Close menu"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Scrollable Categories */}
              <div className="flex-1 overflow-y-auto px-3 py-4">
                <p className="px-2.5 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                  Browse Categories
                </p>
                <div className="space-y-1">
                  {(() => {
                    const homeUrl = buildBrowseUrl(activeLang);
                    const homeActive = optimisticHref ? optimisticHref === homeUrl : isHomeActive;
                    return (
                      <Link
                        href={homeUrl}
                        onClick={() => {
                          setOptimisticHref(homeUrl);
                          setMobileMenuOpen(false);
                        }}
                        className={clsx(
                          'flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-bold transition',
                          homeActive
                            ? 'bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] text-white shadow-[0_4px_16px_rgba(255,109,46,0.35)]'
                            : 'text-white/80 hover:bg-white/[0.06] hover:text-white',
                        )}
                      >
                        <span>Home</span>
                        <ChevronRight size={15} className={homeActive ? 'text-white' : 'text-white/35'} />
                      </Link>
                    );
                  })()}

                  {mainTypes.map((ct) => {
                    const slug = normalizeTypeSlug(ct.slug);
                    const label = ct.title || ct.name || ct.slug;
                    const itemUrl = buildBrowseUrl(activeLang, slug);
                    const active = optimisticHref
                      ? optimisticHref === itemUrl
                      : activeTypeSlug === slug;
                    return (
                      <Link
                        key={`drawer-${ct.id ?? ct.slug}`}
                        href={itemUrl}
                        onClick={() => {
                          setOptimisticHref(itemUrl);
                          setMobileMenuOpen(false);
                        }}
                        className={clsx(
                          'flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-bold transition',
                          active
                            ? 'bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] text-white shadow-[0_4px_16px_rgba(255,109,46,0.35)]'
                            : 'text-white/80 hover:bg-white/[0.06] hover:text-white',
                        )}
                      >
                        <span>{label}</span>
                        <ChevronRight size={15} className={active ? 'text-white' : 'text-white/35'} />
                      </Link>
                    );
                  })}
                </div>

                {/* Quick Account Links inside Drawer */}
                <div className="mt-6 border-t border-white/[0.08] pt-4">
                  <p className="px-2.5 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                    Account &amp; Membership
                  </p>
                  <div className="space-y-1">
                    <Link
                      href={userPageHref(user, 'subscription')}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#FF8A54] transition hover:bg-white/[0.06]"
                    >
                      <Crown size={16} />
                      <span>{mounted && isVip ? 'VIP Membership Active' : 'Subscribe to VIP'}</span>
                    </Link>
                    <Link
                      href={userPageHref(user, 'myspace')}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      <Bookmark size={16} className="text-zinc-400" />
                      <span>My Space &amp; Watchlist</span>
                    </Link>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* MOBILE BOTTOM APP BAR (HOME, SEARCH, VIP, MENU DRAWER) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-[#0A0A0A]/95 backdrop-blur-2xl lg:hidden"
        aria-label="Mobile Bottom Navigation"
      >
        <div className="grid h-16 grid-cols-4 items-center">
          <Link
            href={buildBrowseUrl(activeLang)}
            className={clsx(
              'flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition',
              isHomeActive && !mobileMenuOpen ? 'text-[#FF6D2E]' : 'text-white/55',
            )}
          >
            <Home size={19} strokeWidth={isHomeActive && !mobileMenuOpen ? 2.4 : 1.8} />
            <span>Home</span>
          </Link>

          <Link
            href="/search"
            className={clsx(
              'flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition',
              pathname === '/search' ? 'text-[#FF6D2E]' : 'text-white/55',
            )}
          >
            <Search size={19} strokeWidth={pathname === '/search' ? 2.4 : 1.8} />
            <span>Search</span>
          </Link>

          <Link
            href={userPageHref(user, 'subscription')}
            className={clsx(
              'flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition',
              pathname?.includes('subscription') ? 'text-[#FF6D2E]' : 'text-white/55',
            )}
          >
            <Crown size={19} strokeWidth={pathname?.includes('subscription') ? 2.4 : 1.8} />
            <span>{mounted && isVip ? 'VIP' : 'Subscribe'}</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className={clsx(
              'flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition',
              mobileMenuOpen ? 'text-[#FF6D2E]' : 'text-white/55',
            )}
          >
            <Menu size={19} strokeWidth={mobileMenuOpen ? 2.4 : 1.8} />
            <span>Categories</span>
          </button>
        </div>
      </nav>
    </>
  );
}

export default function Navbar() {
  return (
    <Suspense
      fallback={
        <header className="fixed left-0 right-0 top-0 z-50 h-[72px] bg-gradient-to-b from-black/90 via-black/45 to-transparent" />
      }
    >
      <NavbarContent />
    </Suspense>
  );
}
