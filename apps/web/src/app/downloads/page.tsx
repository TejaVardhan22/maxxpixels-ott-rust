import { Download } from 'lucide-react';
import { EmptyState, PageHero, PageShell } from '@/components/layout/PageChrome';

export default function DownloadsPage() {
  return (
    <PageShell narrow>
      <PageHero eyebrow="Offline" title="Downloads" description="Take titles with you on supported mobile devices." icon={Download} />
      <EmptyState title="Mobile app only" description="Downloaded content is available on the MaxxPixels mobile app." icon={Download} />
    </PageShell>
  );
}
