import Link from 'next/link';
import { XCircle } from 'lucide-react';
import { GlassPanel, PageShell } from '@/components/layout/PageChrome';

export default function PaymentCancelPage() {
  return (
    <PageShell narrow>
      <GlassPanel className="mx-auto mt-10 max-w-lg text-center">
        <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-[2rem] bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
          <XCircle size={44} />
        </div>
        <h1 className="font-display text-4xl font-black tracking-tight text-white">Payment Cancelled</h1>
        <p className="mt-3 text-sm leading-6 text-desc-text">Your payment was not completed. No charges were made.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/subscription" className="btn-primary rounded-full px-8 py-3 text-sm">Try Again</Link>
          <Link href="/" className="btn-secondary rounded-full px-8 py-3 text-sm">Go Home</Link>
        </div>
      </GlassPanel>
    </PageShell>
  );
}
