'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  SkipForward,
  Subtitles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { StreamTitle } from '@/lib/streaming/types';
import { getEffectiveProgress, useStreamingStore } from '@/lib/streaming/store';
import { cn } from '@/lib/utils';

const subs = ['Off', 'English CC', 'Hindi', 'Tamil'];
const audio = ['Original', 'Hindi dubbed', 'Tamil dubbed'];
const qualities = ['Auto', '1080p', '720p', '480p'];

export function StreamingVideoPlayer({ title }: { title: StreamTitle }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(() => getEffectiveProgress(title.id, title.progressPercent));
  const [volume, setVolume] = useState([80]);
  const [fullscreen, setFullscreen] = useState(false);
  const [showUi, setShowUi] = useState(true);
  const setProgressStore = useStreamingStore((s) => s.setProgress);

  useEffect(() => {
    const t = window.setTimeout(() => setShowUi(false), 3200);
    return () => clearTimeout(t);
  }, [playing, progress]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFs = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  };

  const bumpProgress = (delta: number) => {
    setProgress((p) => {
      const n = Math.min(100, Math.max(0, p + delta));
      setProgressStore(title.id, n);
      return n;
    });
  };

  return (
    <div
      ref={containerRef}
      className="relative flex aspect-video w-full max-h-[75vh] items-center justify-center overflow-hidden rounded-xl bg-black ring-1 ring-white/10"
      onMouseMove={() => setShowUi(true)}
      onClick={() => setPlaying(!playing)}
    >
      <Image src={title.backdropUrl} alt="" fill className="object-cover opacity-80" sizes="100vw" priority />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent pointer-events-none" />

      {/* Mock HLS layer — swap for HlsStitchedPlayer when manifest URLs exist */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {!playing && (
          <div className="rounded-full bg-white/10 p-5 backdrop-blur-md ring-1 ring-white/20">
            <Play className="h-10 w-10 text-white" fill="white" />
          </div>
        )}
      </div>

      <div
        className={cn(
          'absolute inset-0 flex flex-col justify-between p-3 sm:p-5 transition-opacity duration-300',
          showUi ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="font-display text-lg font-bold sm:text-2xl drop-shadow-lg">{title.title}</h1>
            <p className="text-xs text-desc-text sm:text-sm">{title.kind === 'series' ? 'Series' : 'Movie'} . backend catalog stream</p>
          </div>
          <Button variant="glass" size="sm" className="rounded-full" asChild>
            <Link href={`/stream/title/${title.id}`}>Back</Link>
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-desc-text w-8">{Math.round(progress)}%</span>
            <Slider
              value={[progress]}
              max={100}
              step={1}
              className="flex-1 cursor-pointer"
              onValueChange={(v) => {
                const n = v[0] ?? 0;
                setProgress(n);
                setProgressStore(title.id, n);
              }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="text-white" onClick={() => setPlaying(!playing)}>
                {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 fill-white" />}
              </Button>
              <Button variant="ghost" size="sm" className="text-xs gap-1 text-white" onClick={() => bumpProgress(-8)}>
                −
              </Button>
              <Button variant="ghost" size="sm" className="text-xs gap-1 text-white" onClick={() => bumpProgress(8)}>
                +
              </Button>
              {title.kind === 'series' && (
                <Button variant="secondary" size="sm" className="ml-1 rounded-full gap-1 text-xs">
                  <SkipForward className="h-3.5 w-3.5" />
                  Next ep
                </Button>
              )}
              <Button variant="ghost" size="sm" className="ml-1 rounded-full border border-white/10 text-[10px]">
                Skip intro
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="text-white" onClick={() => setMuted(!muted)}>
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
              <div className="hidden w-24 sm:block">
                <Slider
                  value={volume}
                  max={100}
                  step={1}
                  onValueChange={setVolume}
                  disabled={muted}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1 text-white text-xs">
                    <Subtitles className="h-4 w-4" />
                    CC
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {subs.map((s) => (
                    <DropdownMenuItem key={s}>{s}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-white text-xs">
                    Audio
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {audio.map((s) => (
                    <DropdownMenuItem key={s}>{s}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-white text-xs">
                    Quality
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {qualities.map((s) => (
                    <DropdownMenuItem key={s}>{s}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon" className="text-white" onClick={toggleFs}>
                {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
