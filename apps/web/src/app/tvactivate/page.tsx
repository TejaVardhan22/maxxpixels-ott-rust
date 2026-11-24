'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserToken } from '@ott/shared';
import {
  CheckCircle2,
  Copy,
  Loader2,
  Lock,
  LogOut,
  Monitor,
  ShieldCheck,
  Sparkles,
  Tv,
} from 'lucide-react';
import { GlassPanel, PageHero, PageShell } from '@/components/layout/PageChrome';
import { showToast } from '@/components/ui/ToastHost';
import { useStoredUser } from '@/lib/auth';
import { userPageHref } from '@/lib/userRoutes';

interface DeviceItem {
  id: number;
  deviceId: string;
  deviceName?: string | null;
  platform?: string | null;
  deviceType?: string | null;
  isActive: boolean;
  isStreaming?: boolean;
  lastActiveAt?: string | null;
}

interface DeviceSummaryResponse {
  plan?: {
    planName?: string;
    maxDevices?: number;
  };
  usage?: {
    activeDevicesCount?: number;
  };
  devices?: DeviceItem[];
}

const CODE_LEN = 6;

export default function TvActivatePage() {
  const queryClient = useQueryClient();
  const { user, isLoggedIn } = useStoredUser();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LEN).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [generatingTest, setGeneratingTest] = useState(false);
  const [testCode, setTestCode] = useState('');
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const summaryQ = useQuery<DeviceSummaryResponse | null>({
    queryKey: ['device-summary', user?.id],
    enabled: Boolean(isLoggedIn && user?.id),
    queryFn: async () => {
      const token = getUserToken();
      if (!token) return null;
      const res = await fetch('/api/v1/devices/summary', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const json = await res.json();
      return (json?.data ?? json?.result ?? json) as DeviceSummaryResponse;
    },
  });

  useEffect(() => {
    if (isLoggedIn) {
      inputRefs.current[0]?.focus();
    }
  }, [isLoggedIn]);

  const fullCode = digits.join('').trim().toUpperCase();

  const handleDigitChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    setError('');
    setMessage('');

    if (!cleaned) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }

    // Handle multi-char paste into any box
    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, CODE_LEN).split('');
      setDigits(() => {
        const next = Array(CODE_LEN).fill('');
        chars.forEach((ch, idx) => {
          next[idx] = ch;
        });
        return next;
      });
      const focusIdx = Math.min(chars.length, CODE_LEN - 1);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    setDigits((prev) => {
      const next = [...prev];
      next[index] = cleaned[0];
      return next;
    });
    if (index < CODE_LEN - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < CODE_LEN - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const activateTv = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.id) return;

    if (fullCode.length < 4) {
      setError('Enter the 6-character pairing code shown on your Smart TV.');
      return;
    }

    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      const token = getUserToken();
      const res = await fetch('/api/v1/auth/tv-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          user_id: user.id,
          unique_code: fullCode,
          code: fullCode,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json?.message || json?.error || 'Invalid or expired TV pairing code.';
        setError(msg);
        showToast({ title: 'TV Activation Failed', message: msg, variant: 'error' });
        return;
      }

      const tvName = json?.data?.deviceName || 'Smart TV';
      setMessage(`${tvName} activated successfully! Your TV will sign in automatically.`);
      setDigits(Array(CODE_LEN).fill(''));
      setTestCode('');
      showToast({
        title: 'Smart TV Activated',
        message: `${tvName} is now linked to your account.`,
        variant: 'success',
      });
      await queryClient.invalidateQueries({ queryKey: ['device-summary', user.id] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to activate TV right now.';
      setError(msg);
      showToast({ title: 'TV Activation Failed', message: msg, variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const generateTestTvCode = async () => {
    setGeneratingTest(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/v1/auth/tv/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceName: 'Living Room Smart TV',
          platform: 'ANDROID_TV',
        }),
      });
      const json = await res.json().catch(() => ({}));
      const generated = String(json?.data?.code || json?.code || '').toUpperCase();
      if (res.ok && generated) {
        setTestCode(generated);
        const chars = generated.slice(0, CODE_LEN).split('');
        setDigits(Array.from({ length: CODE_LEN }, (_, i) => chars[i] || ''));
        showToast({
          title: 'Test TV Code Generated',
          message: `Code ${generated} pre-filled. Click "Activate TV" to link it.`,
          variant: 'info',
        });
      }
    } finally {
      setGeneratingTest(false);
    }
  };

  const disconnectTv = async (device: DeviceItem) => {
    const token = getUserToken();
    if (!token) return;
    setRevokingId(device.deviceId);
    try {
      const res = await fetch(`/api/v1/devices/${encodeURIComponent(device.deviceId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast({
          title: 'TV Signed Out',
          message: `"${device.deviceName || 'Smart TV'}" has been disconnected.`,
          variant: 'info',
        });
        await queryClient.invalidateQueries({ queryKey: ['device-summary', user?.id] });
      }
    } finally {
      setRevokingId(null);
    }
  };

  const activeTvs = (summaryQ.data?.devices ?? []).filter((d) => {
    if (!d.isActive) return false;
    const raw = `${d.platform || ''} ${d.deviceType || ''} ${d.deviceName || ''}`.toLowerCase();
    return raw.includes('tv') || raw.includes('firetv') || raw.includes('roku') || raw.includes('webos');
  });

  return (
    <PageShell narrow>
      <PageHero
        backHref={userPageHref(user, 'myspace')}
        backLabel="Back to My Space"
        eyebrow="Big Screen"
        title="Activate Smart TV"
        description="Pair your Android TV, Fire TV, or Smart TV with your account using the 6-character code on your TV screen."
        icon={Tv}
      />

      {!isLoggedIn ? (
        <GlassPanel className="border-white/10 bg-[#1E222A] p-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-[#FF6D2E]/30 bg-[#FF6D2E]/15 text-[#FF8A54]">
            <Lock size={26} />
          </div>
          <h2 className="text-lg font-extrabold text-white">Sign in to activate your TV</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-400">
            Sign in on web first, then enter the 6-character pairing code displayed on your TV screen.
          </p>
          <Link
            href="/login?redirect=/tvactivate"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-8 text-sm font-bold text-white shadow-[0_6px_22px_rgba(255,109,46,0.4)] transition hover:brightness-110"
          >
            Sign In
          </Link>
        </GlassPanel>
      ) : (
        <div className="space-y-6">
          {/* 1. PAIRING CODE INPUT CARD */}
          <GlassPanel className="border-white/10 bg-[#1E222A] p-6 sm:p-8">
            <form onSubmit={activateTv} className="mx-auto max-w-md text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-[#FF6D2E]/30 bg-[#FF6D2E]/15 text-[#FF8A54]">
                <Tv size={22} />
              </div>
              <h2 className="text-lg font-extrabold text-white">Enter TV Pairing Code</h2>
              <p className="mt-1.5 text-xs text-zinc-400">
                Type or paste the 6-character code shown on your Smart TV app.
              </p>

              {/* 6-Box Segmented Code Input */}
              <div className="mt-6 flex items-center justify-center gap-2 sm:gap-3">
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="text"
                    maxLength={CODE_LEN}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    aria-label={`TV code character ${idx + 1}`}
                    className="h-14 w-11 rounded-xl border border-white/15 bg-[#14161A] text-center font-mono text-2xl font-black uppercase text-white outline-none transition focus:border-[#FF6D2E] focus:ring-2 focus:ring-[#FF6D2E]/30 sm:h-16 sm:w-13"
                  />
                ))}
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-400">
                  {error}
                </div>
              )}

              {message && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>{message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || fullCode.length < 4}
                className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-8 text-sm font-bold text-white shadow-[0_6px_22px_rgba(255,109,46,0.4)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Activating TV...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} /> Activate TV
                  </>
                )}
              </button>

              {/* Quick Test Pairing Code Helper */}
              <div className="mt-5 border-t border-white/[0.08] pt-4">
                <button
                  type="button"
                  disabled={generatingTest}
                  onClick={generateTestTvCode}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition hover:text-[#FF8A54]"
                >
                  <Sparkles size={13} className="text-[#FF8A54]" />
                  {generatingTest ? 'Generating test code...' : 'Testing without a TV? Generate a live TV pairing code'}
                </button>
                {testCode && (
                  <p className="mt-2 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#14161A] px-3 py-1 font-mono text-xs text-zinc-300">
                    Active test code: <strong className="text-[#FF8A54]">{testCode}</strong>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(testCode);
                        showToast({ message: `Copied ${testCode}`, variant: 'info' });
                      }}
                      className="text-zinc-400 hover:text-white"
                      aria-label="Copy test code"
                    >
                      <Copy size={12} />
                    </button>
                  </p>
                )}
              </div>
            </form>
          </GlassPanel>

          {/* 2. HOW IT WORKS STEPS */}
          <GlassPanel className="border-white/10 bg-[#1E222A]">
            <h3 className="mb-4 text-sm font-extrabold uppercase tracking-[0.12em] text-zinc-300">
              How to Connect Your TV
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  step: '01',
                  title: 'Open TV App',
                  desc: 'Launch MaxxPixels on your Android TV, Fire TV, or Smart TV.',
                },
                {
                  step: '02',
                  title: 'Get 6-Char Code',
                  desc: 'Select "Sign In with TV Code" to display your unique pairing code.',
                },
                {
                  step: '03',
                  title: 'Enter & Watch',
                  desc: 'Enter the code above. Your TV signs in automatically in seconds.',
                },
              ].map((s) => (
                <div key={s.step} className="rounded-xl border border-white/10 bg-[#14161A] p-4">
                  <span className="text-xs font-black text-[#FF8A54]">STEP {s.step}</span>
                  <p className="mt-1 text-sm font-bold text-white">{s.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </GlassPanel>

          {/* 3. CONNECTED SMART TVS */}
          <GlassPanel className="border-white/10 bg-[#1E222A]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#FF6D2E]/15 text-[#FF8A54]">
                  <Monitor size={16} />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Linked Smart TVs ({activeTvs.length})
                  </h3>
                  {summaryQ.data?.plan && (
                    <p className="text-[11px] text-zinc-400">
                      {summaryQ.data.usage?.activeDevicesCount ?? 0} of {summaryQ.data.plan.maxDevices ?? 2} total plan devices active ({summaryQ.data.plan.planName})
                    </p>
                  )}
                </div>
              </div>
              <Link
                href={userPageHref(user, 'settings')}
                className="text-xs font-bold text-[#FF8A54] transition hover:text-[#FF6D2E]"
              >
                Manage All Devices →
              </Link>
            </div>

            {activeTvs.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-[#14161A] px-4 py-5 text-center text-xs text-zinc-400">
                No Smart TVs linked yet. Activate one above to stream on the big screen.
              </p>
            ) : (
              <div className="space-y-2.5">
                {activeTvs.map((tv) => (
                  <div
                    key={tv.id ?? tv.deviceId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#14161A] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#FF6D2E]/15 text-[#FF8A54]">
                        <Tv size={17} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">
                          {tv.deviceName || 'Smart TV'}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          {(tv.platform || 'SMART TV').replace('_', ' ')} · Active
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={revokingId === tv.deviceId}
                      onClick={() => disconnectTv(tv)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400 transition hover:border-red-500/45 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {revokingId === tv.deviceId ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <LogOut size={12} />
                      )}
                      Sign Out TV
                    </button>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>
        </div>
      )}
    </PageShell>
  );
}
