'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Globe, Layers, Loader2, Search as SearchIcon, TrendingUp, X } from 'lucide-react';
import {
  EVENTS,
  getGenreUrl,
  resolveImageUrl,
  useCategories,
  useLanguages,
  useSearch,
  useSections,
} from '@ott/shared';
import type { Category, ContentItem, Language } from '@ott/shared';
import ContentCard from '@/components/home/ContentCard';
import ContentRail from '@/components/home/ContentRail';
import { PageHero, PageShell } from '@/components/layout/PageChrome';
import { trackEvent, trackFbEvent } from '@/lib/analytics';
import { useStoredUser } from '@/lib/auth';

const SEARCH_DEBOUNCE_MS = 350;

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams?.get('q') ?? '';
  const [query, setQuery] = useState(initialQ);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ.trim());
  const { session } = useStoredUser();
  const analyticsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external URL ?q= changes into local input state
  useEffect(() => {
    const qParam = searchParams?.get('q') ?? '';
    setQuery(qParam);
    setDebouncedQuery(qParam.trim());
  }, [searchParams]);

  // Properly debounce API search + URL sync (350ms)
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setDebouncedQuery('');
      if (searchParams?.get('q')) {
        router.replace('/search', { scroll: false });
      }
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(trimmed);
      if (searchParams?.get('q') !== trimmed) {
        router.replace(`/search?q=${encodeURIComponent(trimmed)}`, { scroll: false });
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, router, searchParams]);

  // Debounced analytics tracking (800ms)
  useEffect(() => {
    if (!debouncedQuery) return;
    if (analyticsTimerRef.current) clearTimeout(analyticsTimerRef.current);
    analyticsTimerRef.current = setTimeout(() => {
      trackEvent(EVENTS.SEARCH, { search_term: debouncedQuery });
      trackFbEvent('Search', { search_string: debouncedQuery });
    }, 800);
    return () => {
      if (analyticsTimerRef.current) clearTimeout(analyticsTimerRef.current);
    };
  }, [debouncedQuery]);

  const searchQ = useSearch(debouncedQuery, 1, session);
  const categoriesQ = useCategories();
  const languagesQ = useLanguages();
  const sectionsQ = useSections(0, 1, session);

  const results = useMemo<ContentItem[]>(() => {
    if (!debouncedQuery) return [];
    const raw = searchQ.data as any;
    if (Array.isArray(raw?.result)) return raw.result;
    if (Array.isArray(raw?.data?.content)) return raw.data.content;
    if (Array.isArray(raw?.data)) return raw.data;
    if (Array.isArray(raw)) return raw;
    return [];
  }, [debouncedQuery, searchQ.data]);

  const categories = (categoriesQ.data?.result ?? []) as Category[];
  const languages = (languagesQ.data?.result ?? []) as Language[];
  const trendingItems = sectionsQ.data?.pages?.[0]?.result?.[0]?.data ?? [];

  const isDebouncing = query.trim() !== debouncedQuery;
  const isSearching = Boolean(query.trim()) && (isDebouncing || searchQ.isLoading || searchQ.isFetching);

  return (
    <PageShell>
      <PageHero
        eyebrow="Discover"
        title="Search & Explore"
        description="Find movies, web series, short films, microdramas, podcasts, and regional cinema across MaxxPixels."
        icon={SearchIcon}
      >
        <div className="relative max-w-2xl">
          <SearchIcon
            size={19}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#FF8A54]"
            strokeWidth={2}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies, series, podcasts, genres..."
            className="w-full rounded-xl border border-white/15 bg-[#1A1D24] py-3.5 pl-12 pr-12 text-sm font-medium text-white transition placeholder:text-zinc-500 focus:border-[#FF6D2E] focus:outline-none focus:ring-2 focus:ring-[#FF6D2E]/25 sm:text-base"
            autoFocus
          />
          {isSearching ? (
            <Loader2
              size={17}
              className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-[#FF6D2E]"
            />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setDebouncedQuery('');
              }}
              className="absolute right-3.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-zinc-300 transition hover:bg-white/20 hover:text-white"
              aria-label="Clear search"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          ) : null}
        </div>
      </PageHero>

      <div>
        {query.trim().length > 0 ? (
          <>
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-zinc-400">
                {isSearching ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-[#FF6D2E]" />
                    Searching for &ldquo;{query.trim()}&rdquo;…
                  </span>
                ) : (
                  <>
                    <span className="font-bold text-white">{results.length}</span>
                    {results.length === 1 ? ' result for ' : ' results for '}
                    <span className="font-bold text-white">&ldquo;{debouncedQuery}&rdquo;</span>
                  </>
                )}
              </p>
            </div>

            {results.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-3.5 gap-y-7 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                {results.map((item: ContentItem, idx: number) => (
                  <div key={item.id ?? idx} className="flex justify-center">
                    <ContentCard item={item} />
                  </div>
                ))}
              </div>
            ) : (
              !isSearching && (
                <div className="mx-auto my-16 max-w-md rounded-2xl border border-white/10 bg-[#1E222A] p-10 text-center">
                  <SearchIcon size={32} className="mx-auto mb-4 text-zinc-500" strokeWidth={1.5} />
                  <p className="text-lg font-bold text-white">No matching titles</p>
                  <p className="mt-1.5 text-sm text-zinc-400">
                    Try a different keyword or explore by genre and language below.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setDebouncedQuery('');
                    }}
                    className="mt-5 rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-6 py-2.5 text-xs font-bold text-white shadow-md transition hover:brightness-110"
                  >
                    Clear Search
                  </button>
                </div>
              )
            )}
          </>
        ) : (
          <div className="space-y-12">
            {/* Quick Searches driven dynamically from Categories API */}
            {categories.length > 0 && (
              <div>
                <div className="mb-3.5 flex items-center gap-2">
                  <TrendingUp size={15} className="text-[#FF6D2E]" />
                  <h2 className="text-base font-bold text-white">Quick Searches</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {categories.slice(0, 10).map((cat) => (
                    <button
                      key={`quick-${cat.id}`}
                      type="button"
                      onClick={() => setQuery(cat.name ?? '')}
                      className="rounded-full border border-white/15 bg-[#1E222A] px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:border-[#FF6D2E]/60 hover:bg-[#262B36] hover:text-white"
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Now Rail */}
            {trendingItems.length > 0 && (
              <div className="-mx-4 sm:-mx-6 lg:-mx-12">
                <ContentRail title="Trending Now" items={trendingItems} />
              </div>
            )}

            {/* Browse by Genre */}
            {categories.length > 0 && (
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Layers size={15} className="text-[#FF6D2E]" />
                  <h2 className="text-base font-bold text-white">Browse by Genre</h2>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={getGenreUrl(cat as any)}
                      className="group relative h-28 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1E222A] transition hover:-translate-y-0.5 hover:border-[#FF6D2E]/60 sm:h-32"
                    >
                      {cat.image ? (
                        <img
                          src={resolveImageUrl(cat.image)}
                          alt={cat.name ?? ''}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#232833] to-[#14161A]">
                          <Layers size={24} className="text-white/20" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
                      <div className="absolute inset-x-3 bottom-3">
                        <span className="text-sm font-bold text-white">{cat.name}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Browse by Language */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Globe size={15} className="text-[#FF6D2E]" />
                <h2 className="text-base font-bold text-white">Browse by Language</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/"
                  className="rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:brightness-110"
                >
                  Kannada
                </Link>
                <Link
                  href="/all-indian"
                  className="rounded-full border border-[#FF6D2E]/40 bg-[#FF6D2E]/15 px-4 py-2 text-xs font-bold text-[#FF8A54] transition hover:bg-[#FF6D2E]/25"
                >
                  All Indian (Excl. Kannada)
                </Link>
                {languages
                  .filter((l) => String(l.name ?? '').toLowerCase() !== 'kannada')
                  .map((lang) => (
                    <Link
                      key={lang.id}
                      href={`/${encodeURIComponent(String(lang.name ?? '').toLowerCase().trim())}`}
                      className="rounded-full border border-white/15 bg-[#1E222A] px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:border-[#FF6D2E]/50 hover:text-white"
                    >
                      {lang.name}
                    </Link>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <div className="py-20 text-center text-sm text-zinc-400">Loading search…</div>
        </PageShell>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}
