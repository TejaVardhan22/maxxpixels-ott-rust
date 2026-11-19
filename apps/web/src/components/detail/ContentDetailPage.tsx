'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, ThumbsUp, Share2, ArrowLeft, Film, Play, Check } from 'lucide-react';
import {
  useContentDetail, useRelatedContent,
  useToggleBookmark, useToggleLike,
  resolveImageUrl, resolveImageCandidates, formatDuration, videoTypeLabel, getContentImageCandidates,
  getTrailerUrl,
  resolveSecurePlayback,
  catalogApi,
  payload,
  EVENTS,
  getContentSlug,
  getContentUrl,
  getWatchUrl,
} from '@ott/shared';
import type { ContentItem, CastMember, Episode } from '@ott/shared';
import Link from 'next/link';
import EpisodeList from '@/components/detail/EpisodeList';
import CommentSection from '@/components/detail/CommentSection';
import ContentRail from '@/components/home/ContentRail';
import Skeleton from '@/components/ui/Skeleton';
import { useStoredUser } from '@/lib/auth';
import { trackEvent, trackFbEvent } from '@/lib/analytics';
import PlayButtonGuard from '@/components/play/PlayButtonGuard';
import { setPendingPlayback } from '@/lib/playbackSession';
import TrailerPlayerModal from '@/components/trailer/TrailerPlayerModal';
import { OttApiError } from '@ott/shared';
import RentButton from '@/components/payment/RentButton';
import { GoogleAdBanner } from '@/components/ads';

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
    <Suspense fallback={<div className="min-h-screen bg-black" aria-busy="true" />}>
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
  const params = useParams<{ slug?: string; videoType?: string; typeId?: string; videoId?: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, session } = useStoredUser();

  const slugParam = String(
    explicitSlug ||
    params?.slug ||
    (typeof params?.videoId === 'string' && isNaN(Number(params?.videoId)) && params?.videoId !== 'NaN' && params?.videoId !== 'undefined' ? params?.videoId : '') ||
    searchParams?.get('slug') ||
    ''
  ).trim();

  const vt = parseNumericParam(explicitVideoType ?? params?.videoType, contentType === 'series' ? 2 : 1);
  const tid = parseNumericParam(explicitTypeId ?? params?.typeId, 1);
  const vid = parseNumericParam(explicitVideoId ?? params?.videoId, 0);

  // 1. Slug / REST API direct lookup
  const contentBySlugQuery = useQuery({
    queryKey: ['contentDetailBySlug', slugParam, vt, tid, vid],
    queryFn: async () => {
      if (!slugParam && vid <= 0) return null;
      const lookupKey = slugParam || String(vid);

      // Attempt direct backend endpoint GET /content/:slug
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

      // Fallback to catalog search
      if (slugParam) {
        const cleanSearch = slugParam.replace(/[-_]+/g, ' ').trim();
        const res = await catalogApi.searchContent(
          payload.search({ userId: session?.userId ?? 0, deviceId: session?.deviceId ?? 'web' }, cleanSearch, 1)
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
      : rawLegacy?.result?.[0] ?? rawLegacy?.data?.[0] ?? (rawLegacy?.id ? rawLegacy : undefined)
  ) as ContentItem | undefined;

  const content = contentBySlugQuery.data || legacyContent;

  const effectiveVid = parseNumericParam(content?.video_id ?? content?.id, vid);
  const effectiveVt = parseNumericParam(content?.video_type, vt);
  const effectiveTid = parseNumericParam(content?.type_id, tid);

  const relatedQ = useRelatedContent(effectiveVt, effectiveTid, effectiveVid);
  const bookmarkMut = useToggleBookmark();
  const likeMut = useToggleLike();

  const rawRelated = relatedQ.data as any;
  const related = (
    Array.isArray(rawRelated)
      ? rawRelated
      : rawRelated?.result ?? rawRelated?.data ?? []
  ) as ContentItem[];

  const [trailerOpen, setTrailerOpen] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const [rented, setRented] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const resumeAt = parsePositiveSeconds(searchParams?.get('resume_at') ?? searchParams?.get('resumeAt') ?? searchParams?.get('t'));

  const imageCandidates = resolveImageCandidates(getContentImageCandidates(content, 'landscape'));
  const imageCandidateKey = imageCandidates.join('|');
  const safeImageIndex = Math.min(imageIndex, imageCandidates.length);
  const imgSrc = imageCandidates[safeImageIndex] || '';
  const imageFailed = !imgSrc;

  useEffect(() => {
    setImageIndex(0);
  }, [effectiveVid, slugParam, imageCandidateKey]);

  useEffect(() => {
    if (!content) return;
    setRented(Number(content.rent_buy ?? 0) === 1 || Number((content as any).is_rented ?? 0) === 1);
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
  }, [content, effectiveVid]);

  const isLoading =
    (Boolean(slugParam) && contentBySlugQuery.isLoading) ||
    (vid > 0 && legacyDetailQ.isLoading);

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 lg:px-12 py-8">
        <Skeleton className="w-full h-[400px] rounded-xl mb-6" />
        <Skeleton variant="text" className="w-1/2 h-8 mb-3" />
        <Skeleton variant="text" className="w-1/3 h-4 mb-6" />
        <Skeleton className="w-full h-12 rounded-xl" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-32 text-center">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-gold/80">Title Not Found</p>
        <h1 className="mt-3 font-display text-3xl font-black text-white">This title is unavailable.</h1>
        <p className="mt-3 text-sm text-desc-text">
          {slugParam
            ? `We could not find "${slugParam}". It may have been removed or renamed.`
            : 'No content was found for this link.'}
        </p>
        <Link href="/" className="btn-primary mt-8 inline-flex rounded-full px-6 py-3 text-sm font-black">
          Back to Home
        </Link>
      </div>
    );
  }

  const raw = content as Record<string, unknown> | undefined;
  const trailerVisible = Boolean(raw && getTrailerUrl(raw));
  const isTvodContent =
    content.is_rent === 1 ||
    String(raw?.monetization || '').toUpperCase() === 'TVOD' ||
    (content.rent_buy !== undefined && (content as any).rent_buy === 0 && Number(content.rent_price || 0) > 0);
  const isPremiumContent = !isTvodContent && (content.is_premium === 1 || String(raw?.monetization || '').toUpperCase() === 'SVOD');

  const startMainPlayback = async () => {
    if (!user?.id) {
      router.push(`/login?redirect=${encodeURIComponent(getWatchUrl(content as any, undefined, resumeAt))}`);
      return;
    }

    if (isTvodContent && !rented) {
      setPlaybackError('Please rent this title to start streaming.');
      return;
    }

    if (isPremiumContent && user?.is_buy !== 1) {
      router.push('/subscription');
      return;
    }

    try {
      setPlaybackError('');
      let streamUrl = (content as any)?.video_url || (content as any)?.videoUrl || (content as any)?.streamUrl || (content as any)?.stream_url || (content as any)?.movie?.videoAssetId;
      let pbKind: 'hls' | 'direct' = /\.m3u8($|[?#])|manifest/i.test(String(streamUrl || '')) ? 'hls' : 'direct';
      let fallbackUrl: string | undefined = undefined;
      let subtitles: any[] | undefined = undefined;
      let playbackSessionToken: string | undefined = undefined;
      let showAds: boolean | undefined = undefined;
      let vastTagUrl: string | null | undefined = undefined;

      if (effectiveVid > 0) {
        try {
          const pb = await resolveSecurePlayback({ videoId: effectiveVid, videoType: effectiveVt });
          if (pb?.streamUrl) {
            streamUrl = pb.streamUrl;
            pbKind = pb.kind;
            fallbackUrl = pb.fallbackUrl;
            subtitles = pb.subtitles;
            playbackSessionToken = pb.sessionToken;
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
          ? categoryRaw.split(',').map((x) => x.trim()).find((x) => x.length > 0)
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
          resumeAt,
          title: firstText(content.name),
          poster: imgSrc,
          sessionToken: playbackSessionToken,
          showAds,
          vastTagUrl,
        });
      }
      router.push(getWatchUrl(content as any, undefined, resumeAt));
    } catch (error) {
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

    if (isEpPremium && user?.is_buy !== 1) {
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
    } catch (error) {
      router.push(getWatchUrl(content as any, eid));
    }
  };

  const yearVal =
    firstText(content.release_year) ||
    (typeof raw?.release_date === 'string' ? raw.release_date.match(/\b(19|20)\d{2}\b/)?.[0] : '') ||
    '2026';

  const durationVal =
    (content.video_duration ? formatDuration(content.video_duration) : '') ||
    (typeof raw?.duration === 'string' ? raw.duration : '') ||
    (effectiveVt === 2 ? 'Web Series' : '2h 15m');

  const maturityVal =
    firstText(raw?.maturity_rating ?? raw?.age_rating ?? raw?.maturity ?? raw?.certification) ||
    'U/A 13+';

  return (
    <div>
      <div className="relative h-[420px] w-full sm:h-[min(62vw,620px)] lg:h-[min(48vw,760px)]">
        {imgSrc && !imageFailed ? (
          <img
            src={imgSrc}
            alt={firstText(content.name)}
            className="h-full w-full object-cover object-top transition-opacity duration-300"
            onError={() => setImageIndex((current) => Math.min(current + 1, imageCandidates.length))}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#180A10] via-[#08090C] to-[#172235]">
            <Film className="h-20 w-20 text-primary-light/30" strokeWidth={1.25} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-app-bg via-app-bg/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-app-bg/80 via-transparent to-transparent" />

        <button
          type="button"
          onClick={() => router.back()}
          className="absolute top-4 left-4 lg:left-12 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="absolute bottom-8 left-4 lg:left-12 right-4 lg:right-[40%]">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-3 text-white drop-shadow-md">
            {firstText(content.name)}
          </h1>
          <div className="flex items-center gap-3 text-sm font-semibold flex-wrap mb-4 text-white/90">
            {isTvodContent ? (
              <span className="bg-amber-400 text-black text-xs font-black px-2.5 py-0.5 rounded shadow-[0_0_12px_rgba(245,158,11,0.4)] tracking-wider">
                {rented ? 'RENTED' : `RENT · ₹${content.rent_price ?? (content as any).price ?? 99}`}
              </span>
            ) : content.is_premium === 1 ? (
              <span className="bg-amber-500 text-black text-xs font-black px-2.5 py-0.5 rounded shadow-[0_0_12px_rgba(245,158,11,0.4)] tracking-wider">
                VIP
              </span>
            ) : null}
            {yearVal && <span className="font-extrabold text-white">{yearVal}</span>}
            {durationVal && (
              <>
                <span className="h-1 w-1 rounded-full bg-white/40" />
                <span className="text-white/90">{durationVal}</span>
              </>
            )}
            {maturityVal && (
              <span className="rounded border border-white/40 bg-white/10 px-2 py-0.5 text-xs font-black uppercase text-white shadow-sm">
                {maturityVal}
              </span>
            )}
            <span className="rounded border border-white/20 bg-black/40 px-2 py-0.5 text-[11px] font-bold tracking-wide text-white/90">
              4K UHD
            </span>
            <span className="rounded border border-white/20 bg-black/40 px-2 py-0.5 text-[11px] font-medium tracking-wide text-white/80">
              5.1
            </span>
            <span>{videoTypeLabel(content.video_type)}</span>
            {firstText(content.category_name) && (
              <span className="px-2 py-0.5 rounded border border-white/20 bg-white/5 text-xs font-medium text-white/90">
                {firstText(content.category_name)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {isTvodContent && !rented ? (
              <RentButton
                videoId={effectiveVid}
                videoType={effectiveVt}
                subVideoType={Number(content.sub_video_type ?? 0)}
                price={Number(content.rent_price ?? (content as any).price ?? 99)}
                rentDay={Number(content.rent_day ?? ((content as any).validity_hours ? Math.ceil(Number((content as any).validity_hours) / 24) : 2))}
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
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur px-6 py-3 rounded-lg text-sm font-semibold transition-colors"
              >
                <Film size={18} /> Watch trailer
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!user?.id) {
                  router.push(`/login?redirect=${encodeURIComponent(getContentUrl(content as any))}`);
                  return;
                }
                trackEvent(EVENTS.WATCHLIST_ADD, {
                  content_id: effectiveVid,
                  content_name: firstText(content.name),
                });
                trackFbEvent('AddToWishlist', { content_ids: [String(effectiveVid)], content_name: firstText(content.name) });
                bookmarkMut.mutate({
                  user_id: user.id,
                  video_type: effectiveVt,
                  sub_video_type: 0,
                  video_id: effectiveVid,
                  type_id: effectiveTid,
                  is_kids_profile: session?.isKidsProfile ? 1 : 0,
                  action: 'add',
                });
              }}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur px-5 py-3 rounded-lg text-sm font-semibold transition-colors"
            >
              <Plus size={16} /> Watchlist
            </button>
          </div>
          {playbackError && (
            <div className="mt-4 inline-flex rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
              {playbackError}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 lg:px-12 py-6">
        <p className="text-body-text text-sm leading-relaxed max-w-3xl">{firstText(content.description)}</p>

        <div className="flex gap-6 mt-6 pt-6 border-t border-ott-border">
          <button
            type="button"
            onClick={() => {
              if (!user?.id) {
                router.push('/login');
                return;
              }
              likeMut.mutate({
                user_id: user.id,
                video_type: effectiveVt,
                sub_video_type: 0,
                video_id: effectiveVid,
                type_id: effectiveTid,
              });
            }}
            className="flex flex-col items-center gap-1 text-desc-text hover:text-primary transition-colors"
          >
            <ThumbsUp size={20} className={(raw?.is_user_like ?? content.is_like) ? 'text-primary fill-primary' : ''} />
            <span className="text-xs">{content.total_like ?? 0} Likes</span>
          </button>
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
              }
            }}
            className="flex flex-col items-center gap-1 text-desc-text hover:text-white transition-colors"
          >
            <Share2 size={20} />
            <span className="text-xs">Share</span>
          </button>
        </div>

        {(content.cast?.length ?? 0) > 0 && (
          <section className="mt-8">
            <h3 className="text-lg font-bold mb-3">Cast</h3>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {content.cast?.map((c: CastMember) => (
                <Link key={c.id} href={`/cast/${c.id}`} className="flex-shrink-0 text-center group">
                  <img
                    src={resolveImageUrl(c.image)}
                    alt={firstText(c.name)}
                    className="w-16 h-16 rounded-full object-cover bg-shimmer group-hover:ring-2 ring-primary transition-all"
                  />
                  <p className="text-xs text-desc-text mt-1 w-16 truncate">{firstText(c.name)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {(content.season?.length ?? 0) > 0 && (
          <EpisodeList
            seasons={content.season ?? []}
            showId={effectiveVid}
            session={user?.id ? { userId: user.id, deviceId: 'web' } : undefined}
            user={user}
            onPlayEpisode={startEpisodePlayback}
          />
        )}

        <CommentSection videoType={effectiveVt} videoId={effectiveVid} userId={user?.id} />

        <GoogleAdBanner slot="detail-bottom" className="my-6" />

        <ContentRail title="You May Also Like" items={related} />
      </div>

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
