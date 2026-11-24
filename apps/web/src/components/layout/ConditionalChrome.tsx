'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { USER_SCOPED_PAGES } from '@/lib/userRoutes';
import { useStoredUser } from '@/lib/auth';

const BARE_PATH_PREFIXES = ['/apple-design', '/stream', '/player', '/watch', '/login', '/register', '/subscription', '/paymentsuccess', '/paymentcancel'];
const PUBLIC_AUTH_PREFIXES = ['/login', '/register', '/auth', '/legal'];

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

  useEffect(() => {
    setAuthReady(true);
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
