'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  Gift,
  Link2,
  Lock,
  Share2,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { getUserToken } from '@ott/shared';
import { useStoredUser } from '@/lib/auth';
import { userPageHref } from '@/lib/userRoutes';
import { EmptyState, PageHero, PageShell } from '@/components/layout/PageChrome';

interface ReferralHistoryItem {
  id: number;
  referredUserId: number;
  friendName: string;
  referralCode: string;
  status: string;
  rewardType: string;
  rewardDays: number;
  rewardAmount: number;
  creditedAt?: string | null;
  createdAt: string;
}

interface ReferralSummary {
  referralCode: string;
  rewardConfig: {
    rewardType: string;
    rewardDays: number;
  };
  stats: {
    totalInvited: number;
    pendingCount: number;
    rewardedCount: number;
    totalRewardDays: number;
    totalRewardAmount: number;
  };
  appliedReferral?: {
    referralCode: string;
    status: string;
    rewardDays: number;
    referrerName: string;
  } | null;
  history: ReferralHistoryItem[];
}

function authHeaders(): Record<string, string> {
  const token = getUserToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }
  return headers;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function ReferAndEarnPage() {
  const { user, isLoggedIn } = useStoredUser();
  const queryClient = useQueryClient();

  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);
  const [friendCode, setFriendCode] = useState('');
  const [applyFeedback, setApplyFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const referralQ = useQuery<ReferralSummary>({
    queryKey: ['referrals-me'],
    queryFn: async () => {
      const res = await fetch('/api/v1/referrals/me', { headers: authHeaders() });
      if (!res.ok) throw new Error('Unable to load referral details');
      const json = await res.json();
      return (json?.data ?? json?.result ?? json) as ReferralSummary;
    },
    enabled: isLoggedIn,
    staleTime: 30_000,
  });

  const applyMut = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch('/api/v1/referrals/apply', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ referralCode: code }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || json?.error || 'Could not apply referral code.');
      }
      return json?.data ?? json;
    },
    onSuccess: (data) => {
      setFriendCode('');
      setApplyFeedback({
        ok: true,
        text:
          data?.codeType === 'MARKETING_AGENT'
            ? `Partner code linked to ${data?.referrerName || 'Marketing Agent'}!`
            : `Applied code from ${data?.referrerName || 'your friend'}! When you subscribe, they earn ${data?.rewardDays ?? 7} free VIP days.`,
      });
      queryClient.invalidateQueries({ queryKey: ['referrals-me'] });
    },
    onError: (err: Error) => {
      setApplyFeedback({ ok: false, text: err.message });
    },
  });

  const data = referralQ.data;
  const referralCode = data?.referralCode || '';
  const rewardDays = data?.rewardConfig?.rewardDays ?? 7;
  const shareUrl =
    typeof window !== 'undefined' && referralCode
      ? `${window.location.origin}/?ref=${encodeURIComponent(referralCode)}`
      : '';

  const copyText = async (value: string, kind: 'code' | 'link') => {
    if (!value) return;
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopiedType(kind);
      window.setTimeout(() => setCopiedType(null), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (!referralCode) return;
    const text = `Watch movies, web series & originals on MaxxPixels! Use my referral code ${referralCode} to join: ${shareUrl}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Join MaxxPixels', text, url: shareUrl });
        return;
      } catch {
        return;
      }
    }
    await copyText(shareUrl || referralCode, 'link');
  };

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = friendCode.trim().toUpperCase();
    if (!cleaned) return;
    setApplyFeedback(null);
    applyMut.mutate(cleaned);
  };

  return (
    <PageShell narrow>
      <PageHero
        backHref={userPageHref(user, 'myspace')}
        backLabel="Back to My Space"
        eyebrow="Rewards"
        title="Refer & Earn"
        description={`Invite friends to MaxxPixels and earn ${rewardDays} free VIP days when they subscribe.`}
        icon={Gift}
      />

      {!isLoggedIn ? (
        <EmptyState
          title="Sign in to unlock your referral code"
          description="Get your personal invite link, track invited friends, and earn free VIP days automatically."
          actionHref="/login?redirect=/referandearn"
          actionLabel="Sign In"
          icon={Lock}
        />
      ) : (
        <div className="space-y-7">
          {/* HERO REFERRAL CODE CARD */}
          <section className="relative overflow-hidden rounded-2xl border border-[#FF6D2E]/30 bg-gradient-to-br from-[#241A16] via-[#1E222A] to-[#1A1D24] p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#FF6D2E]/15 blur-3xl" />

            <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF6D2E]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF8A54]">
                  <Sparkles size={12} /> +{rewardDays} Free VIP Days Per Friend
                </span>
                <h2 className="mt-3 text-xl font-black text-white sm:text-2xl">
                  Your Personal Referral Code
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  Share your code or invite link. Rewards are credited automatically once your friend subscribes.
                </p>
              </div>

              <div className="flex flex-col items-stretch gap-2.5 sm:items-end">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#FF6D2E]/40 bg-[#14161A] px-5 py-3">
                  <code className="font-mono text-xl font-black tracking-[0.18em] text-[#FF8A54]">
                    {referralQ.isLoading ? '••••••' : referralCode || '—'}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyText(referralCode, 'code')}
                    disabled={!referralCode}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#FF6D2E]/15 px-3 text-xs font-bold text-[#FF8A54] transition hover:bg-[#FF6D2E] hover:text-white disabled:opacity-40"
                  >
                    {copiedType === 'code' ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedType === 'code' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyText(shareUrl, 'link')}
                    disabled={!shareUrl}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 text-xs font-semibold text-white transition hover:border-white/35 hover:bg-white/15 disabled:opacity-40"
                  >
                    {copiedType === 'link' ? <Check size={13} className="text-emerald-400" /> : <Link2 size={13} />}
                    <span>{copiedType === 'link' ? 'Link Copied' : 'Copy Invite Link'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    disabled={!referralCode}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-4 text-xs font-bold text-white shadow-[0_6px_20px_rgba(255,109,46,0.35)] transition hover:brightness-110 disabled:opacity-40"
                  >
                    <Share2 size={13} />
                    <span>Share</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* LIVE STATS ROW */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-white/[0.08] bg-[#1E222A] p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Invited
                </span>
                <Users size={16} className="text-[#FF8A54]" />
              </div>
              <p className="mt-2 text-2xl font-black text-white sm:text-3xl">
                {data?.stats?.totalInvited ?? 0}
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#1E222A] p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Rewarded
                </span>
                <CheckCircle2 size={16} className="text-emerald-400" />
              </div>
              <p className="mt-2 text-2xl font-black text-white sm:text-3xl">
                {data?.stats?.rewardedCount ?? 0}
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#1E222A] p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  VIP Days Earned
                </span>
                <Crown size={16} className="text-[#FF8A54]" />
              </div>
              <p className="mt-2 text-2xl font-black text-[#FF8A54] sm:text-3xl">
                +{data?.stats?.totalRewardDays ?? 0}
              </p>
            </div>
          </div>

          {/* APPLY A FRIEND'S REFERRAL CODE */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#1E222A] p-5 sm:p-6">
            {data?.appliedReferral ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">
                      Referred by {data.appliedReferral.referrerName}
                    </p>
                    <p className="text-xs text-zinc-400">
                      Code <span className="font-mono font-semibold text-zinc-200">{data.appliedReferral.referralCode}</span> applied
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-300">
                  {data.appliedReferral.status === 'REWARDED' ? 'Reward Credited' : 'Linked'}
                </span>
              </div>
            ) : (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <UserPlus size={16} className="text-[#FF8A54]" />
                  <h3 className="text-sm font-bold text-white">Have a referral or partner code?</h3>
                </div>
                <form onSubmit={handleApplySubmit} className="flex flex-col gap-2.5 sm:flex-row">
                  <input
                    type="text"
                    value={friendCode}
                    onChange={(e) => {
                      setFriendCode(e.target.value.toUpperCase());
                      setApplyFeedback(null);
                    }}
                    placeholder="Enter friend referral or agent code"
                    className="ott-input flex-1 font-mono uppercase tracking-wider"
                    maxLength={32}
                  />
                  <button
                    type="submit"
                    disabled={applyMut.isPending || !friendCode.trim()}
                    className="btn-primary h-12 shrink-0 px-7 text-xs disabled:opacity-45"
                  >
                    {applyMut.isPending ? 'Applying…' : 'Apply Code'}
                  </button>
                </form>
                {applyFeedback && (
                  <p
                    className={`mt-2.5 text-xs font-medium ${
                      applyFeedback.ok ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {applyFeedback.text}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* HOW IT WORKS */}
          <section className="grid gap-3 sm:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Share Your Code',
                desc: 'Send your personal referral code or invite link to friends.',
              },
              {
                step: '02',
                title: 'Friend Joins & Subscribes',
                desc: 'Your friend signs up with your link or applies your code.',
              },
              {
                step: '03',
                title: `Earn ${rewardDays} Free VIP Days`,
                desc: 'Your VIP access extends automatically as soon as they subscribe.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-2xl border border-white/[0.06] bg-[#1E222A]/60 p-4"
              >
                <span className="font-mono text-xs font-black text-[#FF8A54]">{item.step}</span>
                <h4 className="mt-1.5 text-sm font-bold text-white">{item.title}</h4>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{item.desc}</p>
              </div>
            ))}
          </section>

          {/* REFERRAL HISTORY */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight text-white">Referral History</h2>
              {(data?.history?.length ?? 0) > 0 && (
                <span className="text-xs text-zinc-400">
                  {data?.history.length} total
                </span>
              )}
            </div>

            {referralQ.isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((n) => (
                  <div key={n} className="h-16 animate-pulse rounded-2xl bg-[#1E222A]" />
                ))}
              </div>
            ) : (data?.history?.length ?? 0) > 0 ? (
              <div className="space-y-2.5">
                {data!.history.map((item) => {
                  const isRewarded = item.status === 'REWARDED';
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#1E222A] px-5 py-4"
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-black ${
                            isRewarded
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-[#FF6D2E]/15 text-[#FF8A54]'
                          }`}
                        >
                          {item.friendName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{item.friendName}</p>
                          <p className="mt-0.5 text-xs text-zinc-400">
                            Joined {formatDate(item.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {isRewarded ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
                            <Crown size={12} /> +{item.rewardDays} VIP Days
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-zinc-300">
                            <Clock size={12} className="text-[#FF8A54]" /> Signed Up
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.07] bg-[#1E222A]/60 px-6 py-10 text-center">
                <Gift size={28} className="mx-auto mb-3 text-[#FF8A54]" />
                <p className="text-sm font-bold text-white">No referrals yet</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Share your code above with friends to start earning free VIP days.
                </p>
                <Link
                  href="/subscription"
                  className="mt-4 inline-flex text-xs font-semibold text-[#FF8A54] hover:underline"
                >
                  View VIP Plans
                </Link>
              </div>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}
