'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useCategories, useContentByCategory, type Category } from '@ott/shared';
import CatalogGrid from '@/components/browse/CatalogGrid';
import { EmptyState, PageHero, PageShell } from '@/components/layout/PageChrome';
import { Layers } from 'lucide-react';
import { useStoredUser } from '@/lib/auth';

export default function ByCategoryPage() {
  const params = useParams();
  const rawParam = String(params?.id ?? params?.slug ?? '').toLowerCase().trim();
  const { session } = useStoredUser();

  const categoriesQ = useCategories();
  const categoriesList = useMemo((): Category[] => {
    const raw = categoriesQ.data as any;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.result)) return raw.result;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  }, [categoriesQ.data]);

  const category = useMemo(() => {
    if (!rawParam) return undefined;
    return categoriesList.find((item) => {
      const idStr = String(item.id ?? '');
      const rawSlug = String(item.slug || item.name || '');
      const slugStr = rawSlug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
      return (
        idStr === rawParam ||
        slugStr === rawParam ||
        rawParam.endsWith(`-${idStr}`) ||
        rawParam.startsWith(`${slugStr}-`)
      );
    });
  }, [categoriesList, rawParam]);

  const categoryId = category ? Number(category.id) : Number(rawParam) || 1;
  const contentQ = useContentByCategory(categoryId, 1, session);
  const items = contentQ.data?.pages?.flatMap((p) => p.result ?? []) ?? [];

  const categoryTitle = category?.name
    ?? (rawParam ? rawParam.charAt(0).toUpperCase() + rawParam.slice(1).replace(/-/g, ' ') : 'Category');

  return (
    <PageShell>
      <PageHero
        backHref="/"
        backLabel="Back to Home"
        eyebrow="Browse by genre"
        title={categoryTitle}
        description={`Movies and series selected from ${categoryTitle}.`}
        icon={Layers}
      />
      <CatalogGrid
        items={items}
        loading={contentQ.isLoading}
        hasMore={contentQ.hasNextPage}
        loadingMore={contentQ.isFetchingNextPage}
        onLoadMore={() => void contentQ.fetchNextPage()}
      />
      {items.length === 0 && !contentQ.isLoading && (
        <EmptyState
          title="No content found"
          description="This category does not have titles yet. Try another shelf."
          actionHref="/search"
          actionLabel="Browse More"
          icon={Layers}
        />
      )}
    </PageShell>
  );
}
