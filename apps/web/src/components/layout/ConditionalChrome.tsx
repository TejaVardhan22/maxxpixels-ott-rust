'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { USER_SCOPED_PAGES } from '@/lib/userRoutes';
import { useStoredUser } from '@/lib/auth';

const BARE_PATH_PREFIXES = ['/apple-design', '/stream', '/player', '/watch', '/login', '/register', '/subscription', '/paymentsuccess', '/paymentcancel', '/producer'];
const PUBLIC_AUTH_PREFIXES = ['/login', '/register', '/auth', '/legal', '/producer'];

const NON_HERO_ROOT_SEGMENTS = new Set([
  'about', 'auth', 'avatar', 'bycast', 'bycategory', 'bychannel', 'bylanguage',
  'cast', 'category', 'channels', 'commanpages', 'continuewatching', 'details',
  'downloads', 'editprofile', 'genres', 'languages', 'legal', 'login',
  'myspace', 'notifications', 'pages', 'paymentcancel', 'paymentsuccess',
  'player', 'profile', 'referandearn', 'register', 'related', 'search', 'sections',
  'settings', 'shorts', 'store', 'stream', 'subscription', 'tvactivate',
  'wallet', 'wallethistory', 'watch', 'watchlist', 'apple-design',
]);

/** Pages with a full-bleed cinematic hero that bleeds underneath the transparent top navbar */
function isFullBleedHeroPath(pathname: string | null): boolean {
  if (!pathname || pathname === '/') return true;
  if (
    pathname === '/movies' ||
    pathname === '/shows' ||
    pathname.startsWith('/movie/') ||
    pathname.startsWith('/movies/') ||
    pathname.startsWith('/series/') ||
    pathname.startsWith('/shows/') ||
    pathname.startsWith('/title/')
  ) {
    return true;
  }
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 2 && USER_SCOPED_PAGES.has(segments[1].toLowerCase())) {
    return false;
  }
  if (segments.length >= 1 && segments.length <= 2 && !NON_HERO_ROOT_SEGMENTS.has(segments[0].toLowerCase())) {
    return true;
  }
  return false;
}

export function ConditionalChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoggedIn } = useStoredUser();
  const [authReady, setAuthReady] = useState(false);
  const [maintenanceState, setMaintenanceState] = useState<{
    active: boolean;
    message: string;
    appName: string;
    logoUrl: string;
  }>({
    active: false,
    message: '',
    appName: 'MaxxPixels',
    logoUrl: '',
  });
  const [checkingMaintenance, setCheckingMaintenance] = useState(false);

  const checkMaintenanceMode = async () => {
    setCheckingMaintenance(true);
    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1').replace(/\/$/, '');
      const res = await fetch(`${apiBase}/settings`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json().catch(() => ({}));
      const s = json?.data ?? json?.result ?? {};
      const rawMode = s.maintenanceMode ?? s.maintenance_mode ?? s.maintenance_mode_enabled;
      const active =
        rawMode === true ||
        String(rawMode || '').trim().toLowerCase() === 'true' ||
        String(rawMode || '').trim() === '1';
      const message =
        String(s.maintenanceMessage || s.maintenance_message || '').trim() ||
        'We are currently performing scheduled maintenance to improve your experience. Please check back shortly.';
      const appName = String(s.appName || s.appShortName || 'MaxxPixels').trim();
      const logoUrl = String(s.darkLogoUrl || s.logoUrl || '').trim();
      setMaintenanceState({ active, message, appName, logoUrl });
    } catch {
      // Ignore network errors on settings check
    } finally {
      setCheckingMaintenance(false);
    }
  };

  useEffect(() => {
    setAuthReady(true);
    checkMaintenanceMode();
  }, []);

  const isPublicAuthPage = PUBLIC_AUTH_PREFIXES.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    if (!authReady || isPublicAuthPage) return;
    if (!isLoggedIn) {
      const next = pathname && pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${next}`);
    }
  }, [authReady, isLoggedIn, isPublicAuthPage, pathname, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const search = new URLSearchParams(window.location.search);
      const ref = search.get('ref') || search.get('reference_code') || search.get('referral');
      if (ref && ref.trim()) {
        localStorage.setItem('pending_referral_code', ref.trim());
      }
    } catch {}
  }, [pathname]);

  if (maintenanceState.active) {
    return (
      <div className="min-h-screen bg-[#08080c] text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl border border-amber-500/30 bg-[#12121a] p-8 text-center space-y-5 shadow-2xl">
          {maintenanceState.logoUrl ? (
            <img
              src={maintenanceState.logoUrl}
              alt={maintenanceState.appName}
              className="h-12 mx-auto object-contain"
            />
          ) : (
            <div className="text-xl font-extrabold tracking-tight text-white">
              {maintenanceState.appName}
            </div>
          )}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-wider">
            Scheduled Maintenance
          </div>
          <h1 className="text-2xl font-bold text-white">We&apos;ll Be Right Back</h1>
          <p className="text-sm text-zinc-300 leading-relaxed">{maintenanceState.message}</p>
          <button
            type="button"
            onClick={checkMaintenanceMode}
            disabled={checkingMaintenance}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold transition cursor-pointer"
          >
            {checkingMaintenance ? 'Checking Status...' : 'Check Status Again'}
          </button>
        </div>
      </div>
    );
  }

  const bare =
    pathname?.endsWith('/watch') ||
    pathname?.endsWith('/subscription') ||
    (BARE_PATH_PREFIXES.some((p) => pathname?.startsWith(p)) ?? false);

  if (bare) {
    if (!isPublicAuthPage && (!authReady || !isLoggedIn)) {
      return <div className="min-h-screen bg-[#0A0A0A]" />;
    }
    return <>{children}</>;
  }

  if (!isPublicAuthPage && (!authReady || !isLoggedIn)) {
    return <div className="min-h-screen bg-[#0A0A0A]" />;
  }

  const fullBleed = isFullBleedHeroPath(pathname);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <Navbar />
      <main className={`min-h-screen pb-16 lg:pb-0 ${fullBleed ? 'pt-0' : 'pt-[102px] sm:pt-[110px] lg:pt-[72px]'}`}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
