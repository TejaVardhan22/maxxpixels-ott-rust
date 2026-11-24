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
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-[81] w-full max-w-md rounded-2xl border border-white/10 bg-[#141414] p-7 shadow-2xl">
        <h2 className="mb-2 text-xl font-bold text-white">Sign in to watch</h2>
        {title ? (
          <p className="mb-5 text-sm text-zinc-400">&ldquo;{title}&rdquo;</p>
        ) : (
          <p className="mb-5 text-sm text-zinc-400">
            Create a free account or sign in to continue.
          </p>
        )}
        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="flex justify-center rounded-md bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] py-3 text-sm font-bold text-white shadow-[0_8px_24px_rgba(255,109,46,0.35)] transition hover:brightness-110"
            onClick={onClose}
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="flex justify-center rounded-md border border-white/15 bg-white/5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            onClick={onClose}
          >
            Create Account
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 text-xs font-medium text-zinc-500 transition hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
