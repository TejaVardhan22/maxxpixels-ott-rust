'use client';

import Link from 'next/link';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
};

export default function SubscribeModal({ open, onClose, title }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-[81] w-full max-w-md rounded-2xl border border-white/10 bg-[#141414] p-7 shadow-2xl">
        <h2 className="mb-2 text-xl font-bold text-white">Subscription required</h2>
        {title ? (
          <p className="mb-5 text-sm text-zinc-400">
            &ldquo;{title}&rdquo; is included with an active VIP subscription.
          </p>
        ) : (
          <p className="mb-5 text-sm text-zinc-400">Subscribe to unlock premium titles.</p>
        )}
        <Link
          href="/subscription"
          className="flex justify-center rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] py-3 text-sm font-bold text-white shadow-[0_8px_24px_rgba(255,109,46,0.35)] transition hover:brightness-110"
          onClick={onClose}
        >
          View Plans
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full text-xs font-medium text-zinc-500 transition hover:text-white"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
