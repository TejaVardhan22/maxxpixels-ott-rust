'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Info, Play, Plus, Sparkles, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { StreamTitle } from '@/lib/streaming/types';
import { getEffectiveProgress } from '@/lib/streaming/store';
import { cn } from '@/lib/utils';

interface CinematicHeroProps {
  featured: StreamTitle;
  className?: string;
  watchlisted?: boolean;
  onToggleWatchlist?: () => void;
}

export function CinematicHero({ featured, className, watchlisted, onToggleWatchlist }: CinematicHeroProps) {
  const [muted, setMuted] = useState(true);
  const inList = Boolean(watchlisted ?? featured.isBookmarked);
  const progress = getEffectiveProgress(featured.id, featured.progressPercent);

  return (
    <section className={cn('relative isolate min-h-[56vh] sm:min-h-[62vh] lg:min-h-[72vh] 3xl:min-h-[78vh]', className)}>
      <div className="absolute inset-0">
        <Image
          src={featured.backdropUrl}
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#001129] via-[#001129]/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#001129] via-[#001129]/50 to-transparent" />
      </div>

      <div className="relative z-10 flex flex-col justify-end px-4 pb-10 pt-28 sm:px-6 sm:pb-14 lg:px-12 lg:pb-20 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            {featured.isOriginal && (
              <Badge variant="default" className="gap-1">
                <Sparkles className="h-3 w-3" /> Original
              </Badge>
            )}
            {featured.liveBadge && <Badge variant="live">{featured.liveBadge}</Badge>}
            <span className="rounded border border-white/40 bg-white/10 px-2 py-0.5 text-xs font-black uppercase text-white shadow-sm">
              {featured.maturity || 'U/A 13+'}
            </span>
            <span className="text-sm font-extrabold text-white">{featured.year || 2026}</span>
            {featured.durationMin && (
              <span className="text-sm font-semibold text-white/90">
                {Math.floor(featured.durationMin / 60) > 0
                  ? `${Math.floor(featured.durationMin / 60)}h ${featured.durationMin % 60}m`
                  : `${featured.durationMin}m`}
              </span>
            )}
            <span className="rounded border border-white/30 bg-white/10 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-white/80">
              4K UHD
            </span>
            <span className="text-sm font-bold text-gold">★ {featured.rating || 4.8}</span>
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl 3xl:text-6xl text-balance drop-shadow-lg">
            {featured.title}
          </h1>
          <p className="mt-3 max-w-xl text-sm sm:text-base text-body-text/90 line-clamp-3">{featured.synopsis}</p>
          {progress > 0 && (
            <div className="mt-4 max-w-md">
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-desc-text">{progress}% watched</p>
            </div>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="accent" size="lg" className="rounded-md px-8 gap-2 shadow-lg shadow-gold/30" asChild>
              <Link href={`/stream/watch/${featured.id}`}>
                <Play className="h-5 w-5 fill-current" />
                Play
              </Link>
            </Button>
            <Button variant="glass" size="lg" className="rounded-full gap-2" asChild>
              <Link href={`/stream/title/${featured.id}`}>
                <Info className="h-5 w-5" />
                More info
              </Link>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full border-white/25"
              aria-label={inList ? 'Remove from watchlist' : 'Add to watchlist'}
              onClick={onToggleWatchlist}
            >
              <Plus className={cn('h-5 w-5 transition-transform', inList && 'rotate-45 text-accent')} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-white/80"
              aria-label="Audio preview"
              type="button"
              onClick={() => setMuted(!muted)}
            >
              <Volume2 className={cn('h-5 w-5', muted && 'opacity-50')} />
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
