'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import VideoPlayer from '@/components/player/VideoPlayer';
import { normalizeTrailerType, videoAccessApi } from '@ott/shared';

type Props = {
  open: boolean;
  onClose: () => void;
  videoId: number;
  videoType: number;
  subVideoType?: number;
};

function getYoutubeEmbedUrl(url: string): string {
  if (url.includes('/embed/')) return url;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/,
  );
  if (match && match[1]) {
    return `https://www.youtube.com/embed/${match[1]}?autoplay=1`;
  }
  return url;
}

/**
 * Fetches trailer payload from GET /api/video/{id}/trailer (no subscription required).
 */
export default function TrailerPlayerModal({
  open,
  onClose,
  videoId,
  videoType,
  subVideoType = 0,
}: Props) {
  const [trailerUrl, setTrailerUrl] = useState('');
  const [trailerType, setTrailerType] = useState('');
  const [poster, setPoster] = useState<string | undefined>();
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    setLoading(true);
    setErr('');
    videoAccessApi
      .getTrailerPayload(videoId, videoType, subVideoType)
      .then((r) => {
        if (cancel) return;
        const payload: any = (r as any)?.result ?? (r as any)?.data ?? r ?? {};
        const url = payload.trailer_url || payload.trailerUrl || '';
        const type = payload.trailer_type || payload.trailerType || '';
        const thumb = payload.trailer_thumbnail || payload.trailerThumbnail || payload.thumbnail;

        setTrailerUrl(url);
        setTrailerType(type);
        setPoster(thumb || undefined);
        if (!url) {
          setErr('Trailer unavailable for this title.');
        }
      })
      .catch(() => {
        if (!cancel) setErr('Trailer unavailable.');
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [open, videoId, videoType, subVideoType]);

  if (!open) return null;

  const kind = normalizeTrailerType(trailerType);
  const yt =
    trailerUrl.includes('youtube.com') || trailerUrl.includes('youtu.be') || kind === 'youtube';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-[91] w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#141414] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <span className="text-sm font-bold text-white">Official Trailer</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex aspect-video items-center justify-center bg-[#0A0A0A]">
          {loading && <div className="text-sm text-zinc-400">Loading trailer…</div>}
          {err && <div className="px-4 text-center text-sm text-[#FFB088]">{err}</div>}
          {!loading && !err && trailerUrl && yt && (
            <iframe
              title="Trailer"
              src={getYoutubeEmbedUrl(trailerUrl)}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
          {!loading &&
            !err &&
            trailerUrl &&
            !yt &&
            (kind === 'hls' || trailerUrl.includes('.m3u8')) && (
              <div className="h-full w-full">
                <VideoPlayer src={trailerUrl} poster={poster} autoPlay title="Trailer" />
              </div>
            )}
          {!loading &&
            !err &&
            trailerUrl &&
            !yt &&
            kind !== 'hls' &&
            !trailerUrl.includes('.m3u8') && (
              <video
                src={trailerUrl}
                poster={poster}
                controls
                autoPlay
                playsInline
                className="h-full w-full"
              />
            )}
        </div>
      </div>
    </div>
  );
}
