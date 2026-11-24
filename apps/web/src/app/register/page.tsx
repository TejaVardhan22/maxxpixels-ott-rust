'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { EVENTS } from '@ott/shared';
import { setStoredUser } from '@/lib/auth';
import { trackEvent, trackFbEvent } from '@/lib/analytics';
import { useBranding } from '@/hooks/useBranding';
import VerifiedSignupForm from '@/components/auth/VerifiedSignupForm';

export default function RegisterPage() {
  const router = useRouter();
  const brand = useBranding();
  const [logoError, setLogoError] = useState(false);

  return (
    <div className="relative flex min-h-screen flex-col bg-[#0A0A0A] text-white selection:bg-[#FF6D2E]/40">
      {/* Exact Same Cinema Backdrop as Login */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute inset-0 scale-105 bg-cover bg-center opacity-25 blur-[2px]"
          style={{ backgroundImage: "url('/banner_movies_entertainment.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/70 to-[#0A0A0A]" />
        <div className="absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#FF6D2E]/[0.08] blur-[120px]" />
      </div>

      {/* Top-Left Brand Header (Exact Twin of Login) */}
      <header className="relative z-20 mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 py-6 sm:px-12">
        <Link href="/" className="inline-flex items-center focus:outline-none">
          {brand.logoUrl && !logoError ? (
            <img
              src={brand.logoUrl}
              alt={brand.name}
              onError={() => setLogoError(true)}
              className="h-10 max-w-[200px] object-contain sm:h-12 sm:max-w-[220px]"
            />
          ) : (
            <span className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              {brand.name}
            </span>
          )}
        </Link>
      </header>

      {/* Centered Netflix-Style Dark Glass Sign-Up Card */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16 pt-2">
        <div className="w-full max-w-[480px] rounded-xl border border-white/[0.08] bg-black/75 px-7 py-10 shadow-[0_32px_90px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:px-12 sm:py-11">
          <h1 className="text-[32px] font-black tracking-tight text-white">Sign Up</h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            Create your {brand.shortName || brand.name} account to start streaming.
          </p>

          <div className="mt-6">
            <VerifiedSignupForm
              onRegistered={(user) => {
                setStoredUser(user);
                trackEvent(EVENTS.OTP_VERIFIED, { method: 'phone_otp', flow: 'register' });
                trackEvent(EVENTS.REGISTER, { method: 'verified_signup' });
                trackFbEvent('CompleteRegistration', { content_name: 'verified_signup' });
                const hasSub =
                  Number((user as any)?.is_buy ?? (user as any)?.isBuy ?? (user as any)?.user?.is_buy ?? 0) === 1 ||
                  Boolean((user as any)?.is_subscribed ?? (user as any)?.isSubscribed);
                router.push(hasSub ? '/' : '/subscription');
              }}
            />
          </div>

          <div className="mt-7 space-y-2.5">
            <p className="text-sm text-zinc-400">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-bold text-white transition hover:text-[#FF8A54] hover:underline"
              >
                Sign in now.
              </Link>
            </p>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Instant SMS OTP verification protects your account across Web, Mobile, and Smart TV.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
