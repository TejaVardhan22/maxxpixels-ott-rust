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
        className="absolute inset-0 bg-black/70"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-[81] w-full max-w-md rounded-2xl border border-ott-border bg-surface p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-2">Subscription required</h2>
        {title ? (
          <p className="text-sm text-desc-text mb-4">
            &ldquo;{title}&rdquo; is included with an active MaxxPixels subscription.
          </p>
        ) : (
          <p className="text-sm text-desc-text mb-4">Subscribe to unlock premium titles.</p>
        )}
        <Link
          href="/subscription"
          className="flex justify-center rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary-dark transition-colors"
          onClick={onClose}
        >
          View plans
        </Link>
        <button type="button" onClick={onClose} className="w-full mt-3 text-xs text-muted-text">
          Not now
        </button>
      </div>
    </div>
  );
}
