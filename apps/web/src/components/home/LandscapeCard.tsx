'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Clapperboard, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type MouseEvent } from 'react';
import { resolveImageCandidates, progressPercent, getContentImageCandidates, resolveSecurePlayback, getContentUrl, getWatchUrl } from '@ott/shared';
import type { ContentItem } from '@ott/shared';
import { setPendingPlayback } from '@/lib/playbackSession';

interface Props {
  item: ContentItem;
  variant?: 'default' | 'resume';
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

export default function LandscapeCard({ item, variant = 'default' }: Props) {
  const router = useRouter();
  const rawItem = (item ?? {}) as Record<string, any>;
  const contentId = extractNumericId(
    item.video_id,
    item.id,
    rawItem.content_id,
    rawItem.resource_id,
    rawItem.videoId,
    rawItem.content?.id,
    rawItem.content?.video_id,
  );
  const href = getContentUrl(item as any);
  const imageCandidates = resolveImageCandidates(getContentImageCandidates(item, 'landscape'));
  const imageCandidateKey = imageCandidates.join('|');
  const [imageIndex, setImageIndex] = useState(0);
  const safeImageIndex = Math.min(imageIndex, imageCandidates.length);
  const imgSrc = imageCandidates[safeImageIndex] || '';
  const imageFailed = !imgSrc;
  const progress = progressPercent(item.stop_time, item.video_duration);
  const resumeAt = asPositiveSeconds(item.stop_time);
  const isResume = variant === 'resume' || progress > 0;

  useEffect(() => {
    setImageIndex(0);
  }, [contentId, imageCandidateKey]);

  const startResumePlayback = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (!contentId || resumeAt <= 0) return;

    event.preventDefault();

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
        resumeAt,
        title: String(item.name ?? ''),
        poster: imgSrc,
        sessionToken: pb.sessionToken,
        showAds: pb.showAds,
        vastTagUrl: pb.vastTagUrl,
      });
      const watchUrl = getWatchUrl(item as any, undefined, resumeAt);
      router.push(watchUrl);
    } catch {
      router.push(getWatchUrl(item as any, undefined, resumeAt));
    }
  };

  return (
    <Link
      href={href}
      onClick={startResumePlayback}
      className="group block w-[250px] flex-shrink-0 focus-visible:outline-none sm:w-[290px] lg:w-[330px]"
    >
      <div className="relative aspect-video overflow-hidden rounded-xl bg-surface ring-1 ring-white/10 transition duration-300 group-hover:-translate-y-1 group-hover:ring-white/25 group-focus-visible:ring-2 group-focus-visible:ring-primary">
        {imgSrc && !imageFailed ? (
          <>
            <Image
              src={imgSrc}
              alt=""
              fill
              sizes="(max-width: 640px) 250px, (max-width: 1024px) 290px, 330px"
              className="scale-110 object-cover opacity-45 blur-xl"
              loading="lazy"
              unoptimized
              aria-hidden
            />
            <Image
              src={imgSrc}
              alt={item.name ?? ''}
              fill
              sizes="(max-width: 640px) 250px, (max-width: 1024px) 290px, 330px"
              className="object-cover transition duration-500 group-hover:scale-105"
              loading="lazy"
              unoptimized
              onError={() => setImageIndex((current) => Math.min(current + 1, imageCandidates.length))}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#172235] px-5 text-center">
            <Clapperboard className="mb-2 h-7 w-7 text-white/28" strokeWidth={1.5} />
            <span className="line-clamp-1 text-xs font-bold text-white/55">{item.name ?? 'Artwork unavailable'}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-black/10 transition group-hover:bg-black/25" />

        {isResume ? (
          <span className="absolute bottom-4 left-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-black text-black shadow-lg">
            <Play size={13} fill="currentColor" /> Resume
          </span>
        ) : (
          <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-black shadow-xl">
              <Play size={16} fill="currentColor" className="ml-0.5" />
            </span>
          </span>
        )}

        {/* Continue-watching progress bar */}
        {progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/15">
            <div
              className="h-full rounded-r-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Duration label */}
        {item.video_duration && progress === 0 && (
          <span className="absolute right-2.5 top-2.5 rounded bg-black/70 px-2 py-1 text-[10px] font-semibold text-white/75">
            {typeof item.video_duration === 'number'
              ? `${Math.floor(item.video_duration / 60)}m`
              : item.video_duration}
          </span>
        )}
      </div>

      <div className="mt-3 px-0.5">
        <p className="truncate text-sm font-bold text-white/88 transition group-hover:text-white">{item.name}</p>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-white/38">
          <span>{item.video_type === 2 ? 'Series' : 'Movie'}</span>
          {progress > 0 && (
            <>
              <span className="h-1 w-1 rounded-full bg-white/25" />
              <span>{Math.round(progress)}% watched</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
