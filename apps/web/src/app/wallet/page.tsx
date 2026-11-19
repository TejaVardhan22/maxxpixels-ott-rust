import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { EmptyState, PageShell } from '@/components/layout/PageChrome';

export default function WalletPage() {
  return (
    <PageShell narrow>
      <EmptyState
        title="Wallet is not available"
        description="Wallet top-ups and subscription payments are processed via the Spring Boot backend."
        actionHref="/subscription"
        actionLabel="View Plans"
        icon={CreditCard}
      />
      <div className="mt-5 text-center">
        <Link href="/myspace" className="text-sm font-bold text-gold hover:underline">
          Back to My Space
        </Link>
      </div>
    </PageShell>
  );
}
