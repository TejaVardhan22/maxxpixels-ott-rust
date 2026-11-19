'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import type { HomeRow } from '@/lib/streaming/types';
import type { StreamTitle } from '@/lib/streaming/types';
import { TitleCard } from '@/components/streaming/title-card';
import { cn } from '@/lib/utils';

export function MediaRow({
  row,
  items,
  onToggleWatchlist,
}: {
  row: HomeRow;
  items: StreamTitle[];
  onToggleWatchlist?: (title: StreamTitle) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(true);

  if (items.length === 0) {
    if (row.id === 'wl') {
      return (
        <section className="mt-8 sm:mt-10 px-4 sm:px-6 lg:px-12">
          <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight">{row.title}</h2>
          <p className="mt-2 max-w-md text-sm text-desc-text">
            Tap + on any poster to save. Your list syncs across devices when you connect an account.
          </p>
        </section>
      );
    }
    return null;
  }

  const update = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  const scroll = (dir: 'l' | 'r') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'r' ? el.clientWidth * 0.85 : -el.clientWidth * 0.85, behavior: 'smooth' });
    setTimeout(update, 320);
  };

  return (
    <section className="mt-8 sm:mt-10 group/row relative">
      <div className="mb-3 flex items-end justify-between px-4 sm:px-6 lg:px-12">
        <motion.h2
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="font-display text-lg sm:text-xl font-bold tracking-tight"
        >
          {row.title}
        </motion.h2>
        <div className="hidden sm:flex gap-1">
          <Button variant="ghost" size="icon" disabled={!canL} onClick={() => scroll('l')} aria-label="Scroll left">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" disabled={!canR} onClick={() => scroll('r')} aria-label="Scroll right">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={update}
        className={cn(
          'flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth px-4 sm:px-6 lg:px-12 pb-2',
          row.variant === 'top10' && 'gap-4',
        )}
      >
        {items.map((t, i) => (
          <TitleCard
            key={t.id}
            title={t}
            variant={row.variant === 'top10' ? 'top10' : row.variant === 'landscape' ? 'landscape' : 'standard'}
            rank={row.variant === 'top10' ? i + 1 : undefined}
            watchlisted={t.isBookmarked}
            onToggleWatchlist={onToggleWatchlist}
          />
        ))}
        <Link
          href="/stream/categories"
          className="flex h-[180px] w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/15 text-xs font-semibold text-desc-text hover:border-gold/40 hover:text-white"
        >
          More
        </Link>
      </div>
    </section>
  );
}
