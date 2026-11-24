'use client';

import { useState } from 'react';
import { Clock } from 'lucide-react';
import clsx from 'clsx';
import { useEpisodes, resolveImageUrl, formatDuration } from '@ott/shared';
import type { Season, Episode, SessionContext, LoginUserResult } from '@ott/shared';
import PlayButtonGuard from '@/components/play/PlayButtonGuard';

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

interface Props {
  seasons: Season[];
  showId: number;
  session?: SessionContext;
  user: LoginUserResult | null;
  onPlayEpisode: (ep: Episode) => void | Promise<void>;
}

export default function EpisodeList({ seasons, showId, session, user, onPlayEpisode }: Props) {
  const [active, setActive] = useState(0);
  const seasonId = seasons[active]?.id ?? 0;
  const episodesQ = useEpisodes(seasonId, session, showId);
  const episodes = (episodesQ.data?.result ?? []) as Episode[];

  if (seasons.length === 0) return null;

  return (
    <section>
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h3 className="text-xl font-bold tracking-tight text-white">Episodes</h3>

        {seasons.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {seasons.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(i)}
                className={clsx(
                  'flex-shrink-0 whitespace-nowrap rounded-md px-4 py-1.5 text-xs font-bold transition-all duration-200',
                  i === active
                    ? 'bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] text-white shadow-[0_6px_18px_rgba(255,109,46,0.35)]'
                    : 'border border-white/10 bg-[#141414] text-white/70 hover:border-white/25 hover:text-white',
                )}
              >
                {s.name || `Season ${i + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        {episodesQ.isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex animate-pulse gap-4 rounded-xl bg-[#141414] p-3">
              <div className="aspect-video w-40 flex-shrink-0 rounded-lg bg-white/[0.06]" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-4 w-2/3 rounded bg-white/[0.06]" />
                <div className="h-3 w-1/4 rounded bg-white/[0.06]" />
                <div className="h-3 w-full rounded bg-white/[0.06]" />
              </div>
            </div>
          ))}

        {episodes.map((ep, idx) => (
          <div
            key={ep.id}
            className="group flex items-center gap-4 rounded-xl border border-white/[0.08] bg-[#141414] p-3 transition-colors duration-200 hover:bg-[#1A1A1A]"
          >
            <div className="hidden w-7 flex-shrink-0 items-center justify-center text-sm font-bold text-white/40 sm:flex">
              {idx + 1}
            </div>

            <div className="relative aspect-video w-36 flex-shrink-0 overflow-hidden rounded-lg bg-[#0A0A0A] sm:w-44">
              <img
                src={resolveImageUrl(ep.landscape || ep.image || ep.thumbnail)}
                alt={firstText(ep.name)}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {ep.is_premium === 1 && (
                <span className="absolute left-1.5 top-1.5 rounded bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">
                  VIP
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1 py-0.5">
              <div className="flex items-start justify-between gap-2">
                <h4 className="truncate text-sm font-semibold text-white">
                  {firstText(ep.name)}
                </h4>
                {ep.video_duration && (
                  <span className="mt-0.5 flex flex-shrink-0 items-center gap-1 text-[11px] font-medium text-white/45">
                    <Clock size={11} strokeWidth={2} />
                    {formatDuration(ep.video_duration)}
                  </span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/55">
                {firstText(ep.description)}
              </p>
            </div>

            <div className="flex flex-shrink-0 items-center">
              <PlayButtonGuard
                user={user}
                isPremium={ep.is_premium === 1}
                contentTitle={firstText(ep.name)}
                onPlay={() => onPlayEpisode(ep)}
                compact
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
