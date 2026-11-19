'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const BARE_PATH_PREFIXES = ['/apple-design', '/stream', '/player', '/watch'];

export function ConditionalChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
    (BARE_PATH_PREFIXES.some((p) => pathname?.startsWith(p)) ?? false);

  if (bare) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-[70px]">{children}</main>
      <Footer />
    </>
  );
}
