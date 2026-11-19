'use client';

import { useCallback, useRef } from 'react';
import { useAddContinueWatching } from '@ott/shared';
import { SubscriptionGate } from '@/components/streaming/subscription-gate';
import HlsStitchedPlayer from '@/components/player/HlsStitchedPlayer';
import type { StreamTitle } from '@/lib/streaming/types';
import { useStoredUser } from '@/lib/auth';
import { useStreamingStore } from '@/lib/streaming/store';

export function WatchExperience({ title }: { title: StreamTitle }) {
  const { user, session } = useStoredUser();
  const continueMut = useAddContinueWatching();
  const setProgress = useStreamingStore((s) => s.setProgress);
  const lastSyncAt = useRef(0);

  const syncContinueWatching = useCallback((currentTime: number, duration: number) => {
    if (!user?.id || !title.videoId) return;
    if (!Number.isFinite(currentTime) || currentTime < 5) return;

    const now = Date.now();
    if (now - lastSyncAt.current < 15_000) return;
    lastSyncAt.current = now;

    if (duration > 0) {
      setProgress(title.id, Math.min(99, Math.round((currentTime / duration) * 100)));
    }

    continueMut.mutate({
      user_id: user.id,
      is_kids_profile: session?.isKidsProfile ? 1 : 0,
      video_type: title.videoType ?? 1,
      sub_video_type: 0,
      video_id: title.videoId,
      episode_id: 0,
      stop_time: Math.floor(currentTime),
    });
  }, [continueMut, session?.isKidsProfile, setProgress, title.id, title.videoId, title.videoType, user?.id]);

  return (
    <SubscriptionGate requires={title.requiresPlan}>
      {title.videoId ? (
        <HlsStitchedPlayer
          videoId={title.videoId}
          videoType={title.videoType ?? 1}
          poster={title.backdropUrl}
          title={title.title}
          onPlaybackProgress={syncContinueWatching}
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-black text-white">
          <p className="text-sm opacity-80">No stream available for this title.</p>
        </div>
      )}
    </SubscriptionGate>
  );
}
