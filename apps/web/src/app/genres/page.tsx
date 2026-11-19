'use client';

import { useMemo } from 'react';
import { useCategories, resolveImageUrl, type Category, getGenreUrl } from '@ott/shared';
import { EmptyState, PageHero, PageShell } from '@/components/layout/PageChrome';
import { Layers } from 'lucide-react';
import Link from 'next/link';

export default function GenresHubPage() {
  const categoriesQ = useCategories();
  const categories = useMemo((): Category[] => {
    const raw = categoriesQ.data as any;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.result)) return raw.result;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  }, [categoriesQ.data]);

  return (
    <PageShell>
      <PageHero
        backHref="/"
        backLabel="Back to Home"
        eyebrow="Explore Genres"
        title="Popular Genres"
        description="Browse high-definition movies, original series, and short films sorted by your favorite genre."
        icon={Layers}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={getGenreUrl(cat as any)}
            className="explore-category-card group h-36 sm:h-44 rounded-2xl overflow-hidden relative ring-1 ring-white/10 transition-all duration-300 hover:scale-[1.02] hover:ring-primary/50"
          >
            {cat.image ? (
              <img
                src={resolveImageUrl(cat.image)}
                alt={cat.name ?? ''}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-[#172235]">
                <Layers size={32} className="text-primary-light/55" strokeWidth={1.5} />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <span className="text-white font-display font-black text-base sm:text-lg leading-tight block">
                {cat.name}
              </span>
              <span className="text-[11px] font-bold text-white/50 tracking-wider uppercase mt-1 block">
                Explore Genre &rarr;
              </span>
            </div>
          </Link>
        ))}
      </div>

      {categories.length === 0 && !categoriesQ.isLoading && (
        <EmptyState
          title="No genres found"
          description="Categories will appear here once configured."
          actionHref="/"
          actionLabel="Back Home"
          icon={Layers}
        />
      )}
    </PageShell>
  );
}
