'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  Clock,
  Crown,
  Film,
  Globe,
  Home,
  LogOut,
  Menu,
  Mic,
  Music,
  Search,
  Settings,
  Smartphone,
  Sparkles,
  Tv,
  User,
  Video,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useStoredUser } from '@/lib/auth';
import { avatarUrl } from '@ott/shared';
import { useBranding } from '@/hooks/useBranding';

interface LanguageOption {
  name: string;
  native: string;
  code: string;
  param: string;
}

const INDIAN_LANGUAGES: LanguageOption[] = [
  { name: 'Kannada', native: 'ಕನ್ನಡ', code: 'kn', param: 'kannada' },
  { name: 'Telugu', native: 'తెలుగు', code: 'te', param: 'telugu' },
  { name: 'Tamil', native: 'தமிழ்', code: 'ta', param: 'tamil' },
  { name: 'Malayalam', native: 'മലയാളം', code: 'ml', param: 'malayalam' },
  { name: 'Hindi', native: 'हिंदी', code: 'hi', param: 'hindi' },
  { name: 'Bengali', native: 'বাংলা', code: 'bn', param: 'bengali' },
  { name: 'Marathi', native: 'मराठी', code: 'mr', param: 'marathi' },
  { name: 'Gujarati', native: 'ગુજરાતી', code: 'gu', param: 'gujarati' },
  { name: 'Punjabi', native: 'ਪੰਜਾਬੀ', code: 'pa', param: 'punjabi' },
  { name: 'Odia', native: 'ଓଡ଼ିଆ', code: 'or', param: 'odia' },
];

const MAIN_TYPES = [
  { label: 'All', icon: Home, typeId: 0 },
  { label: 'Movies', icon: Film, typeId: 1 },
  { label: 'Series', icon: Tv, typeId: 6 },
  { label: 'Shorts', icon: Video, typeId: 3 },
  { label: 'Micro-Drama', icon: Smartphone, typeId: 4 },
  { label: 'Songs', icon: Music, typeId: 2 },
  { label: 'Podcasts', icon: Mic, typeId: 5 },
  { label: 'AI Cinema', icon: Sparkles, typeId: 7 },
];

function NavbarContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentTypeId = Number(searchParams?.get('type') ?? 0);
  const currentLang = searchParams?.get('lang') ?? '';
  const isAllIndianPortal =
    currentLang === 'all-indian' ||
    currentLang === 'all_indian' ||
    (currentLang !== '' && currentLang !== 'kannada');

  const { isLoggedIn, user, logout } = useStoredUser();
  const brand = useBranding();

  const [mounted, setMounted] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 15);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menus on route changes
  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
    setLangOpen(false);
  }, [pathname, searchParams]);

  // Click outside listener
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        searchInputRef.current?.blur();
        setSearchFocused(false);
        setProfileOpen(false);
        setLangOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/search');
    }
  };

  /** Helper to construct URLs while preserving current language context seamlessly */
  const buildTypeUrl = (typeId: number) => {
    const params = new URLSearchParams();
    if (currentLang && currentLang !== 'kannada') {
      params.set('lang', currentLang);
    } else if (currentLang === 'kannada' || (!isAllIndianPortal && currentLang)) {
      params.set('lang', 'kannada');
    } else if (isAllIndianPortal) {
      params.set('lang', 'all-indian');
    }

    if (typeId === 1) {
      const qs = params.toString();
      return qs ? `/movies?${qs}` : '/movies';
    }
    if (typeId === 6) {
      const qs = params.toString();
      return qs ? `/shows?${qs}` : '/shows';
    }
    if (typeId > 0) {
      params.set('type', String(typeId));
    }
    const query = params.toString();
    return query ? `/?${query}` : '/';
  };

  /** Helper to construct language URLs while preserving current main type filter */
  const buildLangUrl = (langParam: string) => {
    const params = new URLSearchParams();
    if (langParam === 'all-indian') {
      params.set('lang', 'all-indian');
    } else if (langParam && langParam !== 'kannada') {
      params.set('lang', langParam);
    } else if (langParam === 'kannada') {
      params.set('lang', 'kannada');
    }

    let basePath = '/';
    if (pathname === '/movies' || (currentTypeId === 1 && pathname !== '/shows')) {
      basePath = '/movies';
    } else if (pathname === '/shows' || (currentTypeId === 6 && pathname !== '/movies')) {
      basePath = '/shows';
    } else if (currentTypeId > 0) {
      params.set('type', String(currentTypeId));
    }

    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const isTypeActive = (typeId: number) => {
    if (typeId === 0) {
      return (pathname === '/' || pathname === '') && (!currentTypeId || currentTypeId === 0);
    }
    if (typeId === 1) {
      return pathname === '/movies' || pathname === '/movie' || (pathname === '/' && currentTypeId === 1);
    }
    if (typeId === 6) {
      return pathname === '/shows' || pathname === '/series' || (pathname === '/' && currentTypeId === 6);
    }
    if (pathname !== '/' && pathname !== '') return false;
    return currentTypeId === typeId;
  };

  const selectedLanguageLabel = useMemo(() => {
    if (currentLang === 'kannada') return 'Kannada';
    if (currentLang === 'all-indian' || currentLang === 'all') return 'All Indian';
    if (currentLang) {
      const found = INDIAN_LANGUAGES.find(
        (l) => l.param.toLowerCase() === currentLang.toLowerCase(),
      );
      return found ? found.name : currentLang.charAt(0).toUpperCase() + currentLang.slice(1);
    }
    return isAllIndianPortal ? 'All Indian' : 'Languages';
  }, [currentLang, isAllIndianPortal]);

  const isAuth = mounted && isLoggedIn;
  const premiumCta = !mounted ? null : !isLoggedIn ? 'VIP Upgrade' : user?.is_buy !== 1 ? 'Upgrade VIP' : 'VIP 4K';

  return (
    <header
      className={clsx(
        'fixed left-0 right-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-white/[0.08] bg-[#07080B]/95 shadow-[0_12px_45px_rgba(0,0,0,0.9)] backdrop-blur-2xl'
          : 'border-b border-transparent bg-gradient-to-b from-[#07080B]/95 via-[#07080B]/70 to-transparent',
      )}
    >
      {/* Glow highlight line on top border */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#E50914]/40 to-transparent opacity-80" />

      <div className="mx-auto flex h-[66px] max-w-[1760px] items-center justify-between px-3.5 sm:px-6 lg:px-8">
        
        {/* ========================================================================= */}
        {/* LEFT SECTION: BRAND + PORTAL SWITCHER + ALL MAIN TYPES + LANGUAGE SELECTOR */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-2.5 lg:gap-4 xl:gap-6 min-w-0">
          
          {/* BRAND LOGO */}
          <Link
            href="/"
            className="group flex-shrink-0 flex items-center gap-2 transition-transform duration-200 hover:scale-[1.02] focus:outline-none"
            aria-label="MaxxPixels Home"
          >
            {brand.logoUrl && !logoError ? (
              <img
                src={brand.logoUrl}
                alt={brand.name}
                className="h-8 max-w-[125px] object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
                onError={() => setLogoError(true)}
              />
            ) : (
              <span className="flex items-center font-display text-lg font-black tracking-tight text-white sm:text-2xl">
                <span className="tracking-tighter">MAXX</span>
                <span className="text-[#E50914] drop-shadow-[0_0_16px_rgba(229,9,20,0.9)]">PIXELS</span>
                <span className="ml-1.5 rounded-md border border-[#E50914]/50 bg-gradient-to-r from-[#E50914]/25 to-red-950/40 px-1.5 py-0.5 text-[9px] font-black uppercase text-[#FF5A60] shadow-[0_0_10px_rgba(229,9,20,0.35)]">
                  4K
                </span>
              </span>
            )}
          </Link>

          {/* DUAL PORTAL SEGMENTED CONTROLLER (Kannada Hub vs All Indian Hub) */}
          <div className="hidden items-center rounded-full border border-white/12 bg-white/[0.04] p-0.5 shadow-inner backdrop-blur-md lg:flex flex-shrink-0">
            <Link
              href={buildLangUrl('kannada')}
              className={clsx(
                'flex items-center gap-1.5 rounded-full px-2.5 xl:px-3 py-1 text-[11.5px] font-extrabold transition-all duration-200',
                !isAllIndianPortal
                  ? 'bg-gradient-to-r from-[#E50914] to-[#C10711] text-white shadow-[0_0_16px_rgba(229,9,20,0.6)]'
                  : 'text-white/60 hover:text-white',
              )}
            >
              <Film size={12} strokeWidth={2.5} />
              <span>Kannada</span>
            </Link>

            <Link
              href={buildLangUrl('all-indian')}
              className={clsx(
                'flex items-center gap-1.5 rounded-full px-2.5 xl:px-3 py-1 text-[11.5px] font-extrabold transition-all duration-200',
                isAllIndianPortal
                  ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-black font-black shadow-[0_0_16px_rgba(245,158,11,0.6)]'
                  : 'text-white/60 hover:text-amber-400',
              )}
            >
              <Globe size={12} strokeWidth={2.5} />
              <span>All Indian</span>
            </Link>
          </div>

          {/* DESKTOP LANGUAGE DROPDOWN SELECTOR */}
          <div className="relative hidden lg:block flex-shrink-0" ref={langRef}>
            <button
              type="button"
              onClick={() => setLangOpen((open) => !open)}
              className={clsx(
                'flex items-center gap-1.5 rounded-full border px-2.5 xl:px-3 py-1 text-[11.5px] font-extrabold transition-all duration-200',
                currentLang && currentLang !== 'kannada' && currentLang !== 'all-indian'
                  ? 'border-amber-400/50 bg-amber-400/15 text-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.35)]'
                  : 'border-white/10 bg-white/[0.04] text-white/75 hover:border-white/25 hover:bg-white/[0.08] hover:text-white',
              )}
              aria-expanded={langOpen}
              aria-label="Select Language"
            >
              <Globe size={12} className={currentLang && currentLang !== 'kannada' ? 'text-amber-400' : 'text-white/60'} />
              <span>{selectedLanguageLabel}</span>
              <ChevronDown size={11} className={clsx('transition-transform duration-200 text-white/60', langOpen && 'rotate-180')} />
            </button>

            {langOpen && (
              <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-white/15 bg-[#0C0E14]/98 p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.95)] backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-150">
                <div className="border-b border-white/10 px-2.5 pb-2 pt-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-white/40">Select Language</p>
                </div>
                <div className="mt-1.5 max-h-72 overflow-y-auto space-y-0.5 scrollbar-thin">
                  <Link
                    href={buildLangUrl('kannada')}
                    onClick={() => setLangOpen(false)}
                    className={clsx(
                      'flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-bold transition',
                      !isAllIndianPortal || currentLang === 'kannada'
                        ? 'bg-[#E50914] text-white shadow-sm'
                        : 'text-white/75 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span>Kannada</span>
                      <span className="text-[10px] opacity-70">(ಕನ್ನಡ)</span>
                    </div>
                    {(!isAllIndianPortal || currentLang === 'kannada') && <Check size={14} />}
                  </Link>
                  <Link
                    href={buildLangUrl('all-indian')}
                    onClick={() => setLangOpen(false)}
                    className={clsx(
                      'flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-bold transition',
                      currentLang === 'all-indian' || currentLang === 'all'
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black shadow-sm'
                        : 'text-white/75 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span>All Indian</span>
                      <span className="text-[10px] opacity-70">(All Non-Kannada)</span>
                    </div>
                    {(currentLang === 'all-indian' || currentLang === 'all') && <Check size={14} />}
                  </Link>
                  {INDIAN_LANGUAGES.filter((l) => l.param !== 'kannada').map((lang) => {
                    const isSelected = currentLang.toLowerCase() === lang.param.toLowerCase();
                    return (
                      <Link
                        key={`desktop-lang-${lang.code}`}
                        href={buildLangUrl(lang.param)}
                        onClick={() => setLangOpen(false)}
                        className={clsx(
                          'flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-bold transition',
                          isSelected
                            ? 'bg-amber-400 text-black font-black shadow-sm'
                            : 'text-white/75 hover:bg-white/10 hover:text-white',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span>{lang.name}</span>
                          <span className="text-[10px] opacity-70">({lang.native})</span>
                        </div>
                        {isSelected && <Check size={14} />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* DESKTOP PRIMARY CONTENT TYPES NAVIGATION - SHOW ALL MAIN TYPES */}
          <nav className="hidden items-center gap-0.5 xl:gap-1 lg:flex overflow-x-auto scrollbar-hide py-1 max-w-[55vw] 2xl:max-w-none" aria-label="Main Navigation">
            {MAIN_TYPES.map((item) => {
              const active = isTypeActive(item.typeId);
              const IconComp = item.icon;
              const href = buildTypeUrl(item.typeId);

              return (
                <Link
                  key={item.label}
                  href={href}
                  className={clsx(
                    'group relative flex-shrink-0 flex items-center gap-1 rounded-full px-2.5 xl:px-3 py-1.5 text-xs font-bold transition-all duration-200',
                    active
                      ? 'border border-white/20 bg-white/[0.14] text-white shadow-[0_0_20px_rgba(255,255,255,0.12)]'
                      : 'text-white/70 hover:bg-white/[0.08] hover:text-white',
                  )}
                >
                  <IconComp
                    size={13}
                    strokeWidth={active ? 2.5 : 2}
                    className={clsx(
                      'transition-transform duration-200 group-hover:scale-110',
                      active ? 'text-[#E50914]' : 'text-white/50 group-hover:text-white/90',
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT SECTION: SEARCH BAR + MY SPACE + NOTIFICATIONS + VIP CTA + PROFILE */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* INTERACTIVE EXPANDABLE SEARCH BAR */}
          <form
            onSubmit={handleSearchSubmit}
            className={clsx(
              'relative hidden items-center rounded-full border transition-all duration-300 lg:flex',
              searchFocused
                ? 'w-64 border-[#E50914] bg-black/80 shadow-[0_0_20px_rgba(229,9,20,0.35)] ring-1 ring-[#E50914]/50'
                : 'w-44 border-white/10 bg-white/[0.05] hover:border-white/20 hover:bg-white/[0.08]',
            )}
          >
            <Search
              size={15}
              className={clsx(
                'absolute left-3 transition-colors duration-200',
                searchFocused ? 'text-[#E50914]' : 'text-white/45',
              )}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search catalog..."
              className="w-full bg-transparent py-2 pl-9 pr-14 text-xs font-semibold text-white placeholder-white/40 focus:outline-none"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-white/40 hover:text-white"
              >
                <X size={13} />
              </button>
            ) : (
              <div className="pointer-events-none absolute right-2.5 flex items-center gap-0.5 rounded border border-white/10 bg-white/10 px-1 py-0.5 text-[9px] font-bold text-white/50">
                <span>⌘K</span>
              </div>
            )}
          </form>

          {/* MOBILE SEARCH ICON BUTTON */}
          <Link
            href="/search"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/80 transition hover:border-white/30 hover:bg-white/[0.12] hover:text-white lg:hidden"
            aria-label="Search Catalog"
          >
            <Search size={16} strokeWidth={2.2} />
          </Link>

          {/* MY SPACE / WATCHLIST BUTTON */}
          <Link
            href="/myspace"
            className={clsx(
              'hidden h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition sm:flex',
              pathname === '/myspace' || pathname === '/watchlist'
                ? 'border-[#E50914]/50 bg-[#E50914]/20 text-white shadow-[0_0_14px_rgba(229,9,20,0.35)]'
                : 'border-white/10 bg-white/[0.04] text-white/75 hover:border-white/25 hover:bg-white/[0.08] hover:text-white',
            )}
            aria-label="My Watchlist"
          >
            <Bookmark
              size={14}
              className={pathname === '/myspace' ? 'text-[#E50914]' : 'text-white/60'}
            />
            <span className="hidden xl:inline">My Space</span>
          </Link>

          {/* NOTIFICATION BELL */}
          {isAuth && (
            <Link
              href="/notifications"
              className={clsx(
                'relative flex h-9 w-9 items-center justify-center rounded-full border transition',
                pathname === '/notifications'
                  ? 'border-[#E50914]/50 bg-[#E50914]/20 text-white shadow-[0_0_14px_rgba(229,9,20,0.35)]'
                  : 'border-white/10 bg-white/[0.04] text-white/75 hover:border-white/25 hover:bg-white/[0.08] hover:text-white',
              )}
              aria-label="Notifications"
            >
              <Bell size={15} strokeWidth={2.2} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#E50914] shadow-[0_0_8px_#E50914]" />
            </Link>
          )}

          {/* SHIMMERING VIP UPGRADE CTA BUTTON */}
          {premiumCta && (
            <Link
              href="/subscription"
              className="relative group hidden items-center gap-1.5 overflow-hidden rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 px-4 py-2 text-xs font-black text-black shadow-[0_0_20px_rgba(245,158,11,0.4)] transition hover:shadow-[0_0_28px_rgba(245,158,11,0.7)] hover:brightness-110 sm:inline-flex"
            >
              {/* Shimmer light sweep animation */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
              <Crown size={14} fill="currentColor" strokeWidth={1.5} />
              <span>{premiumCta}</span>
            </Link>
          )}

          {/* USER PROFILE DROPDOWN OR SIGN IN */}
          {isAuth ? (
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                className="flex items-center gap-2 rounded-full p-0.5 transition hover:ring-2 hover:ring-[#E50914]/70 focus:outline-none"
                aria-haspopup="true"
                aria-expanded={profileOpen}
                aria-label="User profile menu"
              >
                <img
                  src={avatarUrl(user?.image)}
                  alt={user?.full_name ?? 'Profile'}
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-[#E50914] shadow-[0_0_12px_rgba(229,9,20,0.45)]"
                />
                <ChevronDown
                  size={13}
                  className={clsx(
                    'hidden text-white/70 transition duration-200 md:block',
                    profileOpen && 'rotate-180',
                  )}
                />
              </button>

              {/* PROFILE POPOVER MENU */}
              {profileOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-white/15 bg-[#0C0E14]/98 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.95)] backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-150">
                  {/* USER HEADER */}
                  <div className="border-b border-white/10 px-3 pb-3.5 pt-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-white truncate max-w-[170px]">
                        {user?.full_name ?? 'Subscriber'}
                      </p>
                      {user?.is_buy === 1 ? (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-black uppercase text-amber-300 border border-amber-500/40">
                          VIP 4K
                        </span>
                      ) : (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-extrabold uppercase text-white/60">
                          Free
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/50 truncate mt-0.5">
                      {user?.email || user?.mobile_number || 'MaxxPixels Member'}
                    </p>
                  </div>

                  {/* MENU LINKS */}
                  <div className="mt-2 space-y-1">
                    <Link
                      href="/myspace"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
                    >
                      <Bookmark size={15} className="text-[#E50914]" />
                      <span>My Watchlist & Library</span>
                    </Link>

                    <Link
                      href="/continuewatching"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
                    >
                      <Clock size={15} className="text-blue-400" />
                      <span>Continue Watching</span>
                    </Link>

                    <Link
                      href="/subscription"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
                    >
                      <Crown size={15} className="text-amber-400" />
                      <span>Subscription & VIP Pass</span>
                    </Link>

                    <Link
                      href="/editprofile"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold text-white/80 transition hover:bg-white/10 hover:text-white"
                    >
                      <Settings size={15} className="text-white/60" />
                      <span>Account Settings</span>
                    </Link>

                    <div className="border-t border-white/10 pt-1 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          setProfileOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold text-[#FF5A60] transition hover:bg-red-500/10"
                      >
                        <LogOut size={15} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-gradient-to-r from-[#E50914] to-[#C10711] px-4 sm:px-5 py-2 text-xs font-black text-white shadow-[0_0_18px_rgba(229,9,20,0.55)] transition hover:brightness-110 hover:shadow-[0_0_24px_rgba(229,9,20,0.8)]"
            >
              Sign In
            </Link>
          )}

          {/* MOBILE HAMBURGER TOGGLE BUTTON */}
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/80 transition hover:bg-white/[0.12] hover:text-white md:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE FULL-FEATURED RESPONSIVE DRAWER */}
      {/* ========================================================================= */}
      <div
        className={clsx(
          'overflow-hidden transition-all duration-300 md:hidden',
          mobileOpen
            ? 'max-h-[85vh] border-b border-white/15 bg-[#07080B]/98 shadow-2xl backdrop-blur-3xl overflow-y-auto'
            : 'max-h-0',
        )}
      >
        <div className="space-y-4 px-4 pb-6 pt-3">
          
          {/* MOBILE PORTAL TOGGLE */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
            <Link
              href={buildLangUrl('kannada')}
              onClick={() => setMobileOpen(false)}
              className={clsx(
                'flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition-all',
                !isAllIndianPortal
                  ? 'bg-gradient-to-r from-[#E50914] to-[#C10711] text-white shadow-md'
                  : 'text-white/60 hover:text-white',
              )}
            >
              <Film size={14} />
              <span>Kannada Portal</span>
            </Link>

            <Link
              href={buildLangUrl('all-indian')}
              onClick={() => setMobileOpen(false)}
              className={clsx(
                'flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-extrabold transition-all',
                isAllIndianPortal
                  ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-black font-black shadow-md'
                  : 'text-white/60 hover:text-amber-400',
              )}
            >
              <Globe size={14} />
              <span>All Indian Portal</span>
            </Link>
          </div>

          {/* MOBILE SEARCH INPUT */}
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <Search size={15} className="absolute left-3 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search movies, shows, songs..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-2.5 pl-9 pr-4 text-xs font-semibold text-white placeholder-white/40 focus:border-[#E50914] focus:outline-none"
            />
          </form>

          {/* CATEGORIES GRID */}
          <div>
            <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-wider text-white/40">
              Browse Main Types
            </p>
            <nav className="grid grid-cols-4 gap-2">
              {MAIN_TYPES.map((item) => {
                const active = isTypeActive(item.typeId);
                const IconComp = item.icon;
                const href = buildTypeUrl(item.typeId);

                return (
                  <Link
                    key={`mob-${item.label}`}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={clsx(
                      'flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-2.5 text-[11px] font-extrabold transition-all text-center',
                      active
                        ? 'border-[#E50914] bg-[#E50914] text-white shadow-[0_0_16px_rgba(229,9,20,0.5)]'
                        : 'border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.1] hover:text-white',
                    )}
                  >
                    <IconComp size={16} />
                    <span className="truncate w-full text-[10.5px]">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* REGIONAL INDIAN LANGUAGES */}
          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-white/40">
                Indian Languages
              </span>
              <Link
                href={buildLangUrl('all-indian')}
                onClick={() => setMobileOpen(false)}
                className="text-[10px] font-bold text-amber-400 hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {INDIAN_LANGUAGES.map((lang) => {
                const isSelected =
                  lang.param === 'kannada'
                    ? !isAllIndianPortal || currentLang === 'kannada'
                    : currentLang.toLowerCase() === lang.param.toLowerCase();

                const href = buildLangUrl(lang.param);

                return (
                  <Link
                    key={`mob-lang-${lang.code}`}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={clsx(
                      'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold border transition-all',
                      isSelected
                        ? 'border-[#E50914] bg-[#E50914] text-white shadow-sm'
                        : 'border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20 hover:text-white',
                    )}
                  >
                    <span>{lang.name}</span>
                    <span className="text-[10px] opacity-70 font-medium">({lang.native})</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* MOBILE ACTION BUTTONS */}
          <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
            <Link
              href="/subscription"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 px-3 py-3 text-xs font-black text-black shadow-lg"
            >
              <Crown size={15} fill="currentColor" />
              <span>Upgrade VIP</span>
            </Link>

            {isAuth ? (
              <button
                type="button"
                onClick={() => {
                  logout();
                  setMobileOpen(false);
                }}
                className="flex items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-xs font-bold text-[#FF5A60]"
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#E50914] to-[#C10711] px-3 py-3 text-xs font-black text-white shadow-lg"
              >
                <User size={15} />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Navbar() {
  return (
    <Suspense
      fallback={
        <header className="fixed left-0 right-0 top-0 z-50 flex h-[66px] items-center justify-between border-b border-white/10 bg-[#07080B]/95 px-4 backdrop-blur-2xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 font-display text-xl font-black text-white">
            <span>MAXX</span>
            <span className="text-[#E50914]">PIXELS</span>
          </div>
        </header>
      }
    >
      <NavbarContent />
    </Suspense>
  );
}
