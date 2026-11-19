import type { Metadata } from 'next';
import { StreamingShell } from '@/components/streaming/streaming-shell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'MaxxPixels Stream - Watch Movies & Series',
  description: 'Premium OTT experience powered by the MaxxPixels backend catalog',
};

export default function StreamLayout({ children }: { children: React.ReactNode }) {
  return <StreamingShell>{children}</StreamingShell>;
}
