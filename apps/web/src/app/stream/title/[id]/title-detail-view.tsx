'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToggleBookmark } from '@ott/shared';
import { Info, Play, Plus, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { TitleCard } from '@/components/streaming/title-card';
import type { StreamTitle } from '@/lib/streaming/types';
import { fetchCatalog } from '@/lib/streaming/api';
import { useStoredUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

export function TitleDetailView({ title }: { title: StreamTitle }) {
  const { user, session } = useStoredUser();
  const bookmarkMut = useToggleBookmark();
  const [inList, setInList] = useState(title.isBookmarked);
  const catalogQ = useQuery({
    queryKey: ['stream', 'catalog', session?.userId ?? 0, session?.deviceId ?? 'web'],
    queryFn: () => fetchCatalog(undefined, session),
  });
  const related = (catalogQ.data ?? [])
    .filter((item) => item.id !== title.id && item.genres.some((genre) => title.genres.includes(genre)))
    .slice(0, 12);

  useEffect(() => {
    setInList(title.isBookmarked);
  }, [title.id, title.isBookmarked]);

  const toggleWatchlist = () => {
    if (!user?.id || !title.videoId || bookmarkMut.isPending) return;
    if (inList) return;

    setInList(true);
    bookmarkMut.mutate(
      {
        user_id: user.id,
        video_type: title.videoType ?? 1,
        sub_video_type: 0,
        video_id: title.videoId,
        type_id: title.typeId ?? 1,
        is_kids_profile: session?.isKidsProfile ? 1 : 0,
        action: 'add',
      },
      {
        onError: () => setInList(false),
      },
    );
  };

  return (
    <div className="pb-12">
      <div className="relative aspect-[21/9] min-h-[220px] w-full sm:min-h-[320px]">
        <Image src={title.backdropUrl} alt="" fill className="object-cover" sizes="100vw" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-[#001129] via-[#001129]/70 to-transparent" />
        <div className="absolute bottom-6 left-4 right-4 sm:left-8 lg:left-12 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2.5 mb-3 text-sm font-semibold text-white/90">
            {title.requiresPlan && (
              <span className="bg-amber-500 text-black text-xs font-black px-2.5 py-0.5 rounded shadow-[0_0_12px_rgba(245,158,11,0.4)] tracking-wider">
                VIP
              </span>
            )}
            <span className="font-extrabold text-white">{title.year || 2026}</span>
            {title.durationMin && (
              <>
                <span className="h-1 w-1 rounded-full bg-white/40" />
                <span className="text-white/90">{title.durationMin}m</span>
              </>
            )}
            <span className="rounded border border-white/40 bg-white/10 px-2 py-0.5 text-xs font-black uppercase text-white shadow-sm">
              {title.maturity || 'U/A 13+'}
            </span>
            <span className="rounded border border-white/20 bg-black/40 px-2 py-0.5 text-[11px] font-bold tracking-wide text-white/90">
              4K UHD
            </span>
            <span className="rounded border border-white/20 bg-black/40 px-2 py-0.5 text-[11px] font-medium tracking-wide text-white/80">
              5.1
            </span>
            {title.isOriginal && <Badge variant="default">Original</Badge>}
            {title.rating && <span className="text-sm text-gold">★ {title.rating}</span>}
          </div>
          <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight drop-shadow-md">{title.title}</h1>
          <p className="mt-2 text-sm text-desc-text">{title.genres.join(' · ')} · {title.languages.join(', ')}</p>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-12 max-w-5xl -mt-4 relative z-10 flex flex-wrap gap-3">
        <Button variant="accent" size="lg" className="rounded-full gap-2" asChild>
          <Link href={`/stream/watch/${title.id}`}>
            <Play className="h-5 w-5 fill-current" />
            Play
          </Link>
        </Button>
        <Button variant="glass" size="lg" className="rounded-full gap-2">
          <Info className="h-5 w-5" />
          Trailer
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="rounded-full gap-2 border-white/20"
          onClick={toggleWatchlist}
          disabled={!user?.id || bookmarkMut.isPending}
        >
          <Plus className={cn('h-5 w-5', inList && 'rotate-45 text-accent')} />
          {inList ? 'Saved' : 'Watchlist'}
        </Button>
        <Button variant="ghost" size="lg" className="rounded-full gap-2 text-white">
          <Share2 className="h-5 w-5" />
          Share
        </Button>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-12 mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
        <div>
          <p className="text-body-text leading-relaxed">{title.synopsis}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-desc-text">
            {title.durationMin && <span>{title.durationMin} min</span>}
            <span>Plans: {title.requiresPlan}+</span>
          </div>

          {title.episodes && title.episodes.length > 0 && (
            <>
              <h2 className="mt-10 font-display text-xl font-bold">Episodes</h2>
              <Separator className="my-4" />
              <ul className="space-y-3">
                {title.episodes.map((ep) => (
                  <li
                    key={ep.id}
                    className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4"
                  >
                    <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-lg">
                      <Image src={ep.stillUrl} alt="" fill className="object-cover" sizes="144px" />
                    </div>
                    <div>
                      <p className="text-xs text-gold font-semibold">
                        E{ep.number} · {ep.durationMin}m
                      </p>
                      <p className="font-semibold">{ep.title}</p>
                      <p className="text-sm text-desc-text line-clamp-2">{ep.synopsis}</p>
                      <Button variant="ghost" size="sm" className="h-auto p-0 text-gold" asChild>
                        <Link href={`/stream/watch/${title.id}?ep=${ep.id}`}>Play episode</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="mt-10 font-display text-xl font-bold">Cast & crew</h2>
          <Separator className="my-4" />
          <ScrollArea className="w-full whitespace-nowrap pb-3">
            <div className="flex gap-4">
              {title.cast.map((c) => (
                <div key={c.id} className="w-28 shrink-0 text-center">
                  <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full border border-white/10">
                    <Image src={c.imageUrl} alt={c.name} fill className="object-cover" sizes="96px" />
                  </div>
                  <p className="mt-2 text-xs font-semibold truncate">{c.name}</p>
                  <p className="text-[10px] text-desc-text truncate">{c.role}</p>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <h2 className="mt-10 font-display text-xl font-bold">More like this</h2>
          <div className="mt-4 flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {related.map((t) => (
              <TitleCard key={t.id} title={t} />
            ))}
          </div>
        </div>

        <aside className="rounded-xl border border-white/10 bg-white/[0.03] p-4 h-fit lg:sticky lg:top-24">
          <p className="text-xs font-semibold uppercase tracking-wide text-desc-text">Meta</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <span className="text-muted-text">Type</span>{' '}
              <span className="capitalize">{title.kind}</span>
            </li>
            <li>
              <span className="text-muted-text">Year</span> {title.year}
            </li>
            <li>
              <span className="text-muted-text">Audio</span> {title.languages.join(', ')}
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
