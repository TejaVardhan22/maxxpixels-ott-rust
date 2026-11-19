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
  title:        string;
  items:        ContentItem[];
  seeAllHref?:  string;
  landscape?:   boolean;
  tabs?:        TabOption[];
  activeTab?:   string;
  onTabChange?: (value: string) => void;
  resume?:      boolean;
}

export default function ContentRail({
  title, items, seeAllHref, landscape, tabs, activeTab, onTabChange, resume,
}: Props) {
  const railRef                             = useRef<HTMLDivElement>(null);
  const [canScrollLeft,  setCanScrollLeft]  = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const CARD_W     = landscape ? 280 : 174;
  const SCROLL_AMT = CARD_W * 3 + 36;

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
    railRef.current?.scrollBy({ left: dir === 'right' ? SCROLL_AMT : -SCROLL_AMT, behavior: 'smooth' });
    setTimeout(updateArrows, 350);
  };

  if (items.length === 0) return null;

  return (
    <section
      className="group/rail relative mt-12 lg:mt-16"
      aria-labelledby={`rail-${title.replace(/\s+/g, '-').toLowerCase()}`}
    >
      {/* Header */}
      <div className="mb-5 flex items-end justify-between px-4 sm:px-6 lg:px-12">
        {/* Left: title with accent border + optional tabs */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="min-w-0">
            <h2
              id={`rail-${title.replace(/\s+/g, '-').toLowerCase()}`}
              className="truncate text-[clamp(1.2rem,2vw,1.7rem)] font-black tracking-[-0.035em] text-white"
            >
              {title}
            </h2>
          </div>

          {/* Tab toggles */}
          {tabs && tabs.length > 0 && (
            <div className="tab-toggle-group flex-shrink-0 hidden sm:flex">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => onTabChange?.(tab.value)}
                  className={activeTab === tab.value ? 'tab-toggle tab-toggle-active' : 'tab-toggle'}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* See All — always visible */}
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="ml-3 flex min-h-9 flex-shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs font-bold text-white/72 transition hover:border-gold/35 hover:bg-gold/10 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
          >
            See all <ChevronRight size={13} strokeWidth={2.5} />
          </Link>
        )}
      </div>

      {/* Mobile tab toggles */}
      {tabs && tabs.length > 0 && (
        <div className="flex sm:hidden px-4 sm:px-6 mb-3">
          <div className="tab-toggle-group">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => onTabChange?.(tab.value)}
                className={activeTab === tab.value ? 'tab-toggle tab-toggle-active' : 'tab-toggle'}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rail wrapper */}
      <div className="relative">
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute bottom-0 left-0 top-0 z-20 hidden w-16 items-center justify-center bg-gradient-to-r from-app-bg via-app-bg/85 to-transparent opacity-0 transition-all group-hover/rail:opacity-100 focus:opacity-100 md:flex"
            aria-label="Scroll left"
          >
            <div className="w-9 h-9 rounded-full bg-black/70 border border-white/15 backdrop-blur flex items-center justify-center hover:bg-gold/20 hover:border-gold/50 transition-colors">
              <ChevronLeft size={16} className="text-white" strokeWidth={2.5} />
            </div>
          </button>
        )}

        {/* Right arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute bottom-0 right-0 top-0 z-20 hidden w-16 items-center justify-center bg-gradient-to-l from-app-bg via-app-bg/85 to-transparent opacity-0 transition-all group-hover/rail:opacity-100 focus:opacity-100 md:flex"
            aria-label="Scroll right"
          >
            <div className="w-9 h-9 rounded-full bg-black/70 border border-white/15 backdrop-blur flex items-center justify-center hover:bg-gold/20 hover:border-gold/50 transition-colors">
              <ChevronRight size={16} className="text-white" strokeWidth={2.5} />
            </div>
          </button>
        )}

        {/* Scrollable row */}
        <div
          ref={railRef}
          onScroll={updateArrows}
          className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-5 pt-1 scrollbar-hide sm:px-6 lg:snap-none lg:px-12"
        >
          {items.map((item, idx) => (
            <div className="snap-start" key={item.id ?? `item-${idx}`}>
              {landscape ? <LandscapeCard item={item} variant={resume ? 'resume' : 'default'} /> : <ContentCard item={item} />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
