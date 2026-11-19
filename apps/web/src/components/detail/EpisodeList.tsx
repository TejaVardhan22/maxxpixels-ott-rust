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
    <section className="mt-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <h3 className="text-xl font-bold text-white">Episodes</h3>

        {seasons.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {seasons.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(i)}
                className={clsx(
                  'flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200',
                  i === active
                    ? 'bg-[#E50914] text-white shadow-[0_0_15px_rgba(229,9,20,0.4)]'
                    : 'bg-surface border border-ott-border text-desc-text hover:text-white hover:border-white/20',
                )}
              >
                {s.name || `Season ${i + 1}`}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {episodesQ.isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 bg-surface rounded-xl p-3 animate-pulse">
              <div className="w-40 aspect-video bg-shimmer rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-4 bg-shimmer rounded w-2/3" />
                <div className="h-3 bg-shimmer rounded w-1/4" />
                <div className="h-3 bg-shimmer rounded w-full" />
              </div>
            </div>
          ))}

        {episodes.map((ep, idx) => (
          <div
            key={ep.id}
            className="group flex gap-4 bg-surface hover:bg-surface-hover rounded-xl p-3 transition-all duration-200 hover:ring-1 hover:ring-white/10"
          >
            <div className="hidden sm:flex w-8 items-center justify-center text-muted-text text-sm font-medium flex-shrink-0">
              {idx + 1}
            </div>

            <div className="relative flex-shrink-0 w-36 sm:w-44 aspect-video rounded-lg overflow-hidden bg-shimmer">
              <img
                src={resolveImageUrl(ep.landscape || ep.image || ep.thumbnail)}
                alt={firstText(ep.name)}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              {ep.is_premium === 1 && (
                <span className="absolute top-1.5 left-1.5 text-[8px] font-black bg-gold text-black px-1.5 py-0.5 rounded uppercase tracking-wide">
                  Premium
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0 py-0.5">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-sm text-white truncate group-hover:text-primary transition-colors">
                  {firstText(ep.name)}
                </h4>
                {ep.video_duration && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-text flex-shrink-0 mt-0.5">
                    <Clock size={10} strokeWidth={2} />
                    {formatDuration(ep.video_duration)}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-text mt-1 line-clamp-2 leading-relaxed">{firstText(ep.description)}</p>
            </div>

            <div className="flex items-center flex-shrink-0">
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
