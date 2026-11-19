'use client';

import Link from 'next/link';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
};

/** Lightweight sign-in prompt — preserves existing auth routes. */
export default function AuthModal({ open, onClose, title }: Props) {
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
        <h2 className="text-xl font-bold text-white mb-2">Sign in to watch</h2>
        {title ? (
          <p className="text-sm text-desc-text mb-4">&ldquo;{title}&rdquo;</p>
        ) : (
          <p className="text-sm text-desc-text mb-4">Create a free account or sign in to continue.</p>
        )}
        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="flex justify-center rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary-dark transition-colors"
            onClick={onClose}
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="flex justify-center rounded-xl border border-ott-border py-3 text-sm font-semibold text-white hover:bg-white/5 transition-colors"
            onClick={onClose}
          >
            Create account
          </Link>
          <button type="button" onClick={onClose} className="text-xs text-muted-text mt-2">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
