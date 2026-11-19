'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Film, Play, Plus } from 'lucide-react';
import { resolveImageUrl, getContentImagePath, useToggleBookmark, getContentUrl } from '@ott/shared';
import type { ContentItem } from '@ott/shared';
import { useStoredUser } from '@/lib/auth';

interface Props {
  item: ContentItem;
  bookmarkAction?: 'add' | 'remove' | 'toggle';
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

export default function ContentCard({ item, bookmarkAction = 'add' }: Props) {
  const router = useRouter();
  const { user, session } = useStoredUser();
  const bookmarkMut = useToggleBookmark();
  const [isBookmarked, setIsBookmarked] = useState(Number(item.is_bookmark ?? 0) === 1);
  const [imageFailed, setImageFailed] = useState(false);
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
  const imgSrc = resolveImageUrl(getContentImagePath(item, 'portrait'));

  useEffect(() => {
    setIsBookmarked(Number(item.is_bookmark ?? 0) === 1);
    setImageFailed(false);
  }, [item.is_bookmark, contentId]);

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

    const nextState = bookmarkAction === 'remove' ? false : !isBookmarked || bookmarkAction === 'add';
    setIsBookmarked(nextState);
    bookmarkMut.mutate(
      {
        user_id: user.id,
        video_type: item.video_type ?? 1,
        sub_video_type: item.sub_video_type ?? 0,
        video_id: contentId,
        type_id: item.type_id ?? 1,
        is_kids_profile: session?.isKidsProfile ? 1 : 0,
        action: bookmarkAction,
      },
      { onError: () => setIsBookmarked(isBookmarked) },
    );
  };

  const year = String(item.release_year ?? '').trim();
  const category = String(item.category_name ?? '').split(',')[0]?.trim();

  return (
    <article className="group relative w-[140px] flex-shrink-0 sm:w-[164px] lg:w-[176px] xl:w-[192px]">
      <Link
        href={href}
        aria-label={`View ${item.name ?? 'title'}`}
        className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="content-card relative aspect-[2/3] overflow-hidden rounded-2xl bg-[#12151E] shadow-2xl ring-1 ring-white/10 transition-all duration-300 group-hover:-translate-y-1.5 group-hover:ring-primary/60 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.8),0_0_20px_rgba(229,9,20,0.3)]">
          {imgSrc && !imageFailed ? (
            <>
              <Image
                src={imgSrc}
                alt=""
                fill
                sizes="(max-width: 640px) 140px, (max-width: 1024px) 164px, 192px"
                className="scale-110 object-cover opacity-40 blur-xl"
                loading="lazy"
                unoptimized
                aria-hidden
              />
              <Image
                src={imgSrc}
                alt={item.name ?? ''}
                fill
                sizes="(max-width: 640px) 140px, (max-width: 1024px) 164px, 192px"
                className="object-cover transition duration-500 group-hover:scale-105"
                loading="lazy"
                unoptimized
                onError={() => setImageFailed(true)}
              />
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#172235] px-4 text-center">
              <Film className="mb-3 h-7 w-7 text-white/30" strokeWidth={1.5} />
              <span className="line-clamp-2 text-xs font-bold leading-5 text-white/60">{item.name ?? 'Artwork unavailable'}</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#08090C] via-[#08090C]/20 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-95" />

          <div className="absolute inset-0 grid place-items-center opacity-0 transition-all duration-300 group-hover:opacity-100">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#E50914] text-white shadow-[0_0_20px_rgba(229,9,20,0.7)] transition-transform duration-300 group-hover:scale-110">
              <Play size={20} fill="currentColor" className="ml-0.5" />
            </span>
          </div>

          {Boolean(
            item.is_rent === 1 ||
            String(rawItem?.monetization || '').toUpperCase() === 'TVOD' ||
            (item.rent_buy !== undefined && item.rent_buy === 0 && Number(item.rent_price || item.price || 0) > 0)
          ) ? (
            <span className="absolute left-2.5 top-2.5 rounded-lg border border-amber-400/60 bg-[#08090C]/95 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-400 backdrop-blur-md shadow-[0_0_12px_rgba(251,191,36,0.35)]">
              RENT · ₹{item.rent_price ?? item.price ?? rawItem?.rentPrice ?? 99}
            </span>
          ) : item.is_premium === 1 ? (
            <span className="absolute left-2.5 top-2.5 rounded-lg border border-primary/40 bg-[#08090C]/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-primary-light backdrop-blur-md shadow-md">
              4K VIP
            </span>
          ) : null}

          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between text-[11px] font-bold text-white/80">
            <span className="truncate">{category || (item.video_type === 2 ? 'Series' : 'Movie')}</span>
            {year && <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] text-white/90 backdrop-blur-sm">{year}</span>}
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={toggleBookmark}
        disabled={bookmarkMut.isPending}
        className="absolute right-2.5 top-2.5 z-10 grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-black/70 text-white opacity-0 backdrop-blur-md transition-all hover:scale-110 hover:bg-[#E50914] hover:border-[#E50914] focus:opacity-100 group-hover:opacity-100 disabled:opacity-50"
        title={isBookmarked ? 'Remove from My List' : 'Add to My List'}
        aria-label={isBookmarked ? `Remove ${item.name ?? 'title'} from My List` : `Add ${item.name ?? 'title'} to My List`}
      >
        {isBookmarked ? <Check size={15} /> : <Plus size={16} />}
      </button>

      <Link href={href} className="mt-2.5 block px-0.5 focus-visible:outline-none focus-visible:text-primary-light">
        <h3 className="truncate text-sm font-extrabold text-white/90 transition duration-200 group-hover:text-primary-light">
          {item.name}
        </h3>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-white/45">
          <span>{item.video_type === 2 ? 'Web Series' : 'Movie'}</span>
          <span>•</span>
          <span className="text-emerald-400 font-bold">98% Match</span>
        </p>
      </Link>
    </article>
  );
}
