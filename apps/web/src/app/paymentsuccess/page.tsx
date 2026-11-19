'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { trackEvent, trackFbEvent } from '@/lib/analytics';
import { EVENTS } from '@ott/shared';
import { GlassPanel, PageShell } from '@/components/layout/PageChrome';

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" aria-busy="true" />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const isMobile = searchParams.get('source') === 'mobile';

  useEffect(() => {
    trackEvent(EVENTS.PAYMENT_SUCCESS);
    trackEvent(EVENTS.SUBSCRIPTION_PURCHASE);
    trackFbEvent('Purchase', { currency: 'INR', value: 0 });
    trackFbEvent('Subscribe');
  }, []);

  return (
    <PageShell narrow>
      <GlassPanel className="mx-auto mt-10 max-w-lg text-center">
        <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-[2rem] bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
          <CheckCircle size={44} />
        </div>
        <h1 className="font-display text-4xl font-black tracking-tight text-white">Payment Successful</h1>
        <p className="mt-3 text-sm leading-6 text-desc-text">Your subscription is active. The premium shelf is unlocked.</p>
        {isMobile ? (
          <button
            onClick={() => {
              const referrer = document.referrer;
              const allowedReferrers = ['razorpay.com', 'stripe.com', 'juspay.in', 'localhost'];
              const isValidReferrer = !referrer || allowedReferrers.some((r) => referrer.includes(r));
              if (isValidReferrer) {
                window.location.href = 'ott://payment-success';
              }
            }}
            className="btn-primary mt-8 rounded-full px-8 py-3 text-sm"
          >
            Return to App
          </button>
        ) : (
          <Link href="/" className="btn-primary mt-8 inline-flex rounded-full px-8 py-3 text-sm">
            Start Watching
          </Link>
        )}
      </GlassPanel>
    </PageShell>
  );
}
