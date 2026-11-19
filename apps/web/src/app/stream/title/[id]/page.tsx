'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchTitleById } from '@/lib/streaming/api';
import { useStoredUser } from '@/lib/auth';
import { TitleDetailView } from './title-detail-view';

export default function StreamTitlePage({ params }: { params: { id: string } }) {
  const { session } = useStoredUser();
  const titleQ = useQuery({
    queryKey: ['stream', 'title', params.id, session?.userId ?? 0, session?.deviceId ?? 'web'],
    queryFn: () => fetchTitleById(params.id, session),
  });

  if (titleQ.isLoading) {
    return <div className="mx-auto mt-28 h-[60vh] max-w-6xl animate-pulse rounded-[2rem] bg-white/[0.06]" />;
  }

  if (!titleQ.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-32 text-center">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-gold/80">Title unavailable</p>
        <h1 className="mt-3 font-display text-3xl font-black text-white">This title was not found.</h1>
      </div>
    );
  }

  return <TitleDetailView title={titleQ.data} />;
}
