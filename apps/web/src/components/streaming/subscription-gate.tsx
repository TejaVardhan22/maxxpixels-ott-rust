'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PlanTier } from '@/lib/streaming/types';
import { useSubscriptionStatus } from '@ott/shared';
import { useStoredUser } from '@/lib/auth';

export function SubscriptionGate({
  requires,
  children,
}: {
  requires: PlanTier;
  children: React.ReactNode;
}) {
  const { user, isLoggedIn } = useStoredUser();
  const subscriptionQ = useSubscriptionStatus(isLoggedIn && requires !== 'free');
  const hasBackendPlan =
    subscriptionQ.data?.is_subscribed === true ||
    user?.is_buy === 1;
  const ok = requires === 'free' || hasBackendPlan;
  const tier = hasBackendPlan ? 'premium' : 'free';

  if (ok) return <>{children}</>;

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
        <Lock className="h-7 w-7 text-gold" />
      </div>
      <div>
        <h2 className="font-display text-xl font-bold">Subscriber only</h2>
        <p className="mt-2 max-w-sm text-sm text-desc-text">
          This title needs a <span className="font-semibold text-white">{requires}</span> plan. You are on{' '}
          <span className="font-semibold text-white">{tier}</span>.
        </p>
      </div>
      <Button variant="accent" className="rounded-full" asChild>
        <Link href={isLoggedIn ? '/stream/plans' : '/stream/auth/login'}>
          {isLoggedIn ? 'View plans' : 'Sign in'}
        </Link>
      </Button>
    </div>
  );
}
