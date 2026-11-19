'use client';

import { useState } from 'react';
import { Play, Loader2 } from 'lucide-react';
import type { LoginUserResult } from '@ott/shared';
import { checkPlaybackGate, type PlaybackGateResult } from '@ott/shared';
import AuthModal from '@/components/auth/AuthModal';
import SubscribeModal from '@/components/auth/SubscribeModal';

type Props = {
  user: LoginUserResult | null;
  isPremium: boolean;
  contentTitle?: string;
  /** Called only after auth + subscription rules pass — may be async (secure playback fetch). */
  onPlay: () => void | Promise<void>;
  className?: string;
  /** Round icon-only button for episode rows */
  compact?: boolean;
};

export default function PlayButtonGuard({
  user,
  isPremium,
  contentTitle,
  onPlay,
  className,
  compact = false,
}: Props) {
  const [authOpen, setAuthOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const gate: PlaybackGateResult = checkPlaybackGate(user, isPremium);
    if (gate === 'needs_auth') {
      setAuthOpen(true);
      return;
    }
    if (gate === 'needs_sub') {
      setSubOpen(true);
      return;
    }
    setLoading(true);
    try {
      await Promise.resolve(onPlay());
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className={
          className ??
          (compact
            ? 'inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white disabled:opacity-60'
            : 'inline-flex items-center gap-2 bg-[#E50914] hover:bg-[#B80710] text-white font-black px-8 py-3 rounded-xl shadow-[0_0_20px_rgba(229,9,20,0.45)] transition-all hover:scale-105 disabled:opacity-60')
        }
      >
        {loading ? (
          <Loader2 size={compact ? 16 : 18} className="animate-spin text-white" />
        ) : (
          <Play size={compact ? 16 : 18} fill={compact ? 'currentColor' : 'currentColor'} className={compact ? 'text-white ml-0.5' : ''} />
        )}
        {!compact && (loading ? 'Starting…' : 'Play')}
      </button>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} title={contentTitle} />
      <SubscribeModal
        open={subOpen}
        onClose={() => setSubOpen(false)}
        title={contentTitle}
      />
    </>
  );
}
