'use client';

import { StreamHeader } from '@/components/streaming/stream-header';
import { StreamBottomNav } from '@/components/streaming/stream-bottom-nav';

export function StreamingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stream-bg text-white antialiased">
      <StreamHeader />
      <main className="lg:pl-56 3xl:pl-64 tv:pl-72 min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)] pb-24 lg:pb-8">
        {children}
      </main>
      <StreamBottomNav />
    </div>
  );
}
