'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePhoneLoginOtpRequest, usePhoneOtpLogin, EVENTS } from '@ott/shared';
import { ArrowLeft, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { setStoredUser } from '@/lib/auth';
import { useBranding } from '@/hooks/useBranding';
import { trackEvent, trackFbEvent } from '@/lib/analytics';

export default function VerifyLoginOtpPage() {
  const router = useRouter();
  const brand = useBranding();
  const phoneOtpRequest = usePhoneLoginOtpRequest();
  const phoneOtpLoginMut = usePhoneOtpLogin();

  const [fullPhone, setFullPhone] = useState('');
  const [redirectTo, setRedirectTo] = useState('/');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [step, setStep] = useState<'otp' | 'name'>('otp');
  const [userName, setUserName] = useState('');
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [logoError, setLogoError] = useState(false);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedPhone = sessionStorage.getItem('otp_phone') || '';
    const savedRedirect = sessionStorage.getItem('otp_redirect') || '/';
    if (!savedPhone) {
      router.replace('/login');
      return;
    }
    setFullPhone(savedPhone);
    setRedirectTo(savedRedirect.startsWith('/') ? savedRedirect : '/');
    setTimeout(() => inputRefs.current[0]?.focus(), 60);
  }, [router]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const code = digits.join('');

  const handleDigitChange = (idx: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    setError('');
    if (!cleaned) {
      const next = [...digits];
      next[idx] = '';
      setDigits(next);
      return;
    }
    if (cleaned.length > 1) {
      const pasted = cleaned.slice(0, 6).split('');
      const next = ['', '', '', '', '', ''];
      pasted.forEach((ch, i) => {
        next[i] = ch;
      });
      setDigits(next);
      const focusIdx = Math.min(pasted.length, 5);
      inputRefs.current[focusIdx]?.focus();
      return;
    }
    const next = [...digits];
    next[idx] = cleaned;
    setDigits(next);
    if (idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit verification code sent to your mobile.');
      return;
    }
    if (!fullPhone) {
      router.replace('/login');
      return;
    }

    setError('');
    setNotice('');
    setBusy(true);
    try {
      const res = (await phoneOtpLoginMut.mutateAsync({ phone: fullPhone, code })) as any;
      const userPayload = res?.data || res?.result?.[0] || res?.user || res;

      if (
        !userPayload ||
        (!userPayload.id && !userPayload.uuid && !userPayload.accessToken && !userPayload.auth_token)
      ) {
        throw new Error(res?.message || 'Verification failed.');
      }

      const isNewRegistration = userPayload.isNewUser === true;
      const needsNamePrompt =
        isNewRegistration &&
        (!userPayload.fullName ||
          userPayload.fullName === 'Subscriber' ||
          ['male', 'female'].includes((userPayload.fullName || '').toLowerCase()));

      if (needsNamePrompt) {
        setPendingUser(userPayload);
        setStep('name');
        return;
      }

      sessionStorage.removeItem('otp_phone');
      sessionStorage.removeItem('otp_redirect');
      setStoredUser(userPayload);
      trackEvent(EVENTS.OTP_VERIFIED, { method: 'phone_otp', flow: 'login' });
      trackEvent(EVENTS.LOGIN, { method: 'phone_otp' });
      trackFbEvent('CompleteRegistration', { content_name: 'phone_otp_verified' });
      const hasSub =
        Number(userPayload?.is_buy ?? userPayload?.isBuy ?? userPayload?.user?.is_buy ?? userPayload?.user?.isBuy ?? 0) === 1 ||
        Boolean(userPayload?.is_subscribed ?? userPayload?.isSubscribed ?? userPayload?.user?.is_subscribed ?? userPayload?.user?.isSubscribed);
      router.push(hasSub ? redirectTo : '/subscription');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (!fullPhone || resendCooldown > 0 || busy) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await phoneOtpRequest.mutateAsync(fullPhone);
      setDigits(['', '', '', '', '', '']);
      setResendCooldown(30);
      setNotice(`New verification code sent to ${fullPhone}`);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to resend code.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = userName.trim();
    if (cleanName.length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }
    const lower = cleanName.toLowerCase();
    if (['male', 'female', 'other'].includes(lower)) {
      setError('Please enter your actual name (e.g. Rahul Sharma).');
      return;
    }
    if (/^[\d\s+\-()]+$/.test(cleanName)) {
      setError('Full name cannot be a phone number.');
      return;
    }

    setError('');
    setBusy(true);
    try {
      if (pendingUser?.id) {
        const token = pendingUser.accessToken || pendingUser.auth_token || pendingUser.token;
        await fetch('/api/v1/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            userId: pendingUser.id,
            fullName: cleanName,
            full_name: cleanName,
          }),
        }).catch(() => {});
      }
      const updatedUser = {
        ...pendingUser,
        fullName: cleanName,
        full_name: cleanName,
        name: cleanName,
      };
      sessionStorage.removeItem('otp_phone');
      sessionStorage.removeItem('otp_redirect');
      setStoredUser(updatedUser);
      trackEvent(EVENTS.OTP_VERIFIED, { method: 'phone_otp', flow: 'login_profile_complete' });
      trackEvent(EVENTS.LOGIN, { method: 'phone_otp' });
      const hasSub =
        Number(updatedUser?.is_buy ?? updatedUser?.isBuy ?? updatedUser?.user?.is_buy ?? updatedUser?.user?.isBuy ?? 0) === 1 ||
        Boolean(updatedUser?.is_subscribed ?? updatedUser?.isSubscribed ?? updatedUser?.user?.is_subscribed ?? updatedUser?.user?.isSubscribed);
      router.push(hasSub ? redirectTo : '/subscription');
    } catch {
      setStoredUser(pendingUser);
      router.push('/subscription');
    } finally {
      setBusy(false);
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

      {/* Centered OTP Verification Card */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16 pt-4">
        <div className="w-full max-w-[450px] rounded-xl border border-white/[0.08] bg-black/75 px-7 py-10 shadow-[0_32px_90px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:px-12 sm:py-12">
          {step === 'name' ? (
            <div>
              <h1 className="text-[30px] font-black tracking-tight text-white">Complete Profile</h1>
              <p className="mt-1.5 text-sm text-zinc-400">
                Enter your full name to finish setting up your {brand.name} account.
              </p>

              <form onSubmit={handleSaveName} className="mt-7 space-y-4">
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Full Legal Name"
                  autoComplete="name"
                  required
                  autoFocus
                  className="h-[52px] w-full rounded-md border border-white/20 bg-[#181818]/90 px-4 text-sm font-medium text-white placeholder:text-zinc-400 transition focus:border-white focus:outline-none focus:ring-1 focus:ring-white/30"
                />

                {error && (
                  <p className="rounded-md border border-[#FF6D2E]/40 bg-[#FF6D2E]/12 px-3.5 py-2.5 text-xs font-medium text-[#FFB088]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] text-[15px] font-bold text-white shadow-[0_6px_22px_rgba(255,109,46,0.4)] transition hover:brightness-110 disabled:opacity-50"
                >
                  {busy ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      <span>Continue to {brand.shortName || brand.name}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div>
              <Link
                href="/login"
                className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition hover:text-white"
              >
                <ArrowLeft size={14} />
                <span>Change mobile number</span>
              </Link>

              <h1 className="text-[30px] font-black tracking-tight text-white">
                Enter Sign-In Code
              </h1>
              <p className="mt-1.5 text-sm text-zinc-400">
                Enter the 6-digit code we sent to{' '}
                <span className="font-semibold text-white">{fullPhone || 'your mobile'}</span>.
              </p>

              <form onSubmit={handleVerifyOtp} className="mt-7 space-y-5">
                {/* 6 Segmented OTP Boxes */}
                <div className="grid grid-cols-6 gap-2 sm:gap-2.5">
                  {digits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      aria-label={`Digit ${idx + 1}`}
                      className="h-14 w-full rounded-md border border-white/20 bg-[#181818] text-center font-mono text-2xl font-black text-white transition focus:border-[#FF6D2E] focus:outline-none focus:ring-1 focus:ring-[#FF6D2E]/50"
                    />
                  ))}
                </div>

                {notice && (
                  <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-medium text-emerald-300">
                    {notice}
                  </p>
                )}

                {error && (
                  <p className="rounded-md border border-[#FF6D2E]/40 bg-[#FF6D2E]/12 px-3.5 py-2.5 text-xs font-medium text-[#FFB088]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy || code.length < 6}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] text-[15px] font-bold text-white shadow-[0_6px_22px_rgba(255,109,46,0.4)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
                >
                  {busy ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Verify &amp; Sign In</span>
                  )}
                </button>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-zinc-500">Didn&apos;t receive a code?</span>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={busy || resendCooldown > 0}
                    className="inline-flex items-center gap-1 font-semibold text-[#FF8A54] transition hover:underline disabled:text-zinc-500 disabled:no-underline"
                  >
                    <RotateCcw size={13} />
                    <span>
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
