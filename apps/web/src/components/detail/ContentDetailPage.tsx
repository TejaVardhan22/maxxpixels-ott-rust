'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, ThumbsUp, Share2, ArrowLeft, Film, Check } from 'lucide-react';
import {
  useBookmarks,
  useContentDetail,
  useRelatedContent,
  useToggleBookmark,
  useToggleLike,
  resolveImageUrl,
  resolveImageCandidates,
  formatDuration,
  videoTypeLabel,
  getContentImageCandidates,
  getTrailerUrl,
  resolveSecurePlayback,
  catalogApi,
  payload,
  EVENTS,
  getContentSlug,
  getContentUrl,
  getWatchUrl,
} from '@ott/shared';
import type { ContentItem, Episode } from '@ott/shared';
import Link from 'next/link';
import EpisodeList from '@/components/detail/EpisodeList';
import ContentRail from '@/components/home/ContentRail';
import Skeleton from '@/components/ui/Skeleton';
import { showToast } from '@/components/ui/ToastHost';
import { useStoredUser } from '@/lib/auth';
import { userPageHref } from '@/lib/userRoutes';
import { trackEvent, trackFbEvent } from '@/lib/analytics';
import PlayButtonGuard from '@/components/play/PlayButtonGuard';
import { setPendingPlayback } from '@/lib/playbackSession';
import TrailerPlayerModal from '@/components/trailer/TrailerPlayerModal';
import RentButton from '@/components/payment/RentButton';

interface ContentDetailPageProps {
  slug?: string;
  videoType?: number;
  typeId?: number;
  videoId?: number;
  contentType?: 'movie' | 'series' | 'title';
}

function firstText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(firstText).filter(Boolean).join(', ');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return firstText(record.name ?? record.title ?? record.value ?? '');
  }
  return '';
}

function parsePositiveSeconds(value: string | null): number | undefined {
  const n = Math.floor(Number(value ?? ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseNumericParam(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && Number.isFinite(val) && val > 0) return val;
  if (typeof val === 'string' && val.trim() !== '' && val !== 'NaN' && val !== 'undefined') {
    const n = Number(val);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

export default function ContentDetailPage(props: ContentDetailPageProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0A0A]" aria-busy="true" />}>
      <ContentDetailInner {...props} />
    </Suspense>
  );
}

function ContentDetailInner({
  slug: explicitSlug,
  videoType: explicitVideoType,
  typeId: explicitTypeId,
  videoId: explicitVideoId,
  contentType = 'title',
}: ContentDetailPageProps) {
  const params = useParams<{
    slug?: string;
    videoType?: string;
    typeId?: string;
    videoId?: string;
  }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, session } = useStoredUser();

  const slugParam = String(
    explicitSlug ||
      params?.slug ||
      (typeof params?.videoId === 'string' &&
      isNaN(Number(params?.videoId)) &&
      params?.videoId !== 'NaN' &&
      params?.videoId !== 'undefined'
        ? params?.videoId
        : '') ||
      searchParams?.get('slug') ||
      '',
  ).trim();

  const vt = parseNumericParam(
    explicitVideoType ?? params?.videoType,
    contentType === 'series' ? 2 : 1,
  );
  const tid = parseNumericParam(explicitTypeId ?? params?.typeId, 1);
  const vid = parseNumericParam(explicitVideoId ?? params?.videoId, 0);

  // 1. Slug / REST API direct lookup
  const contentBySlugQuery = useQuery({
    queryKey: ['contentDetailBySlug', slugParam, vt, tid, vid],
    queryFn: async () => {
      if (!slugParam && vid <= 0) return null;
      const lookupKey = slugParam || String(vid);

      try {
        let response = await fetch(`/api/v1/content/${encodeURIComponent(lookupKey)}`);
        if (!response.ok) {
          response = await fetch(`/api/v1/content/slug/${encodeURIComponent(lookupKey)}`);
        }
        if (response.ok) {
          const json = await response.json();
          const rawItem = json?.data ?? json?.result?.[0] ?? json?.result ?? json;
          if (rawItem && (rawItem.id || rawItem.name || rawItem.title)) {
            return rawItem as ContentItem;
          }
        }
      } catch {}

      if (slugParam) {
        const cleanSearch = slugParam.replace(/[-_]+/g, ' ').trim();
        const res = await catalogApi.searchContent(
          payload.search(
            { userId: session?.userId ?? 0, deviceId: session?.deviceId ?? 'web' },
            cleanSearch,
            1,
          ),
        );
        const items = res?.result ?? [];
        if (items.length > 0) {
          const normSlug = slugParam.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const match = items.find((it) => {
            const itSlug = getContentSlug(it as any);
            const itTitle = String(it.name || it.title || '').toLowerCase();
            return (
              itSlug === normSlug ||
              itSlug.startsWith(normSlug) ||
              normSlug.startsWith(itSlug) ||
              itTitle.includes(cleanSearch.toLowerCase()) ||
              cleanSearch.toLowerCase().includes(itTitle)
            );
          });
          if (match) return match as ContentItem;
          if (items.length === 1) return items[0] as ContentItem;
        }
      }

      return null;
    },
    enabled: Boolean(slugParam) || vid <= 0,
    staleTime: 60_000,
  });

  // 2. Legacy numeric contentDetail query if vid > 0
  const legacyDetailQ = useContentDetail(vt, tid, vid, 0, session);

  const rawLegacy = legacyDetailQ.data as any;
  const legacyContent = (
    Array.isArray(rawLegacy)
      ? rawLegacy[0]
      : rawLegacy?.result?.[0] ??
        rawLegacy?.data?.[0] ??
        (rawLegacy?.id ? rawLegacy : undefined)
  ) as ContentItem | undefined;

  const content = contentBySlugQuery.data || legacyContent;

  const effectiveVid = parseNumericParam(content?.video_id ?? content?.id, vid);
  const effectiveVt = parseNumericParam(content?.video_type, vt);
  const effectiveTid = parseNumericParam(content?.type_id, tid);

  const relatedQ = useRelatedContent(effectiveVt, effectiveTid, effectiveVid);
  const bookmarksQ = useBookmarks(session);
  const bookmarkMut = useToggleBookmark();
  const likeMut = useToggleLike();
  const [inWatchlist, setInWatchlist] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    const rawObj = (content ?? {}) as Record<string, any>;
    setIsLiked(Boolean(rawObj.is_user_like ?? Number(content?.is_like ?? 0) === 1));
  }, [content, effectiveVid]);

  useEffect(() => {
    const rawData = bookmarksQ.data as any;
    const list: any[] = Array.isArray(rawData?.result)
      ? rawData.result
      : Array.isArray(rawData?.data)
      ? rawData.data
      : Array.isArray(rawData)
      ? rawData
      : [];
    const found = list.some(
      (it) =>
        Number(it?.contentId ?? it?.content_id ?? it?.video_id ?? it?.id ?? 0) === effectiveVid,
    );
    setInWatchlist(found || Number(content?.is_bookmark ?? 0) === 1);
  }, [bookmarksQ.data, effectiveVid, content?.is_bookmark]);

  const rawRelated = relatedQ.data as any;
  const related = (
    Array.isArray(rawRelated) ? rawRelated : rawRelated?.result ?? rawRelated?.data ?? []
  ) as ContentItem[];

  const [trailerOpen, setTrailerOpen] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const [rented, setRented] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [posterIndex, setPosterIndex] = useState(0);
  const resumeAt = parsePositiveSeconds(
    searchParams?.get('resume_at') ?? searchParams?.get('resumeAt') ?? searchParams?.get('t'),
  );

  const imageCandidates = resolveImageCandidates(getContentImageCandidates(content, 'landscape'));
  const imageCandidateKey = imageCandidates.join('|');
  const safeImageIndex = Math.min(imageIndex, imageCandidates.length);
  const imgSrc = imageCandidates[safeImageIndex] || '';
  const imageFailed = !imgSrc;

  const posterCandidates = resolveImageCandidates(getContentImageCandidates(content, 'portrait'));
  const posterCandidateKey = posterCandidates.join('|');
  const safePosterIndex = Math.min(posterIndex, posterCandidates.length);
  const posterSrc = posterCandidates[safePosterIndex] || '';

  useEffect(() => {
    setImageIndex(0);
    setPosterIndex(0);
  }, [effectiveVid, slugParam, imageCandidateKey, posterCandidateKey]);

  useEffect(() => {
    if (!content) return;
    setRented(
      Number(content.rent_buy ?? 0) === 1 || Number((content as any).is_rented ?? 0) === 1,
    );
    trackEvent(EVENTS.CONTENT_VIEW, {
      content_id: effectiveVid,
      content_name: content.name ?? '',
      content_type: String(content.video_type ?? ''),
      is_premium: content.is_premium === 1 ? 'yes' : 'no',
    });
    trackFbEvent('ViewContent', {
      content_ids: [String(effectiveVid)],
      content_name: content.name ?? '',
      content_type: 'video',
    });
    if (effectiveVid > 0) {
      void fetch('/api/v1/analytics/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.auth_token ? { Authorization: `Bearer ${user.auth_token}` } : {}),
        },
        body: JSON.stringify({
          contentId: effectiveVid,
          contentTitle: String(content.name ?? (content as any)?.title ?? ''),
          eventType: 'CONTENT_VIEW',
          interactionType: 'VIEW',
          deviceType: 'WEB',
        }),
      }).catch(() => {});
    }
  }, [content, effectiveVid, user?.auth_token]);

  const isLoading =
    (Boolean(slugParam) && contentBySlugQuery.isLoading) ||
    (vid > 0 && legacyDetailQ.isLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] px-3 pb-16 pt-[104px] sm:px-6 sm:pt-[112px] lg:px-10 lg:pt-[82px]">
        <div className="mx-auto max-w-[1560px]">
          <Skeleton className="mb-6 min-h-[340px] w-full rounded-2xl bg-[#141414] sm:min-h-[480px] lg:aspect-[16/8.2] lg:max-h-[82svh]" />
          <Skeleton variant="text" className="mb-3 h-7 w-1/3 bg-[#141414]" />
          <Skeleton variant="text" className="mb-6 h-4 w-1/4 bg-[#141414]" />
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] px-4 py-32 text-center text-white">
        <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#141414] p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF6D2E]">
            Title Not Found
          </p>
          <h1 className="mt-3 font-display text-3xl font-black text-white">
            This title is unavailable.
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            {slugParam
              ? `We could not find "${slugParam}". It may have been removed or renamed.`
              : 'No content was found for this link.'}
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-6 py-3 text-sm font-bold text-white shadow-[0_8px_24px_rgba(255,109,46,0.4)] transition hover:brightness-110"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const raw = content as Record<string, unknown> | undefined;
  const trailerVisible = Boolean(raw && getTrailerUrl(raw));
  const isTvodContent =
    content.is_rent === 1 ||
    String(raw?.monetization || '').toUpperCase() === 'TVOD' ||
    (content.rent_buy !== undefined &&
      (content as any).rent_buy === 0 &&
      Number(content.rent_price || 0) > 0);
  const isPremiumContent =
    !isTvodContent &&
    (content.is_premium === 1 || String(raw?.monetization || '').toUpperCase() === 'SVOD');

  const startMainPlayback = async () => {
    if (!user?.id) {
      router.push(
        `/login?redirect=${encodeURIComponent(getWatchUrl(content as any, undefined, resumeAt))}`,
      );
      return;
    }

    if (isTvodContent && !rented) {
      setPlaybackError('Please rent this title to start streaming.');
      return;
    }

    if (!isTvodContent && Number(user?.is_buy ?? 0) !== 1) {
      router.push('/subscription');
      return;
    }

    try {
      setPlaybackError('');
      let streamUrl =
        (content as any)?.video_url ||
        (content as any)?.videoUrl ||
        (content as any)?.streamUrl ||
        (content as any)?.stream_url ||
        (content as any)?.movie?.videoAssetId;
      let pbKind: 'hls' | 'direct' = /\.m3u8($|[?#])|manifest/i.test(String(streamUrl || ''))
        ? 'hls'
        : 'direct';
      let fallbackUrl: string | undefined = undefined;
      let subtitles: any[] | undefined = undefined;
      let playbackSessionToken: string | undefined = undefined;
      let serverResumeAt: number | undefined = undefined;
      let showAds: boolean | undefined = undefined;
      let vastTagUrl: string | null | undefined = undefined;

      if (effectiveVid > 0) {
        try {
          const pb = await resolveSecurePlayback({
            videoId: effectiveVid,
            videoType: effectiveVt,
          });
          if (pb?.streamUrl) {
            streamUrl = pb.streamUrl;
            pbKind = pb.kind;
            fallbackUrl = pb.fallbackUrl;
            subtitles = pb.subtitles;
            playbackSessionToken = pb.sessionToken;
            const rawRes = Number(
              (pb as any)?.resumePositionSeconds ?? (pb as any)?.resume_position_seconds ?? 0,
            );
            if (Number.isFinite(rawRes) && rawRes > 0) serverResumeAt = Math.floor(rawRes);
            showAds = pb.showAds;
            vastTagUrl = pb.vastTagUrl;
          }
        } catch (e) {
          if (!streamUrl) throw e;
        }
      }

      const categoryRaw = raw?.category_id;
      const categoryIdForAds =
        typeof categoryRaw === 'string'
          ? categoryRaw
              .split(',')
              .map((x) => x.trim())
              .find((x) => x.length > 0)
          : typeof categoryRaw === 'number'
          ? String(categoryRaw)
          : String(effectiveTid);

      if (streamUrl) {
        setPendingPlayback({
          kind: pbKind,
          url: streamUrl,
          fallbackUrl,
          subtitles,
          videoId: effectiveVid,
          videoType: effectiveVt,
          typeId: effectiveTid,
          categoryId: categoryIdForAds,
          resumeAt: resumeAt ?? serverResumeAt,
          title: firstText(content.name),
          poster: imgSrc,
          sessionToken: playbackSessionToken,
          showAds,
          vastTagUrl,
        });
      }
      router.push(getWatchUrl(content as any, undefined, resumeAt));
    } catch {
      router.push(getWatchUrl(content as any, undefined, resumeAt));
    }
  };

  const startEpisodePlayback = async (ep: Episode) => {
    const eid = Number(ep.id);
    if (!Number.isFinite(eid)) return;
    const epRaw = ep as unknown as Record<string, unknown>;
    const isEpPremium = ep.is_premium === 1 || epRaw?.is_premium === 1 || isPremiumContent;

    if (!user?.id) {
      router.push(`/login?redirect=${encodeURIComponent(getWatchUrl(content as any, eid))}`);
      return;
    }

    if (Number(user?.is_buy ?? 0) !== 1) {
      router.push('/subscription');
      return;
    }

    try {
      setPlaybackError('');
      const pb = await resolveSecurePlayback({
        videoId: eid,
        videoType: 2,
        episodeId: eid,
        contentId: Number(content.id) || undefined,
      });
      setPendingPlayback({
        kind: pb.kind,
        url: pb.streamUrl,
        fallbackUrl: pb.fallbackUrl,
        subtitles: pb.subtitles,
        videoId: eid,
        videoType: 2,
        typeId: effectiveTid,
        categoryId: String(effectiveTid),
        title: firstText(ep.name),
        poster: resolveImageUrl(ep.landscape || ep.image || ep.thumbnail),
        sessionToken: pb.sessionToken,
        showAds: pb.showAds,
        vastTagUrl: pb.vastTagUrl,
      });
      router.push(getWatchUrl(content as any, eid));
    } catch {
      router.push(getWatchUrl(content as any, eid));
    }
  };

  const titleVal = firstText(content.name ?? raw?.title);
  const descriptionVal = firstText(
    content.description ?? raw?.synopsis ?? raw?.shortDescription ?? raw?.short_description,
  );

  const rawTypeStr = firstText(raw?.contentType ?? raw?.content_type ?? raw?.type);
  const typeBadgeVal = rawTypeStr
    ? rawTypeStr
        .replace(/[_-]+/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (ch) => ch.toUpperCase())
    : videoTypeLabel(content.video_type) !== 'Content'
    ? videoTypeLabel(content.video_type)
    : '';

  const yearVal =
    firstText(content.release_year ?? raw?.releaseYear) ||
    (typeof raw?.release_date === 'string'
      ? raw.release_date.match(/\b(19|20)\d{2}\b/)?.[0]
      : '') ||
    (typeof raw?.releaseDate === 'string'
      ? raw.releaseDate.match(/\b(19|20)\d{2}\b/)?.[0]
      : '') ||
    '';

  const rawDurationNum = Number(
    content.video_duration ?? raw?.durationSeconds ?? raw?.duration_seconds ?? 0,
  );
  const durationVal =
    (rawDurationNum > 0 ? formatDuration(rawDurationNum) : '') ||
    (typeof raw?.duration === 'string' && raw.duration.trim() ? raw.duration.trim() : '');

  const maturityVal = firstText(
    raw?.ageRating ??
      raw?.maturity_rating ??
      raw?.age_rating ??
      raw?.maturity ??
      raw?.certification,
  );

  const languageVal = firstText(
    raw?.originalLanguage ?? raw?.language ?? raw?.language_name ?? raw?.languages,
  );

  const genreVal = firstText(content.category_name ?? raw?.genres ?? raw?.categories);

  const qualityBadges: string[] = Array.isArray(raw?.quality_badges ?? raw?.qualityBadges)
    ? ((raw?.quality_badges ?? raw?.qualityBadges) as unknown[]).map(String).filter(Boolean)
    : typeof (raw?.quality_badges ?? raw?.qualityBadges) === 'string'
    ? String(raw?.quality_badges ?? raw?.qualityBadges)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-16 text-white">
      {/* FRAMED NETFLIX-STYLE CINEMA HERO BILLBOARD */}
      <section className="mx-auto w-full max-w-[1560px] px-3 pt-[104px] sm:px-6 sm:pt-[112px] lg:px-10 lg:pt-[82px]">
        <div
          className="
            relative flex flex-col w-full overflow-hidden rounded-xl sm:block sm:rounded-2xl
            border border-white/[0.12] bg-[#141414] sm:bg-[#0A0A0A]
            shadow-[0_24px_80px_rgba(0,0,0,0.85)]
            sm:min-h-[480px] lg:aspect-[16/8.2] lg:max-h-[82svh]
          "
        >
          {/* 16:9 Artwork Stage (Uncropped 16:9 on mobile, full-bleed cover on sm+) */}
          <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-[#141414] sm:absolute sm:inset-0 sm:h-full sm:aspect-auto">
            {imgSrc && !imageFailed ? (
              <img
                src={imgSrc}
                alt={titleVal}
                className="h-full w-full object-cover object-top sm:object-center"
                onError={() =>
                  setImageIndex((current) => Math.min(current + 1, imageCandidates.length))
                }
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#141414]">
                <Film className="h-16 w-16 text-zinc-700 sm:h-20 sm:w-20" strokeWidth={1.25} />
              </div>
            )}

            {/* Mobile bottom fade into #141414 content block */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#141414] via-[#141414]/65 to-transparent sm:hidden" />

            {/* Tablet & Desktop Pure Cinema-Black Vignettes (#0A0A0A) */}
            <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/55 via-30% to-transparent sm:block" />
            <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-[#0A0A0A]/95 via-[#0A0A0A]/60 via-45% to-transparent sm:block" />
            <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-20 bg-gradient-to-b from-[#0A0A0A]/65 to-transparent sm:block" />
          </div>

          {/* Bottom-Left Hero Content + Portrait Poster Beside Content */}
          <div className="relative z-10 -mt-6 flex flex-col justify-end px-4 pb-5 sm:absolute sm:inset-x-0 sm:bottom-0 sm:mt-0 sm:px-8 sm:pb-10 lg:px-12 lg:pb-12">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-7"
            >
              {/* Mobile + Desktop Top Section with Portrait Poster & Title/Meta */}
              <div className="flex items-end gap-3.5 sm:contents">
                {posterSrc && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.38, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
                    className="w-20 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-[#141414] shadow-[0_14px_34px_rgba(0,0,0,0.9)] sm:w-32 sm:rounded-xl md:w-40 lg:w-44"
                  >
                    <img
                      src={posterSrc}
                      alt={titleVal}
                      className="aspect-[2/3] w-full object-cover object-top"
                      onError={() =>
                        setPosterIndex((current) => Math.min(current + 1, posterCandidates.length))
                      }
                    />
                  </motion.div>
                )}

                <div className="min-w-0 flex-1 max-w-2xl">
                  {/* Top Category / Status Line */}
                  {(isTvodContent || content.is_premium === 1 || typeBadgeVal || genreVal) && (
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] sm:mb-2.5 sm:gap-2 sm:text-xs">
                      {isTvodContent ? (
                        <span className="rounded bg-[#FF6D2E] px-2 py-0.5 text-[10px] font-black text-white">
                          {rented
                            ? 'RENTED'
                            : Number(content.rent_price ?? (content as any).price ?? 0) > 0
                            ? `RENT · ₹${content.rent_price ?? (content as any).price}`
                            : 'RENT'}
                        </span>
                      ) : content.is_premium === 1 ? (
                        <span className="rounded bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-2 py-0.5 text-[10px] font-black text-white">
                          VIP
                        </span>
                      ) : null}
                      {typeBadgeVal && <span className="text-[#FF6D2E]">{typeBadgeVal}</span>}
                      {typeBadgeVal && genreVal && <span className="text-white/30">•</span>}
                      {genreVal && <span className="text-white/80">{genreVal}</span>}
                    </div>
                  )}

                  {/* Title */}
                  <h1 className="font-display text-xl font-black leading-[1.1] tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)] sm:text-4xl lg:text-5xl">
                    {titleVal}
                  </h1>

                  {/* Dot-Separated Metadata Row */}
                  {(yearVal ||
                    durationVal ||
                    languageVal ||
                    maturityVal ||
                    qualityBadges.length > 0) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-white/80 sm:mt-3 sm:gap-2 sm:text-sm">
                      {yearVal && <span>{yearVal}</span>}
                      {durationVal && (
                        <>
                          {yearVal && <span className="text-white/35">•</span>}
                          <span>{durationVal}</span>
                        </>
                      )}
                      {languageVal && (
                        <>
                          {(yearVal || durationVal) && <span className="text-white/35">•</span>}
                          <span>{languageVal}</span>
                        </>
                      )}
                      {maturityVal && (
                        <span className="ml-0.5 rounded border border-white/25 bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white sm:ml-1 sm:text-[11px]">
                          {maturityVal}
                        </span>
                      )}
                      {qualityBadges.map((b) => (
                        <span
                          key={b}
                          className="rounded border border-[#FF6D2E]/40 bg-[#FF6D2E]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#FF6D2E]"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Desktop/Tablet Synopsis + CTAs inside right column */}
                  {descriptionVal && (
                    <p className="mt-3 hidden line-clamp-3 max-w-xl text-sm leading-relaxed text-white/75 sm:block sm:text-[15px]">
                      {descriptionVal}
                    </p>
                  )}

                  {/* Primary CTA Row (Tablet/Desktop) */}
                  <div className="mt-5 hidden flex-wrap items-center gap-3 sm:flex">
                    {isTvodContent && !rented ? (
                      <RentButton
                        videoId={effectiveVid}
                        videoType={effectiveVt}
                        subVideoType={Number(content.sub_video_type ?? 0)}
                        price={Number(content.rent_price ?? (content as any).price ?? 99)}
                        rentDay={Number(
                          content.rent_day ??
                            ((content as any).validity_hours
                              ? Math.ceil(Number((content as any).validity_hours) / 24)
                              : 2),
                        )}
                        title={firstText(content.name)}
                        onRented={() => setRented(true)}
                      />
                    ) : (
                      <PlayButtonGuard
                        user={user}
                        isPremium={isPremiumContent}
                        contentTitle={firstText(content.name)}
                        onPlay={startMainPlayback}
                      />
                    )}

                    {trailerVisible && (
                      <button
                        type="button"
                        onClick={() => setTrailerOpen(true)}
                        className="inline-flex h-11 items-center gap-2 rounded-md border border-white/15 bg-white/15 px-5 text-sm font-bold text-white backdrop-blur-md transition hover:bg-white/25 sm:h-12"
                      >
                        <Film size={16} />
                        <span>Trailer</span>
                      </button>
                    )}

                    {/* My List Button */}
                    <button
                      type="button"
                      disabled={bookmarkMut.isPending}
                      onClick={() => {
                        if (!user?.id) {
                          router.push(
                            `/login?redirect=${encodeURIComponent(getContentUrl(content as any))}`,
                          );
                          return;
                        }
                        const titleName = firstText(content.name) || 'Title';
                        const nextState = !inWatchlist;
                        setInWatchlist(nextState);
                        if (nextState) {
                          trackEvent(EVENTS.WATCHLIST_ADD, {
                            content_id: effectiveVid,
                            content_name: titleName,
                          });
                          trackFbEvent('AddToWishlist', {
                            content_ids: [String(effectiveVid)],
                            content_name: titleName,
                          });
                        }
                        bookmarkMut.mutate(
                          {
                            user_id: user.id,
                            video_type: effectiveVt,
                            sub_video_type: 0,
                            contentId: effectiveVid,
                            video_id: effectiveVid,
                            type_id: effectiveTid,
                            is_kids_profile: session?.isKidsProfile ? 1 : 0,
                            action: nextState ? 'add' : 'remove',
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
                              setInWatchlist(!nextState);
                              showToast({
                                title: 'Watchlist update failed',
                                message: 'Could not update your watchlist. Please try again.',
                                variant: 'error',
                              });
                            },
                          },
                        );
                      }}
                      className={`inline-flex h-11 items-center gap-2 rounded-md border px-5 text-sm font-bold backdrop-blur-md transition sm:h-12 ${
                        inWatchlist
                          ? 'border-[#FF6D2E]/60 bg-[#FF6D2E]/20 text-[#FF6D2E] hover:bg-[#FF6D2E]/30'
                          : 'border-white/15 bg-white/15 text-white hover:bg-white/25'
                      }`}
                    >
                      {inWatchlist ? (
                        <>
                          <Check size={16} strokeWidth={2.5} />
                          <span>In My List</span>
                        </>
                      ) : (
                        <>
                          <Plus size={16} strokeWidth={2.5} />
                          <span>My List</span>
                        </>
                      )}
                    </button>

                    {/* Netflix-Style Circular Like Button (Only thumb turns orange on click) */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!user?.id) {
                          router.push('/login');
                          return;
                        }
                        setIsLiked((v) => !v);
                        likeMut.mutate({
                          user_id: user.id,
                          video_type: effectiveVt,
                          sub_video_type: 0,
                          video_id: effectiveVid,
                          type_id: effectiveTid,
                        });
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white/90 backdrop-blur-md transition hover:border-white/50 hover:bg-white/15 sm:h-12 sm:w-12"
                      title={isLiked ? 'Liked' : 'I like this'}
                      aria-label="Like title"
                    >
                      <ThumbsUp
                        size={16}
                        className={
                          isLiked
                            ? 'fill-[#FF6D2E] text-[#FF6D2E] transition-colors'
                            : 'text-white/90 transition-colors'
                        }
                      />
                    </button>

                    {/* Share Button */}
                    <button
                      type="button"
                      onClick={async () => {
                        if (navigator?.share) {
                          try {
                            await navigator.share({
                              title: firstText(content.name),
                              url: window.location.href,
                            });
                          } catch {}
                        } else if (navigator?.clipboard) {
                          try {
                            await navigator.clipboard.writeText(window.location.href);
                            showToast({
                              title: 'Link copied',
                              message: 'Page link copied to your clipboard.',
                              variant: 'info',
                            });
                          } catch {}
                        }
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white/90 backdrop-blur-md transition hover:border-white/50 hover:bg-white/15 sm:h-12 sm:w-12"
                      aria-label="Share title"
                    >
                      <Share2 size={16} />
                    </button>
                  </div>

                  {playbackError && (
                    <div className="mt-4 hidden rounded-lg border border-[#FF6D2E]/40 bg-[#FF6D2E]/15 px-4 py-2 text-sm text-[#FFB088] sm:inline-flex">
                      {playbackError}
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile Synopsis & Full-Width Responsive CTA Bar (<640px) */}
              <div className="sm:hidden">
                {descriptionVal && (
                  <p className="line-clamp-3 text-xs leading-relaxed text-white/75">
                    {descriptionVal}
                  </p>
                )}

                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  {isTvodContent && !rented ? (
                    <RentButton
                      videoId={effectiveVid}
                      videoType={effectiveVt}
                      subVideoType={Number(content.sub_video_type ?? 0)}
                      price={Number(content.rent_price ?? (content as any).price ?? 99)}
                      rentDay={Number(
                        content.rent_day ??
                          ((content as any).validity_hours
                            ? Math.ceil(Number((content as any).validity_hours) / 24)
                            : 2),
                      )}
                      title={firstText(content.name)}
                      onRented={() => setRented(true)}
                    />
                  ) : (
                    <PlayButtonGuard
                      user={user}
                      isPremium={isPremiumContent}
                      contentTitle={firstText(content.name)}
                      onPlay={startMainPlayback}
                    />
                  )}

                  {trailerVisible && (
                    <button
                      type="button"
                      onClick={() => setTrailerOpen(true)}
                      className="inline-flex h-10 items-center gap-1.5 rounded-md border border-white/15 bg-white/15 px-3.5 text-xs font-bold text-white backdrop-blur-md transition hover:bg-white/25"
                    >
                      <Film size={14} />
                      <span>Trailer</span>
                    </button>
                  )}

                  {/* Mobile My List Button */}
                  <button
                    type="button"
                    disabled={bookmarkMut.isPending}
                    onClick={() => {
                      if (!user?.id) {
                        router.push(
                          `/login?redirect=${encodeURIComponent(getContentUrl(content as any))}`,
                        );
                        return;
                      }
                      const titleName = firstText(content.name) || 'Title';
                      const nextState = !inWatchlist;
                      setInWatchlist(nextState);
                      bookmarkMut.mutate({
                        user_id: user.id,
                        video_type: effectiveVt,
                        sub_video_type: 0,
                        contentId: effectiveVid,
                        video_id: effectiveVid,
                        type_id: effectiveTid,
                        is_kids_profile: session?.isKidsProfile ? 1 : 0,
                        action: nextState ? 'add' : 'remove',
                      });
                    }}
                    className={`inline-flex h-10 items-center gap-1.5 rounded-md border px-3.5 text-xs font-bold backdrop-blur-md transition ${
                      inWatchlist
                        ? 'border-[#FF6D2E]/60 bg-[#FF6D2E]/20 text-[#FF6D2E]'
                        : 'border-white/15 bg-white/15 text-white'
                    }`}
                  >
                    {inWatchlist ? <Check size={14} strokeWidth={2.5} /> : <Plus size={14} strokeWidth={2.5} />}
                    <span>{inWatchlist ? 'In List' : 'My List'}</span>
                  </button>

                  {/* Mobile Circular Like Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!user?.id) {
                        router.push('/login');
                        return;
                      }
                      setIsLiked((v) => !v);
                      likeMut.mutate({
                        user_id: user.id,
                        video_type: effectiveVt,
                        sub_video_type: 0,
                        video_id: effectiveVid,
                        type_id: effectiveTid,
                      });
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white/90 backdrop-blur-md transition hover:border-white/50"
                    title={isLiked ? 'Liked' : 'I like this'}
                    aria-label="Like title"
                  >
                    <ThumbsUp
                      size={15}
                      className={
                        isLiked
                          ? 'fill-[#FF6D2E] text-[#FF6D2E] transition-colors'
                          : 'text-white/90 transition-colors'
                      }
                    />
                  </button>

                  {/* Mobile Share Button */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (navigator?.share) {
                        try {
                          await navigator.share({
                            title: firstText(content.name),
                            url: window.location.href,
                          });
                        } catch {}
                      } else if (navigator?.clipboard) {
                        try {
                          await navigator.clipboard.writeText(window.location.href);
                          showToast({
                            title: 'Link copied',
                            message: 'Page link copied to your clipboard.',
                            variant: 'info',
                          });
                        } catch {}
                      }
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white/90 backdrop-blur-md transition hover:border-white/50"
                    aria-label="Share title"
                  >
                    <Share2 size={15} />
                  </button>
                </div>

                {playbackError && (
                  <div className="mt-3 inline-flex rounded-lg border border-[#FF6D2E]/40 bg-[#FF6D2E]/15 px-3 py-1.5 text-xs text-[#FFB088]">
                    {playbackError}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* DETAILS BODY */}
      <div className="mx-auto max-w-[1560px] space-y-12 px-4 pt-8 sm:px-6 lg:px-10">
        {(content.season?.length ?? 0) > 0 && (
          <EpisodeList
            seasons={content.season ?? []}
            showId={effectiveVid}
            session={user?.id ? { userId: user.id, deviceId: 'web' } : undefined}
            user={user}
            onPlayEpisode={startEpisodePlayback}
          />
        )}

        {(() => {
          const rawCastCandidate =
            content.cast ??
            raw?.cast ??
            raw?.castMembers ??
            raw?.cast_members ??
            raw?.castJson ??
            raw?.cast_json;
          let parsedCast: any[] = [];
          if (Array.isArray(rawCastCandidate)) {
            parsedCast = rawCastCandidate;
          } else if (typeof rawCastCandidate === 'string' && rawCastCandidate.trim()) {
            try {
              const j = JSON.parse(rawCastCandidate);
              if (Array.isArray(j)) parsedCast = j;
            } catch {
              parsedCast = rawCastCandidate
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            }
          }
          const normalizedCast = parsedCast
            .map((entry: any, idx: number) => {
              if (typeof entry === 'string') {
                const name = entry.trim();
                return name
                  ? { id: 0, name, role: 'Cast', photo: '', key: `cast-${idx}-${name}` }
                  : null;
              }
              if (!entry || typeof entry !== 'object') return null;
              const name = firstText(entry.name || entry.fullName || entry.title);
              if (!name) return null;
              const rawPhoto =
                entry.imageUrl ||
                entry.image_url ||
                entry.image ||
                entry.avatarUrl ||
                entry.photo ||
                '';
              return {
                id: Number(entry.id || 0),
                name,
                role: firstText(entry.role || entry.character || entry.designation || 'Cast'),
                photo: rawPhoto ? resolveImageUrl(rawPhoto) : '',
                key: `cast-${entry.id || idx}-${name}`,
              };
            })
            .filter(Boolean) as Array<{
            id: number;
            name: string;
            role: string;
            photo: string;
            key: string;
          }>;

          if (normalizedCast.length === 0) return null;

          return (
            <section>
              <h3 className="mb-4 text-lg font-bold tracking-tight text-white">Cast &amp; Crew</h3>
              <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-hide">
                {normalizedCast.map((c) => {
                  const castHref =
                    c.id > 0 ? `/cast/${c.id}` : `/search?q=${encodeURIComponent(c.name)}`;
                  const initial = c.name.charAt(0).toUpperCase();
                  return (
                    <Link
                      key={c.key}
                      href={castHref}
                      className="group flex w-24 flex-shrink-0 flex-col items-center text-center"
                    >
                      <div className="relative h-20 w-20 overflow-hidden rounded-full border border-white/10 bg-[#141414] transition group-hover:border-[#FF6D2E]">
                        {c.photo ? (
                          <img
                            src={c.photo}
                            alt={c.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#FF6D2E]/85 to-[#FF5500]/85 text-xl font-black text-white">
                            {initial}
                          </div>
                        )}
                      </div>
                      <p className="mt-2 w-full truncate text-xs font-semibold text-white group-hover:text-[#FF6D2E]">
                        {c.name}
                      </p>
                      {c.role && (
                        <p className="mt-0.5 w-full truncate text-[11px] text-zinc-400">
                          {c.role}
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })()}
      </div>

      {related.length > 0 && (
        <div className="mt-10">
          <ContentRail title="More Like This" items={related} />
        </div>
      )}

      <TrailerPlayerModal
        open={trailerOpen}
        onClose={() => setTrailerOpen(false)}
        videoId={effectiveVid}
        videoType={effectiveVt}
        subVideoType={Number(content.sub_video_type ?? 0)}
      />
    </div>
  );
}
