'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTvLogin } from '@ott/shared';
import { Tv, CheckCircle, Lock } from 'lucide-react';
import { GlassPanel, PageHero, PageShell } from '@/components/layout/PageChrome';
import { useStoredUser } from '@/lib/auth';

export default function TvActivatePage() {
  const { user, isLoggedIn } = useStoredUser();
  const tvLoginMut = useTvLogin();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const activateTv = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    const uniqueCode = code.trim().toUpperCase();
    if (!uniqueCode) {
      setError('Enter the code shown on your TV.');
      return;
    }

    setError('');
    setMessage('');
    try {
      const res = await tvLoginMut.mutateAsync({
        user_id: user.id,
        unique_code: uniqueCode,
      });
      if (res.status === 200) {
        setMessage('TV activated successfully.');
        setCode('');
      } else {
        setError(res.message || 'Invalid or expired TV code.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to activate TV.');
    }
  };

  return (
    <PageShell narrow>
      <PageHero eyebrow="Big screen" title="TV Activate" description="Pair your TV with this account and continue watching on the largest screen in the room." icon={Tv} />
      <GlassPanel className="text-center">
        {!isLoggedIn ? (
          <div className="mx-auto max-w-sm">
            <Lock className="mx-auto mb-4 text-gold" size={34} />
            <p className="text-sm text-desc-text">Sign in on web, then enter the pairing code displayed on your TV.</p>
            <Link href="/login" className="btn-primary mt-6 inline-flex rounded-full px-8 py-3 text-sm">
              Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={activateTv} className="mx-auto max-w-sm space-y-4">
            <p className="text-sm text-desc-text">Open MaxxPixels on your TV and enter the code shown there.</p>
            <input
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase());
                setError('');
                setMessage('');
              }}
              placeholder="TV CODE"
              className="ott-input text-center font-mono text-2xl font-black tracking-[0.24em]"
              autoComplete="one-time-code"
            />
            {error && <p className="text-sm text-accent">{error}</p>}
            {message && (
              <p className="inline-flex items-center justify-center gap-2 text-sm text-emerald-400">
                <CheckCircle size={16} />
                {message}
              </p>
            )}
            <button type="submit" disabled={tvLoginMut.isPending} className="btn-primary w-full rounded-full px-8 py-4 text-sm disabled:opacity-50">
              {tvLoginMut.isPending ? 'Activating...' : 'Activate TV'}
            </button>
          </form>
        )}
      </GlassPanel>
    </PageShell>
  );
}
