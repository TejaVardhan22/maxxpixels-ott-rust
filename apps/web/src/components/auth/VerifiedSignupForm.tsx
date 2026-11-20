'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRegistrationOtp, postJson } from '@ott/shared';
import type { LoginUserResult } from '@ott/shared';
import { ShieldCheck, Send, RotateCcw } from 'lucide-react';

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

export default function VerifiedSignupForm({ submitLabel = 'Verify & Create Account', onRegistered }: VerifiedSignupFormProps) {
  const requestOtp = useRegistrationOtp();
  const [step, setStep] = useState<Step>('details');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
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

  const phone = useMemo(() => normalizePhone(form.countryCode, form.phone), [form.countryCode, form.phone]);
  const fullName = useMemo(() => `${form.firstName.trim()} ${form.lastName.trim()}`.trim(), [form.firstName, form.lastName]);
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
    return '';
  };

  const sendOtp = async () => {
    const validationError = validateDetails();
    if (validationError) return setError(validationError);
    setError('');
    try {
      await requestOtp.mutateAsync({ phone, agentCode: form.agentCode });
      setStep('otp');
    } catch (err: any) {
      const msg = err?.message || 'Unable to send OTP. Please try again.';
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
      if (!userPayload || (!userPayload.id && !userPayload.uuid && !userPayload.accessToken && !userPayload.auth_token)) {
        throw new Error(response?.message || 'Verification and Registration failed.');
      }
      onRegistered(userPayload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setError(/already registered|user_already_exists|already exists|409/i.test(msg) ? 'User already exists' : msg);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-4 text-left">
      {step === 'details' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-1">First Name *</label>
              <input
                className="ott-input"
                placeholder="e.g. Rahul"
                autoComplete="given-name"
                value={form.firstName}
                onChange={update('firstName')}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-1">Last Name *</label>
              <input
                className="ott-input"
                placeholder="e.g. Sharma"
                autoComplete="family-name"
                value={form.lastName}
                onChange={update('lastName')}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-1">Mobile Number *</label>
            <div className="grid grid-cols-[88px_1fr] gap-2">
              <input
                className="ott-input font-bold text-center"
                value={form.countryCode}
                onChange={update('countryCode')}
                aria-label="Country code"
              />
              <input
                className="ott-input"
                type="tel"
                inputMode="numeric"
                placeholder="10-digit mobile number"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-1">
              Email Address <span className="text-muted-text/70 font-normal normal-case">(Optional)</span>
            </label>
            <input
              className="ott-input"
              type="email"
              placeholder="name@example.com (optional)"
              autoComplete="email"
              value={form.email}
              onChange={update('email')}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-1">
              Referral Code <span className="text-muted-text/70 font-normal normal-case">(Optional)</span>
            </label>
            <input
              className="ott-input font-bold uppercase tracking-wider"
              placeholder="e.g. MKT-A1B2C3D4"
              autoComplete="off"
              value={form.agentCode}
              onChange={(e) => setForm((c) => ({ ...c, agentCode: e.target.value.trim().toUpperCase() }))}
            />
            <p className="mt-1 text-[11px] text-muted-text/80">
              Enter your referral code if you have one.
            </p>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-xs text-desc-text">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-primary rounded"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              required
            />
            <span>
              I agree to the{' '}
              <a className="text-primary hover:underline font-semibold" href="/legal/terms-of-service">Terms of Use</a>{' '}
              and{' '}
              <a className="text-primary hover:underline font-semibold" href="/legal/privacy-policy">Privacy Policy</a>.
            </span>
          </label>

          <button
            type="button"
            className="btn-primary w-full py-3.5 rounded-xl text-sm font-bold shadow-glow hover:shadow-card transition-all flex items-center justify-center gap-2"
            onClick={sendOtp}
            disabled={busy}
          >
            {requestOtp.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                Sending SMS OTP...
              </span>
            ) : (
              <>
                <Send size={16} />
                Send Verification OTP
              </>
            )}
          </button>
        </>
      )}

      {step === 'otp' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 text-center">
            <p className="text-xs text-primary font-bold uppercase tracking-wider">SMS OTP Sent</p>
            <p className="text-sm text-white mt-1">
              We sent a 6-digit code to <span className="font-bold text-primary-light">{phone}</span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-1 text-center">
              Enter 6-Digit Code
            </label>
            <input
              className="w-full bg-app-bg border border-ott-border rounded-xl px-4 py-3.5 text-2xl text-center tracking-[0.3em] font-black text-white focus:outline-none focus:border-primary/60"
              value={otpCode}
              onChange={(e) => {
                setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setError('');
              }}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              autoFocus
            />
          </div>

          <button
            type="button"
            className="btn-primary w-full py-3.5 rounded-xl text-sm font-bold shadow-glow flex items-center justify-center gap-2"
            onClick={confirmCodeAndRegister}
            disabled={busy}
          >
            <ShieldCheck size={16} />
            {verifying ? 'Verifying...' : submitLabel}
          </button>

          <div className="flex items-center justify-between text-xs text-muted-text pt-1">
            <button
              type="button"
              onClick={() => {
                setStep('details');
                setOtpCode('');
                setError('');
              }}
              className="hover:text-white transition-colors"
            >
              Change details
            </button>
            <button
              type="button"
              onClick={sendOtp}
              disabled={busy}
              className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
            >
              <RotateCcw size={13} /> Resend OTP
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
