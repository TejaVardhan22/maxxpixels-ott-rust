'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Clapperboard, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type MouseEvent } from 'react';
import {
  resolveImageCandidates,
  progressPercent,
  getContentImageCandidates,
  resolveSecurePlayback,
  getContentUrl,
  getWatchUrl,
} from '@ott/shared';
import type { ContentItem } from '@ott/shared';
import { setPendingPlayback } from '@/lib/playbackSession';
import { useStoredUser } from '@/lib/auth';

interface Props {
  item: ContentItem;
  variant?: 'default' | 'resume';
  fluid?: boolean;
}

function asPositiveSeconds(value: unknown): number {
  const n = Math.floor(Number(value ?? 0));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function firstCategoryId(item: ContentItem): string {
  const raw = (item as Record<string, unknown>).category_id;
  if (typeof raw === 'string') {
    return raw.split(',').map((x) => x.trim()).find(Boolean) || String(item.type_id ?? 1);
  }
  if (typeof raw === 'number') return String(raw);
  return String(item.type_id ?? 1);
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

export default function LandscapeCard({ item, variant = 'default', fluid = false }: Props) {
  const router = useRouter();
  const { user } = useStoredUser();
  const rawItem = (item ?? {}) as Record<string, any>;
  const contentId = extractNumericId(
    rawItem.contentId,
    rawItem.content_id,
    item.video_id,
    rawItem.videoId,
    rawItem.content?.id,
    rawItem.content?.video_id,
    item.id,
    rawItem.resource_id,
  );
  const normalizedItem = { ...item, id: contentId || item.id, video_id: contentId || item.video_id };
  const href = getContentUrl(normalizedItem as any);
  const imageCandidates = resolveImageCandidates(getContentImageCandidates(item, 'landscape'));
  const imageCandidateKey = imageCandidates.join('|');
  const [imageIndex, setImageIndex] = useState(0);
  const safeImageIndex = Math.min(imageIndex, imageCandidates.length);
  const imgSrc = imageCandidates[safeImageIndex] || '';
  const imageFailed = !imgSrc;
  const resumeAt = asPositiveSeconds(
    item.stop_time ??
      rawItem.positionSeconds ??
      rawItem.position_seconds ??
      rawItem.watchedSeconds ??
      rawItem.watched_seconds,
  );
  const durationSec = asPositiveSeconds(
    item.video_duration ??
      rawItem.durationSeconds ??
      rawItem.duration_seconds ??
      rawItem.totalDurationSeconds,
  );
  const rawPct = Number(rawItem.percentage ?? 0);
  const progress =
    Number.isFinite(rawPct) && rawPct > 0
      ? Math.min(100, rawPct)
      : progressPercent(resumeAt, durationSec);
  const isResume = variant === 'resume' || progress > 0 || resumeAt > 0;

  useEffect(() => {
    setImageIndex(0);
  }, [contentId, imageCandidateKey]);

  const startResumePlayback = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (!contentId || !isResume) return;

    event.preventDefault();

    if (!user?.id || !user?.auth_token) {
      router.push(`/login?redirect=${encodeURIComponent(getWatchUrl(normalizedItem as any, undefined, resumeAt > 0 ? resumeAt : undefined))}`);
      return;
    }

    if (Number(user.is_buy ?? 0) !== 1 && Number(item.rent_buy ?? 0) !== 1) {
      router.push('/subscription');
      return;
    }

    try {
      const pb = await resolveSecurePlayback({
        videoId: contentId,
        videoType: Number(item.video_type ?? 1),
      });

      setPendingPlayback({
        kind: pb.kind,
        url: pb.streamUrl,
        fallbackUrl: pb.fallbackUrl,
        subtitles: pb.subtitles,
        videoId: contentId,
        videoType: Number(item.video_type ?? 1),
        typeId: Number(item.type_id ?? 1),
        categoryId: firstCategoryId(item),
        resumeAt: resumeAt > 0 ? resumeAt : undefined,
        title: String(item.name || rawItem.title || ''),
        poster: imgSrc,
        sessionToken: pb.sessionToken,
        showAds: pb.showAds,
        vastTagUrl: pb.vastTagUrl,
      });
      router.push(getWatchUrl(normalizedItem as any, undefined, resumeAt > 0 ? resumeAt : undefined));
    } catch {
      router.push(getWatchUrl(normalizedItem as any, undefined, resumeAt > 0 ? resumeAt : undefined));
    }
  };

  return (
    <Link
      href={href}
      onClick={startResumePlayback}
      className={`block focus-visible:outline-none ${
        fluid ? 'w-full' : 'w-[240px] flex-shrink-0 sm:w-[276px] lg:w-[310px]'
      }`}
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-[#141414]">
        {imgSrc && !imageFailed ? (
          <Image
            src={imgSrc}
            alt={item.name ?? ''}
            fill
            sizes="(max-width: 640px) 240px, (max-width: 1024px) 276px, 310px"
            className="object-cover"
            loading="lazy"
            unoptimized
            onError={() =>
              setImageIndex((current) => Math.min(current + 1, imageCandidates.length))
            }
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#141414] px-5 text-center">
            <Clapperboard className="h-7 w-7 text-white/25" strokeWidth={1.5} />
          </div>
        )}

        {isResume && (
          <span className="absolute bottom-3 left-2.5 inline-flex items-center gap-1.5 rounded bg-black/75 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur-sm">
            <Play size={11} fill="currentColor" /> Resume
          </span>
        )}

        {progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/25">
            <div
              className="h-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500]"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </Link>
  );
}
