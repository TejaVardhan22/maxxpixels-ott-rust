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
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (match && match[1]) {
    return `https://www.youtube.com/embed/${match[1]}?autoplay=1`;
  }
  return url;
}

/**
 * Fetches trailer payload from GET /api/video/{id}/trailer (no subscription required).
 */
export default function TrailerPlayerModal({ open, onClose, videoId, videoType, subVideoType = 0 }: Props) {
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
  const yt = trailerUrl.includes('youtube.com') || trailerUrl.includes('youtu.be') || kind === 'youtube';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/80" aria-label="Close" onClick={onClose} />
      <div className="relative z-[91] w-full max-w-4xl rounded-2xl border border-ott-border bg-black overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-ott-border">
          <span className="text-sm font-semibold">Trailer</span>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        <div className="aspect-video bg-black flex items-center justify-center">
          {loading && <div className="text-desc-text text-sm">Loading…</div>}
          {err && <div className="text-red-400 text-sm px-4 text-center">{err}</div>}
          {!loading && !err && trailerUrl && yt && (
            <iframe
              title="Trailer"
              src={getYoutubeEmbedUrl(trailerUrl)}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
          {!loading && !err && trailerUrl && !yt && (kind === 'hls' || trailerUrl.includes('.m3u8')) && (
            <div className="w-full h-full">
              <VideoPlayer src={trailerUrl} poster={poster} autoPlay title="Trailer" />
            </div>
          )}
          {!loading && !err && trailerUrl && !yt && kind !== 'hls' && !trailerUrl.includes('.m3u8') && (
            <video src={trailerUrl} poster={poster} controls autoPlay playsInline className="w-full h-full" />
          )}
        </div>
      </div>
    </div>
  );
}
