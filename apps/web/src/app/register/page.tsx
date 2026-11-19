'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { EVENTS } from '@ott/shared';
import { setStoredUser } from '@/lib/auth';
import { trackEvent, trackFbEvent } from '@/lib/analytics';
import { GlassPanel, PageHero, PageShell } from '@/components/layout/PageChrome';
import VerifiedSignupForm from '@/components/auth/VerifiedSignupForm';
import { UserPlus } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();

  return (
    <PageShell narrow>
      <PageHero
        eyebrow="New Member Registration"
        title="Create MaxxPixels Account"
        description="Complete all required details and verify your mobile number to create your account and start streaming."
        icon={UserPlus}
      />
      <div className="mx-auto w-full max-w-lg">
        <GlassPanel className="p-6 sm:p-8 rounded-2xl border border-primary/20 shadow-glow">
          <VerifiedSignupForm
            onRegistered={(user) => {
              setStoredUser(user);
              trackEvent(EVENTS.REGISTER, { method: 'verified_signup' });
              trackFbEvent('CompleteRegistration', { content_name: 'verified_signup' });
              router.push('/');
            }}
          />
        </GlassPanel>

        <p className="text-center text-sm text-muted-text mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:text-primary-light font-bold transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
