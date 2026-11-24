'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Film, Play, Plus, ThumbsUp, X } from 'lucide-react';
import {
  resolveImageCandidates,
  getContentImageCandidates,
  useToggleBookmark,
  useToggleLike,
  getContentUrl,
  getWatchUrl,
  formatDuration,
  videoTypeLabel,
  EVENTS,
} from '@ott/shared';
import type { ContentItem } from '@ott/shared';
import { useStoredUser } from '@/lib/auth';
import { userPageHref } from '@/lib/userRoutes';
import { showToast } from '@/components/ui/ToastHost';
import { trackEvent, trackFbEvent } from '@/lib/analytics';

interface Props {
  item: ContentItem;
  bookmarkAction?: 'add' | 'remove' | 'toggle';
  fluid?: boolean;
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

function firstText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(firstText).filter(Boolean).join(', ');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return firstText(record.name ?? record.title ?? record.value ?? '');
  }
  return '';
}

export default function ContentCard({ item, bookmarkAction = 'toggle', fluid = false }: Props) {
  const router = useRouter();
  const { user, session } = useStoredUser();
  const bookmarkMut = useToggleBookmark();
  const likeMut = useToggleLike();

  const rawItem = (item ?? {}) as Record<string, any>;
  const [isBookmarked, setIsBookmarked] = useState(Number(item.is_bookmark ?? 0) === 1);
  const [isLiked, setIsLiked] = useState(
    Boolean(rawItem.is_user_like ?? Number(item.is_like ?? 0) === 1),
  );
  const [mounted, setMounted] = useState(false);

  const cardRef = useRef<HTMLElement | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoverBox, setHoverBox] = useState<{
    top: number;
    left: number;
    width: number;
    originX: string;
  } | null>(null);

  const contentId = extractNumericId(
    rawItem.contentId,
    rawItem.content_id,
    item.video_id,
    rawItem.videoId,
    item.id,
    rawItem.resource_id,
    rawItem.content?.id,
    rawItem.content?.video_id,
  );
  const href = getContentUrl(item as any);
  const watchHref = getWatchUrl(item as any);

  // Portrait poster candidates for the base rail card
  const portraitCandidates = resolveImageCandidates([
    ...getContentImageCandidates(item, 'portrait'),
    ...getContentImageCandidates(item, 'landscape'),
  ]);
  const portraitKey = portraitCandidates.join('|');
  const [portraitIdx, setPortraitIdx] = useState(0);
  const imgSrc = portraitCandidates[Math.min(portraitIdx, portraitCandidates.length)] || '';

  // Landscape backdrop candidates for the Netflix hover preview card
  const landscapeCandidates = resolveImageCandidates([
    ...getContentImageCandidates(item, 'landscape'),
    ...getContentImageCandidates(item, 'portrait'),
  ]);
  const landscapeKey = landscapeCandidates.join('|');
  const [landscapeIdx, setLandscapeIdx] = useState(0);
  const previewImgSrc =
    landscapeCandidates[Math.min(landscapeIdx, landscapeCandidates.length)] || imgSrc;

  useEffect(() => {
    setMounted(true);
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setIsBookmarked(Number(item.is_bookmark ?? 0) === 1);
    setIsLiked(Boolean(rawItem.is_user_like ?? Number(item.is_like ?? 0) === 1));
    setPortraitIdx(0);
    setLandscapeIdx(0);
  }, [item.is_bookmark, item.is_like, rawItem.is_user_like, contentId, portraitKey, landscapeKey]);

  useEffect(() => {
    if (!hoverBox) return;
    const closeOnScroll = () => setHoverBox(null);
    window.addEventListener('scroll', closeOnScroll, { passive: true });
    window.addEventListener('resize', closeOnScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', closeOnScroll);
      window.removeEventListener('resize', closeOnScroll);
    };
  }, [hoverBox]);

  const scheduleOpenPreview = () => {
    if (typeof window === 'undefined' || window.innerWidth < 768) return;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (hoverBox || openTimerRef.current) return;

    // Preload the 16:9 landscape artwork right on mouseEnter so it renders with zero flicker
    if (previewImgSrc) {
      const preload = new window.Image();
      preload.src = previewImgSrc;
    }

    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const previewWidth = 316;
      const centerX = rect.left + rect.width / 2;
      const minLeft = 18;
      const maxLeft = window.innerWidth - previewWidth - 18;
      const idealLeft = centerX - previewWidth / 2;
      const left = Math.max(minLeft, Math.min(maxLeft, idealLeft));

      const originX =
        idealLeft < minLeft ? 'left' : idealLeft > maxLeft ? 'right' : 'center';

      const centerY = rect.top + rect.height / 2;
      const estimatedHeight = 324;
      const minTop = 76;
      const maxTop = window.innerHeight - estimatedHeight - 18;
      const top = Math.max(minTop, Math.min(maxTop, centerY - estimatedHeight / 2));

      setHoverBox({ top, left, width: previewWidth, originX });
    }, 280);
  };

  const scheduleClosePreview = () => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setHoverBox(null);
    }, 75);
  };

  const keepPreviewOpen = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const toggleBookmark = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!user?.id) {
      router.push(`/login?redirect=${encodeURIComponent(href)}`);
      return;
    }
    if (!contentId || bookmarkMut.isPending) return;
    if (bookmarkAction === 'add' && isBookmarked) return;
    if (bookmarkAction === 'remove' && !isBookmarked) return;

    const nextState =
      bookmarkAction === 'remove' ? false : !isBookmarked || bookmarkAction === 'add';
    const titleName = String(item.name ?? rawItem.title ?? 'Title');
    setIsBookmarked(nextState);
    if (nextState) {
      trackEvent(EVENTS.WATCHLIST_ADD, {
        content_id: contentId,
        content_name: titleName,
      });
      trackFbEvent('AddToWishlist', {
        content_ids: [String(contentId)],
        content_name: titleName,
      });
      void fetch('/api/v1/analytics/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user.auth_token ? { Authorization: `Bearer ${user.auth_token}` } : {}),
        },
        body: JSON.stringify({
          contentId,
          contentTitle: titleName,
          eventType: 'WATCHLIST_ADD',
          interactionType: 'WATCHLIST',
          deviceType: 'WEB',
        }),
      }).catch(() => {});
    }
    bookmarkMut.mutate(
      {
        user_id: user.id,
        video_type: item.video_type ?? 1,
        sub_video_type: item.sub_video_type ?? 0,
        contentId,
        video_id: contentId,
        type_id: item.type_id ?? 1,
        is_kids_profile: session?.isKidsProfile ? 1 : 0,
        action: bookmarkAction === 'remove' ? 'remove' : nextState ? 'add' : 'remove',
      },
      {
        onSuccess: () => {
          showToast(
            nextState
              ? {
                  title: 'Added to Watchlist',
                  message: `"${titleName}" has been saved to your watchlist.`,
                  variant: 'success',
                  actionLabel: 'View Watchlist',
                  actionHref: userPageHref(user, 'watchlist'),
                }
              : {
                  title: 'Removed from Watchlist',
                  message: `"${titleName}" was removed from your watchlist.`,
                  variant: 'info',
                },
          );
        },
        onError: () => {
          setIsBookmarked(isBookmarked);
          showToast({
            title: 'Watchlist update failed',
            message: 'Could not update your watchlist. Please try again.',
            variant: 'error',
          });
        },
      },
    );
  };

  const handleToggleLike = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!user?.id) {
      router.push(`/login?redirect=${encodeURIComponent(href)}`);
      return;
    }
    if (!contentId || likeMut.isPending) return;
    setIsLiked((v) => !v);
    likeMut.mutate({
      user_id: user.id,
      video_type: item.video_type ?? 1,
      sub_video_type: item.sub_video_type ?? 0,
      video_id: contentId,
      type_id: item.type_id ?? 1,
    });
  };

  const handlePlayNow = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setHoverBox(null);
    if (!user?.id || !user?.auth_token) {
      router.push(`/login?redirect=${encodeURIComponent(watchHref)}`);
      return;
    }
    if (Number(user.is_buy ?? 0) !== 1 && Number(item.rent_buy ?? 0) !== 1) {
      router.push('/subscription');
      return;
    }
    router.push(watchHref);
  };

  const handleMoreInfo = (event: MouseEvent<HTMLButtonElement | HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setHoverBox(null);
    router.push(href);
  };

  const rawRentPrice = Number(item.rent_price ?? item.price ?? rawItem?.rentPrice ?? 0);
  const isTvod = Boolean(
    item.is_rent === 1 ||
      String(rawItem?.monetization || '').toUpperCase() === 'TVOD' ||
      (item.rent_buy !== undefined && item.rent_buy === 0 && rawRentPrice > 0),
  );
  const isPremium = Number(item.is_premium ?? 0) === 1;

  // Build metadata for Netflix hover card: "Film  [U/A 13+]  2h 18m  [HD]"
  const rawTypeStr = firstText(rawItem.contentType ?? rawItem.content_type ?? rawItem.type);
  const typeLabel = rawTypeStr
    ? rawTypeStr
        .replace(/[_-]+/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (ch) => ch.toUpperCase())
    : videoTypeLabel(item.video_type) !== 'Content'
    ? videoTypeLabel(item.video_type)
    : Number(item.video_type ?? 1) === 2
    ? 'Series'
    : 'Film';

  const maturityVal =
    firstText(
      rawItem.ageRating ??
        rawItem.maturity_rating ??
        rawItem.age_rating ??
        rawItem.maturity ??
        rawItem.certification,
    ) || 'U/A 13+';

  const rawDurationNum = Number(
    item.video_duration ?? rawItem.durationSeconds ?? rawItem.duration_seconds ?? 0,
  );
  const durationLabel =
    (rawDurationNum > 0 ? formatDuration(rawDurationNum) : '') ||
    (typeof rawItem.duration === 'string' && rawItem.duration.trim()
      ? rawItem.duration.trim()
      : '');

  const qualityLabel = (() => {
    const qb = rawItem.quality_badges ?? rawItem.qualityBadges;
    if (Array.isArray(qb) && qb.length > 0) return String(qb[0]).toUpperCase();
    if (typeof qb === 'string' && qb.trim()) return qb.split(',')[0].trim().toUpperCase();
    return 'HD';
  })();

  // Build dot-separated tags: "Explosive • Gory • Action Thriller"
  const tagList = (() => {
    const candidates: string[] = [];
    const rawGenres = item.category_name ?? rawItem.genres ?? rawItem.categories ?? rawItem.genre;
    if (Array.isArray(rawGenres)) {
      for (const g of rawGenres) {
        const t = firstText(g);
        if (t) candidates.push(t);
      }
    } else if (typeof rawGenres === 'string' && rawGenres.trim()) {
      for (const part of rawGenres.split(/[,•|/]/)) {
        const t = part.trim();
        if (t) candidates.push(t);
      }
    }
    const lang = firstText(rawItem.originalLanguage ?? rawItem.language_name ?? rawItem.language);
    if (lang && !candidates.some((c) => c.toLowerCase() === lang.toLowerCase())) {
      candidates.push(lang);
    }
    const year = firstText(item.release_year ?? rawItem.releaseYear);
    if (year && candidates.length < 2) {
      candidates.push(year);
    }
    if (candidates.length === 0) {
      candidates.push(typeLabel);
    }
    return candidates.slice(0, 3);
  })();

  return (
    <>
      <article
        ref={cardRef}
        onMouseEnter={scheduleOpenPreview}
        onMouseLeave={scheduleClosePreview}
        className={`group relative ${
          fluid
            ? 'w-full'
            : 'w-[138px] flex-shrink-0 sm:w-[158px] md:w-[172px] lg:w-[188px] xl:w-[198px]'
        }`}
      >
        <Link
          href={href}
          aria-label={`View ${item.name ?? 'title'}`}
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6D2E]"
        >
          <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-[#141414]">
            {imgSrc ? (
              <Image
                src={imgSrc}
                alt={item.name ?? ''}
                fill
                sizes="(max-width: 640px) 138px, (max-width: 1024px) 172px, 198px"
                className="object-cover object-top"
                loading="lazy"
                unoptimized
                onError={() =>
                  setPortraitIdx((curr) => Math.min(curr + 1, portraitCandidates.length))
                }
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#141414] px-4 text-center">
                <Film className="h-7 w-7 text-zinc-500" strokeWidth={1.5} />
              </div>
            )}

            {/* Top-Right Corner Ribbon Badge for VIP / RENT only */}
            {isTvod ? (
              <span className="absolute right-0 top-0 rounded-bl-lg bg-amber-400 px-2 py-1 text-center text-[9px] font-black uppercase leading-tight tracking-wider text-zinc-950 shadow-md">
                {rawRentPrice > 0 ? `RENT ₹${rawRentPrice}` : 'RENT'}
              </span>
            ) : isPremium ? (
              <span className="absolute right-0 top-0 rounded-bl-lg bg-gradient-to-b from-[#FF6D2E] to-[#FF5500] px-2 py-1 text-center text-[10px] font-black uppercase leading-tight tracking-wider text-white shadow-md">
                VIP
              </span>
            ) : null}
          </div>
        </Link>

        {/* Explicit Watchlist Remove button when rendered inside My Watchlist */}
        {bookmarkAction === 'remove' && (
          <button
            type="button"
            onClick={toggleBookmark}
            disabled={bookmarkMut.isPending}
            className="absolute left-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/75 text-white opacity-100 shadow-md backdrop-blur-md disabled:opacity-50"
            title="Remove from Watchlist"
            aria-label={`Remove ${item.name ?? 'title'} from Watchlist`}
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        )}
      </article>

      {/* NETFLIX-STYLE HOVER PREVIEW MINI-MODAL WITH ULTRA-SMOOTH CUBIC-BEZIER ZOOM */}
      {mounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {hoverBox && (
              <motion.div
                key={`preview-${contentId}`}
                onMouseEnter={keepPreviewOpen}
                onMouseLeave={scheduleClosePreview}
                onClick={handleMoreInfo}
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{
                  duration: 0.24,
                  ease: [0.22, 1, 0.36, 1],
                }}
                style={{
                  position: 'fixed',
                  top: hoverBox.top,
                  left: hoverBox.left,
                  width: hoverBox.width,
                  transformOrigin: `${hoverBox.originX} center`,
                  willChange: 'transform, opacity',
                  backfaceVisibility: 'hidden',
                  WebkitFontSmoothing: 'antialiased',
                }}
                className="z-[95] cursor-pointer overflow-hidden rounded-xl border border-white/[0.12] bg-[#181818] text-white shadow-[0_24px_64px_rgba(0,0,0,0.92)]"
              >
                {/* Top 16:9 Widescreen Backdrop Image (Static, no competing inner zoom) */}
                <div className="relative aspect-video w-full overflow-hidden bg-[#101010]">
                  {previewImgSrc ? (
                    <img
                      src={previewImgSrc}
                      alt={String(item.name ?? rawItem.title ?? '')}
                      className="h-full w-full object-cover object-center select-none"
                      draggable={false}
                      onError={() =>
                        setLandscapeIdx((curr) => Math.min(curr + 1, landscapeCandidates.length))
                      }
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#141414]">
                      <Film className="h-10 w-10 text-zinc-600" />
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#181818] via-[#181818]/60 to-transparent" />

                  {/* Subtle Title Overlay on Bottom-Left of Preview Artwork */}
                  <p className="absolute bottom-2.5 left-3.5 right-3.5 truncate text-sm font-extrabold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                    {item.name ?? rawItem.title}
                  </p>

                  {isTvod ? (
                    <span className="absolute right-2.5 top-2.5 rounded bg-amber-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-zinc-950 shadow">
                      {rawRentPrice > 0 ? `RENT ₹${rawRentPrice}` : 'RENT'}
                    </span>
                  ) : isPremium ? (
                    <span className="absolute right-2.5 top-2.5 rounded bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow">
                      VIP
                    </span>
                  ) : null}
                </div>

                {/* Bottom Info Panel */}
                <div className="p-4 pt-3">
                  {/* Row 1: Action Buttons — [Play] [+] [ThumbsUp] ............ [ChevronDown] */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Solid White Play Circle */}
                      <button
                        type="button"
                        onClick={handlePlayNow}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-md transition-colors duration-150 hover:bg-white/85"
                        title="Play"
                        aria-label="Play"
                      >
                        <Play size={18} fill="currentColor" className="ml-0.5" />
                      </button>

                      {/* Watchlist (+) / (Check) Circle */}
                      <button
                        type="button"
                        onClick={toggleBookmark}
                        disabled={bookmarkMut.isPending}
                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors duration-150 ${
                          isBookmarked
                            ? 'border-[#FF6D2E] bg-[#FF6D2E]/20 text-[#FF6D2E]'
                            : 'border-white/45 bg-[#2A2A2A]/70 text-white hover:border-white'
                        }`}
                        title={isBookmarked ? 'Remove from My List' : 'Add to My List'}
                        aria-label={isBookmarked ? 'Remove from My List' : 'Add to My List'}
                      >
                        {isBookmarked ? (
                          <Check size={17} strokeWidth={2.5} />
                        ) : (
                          <Plus size={19} strokeWidth={2.3} />
                        )}
                      </button>

                      {/* Like (ThumbsUp) Circle */}
                      <button
                        type="button"
                        onClick={handleToggleLike}
                        className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/45 bg-[#2A2A2A]/70 text-white transition-colors duration-150 hover:border-white"
                        title="I like this"
                        aria-label="Like"
                      >
                        <ThumbsUp
                          size={16}
                          strokeWidth={2.2}
                          className={isLiked ? 'fill-[#FF6D2E] text-[#FF6D2E]' : 'text-white'}
                        />
                      </button>
                    </div>

                    {/* More Info / Details (ChevronDown) Circle */}
                    <button
                      type="button"
                      onClick={handleMoreInfo}
                      className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/45 bg-[#2A2A2A]/70 text-white transition-colors duration-150 hover:border-white"
                      title="Episodes & Info"
                      aria-label="More Info"
                    >
                      <ChevronDown size={19} strokeWidth={2.3} />
                    </button>
                  </div>

                  {/* Row 2: Type • Maturity Box • Duration • HD Box */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-2 text-[13px] font-medium text-[#BCBCBC]">
                    <span>{typeLabel}</span>

                    {maturityVal && (
                      <span className="border border-white/40 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white/90">
                        {maturityVal}
                      </span>
                    )}

                    {durationLabel && <span>{durationLabel}</span>}

                    {qualityLabel && (
                      <span className="rounded-[3px] border border-white/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-white/90">
                        {qualityLabel}
                      </span>
                    )}
                  </div>

                  {/* Row 3: Dot-Separated Genre / Mood Tags */}
                  {tagList.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-white">
                      {tagList.map((tag, idx) => (
                        <span key={`${tag}-${idx}`} className="inline-flex items-center gap-1.5">
                          {idx > 0 && <span className="text-white/40">•</span>}
                          <span>{tag}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
