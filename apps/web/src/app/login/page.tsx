'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePhoneLoginOtpRequest, EVENTS } from '@ott/shared';
import { ChevronDown, UserPlus, Loader2 } from 'lucide-react';
import { trackEvent, trackFbEvent } from '@/lib/analytics';
import { useBranding } from '@/hooks/useBranding';
import RecaptchaBox from '@/components/auth/RecaptchaBox';

const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', name: 'India' },
];

export default function LoginPage() {
  const router = useRouter();
  const brand = useBranding();
  const phoneOtpRequest = usePhoneLoginOtpRequest();

  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [ccOpen, setCcOpen] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaReset, setRecaptchaReset] = useState(0);
  const [error, setError] = useState('');
  const [notRegistered, setNotRegistered] = useState(false);
  const [sending, setSending] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const selectedCC = COUNTRY_CODES.find((c) => c.code === countryCode) ?? COUNTRY_CODES[0];

  const getRedirectTo = () => {
    if (typeof window === 'undefined') return '/';
    const redirect = new URLSearchParams(window.location.search).get('redirect');
    return redirect?.startsWith('/') ? redirect : '/';
  };

  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '').trim();
    if (!digits || digits.length < 10) {
      setError('Please enter a valid 10-digit mobile phone number.');
      return;
    }
    if (!recaptchaToken) {
      setError('Please complete the reCAPTCHA verification.');
      return;
    }

    setError('');
    setNotRegistered(false);
    setSending(true);

    try {
      const fullPhone = `${countryCode}${digits}`;
      await phoneOtpRequest.mutateAsync({ phone: fullPhone, recaptchaToken });
      trackEvent(EVENTS.LOGIN, { method: 'phone_otp' });
      trackFbEvent('Lead', { content_name: 'phone_otp_login' });
      sessionStorage.setItem('otp_phone', fullPhone);
      sessionStorage.setItem('otp_redirect', getRedirectTo());
      router.push('/login/verify');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to send SMS OTP.';
      setRecaptchaReset((c) => c + 1);
      if (/not registered|user_not_registered|404/i.test(msg)) {
        setNotRegistered(true);
        setError('This mobile number is not registered yet. Sign up to create an account.');
      } else {
        setError(msg);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-[#0A0A0A] text-white selection:bg-[#FF6D2E]/40">
      {/* Cinema Backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute inset-0 scale-105 bg-cover bg-center opacity-25 blur-[2px]"
          style={{ backgroundImage: "url('/banner_movies_entertainment.png')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/70 to-[#0A0A0A]" />
        <div className="absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#FF6D2E]/[0.08] blur-[120px]" />
      </div>

      {/* Top-Left Brand Header */}
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

      {/* Centered Netflix-Style Dark Glass Sign-In Card */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16 pt-4">
        <div className="w-full max-w-[450px] rounded-xl border border-white/[0.08] bg-black/75 px-7 py-10 shadow-[0_32px_90px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:px-14 sm:py-12">
          <h1 className="text-[32px] font-black tracking-tight text-white">Sign In</h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            Enter your mobile number to receive a 6-digit sign-in code.
          </p>

          <form onSubmit={handleSendPhoneOtp} className="mt-7 space-y-4">
            <div className="grid grid-cols-[92px_1fr] gap-2.5">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCcOpen((o) => !o)}
                  className="flex h-[52px] w-full items-center justify-between rounded-md border border-white/20 bg-[#181818]/90 px-3 text-sm font-semibold text-white transition hover:border-white/40"
                >
                  <span>{selectedCC.code}</span>
                  <ChevronDown
                    size={14}
                    className={`text-zinc-400 transition-transform ${ccOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {ccOpen && (
                  <div className="absolute left-0 top-full z-30 mt-1.5 w-48 overflow-hidden rounded-lg border border-white/15 bg-[#181818] py-1 shadow-2xl">
                    {COUNTRY_CODES.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          setCountryCode(c.code);
                          setCcOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-xs text-zinc-200 transition hover:bg-white/10 hover:text-white"
                      >
                        <span>{c.flag}</span>
                        <span className="font-bold">{c.code}</span>
                        <span className="ml-auto text-[11px] text-zinc-400">{c.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 12));
                  setError('');
                  setNotRegistered(false);
                }}
                placeholder="Mobile number"
                required
                autoFocus
                className="h-[52px] w-full rounded-md border border-white/20 bg-[#181818]/90 px-4 text-sm font-medium text-white placeholder:text-zinc-400 transition focus:border-white focus:outline-none focus:ring-1 focus:ring-white/30"
              />
            </div>

            <RecaptchaBox
              onVerify={(token) => {
                setRecaptchaToken(token);
                if (token) setError('');
              }}
              resetSignal={recaptchaReset}
            />

            {error && (
              <div className="space-y-2.5 rounded-md border border-[#FF6D2E]/40 bg-[#FF6D2E]/12 px-3.5 py-3 text-xs font-medium text-[#FFB088]">
                <p>{error}</p>
                {notRegistered && (
                  <div className="flex items-center justify-between border-t border-[#FF6D2E]/25 pt-2.5">
                    <span className="text-[11px] text-zinc-300">New here?</span>
                    <Link
                      href={`/register?phone=${encodeURIComponent(phone.trim())}&countryCode=${encodeURIComponent(countryCode)}`}
                      className="inline-flex items-center gap-1.5 rounded bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110"
                    >
                      <UserPlus size={13} />
                      Sign up now
                    </Link>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] text-[15px] font-bold text-white shadow-[0_6px_22px_rgba(255,109,46,0.4)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
            >
              {sending ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  <span>Sending code...</span>
                </>
              ) : (
                <span>Send Sign-In Code</span>
              )}
            </button>
          </form>

          <div className="mt-8 space-y-3">
            <p className="text-sm text-zinc-400">
              New to {brand.shortName || brand.name}?{' '}
              <Link
                href="/register"
                className="font-bold text-white transition hover:text-[#FF8A54] hover:underline"
              >
                Sign up now.
              </Link>
            </p>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              This page is protected by Google reCAPTCHA to ensure you&apos;re not a bot.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
