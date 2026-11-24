'use client';

import { Download } from 'lucide-react';
import { posterFallback } from '@ott/shared';

interface AdPosterOverlayProps {
  thumbnail: string;
  title: string;
}

function safePosterFilename(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return `${base || 'ad-poster'}.jpg`;
}

async function downloadPoster(url: string, title: string): Promise<void> {
  const filename = safePosterFilename(title);

  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('Poster request failed');

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

export default function AdPosterOverlay({ thumbnail, title }: AdPosterOverlayProps) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0A0A0A]">
      <img
        src={thumbnail}
        alt={title}
        className="h-full w-full object-contain"
        onError={(event) => {
          event.currentTarget.src = posterFallback(title);
        }}
      />
      <div className="absolute bottom-6 left-6 flex items-center gap-2 rounded-full border border-white/15 bg-[#141414]/90 px-4 py-2 text-xs font-bold text-white backdrop-blur-md">
        <span className="rounded bg-[#FF6D2E] px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-white">
          Ad
        </span>
        <span>{title}</span>
      </div>
      <button
        type="button"
        className="pointer-events-auto absolute right-6 top-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#141414]/90 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md transition hover:border-[#FF6D2E] hover:bg-[#FF6D2E]"
        onClick={() => {
          void downloadPoster(thumbnail, title);
        }}
      >
        <Download size={14} strokeWidth={2.2} />
        Download poster
      </button>
    </div>
  );
}
