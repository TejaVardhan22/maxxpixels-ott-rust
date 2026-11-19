'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { StreamTitle } from '@/lib/streaming/types';
import { getEffectiveProgress } from '@/lib/streaming/store';
import { cn } from '@/lib/utils';

interface TitleCardProps {
  title: StreamTitle;
  variant?: 'standard' | 'landscape' | 'top10';
  rank?: number;
  watchlisted?: boolean;
  onToggleWatchlist?: (title: StreamTitle) => void;
}

export function TitleCard({ title, variant = 'standard', rank, watchlisted, onToggleWatchlist }: TitleCardProps) {
  const progress = getEffectiveProgress(title.id, title.progressPercent);
  const inList = Boolean(watchlisted ?? title.isBookmarked);

  const landscape = variant === 'landscape';
  const top10 = variant === 'top10';

  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -6, zIndex: 20 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className="group relative shrink-0"
    >
      <Link
        href={`/stream/title/${title.id}`}
        className={cn(
          'relative block overflow-hidden rounded-lg bg-card ring-1 ring-white/5 shadow-card transition-shadow group-hover:shadow-card-hover group-hover:ring-gold/40',
          landscape ? 'w-[260px] sm:w-[300px] aspect-video' : 'w-[130px] sm:w-[150px] md:w-[168px] aspect-[2/3]',
          top10 && 'flex w-[220px] sm:w-[260px] flex-row items-stretch gap-2 aspect-auto h-[120px] sm:h-[140px]',
        )}
      >
        {top10 && (
          <span className="font-display text-6xl sm:text-7xl font-black leading-none text-white/10 italic pr-2">
            {rank}
          </span>
        )}
        <div className={cn('relative flex-1 overflow-hidden rounded-lg', top10 && 'min-w-0')}>
          <Image
            src={landscape || top10 ? title.backdropUrl : title.posterUrl}
            alt={title.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes={landscape ? '(max-width:768px) 260px, 300px' : '(max-width:768px) 130px, 168px'}
          />
          <div className="absolute inset-0 bg-card-gradient opacity-40 group-hover:opacity-90 transition-opacity" />
          {title.liveBadge && (
            <Badge variant="live" className="absolute top-2 left-2 text-[10px]">
              {title.liveBadge}
            </Badge>
          )}
          {progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
              <div className="h-full bg-gold" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <p className="text-[11px] font-bold text-white drop-shadow line-clamp-2">{title.title}</p>
            <p className="text-[10px] text-desc-text">★ {title.rating}</p>
          </div>
        </div>
      </Link>
      <Button
        variant="secondary"
        size="icon"
        className="absolute -top-2 -right-2 h-8 w-8 rounded-full opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
        aria-label="Watchlist"
        type="button"
        onClick={() => onToggleWatchlist?.(title)}
      >
        <Plus className={cn('h-4 w-4', inList && 'rotate-45 text-gold')} />
      </Button>
    </motion.div>
  );
}
