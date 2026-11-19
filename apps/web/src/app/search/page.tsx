'use client';

import { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, X, TrendingUp, Layers, Globe } from 'lucide-react';
import { useSearch, useCategories, useLanguages, useSections, resolveImageUrl, EVENTS, getGenreUrl, getLanguageUrl } from '@ott/shared';
import type { ContentItem, Category, Language } from '@ott/shared';
import ContentCard from '@/components/home/ContentCard';
import ContentRail from '@/components/home/ContentRail';
import Link from 'next/link';
import { trackEvent, trackFbEvent } from '@/lib/analytics';
import { useStoredUser } from '@/lib/auth';
import { PageHero, PageShell } from '@/components/layout/PageChrome';

const TRENDING_KEYWORDS = ['Action', 'Romance', 'Comedy', 'Horror', 'Drama', 'Thriller', 'Sci-Fi', 'Animation'];

// Debounce delay (ms) before firing the search analytics event
const SEARCH_DEBOUNCE_MS = 800;

export default function ExplorePage() {
  const [query, setQuery] = useState('');
  const { session } = useStoredUser();
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search event — fires 800 ms after the user stops typing
  useEffect(() => {
    if (!query.trim()) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      trackEvent(EVENTS.SEARCH, { search_term: query.trim() });
      trackFbEvent('Search', { search_string: query.trim() });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [query]);
  const searchQ     = useSearch(query, 1, session);
  const categoriesQ = useCategories();
  const languagesQ  = useLanguages();
  const sectionsQ   = useSections(0, 1, session);

  const results    = searchQ.data?.result ?? [];
  const categories = (categoriesQ.data?.result ?? []) as Category[];
  const languages  = (languagesQ.data?.result ?? []) as Language[];
  const trendingItems = sectionsQ.data?.pages?.[0]?.result?.[0]?.data ?? [];

  return (
    <PageShell>
      {/* ── Cine Sphere Explore header ── */}
      <PageHero
        eyebrow="Discover"
        title="Explore"
        description="Search movies, short films and web series from the complete MaxxPixels catalogue."
        icon={SearchIcon}
      >

      {/* ── Search bar ── */}
        <div className="relative max-w-2xl">
          <SearchIcon
            size={20}
            className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-primary-light"
            strokeWidth={2}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies, short films, web series..."
            className="w-full rounded-xl border border-white/10 bg-[#0C111B] py-4 pl-14 pr-14 text-base text-white transition placeholder:text-white/28 focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/[0.07] text-white/55 transition hover:bg-white/12 hover:text-white"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </PageHero>

      <div>
        {/* ── Search Results ── */}
        {query.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-muted-text">
                {searchQ.isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                    Searching…
                  </span>
                ) : (
                  <>
                    <span className="text-white font-semibold">{results.length}</span>
                    {' results for '}
                    <span className="text-primary-light">&ldquo;{query}&rdquo;</span>
                  </>
                )}
              </p>
            </div>

            {results.length > 0 ? (
              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-3 gap-y-6">
                {results.map((item: ContentItem) => (
                  <ContentCard key={item.id} item={item} />
                ))}
              </div>
            ) : !searchQ.isLoading && (
              <div className="text-center py-24 animate-fade-in">
                <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center mx-auto mb-5 border border-ott-border">
                  <SearchIcon size={32} className="text-primary/60" strokeWidth={1.5} />
                </div>
                <p className="text-xl font-display font-bold text-white mb-2">No results found</p>
                <p className="text-muted-text text-sm">Try different keywords or browse categories below</p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* ── Trending keywords ── */}
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 rounded-full bg-primary" />
                <TrendingUp size={15} className="text-primary" strokeWidth={2.2} />
                <h2 className="font-display text-base font-bold text-white">Trending Searches</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {TRENDING_KEYWORDS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setQuery(t)}
                    className="genre-pill hover:bg-primary/20 hover:text-white transition-all duration-200 cursor-pointer"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Trending Now rail ── */}
            {trendingItems.length > 0 && (
              <div className="mb-10 -mx-4 sm:-mx-6 lg:-mx-12">
                <ContentRail
                  title="Trending Now"
                  items={trendingItems}
                />
              </div>
            )}

            {/* ── Browse by Genre (Cine Sphere grid) ── */}
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-1 h-5 rounded-full bg-primary" />
                <Layers size={15} className="text-primary" strokeWidth={2.2} />
                <h2 className="font-display text-base font-bold text-white">Browse by Genre</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={getGenreUrl(cat as any)}
                    className="explore-category-card h-32 sm:h-36"
                  >
                    {cat.image ? (
                      <img
                        src={resolveImageUrl(cat.image)}
                        alt={cat.name ?? ''}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-[#172235]">
                        <Layers size={28} className="text-primary-light/55" strokeWidth={1.5} />
                      </div>
                    )}
                    {/* Purple-tinted gradient overlay — Cine Sphere style */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <span className="text-white font-display font-bold text-sm leading-tight">{cat.name}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* ── Browse by Language ── */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 rounded-full bg-primary" />
                <Globe size={15} className="text-primary" strokeWidth={2.2} />
                <h2 className="font-display text-base font-bold text-white">Browse by Language</h2>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <Link
                  href="/languages/all-indian"
                  className="px-4 py-2.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-sm font-bold text-amber-400 hover:bg-amber-500/20 transition-all duration-200 shadow-sm"
                >
                  🇮🇳 All Indian Languages Movies (Excl. Kannada)
                </Link>
                <Link
                  href="/languages/kannada"
                  className="px-4 py-2.5 rounded-full border border-red-500/40 bg-red-500/10 text-sm font-bold text-red-400 hover:bg-red-500/20 transition-all duration-200 shadow-sm"
                >
                  🎬 Kannada Movies & Entertainment
                </Link>
                {languages.map((lang) => (
                  <Link
                    key={lang.id}
                    href={getLanguageUrl(lang as any)}
                    className="px-4 py-2.5 rounded-full border border-ott-border text-sm text-desc-text hover:text-white hover:border-primary/50 hover:bg-primary/10 transition-all duration-200"
                  >
                    {lang.name}
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
