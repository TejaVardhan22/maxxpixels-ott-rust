'use client';

import { useReferEarnHistory } from '@ott/shared';
import type { ReferEarn } from '@ott/shared';
import { Gift, Copy, Lock } from 'lucide-react';
import { useState } from 'react';
import { useStoredUser } from '@/lib/auth';
import { EmptyState, GlassPanel, PageHero, PageShell } from '@/components/layout/PageChrome';

export default function ReferAndEarnPage() {
  const { user, isLoggedIn } = useStoredUser();
  const historyQ = useReferEarnHistory(user?.id);
  const history = (historyQ.data?.result ?? []) as ReferEarn[];
  const [copied, setCopied] = useState(false);
  const referralCode = user?.reference_code || '';

  const copyReferralCode = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <PageShell narrow>
      <PageHero eyebrow="Rewards" title="Refer & Earn" description="Share MaxxPixels and track rewards on your account." icon={Gift} />
      <GlassPanel className="mb-8 text-center">
        <p className="mb-3 text-sm text-desc-text">Share your referral code with friends</p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <code className="rounded-2xl border border-gold/25 bg-gold/10 px-6 py-3 font-mono text-xl font-black tracking-wider text-gold">
            {referralCode || 'SIGN IN'}
          </code>
          <button
            type="button"
            onClick={copyReferralCode}
            disabled={!referralCode}
            className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-white transition-colors hover:bg-gold/20 hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Copy referral code"
          >
            <Copy size={18} />
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-text">{copied ? 'Referral code copied.' : 'Earn rewards when friends subscribe.'}</p>
      </GlassPanel>

      <h2 className="mb-4 font-display text-xl font-black text-white">Referral History</h2>
      <div className="space-y-3">
        {history.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-xl">
            <div>
              <p className="text-sm font-bold text-white">Referral</p>
              <p className="text-xs text-muted-text">{r.created_at}</p>
            </div>
            <span className="font-black text-emerald-400">+₹{r.amount}</span>
          </div>
        ))}
        {!isLoggedIn && <EmptyState title="Sign in to view rewards" description="Your referral rewards are attached to your profile." actionHref="/login" actionLabel="Sign In" icon={Lock} />}
        {isLoggedIn && history.length === 0 && !historyQ.isLoading && <EmptyState title="No referrals yet" description="Share your code to start earning rewards." icon={Gift} />}
      </div>
    </PageShell>
  );
}
