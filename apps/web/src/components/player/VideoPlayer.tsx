'use client';

import { useEffect, useRef, useState, useCallback, KeyboardEvent } from 'react';
import Hls from 'hls.js';

import { SecurityWatermark } from '../security/SecurityWatermark';

export interface SubtitleTrack {
  label: string;
  src: string;
  srclang?: string;
}

interface Props {
  src: string;
  poster?: string;
  title?: string;
  subtitles?: SubtitleTrack[];
  autoPlay?: boolean;
  onEnded?: () => void;
  /** Fires with media currentTime and duration (content or ad) */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Seek to this position when resumeRequest increments (e.g. returning from mid-roll with same src) */
  resumeAt?: number;
  /** Bump to re-apply resumeAt seek even if source URL unchanged */
  resumeRequest?: number;
  /** Hide chrome and block seek-like input — used during linear ad playback */
  isAdMode?: boolean;
  /** Force hls.js even when the src URL doesn't contain .m3u8 (e.g. blob: URLs) */
  forceHls?: boolean;
  /** Custom XHR setup passed to hls.js — use to add auth headers for variant/segment requests */
  hlsXhrSetup?: (xhr: XMLHttpRequest, url: string) => void;
  /** Mid-roll ad cue point times in seconds — markers shown on the progress bar */
  adMarkers?: number[];
  /** Whether an ad at a marker has been fired (for marker color: pending vs done) */
  firedAdMarkers?: number[];
  /** Optional external ref to the underlying HTMLVideoElement */
  videoRef?: React.Ref<HTMLVideoElement>;
}

interface QualityLevel {
  index: number;
  label: string;
  height: number;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function normalizeMediaSrc(rawSrc: string): string {
  const value = rawSrc.trim();
  if (!value) return '';
  if (value.startsWith('/')) return value;
  if (/^(https?|blob:|data:)/i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  const embeddedCdnUrl = value.match(/(?:^|\/)([a-z0-9.-]+\.b-cdn\.net\/.+)$/i)?.[1];
  if (embeddedCdnUrl) {
    const withProtocol = `https://${embeddedCdnUrl}`;
    if (withProtocol.startsWith('https://') && value.includes('https://')) {
      return value;
    }
    return withProtocol;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(value)) return `https://${value}`;
  return value;
}

function formatTime(s: number) {
  if (!isFinite(s)) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

export default function VideoPlayer({
  src,
  poster,
  title,
  subtitles = [],
  autoPlay = false,
  onEnded,
  onTimeUpdate: onTimeUpdateProp,
  resumeAt = 0,
  resumeRequest = 0,
  isAdMode = false,
  forceHls = false,
  hlsXhrSetup,
  adMarkers = [],
  firedAdMarkers = [],
  videoRef: externalVideoRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = (externalVideoRef || internalVideoRef) as React.RefObject<HTMLVideoElement>;
  const hlsRef       = useRef<Hls | null>(null);
  const hideTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef  = useRef<HTMLDivElement>(null);

  const [playing, setPlaying]         = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const [buffered, setBuffered]       = useState(0);
  const [volume, setVolume]           = useState(1);
  const [muted, setMuted]             = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [buffering, setBuffering]     = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [fullscreen, setFullscreen]   = useState(false);
  const [pip, setPip]                 = useState(false);
  const [speed, setSpeed]             = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [qualities, setQualities]     = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [activeSubtitle, setActiveSubtitle] = useState<number>(-1); // -1 = Off
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [ended, setEnded] = useState(false);
  const [online, setOnline] = useState(true);
  const [showResumeNotice, setShowResumeNotice] = useState(resumeAt > 10);
  const [seekTooltip, setSeekTooltip]  = useState<{ x: number; time: string } | null>(null);
  const [seekFeedback, setSeekFeedback] = useState<{ dir: 'left' | 'right'; show: boolean }>({ dir: 'right', show: false });
  const mediaSrc = normalizeMediaSrc(src);

  const playSafely = useCallback((video: HTMLVideoElement) => {
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((err: unknown) => {
        if (isAdMode) {
          console.warn('[VideoPlayer] Ad playback failed, skipping ad...');
          onEnded?.();
          return;
        }
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          console.warn('[VideoPlayer] Autoplay was blocked by browser policy, showing play control');
          setPlaying(false);
          return;
        }
        const isUnsupported = err instanceof DOMException && err.name === 'NotSupportedError';
        setError(
          isUnsupported
            ? 'This title does not have a valid playable source configured.'
            : 'Video failed to start.',
        );
      });
    }
  }, [isAdMode, onEnded]);

  // ── HLS setup ────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mediaSrc) return;
    setError(null);

    const isHls = forceHls || mediaSrc.includes('.m3u8') || mediaSrc.includes('manifest');

    if (Hls.isSupported() && isHls) {
      const hlsConfig: Record<string, unknown> = {
        enableWorker: true,
        lowLatencyMode: false,
        debug: false,
      };

      if (hlsXhrSetup) {
        hlsConfig.xhrSetup = hlsXhrSetup;
      }

      const hls = new Hls(hlsConfig);
      hlsRef.current = hls;

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            const url = data.url ?? data.context?.url ?? '';
            const status = (data.response as { code?: number } | undefined)?.code;
            console.error('[HLS] fatal error', {
              type: data.type,
              details: data.details,
              url,
              status,
            });

            if (status === 403) {
              setError('Access denied. CDN may require authentication.');
            } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR && status) {
              setError(`Stream request failed (${status}). Please try again.`);
            } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR && url.includes('b-cdn.net')) {
              setError('CDN stream unavailable. The player will need the backend proxy or CDN CORS enabled.');
            } else {
              setError('Stream failed to load. Please try again.');
            }
          }
        }
      });

      hls.loadSource(mediaSrc);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels: QualityLevel[] = hls.levels.map((l, i) => ({
          index: i,
          label: `${l.height}p`,
          height: l.height,
        }));
        setQualities(levels);
        if (autoPlay) playSafely(video);
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl') || !isHls) {
      // Safari native HLS or direct MP4
      video.src = mediaSrc;
      video.load();
      if (autoPlay) playSafely(video);
    } else {
      setError('Your browser does not support HLS streaming.');
    }
  }, [mediaSrc, autoPlay, forceHls, hlsXhrSetup, playSafely]);

  // ── Apply resume seek (mid-roll return; often same src as before) ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isAdMode) return;
    if (!resumeAt || resumeAt <= 0) return;

    const seekTo = () => {
      try {
        video.currentTime = resumeAt;
      } catch {
        /* ignore */
      }
    };

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) seekTo();
    else video.addEventListener('loadedmetadata', seekTo, { once: true });

    return () => {
      video.removeEventListener('loadedmetadata', seekTo);
    };
  }, [resumeAt, resumeRequest, src, isAdMode]);

  // ── Video event listeners ────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay      = () => { setPlaying(true); setEnded(false); };
    const onPause     = () => setPlaying(false);
    const onTimeUpdate = () => {
      const t = video.currentTime;
      const d = Number.isFinite(video.duration) ? video.duration : 0;
      setCurrentTime(t);
      onTimeUpdateProp?.(t, d);
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onDuration  = () => setDuration(video.duration);
    const onWaiting   = () => setBuffering(true);
    const onPlaying   = () => setBuffering(false);
    const onCanPlay   = () => setBuffering(false);
    const onError     = () => {
      if (isAdMode) {
        console.warn('[VideoPlayer] Ad loading error, skipping ad...');
        onEnded?.();
        return;
      }
      setError('Video failed to load.');
    };
    const onEnded_    = () => { setPlaying(false); setEnded(true); onEnded?.(); };
    const onFullscreenChange = () => setFullscreen(!!document.fullscreenElement);
    const onPipEnter  = () => setPip(true);
    const onPipLeave  = () => setPip(false);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDuration);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onError);
    video.addEventListener('ended', onEnded_);
    video.addEventListener('enterpictureinpicture', onPipEnter);
    video.addEventListener('leavepictureinpicture', onPipLeave);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDuration);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError);
      video.removeEventListener('ended', onEnded_);
      video.removeEventListener('enterpictureinpicture', onPipEnter);
      video.removeEventListener('leavepictureinpicture', onPipLeave);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [onEnded, onTimeUpdateProp]);

  useEffect(() => {
    const updateOnlineState = () => setOnline(navigator.onLine);
    updateOnlineState();
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (!showResumeNotice) return;
    const timer = window.setTimeout(() => setShowResumeNotice(false), 7000);
    return () => window.clearTimeout(timer);
  }, [showResumeNotice]);

  // ── Auto-hide controls ───────────────────────────────────────
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setControlsVisible(false);
      }
    }, 3000);
  }, []);

  // ── Controls helpers ─────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      playSafely(v);
    } else {
      v.pause();
    }
  };

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(t, duration));
  };

  const changeVolume = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(1, val));
    v.volume = clamped;
    setVolume(clamped);
    setMuted(clamped === 0);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const toggleFullscreen = () => {
    const c = containerRef.current;
    if (!c) return;
    if (!document.fullscreenElement) {
      c.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const togglePiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      if (v.readyState < HTMLMediaElement.HAVE_METADATA) return;
      await v.requestPictureInPicture();
    }
  };

  const changeSpeed = (s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setSpeed(s);
    setShowSpeedMenu(false);
  };

  const changeQuality = (idx: number) => {
    const hls = hlsRef.current;
    if (hls) {
      hls.currentLevel = idx;
      setCurrentQuality(idx);
    }
    setShowQualityMenu(false);
  };

  const changeSubtitle = (idx: number) => {
    const v = videoRef.current;
    if (!v) return;
    for (let i = 0; i < v.textTracks.length; i++) {
      v.textTracks[i].mode = i === idx ? 'showing' : 'hidden';
    }
    setActiveSubtitle(idx);
    setShowSubMenu(false);
  };

  // ── Progress bar interaction ─────────────────────────────────
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    seek(pct * duration);
  };

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct  = (e.clientX - rect.left) / rect.width;
    setSeekTooltip({ x: e.clientX - rect.left, time: formatTime(pct * duration) });
  };

  // ── Double-click seek zones ──────────────────────────────────
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const c = containerRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    if (xPct < 0.33) {
      seek(currentTime - 10);
      flashFeedback('left');
    } else if (xPct > 0.67) {
      seek(currentTime + 10);
      flashFeedback('right');
    } else {
      togglePlay();
    }
  };

  const flashFeedback = (dir: 'left' | 'right') => {
    setSeekFeedback({ dir, show: true });
    setTimeout(() => setSeekFeedback({ dir, show: false }), 600);
  };

  // ── Keyboard shortcuts ───────────────────────────────────────
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (isAdMode) return;
    showControls();
    switch (e.key) {
      case ' ':
      case 'k': e.preventDefault(); togglePlay(); break;
      case 'ArrowLeft':  e.preventDefault(); seek(currentTime - 10); flashFeedback('left'); break;
      case 'ArrowRight': e.preventDefault(); seek(currentTime + 10); flashFeedback('right'); break;
      case 'ArrowUp':    e.preventDefault(); changeVolume(volume + 0.1); break;
      case 'ArrowDown':  e.preventDefault(); changeVolume(volume - 0.1); break;
      case 'f': case 'F': e.preventDefault(); toggleFullscreen(); break;
      case 'm': case 'M': e.preventDefault(); toggleMute(); break;
      case '?': e.preventDefault(); setShowShortcutHelp((visible) => !visible); break;
      default:
        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault();
          seek((parseInt(e.key) / 10) * duration);
        }
    }
  };

  const progressPct  = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPct  = duration ? (buffered / duration) * 100 : 0;
  const supportsPiP  = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document;

  const chromeOff = isAdMode;

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black select-none focus:outline-none"
      style={{ aspectRatio: '16/9' }}
      tabIndex={chromeOff ? -1 : 0}
      onMouseMove={chromeOff ? undefined : showControls}
      onMouseEnter={chromeOff ? undefined : showControls}
      onMouseLeave={
        chromeOff
          ? undefined
          : () => {
              if (playing) setControlsVisible(false);
            }
      }
      onDoubleClick={chromeOff ? undefined : handleDoubleClick}
      onKeyDown={chromeOff ? undefined : handleKeyDown}
      onClick={
        chromeOff
          ? undefined
          : () => {
              showControls();
              if (!showSpeedMenu && !showQualityMenu && !showSubMenu) togglePlay();
            }
      }
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className="h-full w-full object-contain pointer-events-auto select-none"
        poster={poster}
        playsInline
        disablePictureInPicture
        controlsList="nodownload noremoteplayback"
        style={{ display: 'block' }}
        onClick={(e) => e.stopPropagation()}
      >
        {subtitles.map((s, i) => (
          <track key={i} kind="subtitles" src={s.src} srcLang={s.srclang} label={s.label} />
        ))}
      </video>

      {/* Dynamic Security Watermark */}
      <SecurityWatermark />

      {/* Buffering spinner */}
      {buffering && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/25 pointer-events-none">
          <div className="w-12 h-12 border-4 border-white/25 border-t-primary-light rounded-full animate-spin" />
          <span className="rounded-full bg-black/65 px-3 py-1.5 text-xs font-semibold text-white/75">
            Optimizing stream…
          </span>
        </div>
      )}

      {!online && (
        <div className="absolute inset-x-0 top-4 z-30 mx-auto w-fit rounded-full border border-red-400/30 bg-red-950/90 px-4 py-2 text-xs font-bold text-red-100">
          You’re offline — playback will resume when the connection returns
        </div>
      )}

      {showResumeNotice && resumeAt > 10 && !chromeOff && (
        <div className="absolute bottom-24 left-4 z-20 flex items-center gap-3 rounded-xl border border-white/10 bg-black/80 px-4 py-3 text-sm text-white shadow-xl backdrop-blur">
          <span>Resumed at {formatTime(resumeAt)}</span>
          <button
            type="button"
            className="font-bold text-primary-light hover:text-white"
            onClick={(event) => {
              event.stopPropagation();
              seek(0);
              setShowResumeNotice(false);
            }}
          >
            Start over
          </button>
        </div>
      )}

      {ended && !chromeOff && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 px-6">
          <div className="text-center">
            <p className="font-display text-2xl font-black text-white">You’ve finished {title || 'this title'}</p>
            <p className="mt-2 text-sm text-white/50">Replay it or discover something new.</p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                className="rounded-xl bg-white px-6 py-3 text-sm font-black text-black"
                onClick={(event) => {
                  event.stopPropagation();
                  seek(0);
                  setEnded(false);
                  if (videoRef.current) playSafely(videoRef.current);
                }}
              >
                Replay
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/15 bg-white/10 px-6 py-3 text-sm font-black text-white"
                onClick={(event) => {
                  event.stopPropagation();
                  window.location.href = '/';
                }}
              >
                Browse titles
              </button>
            </div>
          </div>
        </div>
      )}

      {showShortcutHelp && !chromeOff && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-6" onClick={() => setShowShortcutHelp(false)}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-black text-white">Player shortcuts</p>
              <button className="text-xl text-white/50 hover:text-white" onClick={() => setShowShortcutHelp(false)}>×</button>
            </div>
            <div className="mt-5 grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm text-white/65">
              <kbd className="text-white">Space / K</kbd><span>Play or pause</span>
              <kbd className="text-white">← / →</kbd><span>Seek 10 seconds</span>
              <kbd className="text-white">↑ / ↓</kbd><span>Change volume</span>
              <kbd className="text-white">F</kbd><span>Toggle fullscreen</span>
              <kbd className="text-white">M</kbd><span>Mute or unmute</span>
              <kbd className="text-white">0–9</kbd><span>Jump through the movie</span>
            </div>
          </div>
        </div>
      )}

      {/* Double-click seek feedback */}
      {seekFeedback.show && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center gap-1 ${seekFeedback.dir === 'left' ? 'left-8' : 'right-8'}`}
        >
          <span className="text-white text-4xl font-light opacity-80">
            {seekFeedback.dir === 'left' ? '⏮' : '⏭'}
          </span>
          <span className="text-white text-sm font-medium bg-black/50 px-2 py-0.5 rounded">±10s</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-4">
          <span className="text-white text-lg font-semibold">{error}</span>
          <button
            className="px-6 py-2 bg-yellow-400 text-black font-bold rounded-lg hover:bg-yellow-300 transition"
            onClick={(e) => { e.stopPropagation(); setError(null); hlsRef.current?.recoverMediaError(); }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Title overlay */}
      {title && !chromeOff && (
        <div
          className={`absolute top-0 left-0 right-0 px-4 pt-3 pb-8 bg-gradient-to-b from-black/70 to-transparent pointer-events-none transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
        >
          <span className="text-white font-semibold text-base drop-shadow">{title}</span>
        </div>
      )}

      {/* Controls overlay */}
      {!chromeOff && (
      <div
        className={`absolute bottom-0 left-0 right-0 px-4 pb-3 pt-12 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="w-full h-2 bg-white/20 rounded-full cursor-pointer mb-5 relative group"
          onClick={handleProgressClick}
          onMouseMove={handleProgressHover}
          onMouseLeave={() => setSeekTooltip(null)}
        >
          {/* Buffered */}
          <div className="absolute top-0 left-0 h-full bg-white/30 rounded" style={{ width: `${bufferedPct}%` }} />
          {/* Played */}
          <div className="absolute top-0 left-0 h-full rounded bg-primary" style={{ width: `${progressPct}%` }} />
          {/* Ad markers */}
          {duration > 0 && adMarkers.map((marker) => {
            const pct = Math.min(100, Math.max(0, (marker / duration) * 100));
            const isFired = firedAdMarkers.includes(marker);
            return (
              <span
                key={marker}
                className={`absolute top-1/2 z-10 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/50 transition group-hover:h-4 ${
                  isFired ? 'bg-white/30' : 'bg-primary-light'
                }`}
                style={{ left: `${pct}%` }}
                title={`Advertisement at ${formatTime(marker)}`}
                aria-label={`Advertisement cue at ${formatTime(marker)}`}
              />
            );
          })}
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary-light rounded-full shadow -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progressPct}%` }}
          />
          {/* Hover tooltip */}
          {seekTooltip && (
            <div
              className="absolute bottom-4 -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-0.5 rounded pointer-events-none"
              style={{ left: seekTooltip.x }}
            >
              {seekTooltip.time}
            </div>
          )}
        </div>

        {/* Control buttons row */}
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            className="text-white hover:text-yellow-400 transition text-xl w-8 h-8 flex items-center justify-center"
            onClick={togglePlay}
          >
            {playing ? '⏸' : '▶'}
          </button>

          {/* Skip back 10s */}
          <button
            className="text-white hover:text-yellow-400 transition text-sm"
            onClick={() => seek(currentTime - 10)}
            title="-10s"
          >
            ↺
          </button>

          {/* Skip forward 10s */}
          <button
            className="text-white hover:text-yellow-400 transition text-sm"
            onClick={() => seek(currentTime + 10)}
            title="+10s"
          >
            ↻
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1.5">
            <button className="text-white hover:text-yellow-400 transition text-base" onClick={toggleMute}>
              {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="w-16 accent-yellow-400 cursor-pointer"
            />
          </div>

          {/* Time */}
          <span className="text-white text-xs font-mono ml-1 shrink-0">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Subtitles */}
          {subtitles.length > 0 && (
            <div className="relative">
              <button
                className={`text-sm hover:text-yellow-400 transition ${activeSubtitle >= 0 ? 'text-yellow-400' : 'text-white'}`}
                onClick={() => { setShowSubMenu((v) => !v); setShowSpeedMenu(false); setShowQualityMenu(false); }}
              >
                CC
              </button>
              {showSubMenu && (
                <div className="absolute bottom-8 right-0 bg-black/90 border border-white/10 rounded-lg min-w-max overflow-hidden z-20">
                  <button
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-white/10 ${activeSubtitle === -1 ? 'text-yellow-400' : 'text-white'}`}
                    onClick={() => changeSubtitle(-1)}
                  >
                    Off
                  </button>
                  {subtitles.map((s, i) => (
                    <button
                      key={i}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-white/10 ${activeSubtitle === i ? 'text-yellow-400' : 'text-white'}`}
                      onClick={() => changeSubtitle(i)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quality selector */}
          {qualities.length > 0 && (
            <div className="relative">
              <button
                className="text-white text-xs hover:text-yellow-400 transition"
                onClick={() => { setShowQualityMenu((v) => !v); setShowSpeedMenu(false); setShowSubMenu(false); }}
              >
                {currentQuality === -1 ? 'Auto' : `${qualities.find(q => q.index === currentQuality)?.height ?? '?'}p`}
              </button>
              {showQualityMenu && (
                <div className="absolute bottom-8 right-0 bg-black/90 border border-white/10 rounded-lg min-w-max overflow-hidden z-20">
                  <button
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-white/10 ${currentQuality === -1 ? 'text-yellow-400' : 'text-white'}`}
                    onClick={() => changeQuality(-1)}
                  >
                    Auto
                  </button>
                  {[...qualities].sort((a, b) => b.height - a.height).map((q) => (
                    <button
                      key={q.index}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-white/10 ${currentQuality === q.index ? 'text-yellow-400' : 'text-white'}`}
                      onClick={() => changeQuality(q.index)}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Speed selector */}
          <div className="relative">
            <button
              className="text-white text-xs hover:text-yellow-400 transition"
              onClick={() => { setShowSpeedMenu((v) => !v); setShowQualityMenu(false); setShowSubMenu(false); }}
            >
              {speed}x
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-8 right-0 bg-black/90 border border-white/10 rounded-lg min-w-max overflow-hidden z-20">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-white/10 ${speed === s ? 'text-yellow-400' : 'text-white'}`}
                    onClick={() => changeSpeed(s)}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PiP */}
          {supportsPiP && (
            <button
              className={`text-sm transition ${pip ? 'text-yellow-400' : 'text-white hover:text-yellow-400'}`}
              onClick={togglePiP}
              title="Picture-in-Picture"
            >
              ⧉
            </button>
          )}

          {/* Fullscreen */}
          <button
            className="grid h-7 w-7 place-items-center rounded-full text-xs font-black text-white/70 transition hover:bg-white/10 hover:text-white"
            onClick={() => setShowShortcutHelp(true)}
            title="Keyboard shortcuts"
          >
            ?
          </button>

          <button
            className="text-white hover:text-yellow-400 transition text-base"
            onClick={toggleFullscreen}
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? '⛶' : '⛶'}
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
