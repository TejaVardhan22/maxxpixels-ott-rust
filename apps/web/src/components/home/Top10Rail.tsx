'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ContentItem } from '@ott/shared';
import ContentCard from './ContentCard';

interface Top10RailProps {
  title: string;
  items: ContentItem[];
}

export default function Top10Rail({ title, items }: Top10RailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateArrows = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    updateArrows();
    const observer = new ResizeObserver(updateArrows);
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length, updateArrows]);

  const scroll = (dir: 'left' | 'right') => {
    railRef.current?.scrollBy({
      left: dir === 'right' ? 784 : -784,
      behavior: 'smooth',
    });
    setTimeout(updateArrows, 350);
  };

  if (!items.length) return null;

  return (
    <section className="group/rail relative" aria-label={title}>
      {/* Same Editorial Rail Header as ContentRail */}
      <div className="mb-2 flex items-center justify-between px-4 sm:px-6 lg:px-12">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="h-5 w-1 shrink-0 rounded-full bg-gradient-to-b from-[#FF6D2E] to-[#FF5500] shadow-[0_0_10px_rgba(255,109,46,0.6)]" />
          <h2 className="truncate text-lg font-extrabold tracking-tight text-white sm:text-xl lg:text-[22px]">
            {title}
          </h2>
        </div>
      </div>

      {/* Same Compact 7-Card Horizontal Carousel as ContentRail */}
      <div className="relative">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll('left')}
            className="absolute inset-y-0 left-0 z-30 hidden w-14 items-center justify-start bg-gradient-to-r from-[#0A0A0A] via-[#0A0A0A]/75 to-transparent pl-3 md:flex"
            aria-label="Scroll Top 10 left"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white/90 backdrop-blur-md">
              <ChevronLeft size={20} strokeWidth={2.5} />
            </span>
          </button>
        )}

        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll('right')}
            className="absolute inset-y-0 right-0 z-30 hidden w-14 items-center justify-end bg-gradient-to-l from-[#0A0A0A] via-[#0A0A0A]/75 to-transparent pr-3 md:flex"
            aria-label="Scroll Top 10 right"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white/90 backdrop-blur-md">
              <ChevronRight size={20} strokeWidth={2.5} />
            </span>
          </button>
        )}

        <div
          ref={railRef}
          onScroll={updateArrows}
          className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 py-1 scrollbar-hide sm:gap-2.5 sm:px-6 lg:snap-none lg:px-12"
        >
          {items.slice(0, 10).map((item, idx) => (
            <div className="snap-start" key={item.id ?? `top10-${idx}`}>
              <ContentCard item={item} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
