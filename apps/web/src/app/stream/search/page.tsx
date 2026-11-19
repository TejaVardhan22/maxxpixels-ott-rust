'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search as SearchIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { TitleCard } from '@/components/streaming/title-card';
import { fetchCatalog } from '@/lib/streaming/api';
import { useStreamingStore } from '@/lib/streaming/store';
import { useStoredUser } from '@/lib/auth';
import type { ContentKind } from '@/lib/streaming/types';

const suggestions = ['Action', 'Drama', 'Comedy', 'Hindi', 'Premium'];

export default function StreamSearchPage() {
  const { session } = useStoredUser();
  const [q, setQ] = useState('');
  const recent = useStreamingStore((s) => s.recentSearches);
  const addRecent = useStreamingStore((s) => s.addRecentSearch);
  const clearRecent = useStreamingStore((s) => s.clearRecentSearches);
  const [genre, setGenre] = useState<string>('all');
  const [lang, setLang] = useState<string>('all');
  const [kind, setKind] = useState<string>('all');
  const [year, setYear] = useState<string>('all');
  const [rating, setRating] = useState<string>('all');
  const catalogQ = useQuery({
    queryKey: ['stream', 'catalog', session?.userId ?? 0, session?.deviceId ?? 'web'],
    queryFn: () => fetchCatalog(undefined, session),
  });
  const catalog = useMemo(() => catalogQ.data ?? [], [catalogQ.data]);

  const genres = useMemo(() => ['all', ...Array.from(new Set(catalog.flatMap((t) => t.genres)))], [catalog]);
  const langs = useMemo(() => ['all', ...Array.from(new Set(catalog.flatMap((t) => t.languages)))], [catalog]);
  const years = useMemo(
    () => ['all', ...Array.from(new Set(catalog.map((t) => t.year))).sort((a, b) => b - a).map(String)],
    [catalog],
  );

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return catalog.filter((t) => {
      const match =
        !term ||
        t.title.toLowerCase().includes(term) ||
        t.genres.some((g) => g.toLowerCase().includes(term)) ||
        t.languages.some((l) => l.toLowerCase().includes(term));
      const gOk = genre === 'all' || t.genres.includes(genre);
      const lOk = lang === 'all' || t.languages.includes(lang);
      const kOk = kind === 'all' || t.kind === (kind as ContentKind);
      const yOk = year === 'all' || String(t.year) === year;
      const rOk = rating === 'all' || t.rating >= Number(rating);
      return match && gOk && lOk && kOk && yOk && rOk;
    });
  }, [catalog, q, genre, lang, kind, year, rating]);

  const reset = () => {
    setQ('');
    setGenre('all');
    setLang('all');
    setKind('all');
    setYear('all');
    setRating('all');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="font-display text-2xl font-bold">Search</h1>
      <p className="mt-1 text-sm text-desc-text">Search the live MaxxPixels backend catalog.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
          <Input
            className="h-11 rounded-full border-white/10 bg-white/5 pl-9"
            placeholder="Titles, genres, languages..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addRecent(q);
            }}
          />
        </div>
        <Button className="rounded-full" onClick={() => addRecent(q)}>
          Search
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setQ(s)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-desc-text transition-colors hover:border-gold/40 hover:text-white"
          >
            {s}
          </button>
        ))}
      </div>

      {recent.length > 0 && (
        <Card className="mt-6 border-white/10 bg-white/[0.03]">
          <CardContent className="flex flex-wrap items-center gap-2 p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-desc-text">Recent</span>
            {recent.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setQ(r)}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-desc-text hover:border-gold/40 hover:text-white"
              >
                {r}
              </button>
            ))}
            <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={clearRecent}>
              Clear
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Select value={genre} onValueChange={setGenre}>
          <SelectTrigger><SelectValue placeholder="Genre" /></SelectTrigger>
          <SelectContent>{genres.map((g) => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={lang} onValueChange={setLang}>
          <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
          <SelectContent>{langs.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>{['all', 'movie', 'series', 'live'].map((k) => <SelectItem key={k} value={k} className="capitalize">{k}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={rating} onValueChange={setRating}>
          <SelectTrigger><SelectValue placeholder="Min rating" /></SelectTrigger>
          <SelectContent>{['all', '7', '8', '8.5'].map((r) => <SelectItem key={r} value={r}>{r === 'all' ? 'Any rating' : `>= ${r}`}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="mt-10">
        {catalogQ.isLoading ? (
          <div className="flex flex-wrap gap-4">
            {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-56 w-36 animate-pulse rounded-xl bg-white/[0.06]" />)}
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] py-20 text-center">
            <p className="font-display text-lg font-semibold">No titles match</p>
            <p className="mt-2 text-sm text-desc-text">Relax filters or try another keyword.</p>
            <Button variant="outline" className="mt-4 rounded-full" onClick={reset}>Reset filters</Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {results.map((t) => <TitleCard key={t.id} title={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}
