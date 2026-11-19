'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Pause,
  Play,
  Plus,
  Sparkles,
} from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectFade } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import 'swiper/css/effect-fade';

import { resolveImageUrl, resolveImageCandidates, getContentImageCandidates, getContentUrl } from '@ott/shared';
import type { Banner } from '@ott/shared';

interface HeroBannerProps {
  banners: Banner[];
}

function readableValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return value.map(readableValue).filter(Boolean).slice(0, 3).join(' • ');
  }
  return '';
}

function releaseYear(value: unknown): string {
  const raw = readableValue(value);
  return raw.match(/\b(19|20)\d{2}\b/)?.[0] ?? '';
}

function formatDurationLabel(secondsOrStr: unknown): string {
  if (typeof secondsOrStr === 'string' && secondsOrStr.trim()) return secondsOrStr.trim();
  const num = Number(secondsOrStr);
  if (!num || isNaN(num) || num <= 0) return '';
  const h = Math.floor(num / 3600);
  const m = Math.floor((num % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${num}s`;
}

function cleanMaturityRating(raw: string): string {
  if (!raw) return '';
  let str = raw.trim();
  str = str.replace(/_/g, ' ');
  str = str.replace(/\bUA\b/i, 'U/A');
  str = str.replace(/\bU\s*A\b/i, 'U/A');
  str = str.replace(/\bU\/A\s*(\d+)\+?/i, 'U/A $1+');
  return str;
}

function extractNumericId(...candidates: unknown[]): number {
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c) && c > 0) return c;
    if (typeof c === 'string' && c.trim() !== '' && c !== 'NaN' && c !== 'undefined') {
      const n = Number(c);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return 0;
}

export default function HeroBanner({ banners }: HeroBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [swiperRef, setSwiperRef] = useState<SwiperType | null>(null);
  const [paused, setPaused] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [failedArtwork, setFailedArtwork] = useState<Set<string>>(new Set());
  const [artworkIndexes, setArtworkIndexes] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem('maxxpixels.watchlist');
      if (raw) setSavedIds(new Set(JSON.parse(raw) as number[]));
    } catch {
      setSavedIds(new Set());
    }
  }, []);

  const toggleSaved = useCallback(
    (id: number) => {
      const next = new Set(savedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSavedIds(next);
      localStorage.setItem('maxxpixels.watchlist', JSON.stringify([...next]));
    },
    [savedIds],
  );

  const toggleAutoplay = useCallback(() => {
    if (!swiperRef) return;
    if (paused) swiperRef.autoplay.start();
    else swiperRef.autoplay.stop();
    setPaused((current) => !current);
  }, [paused, swiperRef]);

  const totalLabel = useMemo(
    () => String(Math.max(banners.length, 1)).padStart(2, '0'),
    [banners.length],
  );

  if (!banners.length) return null;

  return (
    <section className="relative isolate overflow-hidden bg-[#08090C]" aria-label="Featured titles">
      <Swiper
        modules={[Autoplay, EffectFade]}
        effect="fade"
        fadeEffect={{ crossFade: true }}
        speed={900}
        loop={banners.length > 1}
        autoplay={
          banners.length > 1
            ? { delay: 6500, disableOnInteraction: false, pauseOnMouseEnter: true }
            : false
        }
        onSwiper={setSwiperRef}
        onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
        className="h-[clamp(580px,85svh,800px)] sm:h-[clamp(600px,75vw,820px)] lg:h-[min(88svh,880px)]"
      >
        {banners.map((banner, index) => {
          const rawBanner = banner as any;
          const imageCandidates = resolveImageCandidates(
            getContentImageCandidates(rawBanner, 'landscape'),
          );
          const artworkKey = String(banner.id ?? index);
          const artworkIndex = Math.min(artworkIndexes[artworkKey] ?? 0, imageCandidates.length);
          const image = imageCandidates[artworkIndex] || '';
          const title = banner.name || readableValue(banner.title) || 'Featured';
          const description =
            readableValue(banner.description) || readableValue(banner.short_description);
          const category =
            readableValue(banner.category_name) ||
            readableValue(banner.type_name) ||
            readableValue(banner.video_type);
          const year =
            rawBanner.release_year ||
            rawBanner.releaseYear ||
            rawBanner.content?.releaseYear ||
            rawBanner.content?.release_year ||
            releaseYear(banner.release_date);
          const maturity =
            readableValue(banner.maturity_rating || banner.age_rating || rawBanner.ageRating || rawBanner.content?.ageRating) ||
            '';
          const duration =
            readableValue(banner.duration) ||
            formatDurationLabel(rawBanner.duration_seconds || rawBanner.durationSeconds || rawBanner.content?.durationSeconds || rawBanner.video_duration) ||
            '';
          const isPremium = Number(banner.is_premium) === 1;
          const logo = resolveImageUrl(readableValue(banner.logo_image || rawBanner.logoImageUrl));
          const language = readableValue(banner.language);
          const genres = readableValue(banner.genres);
          const resourceId = extractNumericId(
            banner.video_id,
            banner.content_id,
            banner.resource_id,
            banner.id,
            rawBanner.videoId,
            rawBanner.contentId,
            rawBanner.content?.id,
            rawBanner.content?.video_id,
          );
          const isSaved = savedIds.has(resourceId);
          const actionUrl = rawBanner.action_url || rawBanner.actionUrl;
          const isPortalBanner = Boolean(
            actionUrl ||
            banner.id === 9991 ||
            banner.id === 9992 ||
            (banner as any).isPortalBanner
          );
          const detailsHref = actionUrl || getContentUrl(banner as any);

          return (
            <SwiperSlide key={`${banner.id}-${index}`}>
              <article className="relative h-full select-none">
                {image ? (
                  <div className="absolute inset-0 overflow-hidden">
                    {/* Deep ambient glow layer for atmosphere */}
                    <div
                      className="absolute inset-0 scale-125 bg-cover bg-center opacity-25 blur-3xl pointer-events-none"
                      style={{ backgroundImage: `url(${image})` }}
                      aria-hidden
                    />
                    {/* Main Background Artwork with natural aspect ratio and smart right-alignment */}
                    <Image
                      src={image}
                      alt={title}
                      fill
                      priority={index === 0}
                      sizes="100vw"
                      className="object-cover object-center lg:object-[right_20%] xl:object-[82%_25%]"
                      onError={() =>
                        setArtworkIndexes((current) => ({
                          ...current,
                          [artworkKey]: Math.min((current[artworkKey] ?? 0) + 1, imageCandidates.length),
                        }))
                      }
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#1f0714] via-[#08090C] to-[#120826]">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-red-900/30 via-transparent to-transparent" />
                  </div>
                )}

                {/* Multi-layered cinematic vignettes & seamless blend */}
                {/* 1. Left-to-right fade for high text contrast */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#08090C] via-[#08090C]/90 via-35% via-[#08090C]/50 via-65% to-transparent" />
                {/* 2. Bottom-to-top fade to merge smoothly into Rails */}
                <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#08090C] via-[#08090C]/80 via-30% to-transparent" />
                {/* 3. Top header fade for Navbar readability */}
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#08090C]/90 via-[#08090C]/40 to-transparent" />
                {/* 4. Subtle ambient vignette around entire viewport */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,_transparent_40%,_rgba(8,9,12,0.4)_100%)] pointer-events-none" />

                <div className="relative z-10 mx-auto flex h-full max-w-[1600px] items-end px-5 pb-24 sm:px-8 sm:pb-28 lg:px-12 lg:pb-32 xl:px-16">
                  <div
                    className={`max-w-2xl ${
                      activeIndex === index ? 'hero-caption-enter' : 'opacity-0'
                    }`}
                  >
                    {/* Eyebrow / Category Badges */}
                    <div className="mb-4 flex flex-wrap items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-white/80 sm:text-sm">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-400 backdrop-blur-md shadow-sm">
                        <Sparkles className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                        MaxxPixels Spotlight
                      </span>
                      {category && (
                        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/80 backdrop-blur-md">
                          {category}
                        </span>
                      )}
                      {isPremium && (
                        <span className="rounded-full border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-300 backdrop-blur-md shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                          VIP 4K
                        </span>
                      )}
                    </div>

                    {/* Title Logo or High-End Typography */}
                    {logo && !failedArtwork.has(logo) ? (
                      <div className="relative mb-4 h-20 w-64 sm:h-28 sm:w-80 lg:h-36 lg:w-96 drop-shadow-[0_8px_24px_rgba(0,0,0,0.85)]">
                        <Image
                          src={logo}
                          alt={title}
                          fill
                          sizes="(max-width: 768px) 280px, 384px"
                          className="object-contain object-left-bottom"
                          onError={() => setFailedArtwork((current) => new Set(current).add(logo))}
                        />
                      </div>
                    ) : (
                      <h1 className="max-w-2xl text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight text-white leading-[1.08] drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]">
                        {title}
                      </h1>
                    )}

                    {/* Metadata Badges: Year, Duration, Clean Maturity Badge, 4K UHD, Audio */}
                    <div className="mt-4 flex flex-wrap items-center gap-2.5 text-xs sm:text-sm font-extrabold text-white/90">
                      {year && <span className="text-white font-extrabold">{year}</span>}
                      {duration && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-white/40" />
                          <span className="text-white/90">{duration}</span>
                        </>
                      )}
                      {maturity && (
                        <span className="rounded-md border border-white/30 bg-white/10 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wide text-white shadow-sm">
                          {cleanMaturityRating(maturity)}
                        </span>
                      )}
                      <span className="rounded-md border border-white/20 bg-white/5 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-white/90">
                        4K UHD
                      </span>
                      <span className="rounded-md border border-white/20 bg-white/5 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white/80">
                        DOLBY ATMOS
                      </span>
                      {language && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-white/40" />
                          <span className="text-white/80 font-medium">{language}</span>
                        </>
                      )}
                    </div>

                    {/* Genres Tagline */}
                    {genres && (
                      <p className="mt-2 text-xs sm:text-sm font-semibold tracking-wide text-white/80">
                        {genres}
                      </p>
                    )}

                    {/* Synopsis / Description */}
                    {description && (
                      <p className="mt-3 line-clamp-2 max-w-xl text-sm sm:text-base leading-relaxed text-white/75 drop-shadow-md">
                        {description}
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-6 sm:mt-7 flex flex-wrap items-center gap-3">
                      <Link
                        href={detailsHref}
                        className="group inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl bg-white px-7 text-sm sm:text-base font-extrabold text-black shadow-[0_4px_24px_rgba(255,255,255,0.3)] transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-[0_6px_32px_rgba(255,255,255,0.5)] active:scale-95"
                      >
                        <Play className="h-5 w-5 fill-black text-black transition-transform duration-200 group-hover:scale-110" />
                        <span>{isPortalBanner ? 'Explore Portal' : 'Watch Now'}</span>
                      </Link>
                      {!isPortalBanner ? (
                        <button
                          type="button"
                          onClick={() => toggleSaved(resourceId)}
                          className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border px-5 text-sm sm:text-base font-bold backdrop-blur-xl transition-all duration-200 hover:scale-105 active:scale-95 ${
                            isSaved
                              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                              : 'border-white/20 bg-white/10 text-white hover:border-white/40 hover:bg-white/20'
                          }`}
                          aria-label={isSaved ? `Remove ${title} from My List` : `Add ${title} to My List`}
                        >
                          {isSaved ? <Check className="h-5 w-5 text-emerald-400" /> : <Plus className="h-5 w-5" />}
                          <span>{isSaved ? 'In Watchlist' : 'Watchlist'}</span>
                        </button>
                      ) : (
                        <Link
                          href={detailsHref}
                          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-5 text-sm sm:text-base font-bold text-amber-300 backdrop-blur-xl transition-all duration-200 hover:scale-105 hover:border-amber-400 hover:bg-amber-500/25 active:scale-95"
                        >
                          <Sparkles className="h-4 w-4 text-amber-400" />
                          <span>Browse Catalog</span>
                        </Link>
                      )}
                      <Link
                        href={detailsHref}
                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 text-sm sm:text-base font-bold text-white backdrop-blur-xl transition-all duration-200 hover:scale-105 hover:border-white/40 hover:bg-white/20 active:scale-95"
                        aria-label={`View details for ${title}`}
                      >
                        <Info className="h-5 w-5" />
                        <span className="sr-only sm:not-sr-only">{isPortalBanner ? 'View Portal' : 'More Info'}</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            </SwiperSlide>
          );
        })}
      </Swiper>

      {banners.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 mx-auto flex max-w-[1600px] items-center gap-4 px-5 sm:bottom-8 sm:px-8 lg:px-12 xl:px-16">
          {/* Navigation Arrows */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => swiperRef?.slidePrev()}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-xl transition-all hover:scale-105 hover:bg-white/20 active:scale-95"
              aria-label="Previous featured title"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => swiperRef?.slideNext()}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-xl transition-all hover:scale-105 hover:bg-white/20 active:scale-95"
              aria-label="Next featured title"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Progress Indicator */}
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:max-w-xs">
            <span className="text-xs font-black tabular-nums text-white">
              {String(activeIndex + 1).padStart(2, '0')}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
              <span
                key={`${activeIndex}-${paused}`}
                className={`block h-full rounded-full bg-[#E50914] shadow-[0_0_8px_rgba(229,9,20,0.8)] ${
                  paused ? 'w-0' : 'hero-progress-fill'
                }`}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-white/50">{totalLabel}</span>
          </div>

          {/* Thumbnail strip without ugly browser scrollbar */}
          <div
            className="pointer-events-auto ml-auto hidden max-w-[45%] gap-2.5 overflow-x-auto py-2 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] lg:flex"
            aria-label="Choose featured title"
          >
            {banners.map((item, index) => {
              const rawItm = item as any;
              const thumbCandidates = resolveImageCandidates(
                getContentImageCandidates(rawItm, 'landscape'),
              );
              const thumbKey = `thumb-${item.id ?? index}`;
              const thumbIndex = Math.min(artworkIndexes[thumbKey] ?? 0, thumbCandidates.length);
              const thumbnail = thumbCandidates[thumbIndex] || '';
              const itmTitle = item.name || readableValue(item.title) || `Title ${index + 1}`;
              const isCurrent = activeIndex === index;
              return (
                <button
                  key={`${item.id}-${index}`}
                  onClick={() => swiperRef?.slideToLoop(index)}
                  aria-label={`Show ${itmTitle}`}
                  aria-pressed={isCurrent}
                  className={`group relative h-14 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-300 ${
                    isCurrent
                      ? 'border-red-500 shadow-[0_0_16px_rgba(229,9,20,0.7)] scale-105 opacity-100'
                      : 'border-white/15 opacity-60 hover:opacity-100 hover:border-white/40 hover:scale-102'
                  }`}
                >
                  {thumbnail ? (
                    <Image
                      src={thumbnail}
                      alt={itmTitle}
                      fill
                      sizes="96px"
                      className="object-cover transition-transform duration-300 group-hover:scale-110"
                      onError={() =>
                        setArtworkIndexes((current) => ({
                          ...current,
                          [thumbKey]: Math.min((current[thumbKey] ?? 0) + 1, thumbCandidates.length),
                        }))
                      }
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white/10 text-xs font-bold text-white">
                      {index + 1}
                    </div>
                  )}
                  <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent ${isCurrent ? 'opacity-0' : 'opacity-40'}`} />
                </button>
              );
            })}
          </div>

          {/* Autoplay Toggle */}
          <button
            type="button"
            onClick={toggleAutoplay}
            className="pointer-events-auto ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur-xl transition-all hover:scale-105 hover:bg-white/20 active:scale-95"
            aria-label={paused ? 'Resume hero slideshow' : 'Pause hero slideshow'}
          >
            {paused ? <Play className="h-4 w-4 fill-current text-white" /> : <Pause className="h-4 w-4 fill-current text-white" />}
          </button>
        </div>
      )}
    </section>
  );
}
