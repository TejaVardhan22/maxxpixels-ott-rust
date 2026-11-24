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
            ? 'inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#FF6D2E]/40 bg-[#FF6D2E]/20 text-white transition hover:bg-[#FF6D2E] disabled:opacity-60'
            : 'inline-flex h-11 items-center gap-2.5 rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-7 text-sm font-bold text-white shadow-[0_8px_28px_rgba(255,109,46,0.4)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60 sm:h-12')
        }
      >
        {loading ? (
          <Loader2 size={compact ? 16 : 18} className="animate-spin text-white" />
        ) : (
          <Play
            size={compact ? 16 : 18}
            fill="currentColor"
            className={compact ? 'ml-0.5 text-white' : ''}
          />
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
