'use client';

import { useParams } from 'next/navigation';
import { useCastDetail, useContentByCast, resolveImageUrl } from '@ott/shared';
import type { ContentItem } from '@ott/shared';
import ContentCard from '@/components/home/ContentCard';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Skeleton from '@/components/ui/Skeleton';

export default function CastPage() {
  const { id } = useParams();
  const castId = Number(id);
  const castQ = useCastDetail(castId);
  const contentQ = useContentByCast(castId);
  const rawCast = castQ.data as any;
  const cast = Array.isArray(rawCast) ? rawCast[0] : rawCast?.result?.[0] ?? rawCast?.data?.[0] ?? (rawCast?.id ? rawCast : undefined);
  const items = contentQ.data?.pages?.flatMap((p) => p.result ?? []) ?? [];

  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-12 py-8">
      <Link href="/" className="inline-flex items-center gap-2 text-desc-text hover:text-white mb-6 transition-colors">
        <ArrowLeft size={18} /> Back
      </Link>

      {castQ.isLoading ? (
        <div className="flex flex-col items-center mb-8">
          <Skeleton variant="circle" className="w-28 h-28 mb-4" />
          <Skeleton variant="text" className="w-40 h-6" />
        </div>
      ) : (
        <div className="flex flex-col items-center mb-8">
          <img
            src={resolveImageUrl(cast?.image)}
            alt={cast?.name ?? ''}
            className="w-28 h-28 rounded-full object-cover bg-shimmer mb-4"
          />
          <h1 className="text-3xl font-extrabold">{cast?.name}</h1>
          {cast?.type && <p className="text-primary text-sm mt-1">{cast.type}</p>}
          {cast?.personal_info && (
            <p className="text-desc-text text-sm mt-3 max-w-xl text-center">{cast.personal_info}</p>
          )}
        </div>
      )}

      <h2 className="text-xl font-bold mb-4">Filmography</h2>
      <div className="flex flex-wrap gap-3">
        {(items as ContentItem[]).map((item) => <ContentCard key={item.id} item={item} />)}
      </div>
    </div>
  );
}
