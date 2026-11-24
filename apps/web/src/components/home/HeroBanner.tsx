'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Info, Play, Plus, Sparkles } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';

import {
  resolveImageUrl,
  resolveImageCandidates,
  getContentImageCandidates,
  getContentUrl,
  useBookmarks,
  useToggleBookmark,
  EVENTS,
} from '@ott/shared';
import type { Banner } from '@ott/shared';
import { useStoredUser } from '@/lib/auth';
import { userPageHref } from '@/lib/userRoutes';
import { showToast } from '@/components/ui/ToastHost';
import { trackEvent, trackFbEvent } from '@/lib/analytics';

interface HeroBannerProps {
  banners: Banner[];
}

const AUTOPLAY_DELAY_MS = 5500;

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
  let str = raw.trim().replace(/_/g, ' ');
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

/**
 * Netflix 2025/2026 Framed Cinema Hero Billboard (in platform obsidian + #FF6D2E theme):
 * - Crisp rounded-2xl framed billboard sitting cleanly below the navbar with subtle ambient glow
 * - Ultra-clean bottom-left overlay: title/logo, single dot-separated metadata line, Play + More Info pill buttons
 * - Subtle frosted status pills at bottom-right (VIP/Free + Maturity Rating)
 * - Smooth 950ms horizontal slide carousel with pause-on-hover and animated progress pills
 */
export default function HeroBanner({ banners }: HeroBannerProps) {
  const router = useRouter();
  const { user, session, isLoggedIn } = useStoredUser();
  const bookmarksQ = useBookmarks(session);
  const bookmarkMut = useToggleBookmark();

  const [activeIndex, setActiveIndex] = useState(0);
  const [swiperRef, setSwiperRef] = useState<SwiperType | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [failedArtwork, setFailedArtwork] = useState<Set<string>>(new Set());
  const [artworkIndexes, setArtworkIndexes] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isLoggedIn) {
      const rawData = bookmarksQ.data as any;
      const list: any[] = Array.isArray(rawData?.result)
        ? rawData.result
        : Array.isArray(rawData?.data)
        ? rawData.data
        : Array.isArray(rawData)
        ? rawData
        : [];
      const ids = list
        .map((it) => Number(it?.contentId ?? it?.content_id ?? it?.video_id ?? it?.id ?? 0))
        .filter((n) => Number.isFinite(n) && n > 0);
      setSavedIds(new Set(ids));
      return;
    }
    try {
      const raw = localStorage.getItem('maxxpixels.watchlist');
      if (raw) setSavedIds(new Set(JSON.parse(raw) as number[]));
    } catch {
      setSavedIds(new Set());
    }
  }, [isLoggedIn, bookmarksQ.data]);

  useEffect(() => {
    if (!swiperRef || banners.length <= 1) return;
    swiperRef.autoplay?.start();
  }, [swiperRef, banners.length]);

  const toggleSaved = useCallback(
    (id: number) => {
      if (!isLoggedIn || !user?.id) {
        router.push('/login');
        return;
      }
      if (!id || bookmarkMut.isPending) return;
      const wasSaved = savedIds.has(id);
      const next = new Set(savedIds);
      if (wasSaved) next.delete(id);
      else next.add(id);
      setSavedIds(next);

      if (!wasSaved) {
        trackEvent(EVENTS.WATCHLIST_ADD, { content_id: id });
        trackFbEvent('AddToWishlist', { content_ids: [String(id)] });
      }

      bookmarkMut.mutate(
        {
          user_id: user.id,
          contentId: id,
          video_id: id,
          action: wasSaved ? 'remove' : 'add',
        },
        {
          onSuccess: () => {
            showToast(
              !wasSaved
                ? {
                    title: 'Added to Watchlist',
                    message: 'Saved to your watchlist across all devices.',
                    variant: 'success',
                    actionLabel: 'View Watchlist',
                    actionHref: userPageHref(user, 'watchlist'),
                  }
                : {
                    title: 'Removed from Watchlist',
                    message: 'Removed from your watchlist.',
                    variant: 'info',
                  },
            );
          },
          onError: () => {
            setSavedIds(savedIds);
            showToast({
              title: 'Watchlist update failed',
              message: 'Could not update your watchlist. Please try again.',
              variant: 'error',
            });
          },
        },
      );
    },
    [savedIds, isLoggedIn, user?.id, bookmarkMut, router],
  );

  if (!banners.length) return null;

  return (
    <section
      className="relative w-full bg-[#0A0A0A] px-0 pb-2 pt-[88px] sm:bg-gradient-to-b sm:from-[#161616] sm:via-[#0A0A0A] sm:to-[#0A0A0A] sm:px-6 sm:pb-3 sm:pt-[112px] lg:px-12 lg:pt-[82px]"
      aria-label="Featured titles"
    >
      {/* Seamless Edge-to-Edge on Mobile, Framed Cinema Billboard on sm+ */}
      <div className="group/hero relative mx-auto max-w-[1680px] overflow-hidden bg-[#0A0A0A] sm:rounded-2xl sm:border sm:border-white/[0.1] sm:shadow-[0_24px_64px_rgba(0,0,0,0.85)]">
        <Swiper
          key={`hero-swiper-${banners.length}`}
          modules={[Autoplay]}
          speed={950}
          loop={banners.length > 1}
          grabCursor={banners.length > 1}
          watchSlidesProgress
          autoplay={
            banners.length > 1
              ? {
                  delay: AUTOPLAY_DELAY_MS,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true,
                }
              : false
          }
          onSwiper={(swiper) => {
            setSwiperRef(swiper);
            if (banners.length > 1) {
              swiper.autoplay?.start();
            }
          }}
          onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
          className="w-full"
        >
          {banners.map((banner, index) => {
            const rawBanner = banner as any;
            const landscapeCandidates = resolveImageCandidates([
              ...getContentImageCandidates(rawBanner, 'landscape'),
              ...getContentImageCandidates(rawBanner, 'portrait'),
            ]);
            const artworkKey = String(banner.id ?? index);
            const artworkIndex = Math.min(artworkIndexes[artworkKey] ?? 0, landscapeCandidates.length);
            const image = landscapeCandidates[artworkIndex] || '';
            const title = banner.name || readableValue(banner.title);
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
            const maturity = readableValue(
              banner.maturity_rating ||
                banner.age_rating ||
                rawBanner.ageRating ||
                rawBanner.content?.ageRating,
            );
            const duration =
              readableValue(banner.duration) ||
              formatDurationLabel(
                rawBanner.duration_seconds ||
                  rawBanner.durationSeconds ||
                  rawBanner.content?.durationSeconds ||
                  rawBanner.video_duration,
              );
            const isPremium = Number(banner.is_premium) === 1;
            const logo = resolveImageUrl(readableValue(banner.logo_image || rawBanner.logoImageUrl));
            const rawLang = readableValue(banner.language);
            const LANG_NAMES: Record<string, string> = {
              kn: 'Kannada',
              te: 'Telugu',
              ta: 'Tamil',
              hi: 'Hindi',
              ml: 'Malayalam',
              en: 'English',
              mr: 'Marathi',
            };
            const language = LANG_NAMES[rawLang.toLowerCase()] || rawLang;
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
            const isPortalBanner = Boolean(actionUrl || (banner as any).isPortalBanner);
            const detailsHref = actionUrl || getContentUrl(banner as any);
            const isSlideActive = activeIndex === index;

            const metaParts: string[] = [];
            if (category) metaParts.push(category);
            if (language) metaParts.push(language);
            if (year) metaParts.push(String(year));
            if (duration) metaParts.push(duration);
            if (maturity) metaParts.push(cleanMaturityRating(maturity));

            return (
              <SwiperSlide key={`${banner.id}-${index}`}>
                <article className="relative flex w-full select-none flex-col overflow-hidden bg-[#0A0A0A] sm:block sm:aspect-[16/9] sm:min-h-[380px] lg:aspect-[16/8.2] lg:max-h-[82svh] lg:min-h-[460px]">
                  {/* 16:9 Artwork Stage (Uncropped edge-to-edge 16:9 on mobile, full-bleed cover on sm+) */}
                  <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-[#0A0A0A] sm:absolute sm:inset-0 sm:h-full sm:aspect-auto">
                    {image ? (
                      <Image
                        src={image}
                        alt={title}
                        fill
                        priority={index === 0}
                        sizes="(max-width: 1680px) 100vw, 1680px"
                        unoptimized
                        className="object-cover object-top"
                        onError={() =>
                          setArtworkIndexes((current) => ({
                            ...current,
                            [artworkKey]: Math.min(
                              (current[artworkKey] ?? 0) + 1,
                              landscapeCandidates.length,
                            ),
                          }))
                        }
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-tr from-[#1E1917] via-[#14161A] to-[#261A14]" />
                    )}

                    {/* Mobile smooth bottom blend directly into #0A0A0A */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/65 to-transparent sm:hidden" />

                    {/* Tablet/Desktop bottom & left scrim so 90% of poster stays bright and crisp */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[58%] bg-gradient-to-t from-black/90 via-black/40 to-transparent sm:block" />
                    <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[55%] bg-gradient-to-r from-black/80 via-black/30 to-transparent sm:block sm:w-[48%]" />
                  </div>

                  {/* Bottom Row: Left Title/Meta/Buttons + Right Frosted Status Pills */}
                  <div className="relative z-10 -mt-5 flex flex-col justify-end bg-[#0A0A0A] px-4 pb-3 pt-1 sm:absolute sm:inset-0 sm:mt-0 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:bg-transparent sm:px-8 sm:pb-9 lg:px-11 lg:pb-11">
                    {/* Left Editorial Block */}
                    <div
                      className={`max-w-[460px] transition-all duration-700 ease-out lg:max-w-[540px] ${
                        isSlideActive ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
                      }`}
                    >
                      {logo && !failedArtwork.has(logo) ? (
                        <div className="relative mb-2 h-10 w-36 sm:mb-3 sm:h-20 sm:w-64 lg:h-24 lg:w-72">
                          <Image
                            src={logo}
                            alt={title}
                            fill
                            sizes="288px"
                            unoptimized
                            className="object-contain object-left-bottom drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]"
                            onError={() =>
                              setFailedArtwork((current) => new Set(current).add(logo))
                            }
                          />
                        </div>
                      ) : (
                        title && (
                          <h1 className="line-clamp-2 text-lg font-black leading-[1.12] tracking-tight text-white drop-shadow-[0_4px_22px_rgba(0,0,0,0.9)] sm:text-3xl lg:text-[46px]">
                            {title}
                          </h1>
                        )
                      )}

                      {/* Single Clean Dot-Separated Metadata Line */}
                      {metaParts.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-white/90 drop-shadow sm:mt-2.5 sm:gap-2 sm:text-sm">
                          {metaParts.map((part, pIdx) => (
                            <span key={`${part}-${pIdx}`} className="inline-flex items-center gap-1.5 sm:gap-2">
                              {pIdx > 0 && <span className="text-white/45">•</span>}
                              <span>{part}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Clean 2-3 Line Synopsis (Matches Netflix Billboard) */}
                      {description && (
                        <p className="mt-2.5 hidden max-w-[440px] line-clamp-2 text-[13px] leading-[1.55] text-white/90 drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)] sm:block lg:line-clamp-3 lg:text-[15px]">
                          {description}
                        </p>
                      )}

                      {/* Netflix-Style Pill CTAs (Balanced full-width on mobile, compact on sm+) */}
                      <div className="mt-3 flex w-full items-center gap-2 sm:mt-5 sm:w-auto sm:flex-wrap sm:gap-3">
                        <Link
                          href={detailsHref}
                          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-4 text-xs font-bold text-white shadow-[0_8px_24px_rgba(255,109,46,0.45)] transition-all duration-200 hover:scale-[1.03] hover:brightness-110 active:scale-[0.98] sm:h-11 sm:flex-none sm:gap-2 sm:px-7 sm:text-sm"
                        >
                          <Play className="h-3.5 w-3.5 fill-white text-white sm:h-4 sm:w-4" />
                          <span>{isPortalBanner ? 'Watch Now' : 'Play'}</span>
                        </Link>

                        <Link
                          href={detailsHref}
                          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-4 text-xs font-semibold text-white backdrop-blur-md transition-all duration-200 hover:bg-white/25 sm:h-11 sm:flex-none sm:border-transparent sm:bg-white/20 sm:px-6 sm:text-sm"
                        >
                          <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          <span>More Info</span>
                        </Link>

                        {!isPortalBanner && resourceId > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleSaved(resourceId)}
                            className={`grid h-9 w-9 place-items-center rounded-full backdrop-blur-md transition-all duration-200 hover:scale-105 sm:h-11 sm:w-11 ${
                              isSaved
                                ? 'bg-[#FF6D2E]/25 text-[#FF8A54] ring-1 ring-[#FF6D2E]'
                                : 'bg-white/15 text-white hover:bg-white/25'
                            }`}
                            title={isSaved ? 'In My List' : 'Add to My List'}
                            aria-label={
                              isSaved ? `Remove ${title} from My List` : `Add ${title} to My List`
                            }
                          >
                            {isSaved ? (
                              <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            ) : (
                              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Right Bottom Frosted Status Pills (VIP & Maturity only) */}
                    {(isPremium || maturity) && (
                      <div className="hidden items-center gap-2 sm:flex">
                        {isPremium && (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/55 px-3 py-1.5 text-xs font-semibold text-white/95 backdrop-blur-md ring-1 ring-white/10">
                            <Sparkles className="h-3.5 w-3.5 text-[#FF6D2E]" />
                            <span>VIP Exclusive</span>
                          </span>
                        )}
                        {maturity && (
                          <span className="inline-flex items-center rounded-lg bg-black/55 px-3 py-1.5 text-xs font-bold text-white/95 backdrop-blur-md ring-1 ring-white/10">
                            {cleanMaturityRating(maturity)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </div>
    </section>
  );
}
