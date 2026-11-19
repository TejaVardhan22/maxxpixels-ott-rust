'use client';

import { forwardRef } from 'react';

interface GoogleImaOverlayProps {
  isActive: boolean;
  adTitle?: string;
  adTimeRemaining?: number;
  skippable?: boolean;
  onSkip?: () => void;
}

export const GoogleImaOverlay = forwardRef<HTMLDivElement, GoogleImaOverlayProps>(
  ({ isActive, adTitle, adTimeRemaining, skippable, onSkip }, ref) => {
    return (
      <div
        ref={ref}
        className={`absolute inset-0 z-30 transition-opacity duration-200 ${
          isActive ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{ overflow: 'hidden' }}
      >
        {/* IMA SDK renders its ad iframe directly inside this container */}

        {/* Custom helper overlay badge shown during ad playback */}
        {isActive && (
          <div className="pointer-events-none absolute top-4 left-4 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-3 py-1.5 text-xs text-white backdrop-blur">
            <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-extrabold text-white">
              Ad
            </span>
            <span className="font-semibold text-white/90">
              {adTitle || 'Advertisement'}
            </span>
            {adTimeRemaining !== undefined && adTimeRemaining > 0 && (
              <span className="text-white/60">
                ({Math.ceil(adTimeRemaining)}s)
              </span>
            )}
            {skippable && onSkip && (
              <button
                type="button"
                className="pointer-events-auto ml-2 rounded-full bg-white px-3 py-1 text-xs font-black text-black transition hover:bg-white/90"
                onClick={(e) => {
                  e.stopPropagation();
                  onSkip();
                }}
              >
                Skip Ad
              </button>
            )}
          </div>
        )}
      </div>
    );
  },
);

GoogleImaOverlay.displayName = 'GoogleImaOverlay';
