'use client';

import Link from 'next/link';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ContentCard from './ContentCard';
import LandscapeCard from './LandscapeCard';
import type { ContentItem } from '@ott/shared';

export interface TabOption {
  label: string;
  value: string;
}

interface Props {
  title: string;
  items: ContentItem[];
  seeAllHref?: string;
  landscape?: boolean;
  tabs?: TabOption[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
  resume?: boolean;
}

export default function ContentRail({
  title,
  items,
  seeAllHref,
  landscape,
  tabs,
  activeTab,
  onTabChange,
  resume,
}: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const useLandscape = Boolean(resume);
  const CARD_W = useLandscape ? 300 : 196;
  const SCROLL_AMT = CARD_W * 4;

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
    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [items.length, landscape, updateArrows]);

  const scroll = (dir: 'left' | 'right') => {
    railRef.current?.scrollBy({
      left: dir === 'right' ? SCROLL_AMT : -SCROLL_AMT,
      behavior: 'smooth',
    });
    setTimeout(updateArrows, 350);
  };

  if (items.length === 0) return null;

  return (
    <section
      className="group/rail relative"
      aria-labelledby={`rail-${title.replace(/\s+/g, '-').toLowerCase()}`}
    >
      {/* Editorial Rail Header */}
      <div className="mb-2 flex items-center justify-between px-4 sm:px-6 lg:px-12">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-4 w-1 shrink-0 rounded-full bg-gradient-to-b from-[#FF6D2E] to-[#FF5500] shadow-[0_0_10px_rgba(255,109,46,0.6)] sm:h-5" />
            <h2
              id={`rail-${title.replace(/\s+/g, '-').toLowerCase()}`}
              className="truncate text-[16px] font-extrabold tracking-tight text-white sm:text-xl lg:text-[22px]"
            >
              {title}
            </h2>
          </div>

          {tabs && tabs.length > 0 && (
            <div className="hidden flex-shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] p-0.5 backdrop-blur-md sm:flex">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => onTabChange?.(tab.value)}
                  className={
                    activeTab === tab.value
                      ? 'rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-3.5 py-1 text-xs font-bold text-white shadow-[0_2px_12px_rgba(255,109,46,0.45)]'
                      : 'rounded-full px-3.5 py-1 text-xs font-medium text-white/65 transition hover:text-white'
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="group/more ml-2 inline-flex flex-shrink-0 items-center gap-0.5 text-xs font-semibold text-white/65 transition-all duration-200 hover:text-[#FF8A54] sm:ml-3 sm:gap-1 sm:rounded-full sm:border sm:border-white/10 sm:bg-white/[0.04] sm:px-3 sm:py-1 sm:text-white/80 sm:backdrop-blur-sm sm:hover:border-[#FF6D2E]/60 sm:hover:bg-[#FF6D2E]/15"
          >
            <span className="sm:hidden">See all</span>
            <span className="hidden sm:inline">Explore All</span>
            <ChevronRight
              size={14}
              strokeWidth={2.5}
              className="transition-transform duration-200 group-hover/more:translate-x-0.5"
            />
          </Link>
        )}
      </div>

      {/* Mobile tab toggles */}
      {tabs && tabs.length > 0 && (
        <div className="mb-2 flex px-4 sm:hidden">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] p-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => onTabChange?.(tab.value)}
                className={
                  activeTab === tab.value
                    ? 'rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-3 py-1 text-xs font-bold text-white'
                    : 'rounded-full px-3 py-1 text-xs font-medium text-white/65'
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Horizontal Carousel */}
      <div className="relative">
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute inset-y-0 left-0 z-30 hidden w-14 items-center justify-start bg-gradient-to-r from-[#0A0A0A] via-[#0A0A0A]/75 to-transparent pl-3 md:flex"
            aria-label="Scroll left"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white/90 backdrop-blur-md">
              <ChevronLeft size={20} strokeWidth={2.5} />
            </span>
          </button>
        )}

        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute inset-y-0 right-0 z-30 hidden w-14 items-center justify-end bg-gradient-to-l from-[#0A0A0A] via-[#0A0A0A]/75 to-transparent pr-3 md:flex"
            aria-label="Scroll right"
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
          {items.map((item, idx) => (
            <div className="snap-start" key={item.id ?? `item-${idx}`}>
              {useLandscape ? (
                <LandscapeCard item={item} variant="resume" />
              ) : (
                <ContentCard item={item} />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
