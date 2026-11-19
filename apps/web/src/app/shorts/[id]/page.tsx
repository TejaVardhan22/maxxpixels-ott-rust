import { Clapperboard } from 'lucide-react';
import { EmptyState, PageShell } from '@/components/layout/PageChrome';

export default function ShortsDetailPage() {
  return (
    <PageShell narrow>
      <EmptyState
        title="Shorts are not available"
        description="This app is synced to the content setup for Movies, Short Films, and Web Series."
        actionHref="/search"
        actionLabel="Browse Content"
        icon={Clapperboard}
      />
    </PageShell>
  );
}
