'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePhoneLoginOtpRequest, usePhoneOtpLogin, EVENTS } from '@ott/shared';
import Link from 'next/link';
import { Phone, ChevronDown, ShieldCheck, Send, UserPlus } from 'lucide-react';
import { setStoredUser } from '@/lib/auth';
import { trackEvent, trackFbEvent } from '@/lib/analytics';

const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+1', flag: '🇺🇸', name: 'USA' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+60', flag: '🇲🇾', name: 'Malaysia' },
];

export default function LoginPage() {
  const router = useRouter();
  const phoneOtpRequest = usePhoneLoginOtpRequest();
  const phoneOtpLoginMut = usePhoneOtpLogin();

  const [phone, setPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [countryCode, setCountryCode] = useState('+91');
  const [ccOpen, setCcOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [notRegistered, setNotRegistered] = useState(false);
  const [sending, setSending] = useState(false);

  const [step, setStep] = useState<'phone' | 'otp' | 'name'>('phone');
  const [userName, setUserName] = useState('');
  const [pendingUser, setPendingUser] = useState<any>(null);

  const selectedCC = COUNTRY_CODES.find((c) => c.code === countryCode) ?? COUNTRY_CODES[0];

  const getRedirectTo = () => {
    if (typeof window === 'undefined') return '/';
    const redirect = new URLSearchParams(window.location.search).get('redirect');
    return redirect?.startsWith('/') ? redirect : '/';
  };

  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || phone.trim().length < 10) {
      setError('Please enter a valid 10-digit mobile phone number.');
      return;
    }

    setError('');
    setNotRegistered(false);
    setSending(true);

    try {
      const fullPhone = `${countryCode}${phone.trim()}`;
      await phoneOtpRequest.mutateAsync(fullPhone);
      trackEvent(EVENTS.LOGIN, { method: 'phone_otp' });
      trackFbEvent('Lead', { content_name: 'phone_otp_login' });
      sessionStorage.setItem('otp_phone', fullPhone);
      sessionStorage.setItem('otp_redirect', getRedirectTo());
      setPhoneOtpSent(true);
      setStep('otp');
      setNotice(`SMS verification OTP sent to ${fullPhone}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to send SMS OTP.';
      if (/not registered|user_not_registered|404/i.test(msg)) {
        setNotRegistered(true);
        setError('This mobile number is not registered. Please register first to continue.');
      } else {
        setError(msg);
      }
    } finally {
      setSending(false);
    }
  };

  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(phoneOtp)) {
      setError('Enter the 6-digit SMS verification code.');
      return;
    }

    setError('');
    setSending(true);

    try {
      const fullPhone = `${countryCode}${phone.trim()}`;
      const res = await phoneOtpLoginMut.mutateAsync({ phone: fullPhone, code: phoneOtp }) as any;
      const userPayload = res?.data || res?.result?.[0] || res?.user || res;

      if (!userPayload || (!userPayload.id && !userPayload.uuid && !userPayload.accessToken && !userPayload.auth_token)) {
        throw new Error(res?.message || 'Verification failed.');
      }

      // Only new registrations need name completion; existing users log in immediately.
      const isNewRegistration = userPayload.isNewUser === true;
      const needsNamePrompt = isNewRegistration && (!userPayload.fullName || userPayload.fullName === 'Subscriber' || ['male', 'female'].includes((userPayload.fullName || '').toLowerCase()));

      if (needsNamePrompt) {
        setPendingUser(userPayload);
        setStep('name');
        return;
      }

      setStoredUser(userPayload);
      router.push(getRedirectTo());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setSending(false);
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
      setError('Please enter your actual name (e.g. John Doe), not gender.');
      return;
    }
    if (/^[\d\s+\-()]+$/.test(cleanName)) {
      setError('Full name cannot be a phone number.');
      return;
    }

    setError('');
    setSending(true);
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
        }).catch(() => { });
      }
      const updatedUser = {
        ...pendingUser,
        fullName: cleanName,
        full_name: cleanName,
        name: cleanName,
      };
      setStoredUser(updatedUser);
      router.push(getRedirectTo());
    } catch {
      setStoredUser(pendingUser);
      router.push(getRedirectTo());
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#050A15] text-white">
      {/* Hero Left Side Banner */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#050A15] via-[#0A1020] to-[#050A15]" />
        <div className="absolute inset-0 bg-glow-cyan opacity-30" />
        <div className="relative z-10 flex flex-col justify-center px-20 max-w-xl">
          <span className="text-4xl font-black tracking-tighter text-primary">MaxxPixels</span>
          <h2 className="text-4xl font-extrabold text-white leading-snug mt-4 mb-4">
            Unlimited movies,
            <br />
            TV series & originals.
          </h2>
          <p className="text-desc-text text-base leading-relaxed">
            Instant SMS OTP Sign-In. Stream across 4K Smart TVs, Web, and Mobile.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {['4K Ultra HD', 'Instant SMS OTP', 'Offline Downloads', 'Multi-Device Sync'].map((feat) => (
              <div key={feat} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
                <span className="text-xs text-body-text font-bold">{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Right Side */}
      <div className="flex-1 lg:max-w-[520px] flex flex-col items-center justify-center px-6 sm:px-10 py-16 bg-[#050A15]">
        <div className="lg:hidden mb-8 text-center">
          <span className="text-3xl font-black tracking-tighter text-primary">MaxxPixels</span>
        </div>

        <div className="w-full max-w-sm">
          {step === 'name' ? (
            <div>
              <div className="mb-6">
                <h1 className="text-2xl font-black text-white mb-1">Welcome to MaxxPixels!</h1>
                <p className="text-xs text-muted-text">Please enter your Full Legal Name to complete your streaming profile</p>
              </div>

              <form onSubmit={handleSaveName} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    autoComplete="name"
                    required
                    className="ott-input font-bold"
                    autoFocus
                  />
                </div>

                {error && <p className="text-xs text-accent font-semibold bg-accent/10 p-2.5 rounded-lg border border-accent/20">{error}</p>}

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full btn-primary py-3.5 rounded-xl text-sm font-bold shadow-glow hover:shadow-card transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {sending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                      Saving Profile...
                    </span>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      Complete & Enter MaxxPixels
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div>
              <div className="mb-6">
                <h1 className="text-2xl font-black text-white mb-1">Sign In to MaxxPixels</h1>
                <p className="text-xs text-muted-text">Sign in using instant mobile SMS OTP</p>
              </div>

              <form onSubmit={phoneOtpSent ? handleVerifyPhoneOtp : handleSendPhoneOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-1">Mobile Phone Number</label>
                  <div className="grid grid-cols-[92px_1fr] gap-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setCcOpen(!ccOpen)}
                        className="w-full flex items-center justify-between bg-[#0A1020] border border-white/10 rounded-xl px-3 py-3 text-white text-xs font-bold hover:border-primary/50 transition-colors"
                      >
                        <span>{selectedCC.code}</span>
                        <ChevronDown
                          size={12}
                          className={`text-muted-text transition-transform ${ccOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {ccOpen && (
                        <div className="absolute top-full left-0 mt-1 w-44 rounded-xl glass shadow-modal z-30 overflow-hidden animate-scale-in">
                          {COUNTRY_CODES.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setCountryCode(c.code);
                                setCcOpen(false);
                              }}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-desc-text hover:text-white hover:bg-white/8 transition-colors"
                            >
                              <span>{c.flag}</span>
                              <span className="font-bold">{c.code}</span>
                              <span className="text-muted-text text-[10px] ml-auto">{c.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setError('');
                        setNotRegistered(false);
                      }}
                      placeholder="10-digit mobile number"
                      disabled={phoneOtpSent}
                      required
                      className="ott-input font-bold"
                    />
                  </div>
                </div>

                {phoneOtpSent && (
                  <div>
                    <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-1 text-center">6-Digit Verification Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={phoneOtp}
                      onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      autoComplete="one-time-code"
                      required
                      className="w-full bg-[#050A15] border border-white/15 rounded-xl px-4 py-3.5 text-2xl text-center tracking-[0.35em] font-black text-white focus:outline-none focus:border-primary/60"
                      autoFocus
                    />
                  </div>
                )}

                {notice && <p className="text-xs text-primary font-bold bg-primary/10 p-2.5 rounded-lg border border-primary/20">{notice}</p>}
                {error && (
                  <div className="text-xs text-accent font-semibold bg-accent/10 p-3 rounded-xl border border-accent/25 space-y-2">
                    <p>{error}</p>
                    {notRegistered && (
                      <div className="pt-2 flex items-center justify-between border-t border-accent/20">
                        <span className="text-[11px] text-muted-text">Don't have an account yet?</span>
                        <Link
                          href={`/register?phone=${encodeURIComponent(phone.trim())}&countryCode=${encodeURIComponent(countryCode)}`}
                          className="px-3 py-1.5 bg-primary text-black font-black text-xs rounded-lg hover:bg-primary-light transition-all flex items-center gap-1 shadow-glow"
                        >
                          <UserPlus size={14} />
                          Create Account
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full btn-primary py-3.5 rounded-xl text-sm font-bold shadow-glow hover:shadow-card transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {sending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                      {phoneOtpSent ? 'Verifying Code...' : 'Sending SMS OTP...'}
                    </span>
                  ) : phoneOtpSent ? (
                    <>
                      <ShieldCheck size={18} />
                      Verify & Sign In
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Send Verification Code
                    </>
                  )}
                </button>

                {phoneOtpSent && (
                  <div className="flex justify-between items-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneOtpSent(false);
                        setPhoneOtp('');
                        setError('');
                        setStep('phone');
                      }}
                      className="text-xs text-muted-text hover:text-white"
                    >
                      &larr; Change Mobile Number
                    </button>
                    <button
                      type="button"
                      onClick={handleSendPhoneOtp}
                      disabled={sending}
                      className="text-xs text-primary font-bold hover:underline"
                    >
                      Resend SMS Code
                    </button>
                  </div>
                )}
              </form>

              <div className="mt-8 pt-6 border-t border-white/10 text-center">
                <p className="text-xs text-muted-text">
                  New to MaxxPixels?{' '}
                  <Link href="/register" className="text-primary hover:text-primary-light font-extrabold transition-colors">
                    Create Account
                  </Link>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
