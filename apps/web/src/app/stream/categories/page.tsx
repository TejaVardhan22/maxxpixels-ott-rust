'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Film, Sparkles, Tv } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TitleCard } from '@/components/streaming/title-card';
import { fetchCatalog, fetchCategories } from '@/lib/streaming/api';
import { useStoredUser } from '@/lib/auth';
import type { StreamTitle } from '@/lib/streaming/types';
import type { LucideIcon } from 'lucide-react';

const TABS = ['movies', 'series'] as const;

const icons: Record<string, LucideIcon> = {
  movies: Film,
  series: Tv,
  default: Sparkles,
};

const tabLabels: Record<(typeof TABS)[number], string> = {
  movies: 'Movies',
  series: 'Web Series',
};

function filterTitles(list: StreamTitle[], tab: (typeof TABS)[number], sort: string) {
  let filtered = [...list];
  if (tab === 'movies') filtered = filtered.filter((t) => t.kind === 'movie');
  if (tab === 'series') filtered = filtered.filter((t) => t.kind === 'series');
  if (sort === 'rating') filtered.sort((a, b) => b.rating - a.rating);
  if (sort === 'year') filtered.sort((a, b) => b.year - a.year);
  if (sort === 'title') filtered.sort((a, b) => a.title.localeCompare(b.title));
  return filtered;
}

export default function StreamCategoriesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" aria-busy="true" />}>
      <StreamCategoriesContent />
    </Suspense>
  );
}

function StreamCategoriesContent() {
  const sp = useSearchParams();
  const { session } = useStoredUser();
  const [tab, setTab] = useState<(typeof TABS)[number]>('movies');
  const [sort, setSort] = useState('rating');
  const catalogQ = useQuery({
    queryKey: ['stream', 'catalog', session?.userId ?? 0, session?.deviceId ?? 'web'],
    queryFn: () => fetchCatalog(undefined, session),
  });
  const categoriesQ = useQuery({ queryKey: ['stream', 'categories'], queryFn: () => fetchCategories() });

  useEffect(() => {
    const raw = sp.get('q')?.toLowerCase();
    if (raw && (TABS as readonly string[]).includes(raw)) setTab(raw as (typeof TABS)[number]);
  }, [sp]);

  const titles = useMemo(() => filterTitles(catalogQ.data ?? [], tab, sort), [catalogQ.data, tab, sort]);
  const backendCategories = (categoriesQ.data?.result ?? []).slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-12">
      <h1 className="font-display text-2xl font-bold">Browse</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4">
        {backendCategories.map((cat, index) => {
          const name = String((cat as { name?: unknown }).name ?? `Category ${index + 1}`);
          const Icon = icons[TABS[index] ?? 'default'] ?? Sparkles;
          return (
            <Link key={String((cat as { id?: unknown }).id ?? name)} href={`/bycategory/${String((cat as { id?: unknown }).id ?? '')}`}>
              <Card className="h-full border-white/10 bg-white/[0.03] transition-all hover:border-gold/30 hover:bg-white/[0.06]">
                <CardHeader className="flex flex-row items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/15 text-gold">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{name}</CardTitle>
                    <CardDescription>Explore backend catalog titles.</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as (typeof TABS)[number])} className="w-full lg:w-auto">
          <TabsList className="flex h-auto flex-wrap gap-1 bg-white/5 p-1">
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t} className="text-xs sm:text-sm">
                {tabLabels[t]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-full rounded-full lg:w-[200px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rating">Sort: Top rated</SelectItem>
            <SelectItem value="year">Sort: Newest</SelectItem>
            <SelectItem value="title">Sort: A-Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {catalogQ.isLoading && Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-56 w-36 animate-pulse rounded-xl bg-white/[0.06]" />
        ))}
        {!catalogQ.isLoading && titles.map((t) => (
          <TitleCard key={t.id} title={t} />
        ))}
      </div>
    </div>
  );
}
