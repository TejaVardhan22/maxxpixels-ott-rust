'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePhoneLoginOtpRequest, usePhoneOtpLogin } from '@ott/shared';
import { setStoredUser } from '@/lib/auth';

export default function OtpPage() {
  const router = useRouter();
  const login = usePhoneOtpLogin();
  const requestOtp = usePhoneLoginOtpRequest();
  const [phone, setPhone] = useState('');
  const [redirectTo, setRedirectTo] = useState('/');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('otp_phone');
    if (stored) {
      setPhone(stored);
    }
    const redirect = sessionStorage.getItem('otp_redirect');
    setRedirectTo(redirect?.startsWith('/') ? redirect : '/');
  }, []);

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) return setError('Enter the 6-digit OTP.');
    setError('');
    try {
      const response = await login.mutateAsync({ phone, code: otp }) as any;
      const user = response.result?.[0] || response.user || response.data?.user || response;
      if (!user || (!user.id && !user.uuid && !user.accessToken && !user.auth_token)) {
        throw new Error(response.message || 'Verification failed.');
      }
      setStoredUser(user);
      sessionStorage.removeItem('otp_phone');
      sessionStorage.removeItem('otp_redirect');
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed.');
    }
  };

  const resend = async () => {
    setError('');
    setNotice('');
    try {
      await requestOtp.mutateAsync(phone);
      setOtp('');
      setNotice('A new OTP was sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend OTP.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="bg-surface border border-ott-border rounded-2xl p-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">SMS</div>
          <h1 className="text-2xl font-bold mb-2">Verify OTP</h1>
          <p className="text-desc-text mb-8 text-sm">Enter the 6-digit code sent to <span className="text-white font-semibold">{phone || 'your phone'}</span>.</p>
          <form onSubmit={verify} className="space-y-4">
            <input type="text" inputMode="numeric" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" maxLength={6} autoComplete="one-time-code" autoFocus className="w-full bg-app-bg border border-ott-border rounded-xl px-4 py-4 text-2xl text-center tracking-[0.35em] text-white focus:outline-none focus:border-primary/50" />
            {error && <p className="text-accent text-sm" role="alert">{error}</p>}
            {notice && <p className="text-green-400 text-sm">{notice}</p>}
            <button type="submit" disabled={login.isPending || otp.length !== 6} className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-bold py-3.5 rounded-xl">{login.isPending ? 'Verifying...' : 'Verify & Sign In'}</button>
          </form>
          <button type="button" onClick={resend} disabled={requestOtp.isPending} className="mt-5 text-primary text-sm font-semibold hover:underline disabled:opacity-50">{requestOtp.isPending ? 'Sending...' : 'Resend OTP'}</button>
        </div>
        <div className="mt-4"><Link href={redirectTo !== '/' ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login'} className="text-desc-text text-sm hover:text-white">Back to login</Link></div>
      </div>
    </div>
  );
}
