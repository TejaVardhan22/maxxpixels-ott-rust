'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRegistrationOtp, postJson } from '@ott/shared';
import type { LoginUserResult } from '@ott/shared';
import { ShieldCheck, RotateCcw, Loader2 } from 'lucide-react';
import RecaptchaBox from '@/components/auth/RecaptchaBox';

type Step = 'details' | 'otp';

interface VerifiedSignupFormProps {
  submitLabel?: string;
  onRegistered: (user: LoginUserResult) => void;
}

function normalizePhone(countryCode: string, mobile: string): string {
  const trimmed = mobile.trim();
  if (trimmed.startsWith('+')) return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  return `${countryCode.trim() || '+91'}${trimmed.replace(/\D/g, '')}`;
}

export default function VerifiedSignupForm({
  submitLabel = 'Verify & Create Account',
  onRegistered,
}: VerifiedSignupFormProps) {
  const requestOtp = useRegistrationOtp();
  const [step, setStep] = useState<Step>('details');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaReset, setRecaptchaReset] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    countryCode: '+91',
    phone: '',
    email: '',
    agentCode: '',
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const qPhone = sp.get('phone');
      const qCc = sp.get('countryCode');
      const qAgentCode =
        sp.get('agentCode') ||
        sp.get('agent_code') ||
        sp.get('ref') ||
        sp.get('reference_code') ||
        sp.get('referral');
      const storedAgentCode = window.localStorage.getItem('pending_referral_code');
      if (qPhone || qAgentCode || storedAgentCode) {
        setForm((prev) => ({
          ...prev,
          phone: qPhone ? qPhone.replace(/\D/g, '') : prev.phone,
          countryCode: qCc || prev.countryCode,
          agentCode: (qAgentCode || storedAgentCode || '').trim().toUpperCase(),
        }));
      }
    }
  }, []);

  const phone = useMemo(
    () => normalizePhone(form.countryCode, form.phone),
    [form.countryCode, form.phone],
  );
  const fullName = useMemo(
    () => `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
    [form.firstName, form.lastName],
  );
  const busy = requestOtp.isPending || verifying;

  const update = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setError('');
  };

  const validateDetails = () => {
    const first = form.firstName.trim();
    const last = form.lastName.trim();
    if (!first || first.length < 2) return 'Please enter your first name.';
    if (!last || last.length < 1) return 'Please enter your last name.';
    if (/^[\d\s+\-()]+$/.test(first) || /^[\d\s+\-()]+$/.test(last)) {
      return 'Name cannot contain only numbers.';
    }
    if (!form.phone.trim() || !/^\+[1-9]\d{7,14}$/.test(phone)) {
      return 'Please enter a valid 10-digit mobile number.';
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return 'Please enter a valid email address or leave it blank.';
    }
    if (!accepted) {
      return 'Please accept the Terms of Use & Privacy Policy to continue.';
    }
    if (step === 'details' && !recaptchaToken) {
      return 'Please complete the reCAPTCHA verification.';
    }
    return '';
  };

  const sendOtp = async () => {
    const validationError = validateDetails();
    if (validationError) return setError(validationError);
    setError('');
    try {
      await requestOtp.mutateAsync({
        phone,
        agentCode: form.agentCode,
        recaptchaToken,
      });
      setStep('otp');
    } catch (err: any) {
      const msg = err?.message || 'Unable to send OTP. Please try again.';
      setRecaptchaReset((c) => c + 1);
      if (/already registered|user_already_exists|already exists|409/i.test(msg)) {
        setError('User already exists');
      } else {
        setError(msg);
      }
    }
  };

  const confirmCodeAndRegister = async () => {
    if (!/^\d{6}$/.test(otpCode)) return setError('Enter the 6-digit SMS verification code.');
    setError('');
    setVerifying(true);
    try {
      const response = await postJson<any>('auth/verify-otp', {
        identifier: phone,
        mobile_number: phone,
        mobileNumber: phone,
        phone,
        mode: 'register',
        isRegister: true,
        agentCode: form.agentCode.trim().toUpperCase() || undefined,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        full_name: fullName,
        name: fullName,
        email: form.email.trim() || undefined,
        otp: otpCode,
        code: otpCode,
      });

      const userPayload = response?.data || response?.result?.[0] || response?.user || response;
      if (
        !userPayload ||
        (!userPayload.id &&
          !userPayload.uuid &&
          !userPayload.accessToken &&
          !userPayload.auth_token)
      ) {
        throw new Error(response?.message || 'Verification and Registration failed.');
      }
      onRegistered(userPayload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setError(
        /already registered|user_already_exists|already exists|409/i.test(msg)
          ? 'User already exists'
          : msg,
      );
    } finally {
      setVerifying(false);
    }
  };

  const inputClass =
    'h-[50px] w-full rounded-md border border-white/20 bg-[#181818]/90 px-4 text-sm font-medium text-white placeholder:text-zinc-400 transition focus:border-white focus:outline-none focus:ring-1 focus:ring-white/30';

  return (
    <div className="space-y-3.5 text-left">
      {step === 'details' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <input
              className={inputClass}
              placeholder="First name *"
              autoComplete="given-name"
              value={form.firstName}
              onChange={update('firstName')}
              required
            />
            <input
              className={inputClass}
              placeholder="Last name *"
              autoComplete="family-name"
              value={form.lastName}
              onChange={update('lastName')}
              required
            />
          </div>

          <div className="grid grid-cols-[84px_1fr] gap-2.5">
            <input
              className={`${inputClass} px-2 text-center font-semibold`}
              value={form.countryCode}
              onChange={update('countryCode')}
              aria-label="Country code"
            />
            <input
              className={inputClass}
              type="tel"
              inputMode="numeric"
              placeholder="Mobile number *"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) =>
                setForm((c) => ({ ...c, phone: e.target.value.replace(/\D/g, '').slice(0, 12) }))
              }
              required
            />
          </div>

          <input
            className={inputClass}
            type="email"
            placeholder="Email address (optional)"
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
          />

          <input
            className={`${inputClass} uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal`}
            placeholder="Referral code (optional)"
            autoComplete="off"
            value={form.agentCode}
            onChange={(e) =>
              setForm((c) => ({ ...c, agentCode: e.target.value.trim().toUpperCase() }))
            }
          />

          <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-xs text-zinc-400">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#FF6D2E]"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              required
            />
            <span className="leading-relaxed">
              I agree to the{' '}
              <a
                className="font-semibold text-[#FF8A54] hover:underline"
                href="/legal/terms-of-service"
              >
                Terms of Use
              </a>{' '}
              and{' '}
              <a
                className="font-semibold text-[#FF8A54] hover:underline"
                href="/legal/privacy-policy"
              >
                Privacy Policy
              </a>
              .
            </span>
          </label>

          <RecaptchaBox
            onVerify={(token) => {
              setRecaptchaToken(token);
              if (token) setError('');
            }}
            resetSignal={recaptchaReset}
          />

          <button
            type="button"
            className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] text-[15px] font-bold text-white shadow-[0_6px_22px_rgba(255,109,46,0.4)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
            onClick={sendOtp}
            disabled={busy}
          >
            {requestOtp.isPending ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                <span>Sending code...</span>
              </>
            ) : (
              <span>Send Verification Code</span>
            )}
          </button>
        </>
      )}

      {step === 'otp' && (
        <div className="space-y-4">
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center">
            <p className="text-xs font-medium text-emerald-300">
              We sent a 6-digit code to <span className="font-bold text-white">{phone}</span>
            </p>
          </div>

          <input
            className="h-[56px] w-full rounded-md border border-white/25 bg-[#181818] px-4 text-center font-mono text-2xl font-black tracking-[0.4em] text-white placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-zinc-400 transition focus:border-[#FF6D2E] focus:outline-none focus:ring-1 focus:ring-[#FF6D2E]/50"
            value={otpCode}
            onChange={(e) => {
              setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
              setError('');
            }}
            placeholder="Enter 6-digit code"
            inputMode="numeric"
            maxLength={6}
            autoFocus
          />

          <button
            type="button"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] text-[15px] font-bold text-white shadow-[0_6px_22px_rgba(255,109,46,0.4)] transition hover:brightness-110 disabled:opacity-50"
            onClick={confirmCodeAndRegister}
            disabled={busy}
          >
            {verifying ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={17} />
                <span>{submitLabel}</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setStep('details');
                setOtpCode('');
                setError('');
              }}
              className="text-zinc-400 transition hover:text-white"
            >
              &larr; Change details
            </button>
            <button
              type="button"
              onClick={sendOtp}
              disabled={busy}
              className="inline-flex items-center gap-1 font-semibold text-[#FF8A54] hover:underline disabled:opacity-50"
            >
              <RotateCcw size={13} /> Resend code
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-[#FF6D2E]/40 bg-[#FF6D2E]/12 px-3.5 py-2.5 text-xs font-medium text-[#FFB088]">
          {error}
        </div>
      )}
    </div>
  );
}
