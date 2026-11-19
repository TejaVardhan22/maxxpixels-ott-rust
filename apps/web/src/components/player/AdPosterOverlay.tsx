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
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black">
      <img
        src={thumbnail}
        alt={title}
        className="h-full w-full object-contain"
        onError={(event) => {
          event.currentTarget.src = posterFallback(title);
        }}
      />
      <div className="absolute bottom-5 left-5 rounded bg-black/70 px-3 py-2 text-sm font-bold text-white">
        <span className="mr-2 rounded bg-yellow-400 px-1.5 py-0.5 text-xs font-black text-black">AD</span>
        {title}
      </div>
      <button
        type="button"
        className="pointer-events-auto absolute right-5 top-5 inline-flex items-center gap-2 rounded bg-black/75 px-3 py-2 text-xs font-bold text-white ring-1 ring-white/25 transition hover:bg-black/90 hover:ring-yellow-400/70"
        onClick={() => {
          void downloadPoster(thumbnail, title);
        }}
      >
        <Download size={14} strokeWidth={2.4} />
        Download poster
      </button>
    </div>
  );
}
