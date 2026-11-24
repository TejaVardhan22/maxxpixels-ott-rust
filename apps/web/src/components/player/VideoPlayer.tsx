'use client';

import { useEffect, useRef, useState, useCallback, KeyboardEvent } from 'react';
import Hls from 'hls.js';
import {
  ArrowLeft,
  Cast,
  Check,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  SlidersHorizontal,
  Subtitles,
  Volume2,
  VolumeX,
} from 'lucide-react';
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
  /** Subtitle line below the title, e.g. "Comedy Drama • FHD • 2h 22m" */
  metaSubtitle?: string;
  /** Back arrow handler in the top-left overlay */
  onBack?: () => void;
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
  /** Fill parent viewport instead of fixed 16/9 box */
  fullViewport?: boolean;
}

interface QualityLevel {
  index: number;
  label: string;
  height: number;
}

interface AudioTrackItem {
  index: number;
  label: string;
  lang?: string;
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
  if (!isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

function formatDurationHuman(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '';
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 1) return `${Math.round(seconds)}s`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function qualityBadgeFromHeight(height?: number): string {
  if (!height) return 'FHD';
  if (height >= 2160) return '4K UHD';
  if (height >= 1440) return 'QHD';
  if (height >= 1080) return 'FHD';
  if (height >= 720) return 'HD';
  return 'SD';
}

export default function VideoPlayer({
  src,
  poster,
  title,
  metaSubtitle,
  onBack,
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
  fullViewport = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = (externalVideoRef || internalVideoRef) as React.RefObject<HTMLVideoElement>;
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showVolumePopover, setShowVolumePopover] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto
  const [audioTracks, setAudioTracks] = useState<AudioTrackItem[]>([]);
  const [activeAudioTrack, setActiveAudioTrack] = useState<number>(0);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [activeSubtitle, setActiveSubtitle] = useState<number>(-1); // -1 = Off
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [ended, setEnded] = useState(false);
  const [online, setOnline] = useState(true);
  const [showResumeNotice, setShowResumeNotice] = useState(resumeAt > 10);
  const [castNotice, setCastNotice] = useState<string | null>(null);
  const [seekTooltip, setSeekTooltip] = useState<{ x: number; time: string } | null>(null);
  const [seekFeedback, setSeekFeedback] = useState<{ dir: 'left' | 'right'; show: boolean }>({
    dir: 'right',
    show: false,
  });

  const mediaSrc = normalizeMediaSrc(src);

  const playSafely = useCallback(
    (video: HTMLVideoElement) => {
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
    },
    [isAdMode, onEnded],
  );

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
          label:
            l.height >= 2160
              ? `${l.height}p (4K)`
              : l.height >= 1080
              ? `${l.height}p (FHD)`
              : l.height >= 720
              ? `${l.height}p (HD)`
              : `${l.height}p`,
          height: l.height,
        }));
        setQualities(levels);

        if (Array.isArray(hls.audioTracks) && hls.audioTracks.length > 0) {
          setAudioTracks(
            hls.audioTracks.map((t, idx) => ({
              index: idx,
              label: t.name || t.lang || `Audio ${idx + 1}`,
              lang: t.lang,
            })),
          );
          setActiveAudioTrack(hls.audioTrack >= 0 ? hls.audioTrack : 0);
        } else {
          setAudioTracks([{ index: 0, label: 'Original Audio' }]);
          setActiveAudioTrack(0);
        }

        if (autoPlay) playSafely(video);
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
        if (Array.isArray(data.audioTracks) && data.audioTracks.length > 0) {
          setAudioTracks(
            data.audioTracks.map((t, idx) => ({
              index: idx,
              label: t.name || t.lang || `Audio ${idx + 1}`,
              lang: t.lang,
            })),
          );
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl') || !isHls) {
      video.src = mediaSrc;
      video.load();
      setAudioTracks([{ index: 0, label: 'Original Audio' }]);
      setActiveAudioTrack(0);
      if (autoPlay) playSafely(video);
    } else {
      setError('Your browser does not support HLS streaming.');
    }
  }, [mediaSrc, autoPlay, forceHls, hlsXhrSetup, playSafely, videoRef]);

  // ── Apply resume seek (initial resume or mid-roll return) ──
  const appliedResumeKeyRef = useRef<string>('');
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isAdMode) return;
    if (!resumeAt || resumeAt <= 0) return;

    const resumeKey = `${src}|${resumeAt}|${resumeRequest}`;
    if (appliedResumeKeyRef.current === resumeKey) return;

    const seekTo = () => {
      try {
        if (Math.abs(video.currentTime - resumeAt) > 1.5) {
          video.currentTime = resumeAt;
        }
        appliedResumeKeyRef.current = resumeKey;
      } catch {
        /* ignore */
      }
    };

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      seekTo();
    }
    video.addEventListener('loadedmetadata', seekTo, { once: true });
    video.addEventListener('canplay', seekTo, { once: true });

    return () => {
      video.removeEventListener('loadedmetadata', seekTo);
      video.removeEventListener('canplay', seekTo);
    };
  }, [resumeAt, resumeRequest, src, isAdMode, videoRef]);

  // ── Video event listeners ────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      setPlaying(true);
      setEnded(false);
    };
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => {
      const t = video.currentTime;
      const d = Number.isFinite(video.duration) ? video.duration : 0;
      setCurrentTime(t);
      onTimeUpdateProp?.(t, d);
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onDuration = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onCanPlay = () => setBuffering(false);
    const onError = () => {
      if (isAdMode) {
        console.warn('[VideoPlayer] Ad loading error, skipping ad...');
        onEnded?.();
        return;
      }
      setError('Video failed to load.');
    };
    const onEnded_ = () => {
      setPlaying(false);
      setEnded(true);
      onEnded?.();
    };
    const onFullscreenChange = () => setFullscreen(!!document.fullscreenElement);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDuration);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onError);
    video.addEventListener('ended', onEnded_);
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
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [isAdMode, onEnded, onTimeUpdateProp, videoRef]);

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

  useEffect(() => {
    if (!castNotice) return;
    const timer = window.setTimeout(() => setCastNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [castNotice]);

  // ── Auto-hide controls ───────────────────────────────────────
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (
        videoRef.current &&
        !videoRef.current.paused &&
        !showQualityMenu &&
        !showSubMenu &&
        !showVolumePopover
      ) {
        setControlsVisible(false);
      }
    }, 3200);
  }, [showQualityMenu, showSubMenu, showVolumePopover, videoRef]);

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
    const maxDur = Number.isFinite(duration) && duration > 0 ? duration : v.duration || 0;
    v.currentTime = Math.max(0, Math.min(t, maxDur));
  };

  const changeVolume = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(1, val));
    v.volume = clamped;
    v.muted = clamped === 0;
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
      c.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleCast = async () => {
    const v = videoRef.current as HTMLVideoElement & {
      remote?: { prompt?: () => Promise<void> };
      webkitShowPlaybackTargetPicker?: () => void;
    };
    if (!v) return;
    try {
      if (v.remote && typeof v.remote.prompt === 'function') {
        await v.remote.prompt();
        return;
      }
      if (typeof v.webkitShowPlaybackTargetPicker === 'function') {
        v.webkitShowPlaybackTargetPicker();
        return;
      }
      setCastNotice('Searching for Cast / AirPlay devices on your network…');
    } catch {
      setCastNotice('No Cast devices found on this network.');
    }
  };

  const changeSpeed = (s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setSpeed(s);
  };

  const changeQuality = (idx: number) => {
    const hls = hlsRef.current;
    if (hls) {
      hls.currentLevel = idx;
      setCurrentQuality(idx);
    } else {
      setCurrentQuality(idx);
    }
    setShowQualityMenu(false);
  };

  const changeAudioTrack = (idx: number) => {
    const hls = hlsRef.current;
    if (hls && idx >= 0 && idx < hls.audioTracks.length) {
      hls.audioTrack = idx;
    }
    setActiveAudioTrack(idx);
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
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(pct * duration);
  };

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
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
      toggleFullscreen();
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
      case 'k':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        seek(currentTime - 10);
        flashFeedback('left');
        break;
      case 'ArrowRight':
        e.preventDefault();
        seek(currentTime + 10);
        flashFeedback('right');
        break;
      case 'ArrowUp':
        e.preventDefault();
        changeVolume(volume + 0.1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        changeVolume(volume - 0.1);
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        toggleMute();
        break;
      case '?':
        e.preventDefault();
        setShowShortcutHelp((visible) => !visible);
        break;
      default:
        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault();
          seek((parseInt(e.key, 10) / 10) * duration);
        }
    }
  };

  const progressPct = duration ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const bufferedPct = duration ? Math.min(100, Math.max(0, (buffered / duration) * 100)) : 0;
  const chromeOff = isAdMode;

  // Build dynamic subtitle line ("Comedy Drama • FHD • 2h 22m")
  const highestQualityHeight =
    currentQuality >= 0
      ? qualities.find((q) => q.index === currentQuality)?.height
      : qualities.length > 0
      ? Math.max(...qualities.map((q) => q.height))
      : undefined;
  const qualityTag = qualityBadgeFromHeight(highestQualityHeight);
  const durationTag = formatDurationHuman(duration);

  const computedSubtitle = (() => {
    const parts: string[] = [];
    if (metaSubtitle) {
      parts.push(metaSubtitle);
    }
    if (!metaSubtitle?.includes(qualityTag)) {
      parts.push(qualityTag);
    }
    if (durationTag && !metaSubtitle?.includes(durationTag)) {
      parts.push(durationTag);
    }
    return parts.filter(Boolean).join(' • ');
  })();

  const fallbackQualityOptions: QualityLevel[] =
    qualities.length > 0
      ? [...qualities].sort((a, b) => b.height - a.height)
      : [
          { index: 0, label: '1080p (FHD)', height: 1080 },
          { index: 1, label: '720p (HD)', height: 720 },
          { index: 2, label: '480p', height: 480 },
        ];

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-[#0A0A0A] select-none focus:outline-none overflow-hidden ${
        fullViewport ? 'h-full w-full' : ''
      }`}
      style={fullViewport ? undefined : { aspectRatio: '16/9' }}
      tabIndex={chromeOff ? -1 : 0}
      onMouseMove={chromeOff ? undefined : showControls}
      onMouseEnter={chromeOff ? undefined : showControls}
      onMouseLeave={
        chromeOff
          ? undefined
          : () => {
              if (playing && !showQualityMenu && !showSubMenu && !showVolumePopover) {
                setControlsVisible(false);
              }
            }
      }
      onDoubleClick={chromeOff ? undefined : handleDoubleClick}
      onKeyDown={chromeOff ? undefined : handleKeyDown}
      onClick={
        chromeOff
          ? undefined
          : () => {
              if (showQualityMenu || showSubMenu || showVolumePopover) {
                setShowQualityMenu(false);
                setShowSubMenu(false);
                setShowVolumePopover(false);
                return;
              }
              showControls();
              togglePlay();
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
        controlsList="nodownload"
        style={{ display: 'block' }}
      >
        {subtitles.map((s, i) => (
          <track key={i} kind="subtitles" src={s.src} srcLang={s.srclang} label={s.label} />
        ))}
      </video>

      {/* Dynamic Security Watermark */}
      <SecurityWatermark />

      {/* Buffering spinner */}
      {buffering && !error && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/30">
          <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-white/20 border-t-[#FF6D2E]" />
        </div>
      )}

      {!online && (
        <div className="absolute inset-x-0 top-16 z-30 mx-auto w-fit rounded-full border border-red-400/30 bg-red-950/90 px-4 py-2 text-xs font-bold text-red-100">
          You’re offline — playback will resume when the connection returns
        </div>
      )}

      {castNotice && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-30 mx-auto w-fit rounded-full border border-white/15 bg-[#141414]/95 px-4 py-2 text-xs font-semibold text-white shadow-2xl backdrop-blur-md">
          {castNotice}
        </div>
      )}

      {showResumeNotice && resumeAt > 10 && !chromeOff && (
        <div
          className="absolute bottom-28 left-6 z-20 flex items-center gap-3 rounded-full border border-white/15 bg-[#141414]/95 px-4 py-2 text-xs text-white shadow-xl backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-white/80">Resumed at {formatTime(resumeAt)}</span>
          <button
            type="button"
            className="font-bold text-[#FF6D2E] transition hover:text-white"
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

      {/* Finished screen fallback when standalone VideoPlayer finishes */}
      {ended && !chromeOff && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/85 px-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="max-w-md rounded-2xl border border-white/10 bg-[#141414]/95 p-7 text-center shadow-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FF6D2E]">
              Finished Watching
            </p>
            <p className="mt-2 font-display text-2xl font-black text-white">
              {title || 'This title'}
            </p>
            <p className="mt-2 text-xs text-white/55">
              Replay it now or discover more titles.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                className="rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-6 py-2.5 text-xs font-bold text-white shadow-[0_8px_24px_rgba(255,109,46,0.4)] transition hover:brightness-110"
                onClick={(event) => {
                  event.stopPropagation();
                  seek(0);
                  setEnded(false);
                  if (videoRef.current) playSafely(videoRef.current);
                }}
              >
                Watch Again
              </button>
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/10 px-6 py-2.5 text-xs font-semibold text-white transition hover:bg-white/20"
                onClick={(event) => {
                  event.stopPropagation();
                  window.location.href = '/';
                }}
              >
                Browse Titles
              </button>
            </div>
          </div>
        </div>
      )}

      {showShortcutHelp && !chromeOff && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-6"
          onClick={(e) => {
            e.stopPropagation();
            setShowShortcutHelp(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141414] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-bold text-white">Keyboard Shortcuts</p>
              <button
                className="text-xl text-white/50 hover:text-white"
                onClick={() => setShowShortcutHelp(false)}
              >
                ×
              </button>
            </div>
            <div className="mt-5 grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-xs text-white/70">
              <kbd className="rounded bg-white/10 px-2 py-0.5 font-mono text-white">Space / K</kbd>
              <span>Play or pause</span>
              <kbd className="rounded bg-white/10 px-2 py-0.5 font-mono text-white">← / →</kbd>
              <span>Rewind or forward 10 seconds</span>
              <kbd className="rounded bg-white/10 px-2 py-0.5 font-mono text-white">↑ / ↓</kbd>
              <span>Adjust volume</span>
              <kbd className="rounded bg-white/10 px-2 py-0.5 font-mono text-white">F</kbd>
              <span>Toggle fullscreen</span>
              <kbd className="rounded bg-white/10 px-2 py-0.5 font-mono text-white">M</kbd>
              <span>Mute or unmute</span>
              <kbd className="rounded bg-white/10 px-2 py-0.5 font-mono text-white">0–9</kbd>
              <span>Jump to 0%–90% of video</span>
            </div>
          </div>
        </div>
      )}

      {/* Double-click seek feedback */}
      {seekFeedback.show && (
        <div
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 ${
            seekFeedback.dir === 'left' ? 'left-12 sm:left-20' : 'right-12 sm:right-20'
          }`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-sm font-bold text-white backdrop-blur-md">
            {seekFeedback.dir === 'left' ? '-10s' : '+10s'}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/85 px-6 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="max-w-md text-base font-semibold text-white">{error}</span>
          <button
            className="rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-6 py-2.5 text-xs font-bold text-white shadow-lg transition hover:brightness-110"
            onClick={(e) => {
              e.stopPropagation();
              setError(null);
              if (hlsRef.current) {
                hlsRef.current.recoverMediaError();
              } else if (videoRef.current) {
                videoRef.current.load();
                playSafely(videoRef.current);
              }
            }}
          >
            Retry Playback
          </button>
        </div>
      )}

      {/* ── TOP OVERLAY BAR: Back + Title + Subtitle (left) & Cast + Fullscreen (right) ── */}
      {!chromeOff && (
        <div
          className={`absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 bg-gradient-to-b from-black/85 via-black/45 to-transparent px-5 pb-12 pt-5 transition-opacity duration-300 sm:px-8 sm:pt-6 ${
            controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
            <button
              type="button"
              onClick={() => {
                if (onBack) {
                  onBack();
                } else if (typeof window !== 'undefined') {
                  window.history.back();
                }
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 hover:text-white"
              aria-label="Go back"
            >
              <ArrowLeft className="h-6 w-6" strokeWidth={2.2} />
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight text-white drop-shadow sm:text-xl">
                {title || 'Now Playing'}
              </h1>
              {computedSubtitle && (
                <p className="mt-0.5 truncate text-xs font-medium text-white/75 sm:text-sm">
                  {computedSubtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleCast}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 hover:text-white"
              title="Cast to device"
              aria-label="Cast to device"
            >
              <Cast className="h-5 w-5" strokeWidth={2} />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 hover:text-white"
              title={fullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? (
                <Minimize2 className="h-5 w-5" strokeWidth={2} />
              ) : (
                <Maximize2 className="h-5 w-5" strokeWidth={2} />
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── CENTER OVERLAY TRANSPORT CONTROLS: (10s Rewind)  (Play/Pause)  (10s Forward) ── */}
      {!chromeOff && !ended && !error && (
        <div
          className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-12 transition-opacity duration-300 sm:gap-20 ${
            controlsVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Rewind 10s */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              showControls();
              seek(currentTime - 10);
              flashFeedback('left');
            }}
            className="group pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full text-white transition hover:scale-105 hover:bg-white/10 active:scale-95 sm:h-16 sm:w-16"
            title="Rewind 10 seconds"
            aria-label="Rewind 10 seconds"
          >
            <svg viewBox="0 0 48 48" className="h-11 w-11 sm:h-12 sm:w-12" fill="none">
              <path
                d="M24 10C15.72 10 9 16.72 9 25C9 33.28 15.72 40 24 40C32.28 40 39 33.28 39 25"
                stroke="currentColor"
                strokeWidth="2.75"
                strokeLinecap="round"
              />
              <path
                d="M24 5L17.5 10.5L24 16"
                stroke="currentColor"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <text
                x="24"
                y="29.5"
                textAnchor="middle"
                fill="currentColor"
                fontSize="13.5"
                fontWeight="700"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                10
              </text>
            </svg>
          </button>

          {/* Play / Pause */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              showControls();
              togglePlay();
            }}
            className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full text-white transition hover:scale-105 hover:bg-white/10 active:scale-95 sm:h-20 sm:w-20"
            title={playing ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? (
              <Pause className="h-12 w-12 fill-white text-white sm:h-14 sm:w-14" strokeWidth={1.5} />
            ) : (
              <Play className="ml-1 h-12 w-12 fill-white text-white sm:h-14 sm:w-14" strokeWidth={1.5} />
            )}
          </button>

          {/* Forward 10s */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              showControls();
              seek(currentTime + 10);
              flashFeedback('right');
            }}
            className="group pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full text-white transition hover:scale-105 hover:bg-white/10 active:scale-95 sm:h-16 sm:w-16"
            title="Forward 10 seconds"
            aria-label="Forward 10 seconds"
          >
            <svg viewBox="0 0 48 48" className="h-11 w-11 sm:h-12 sm:w-12" fill="none">
              <path
                d="M24 10C32.28 10 39 16.72 39 25C39 33.28 32.28 40 24 40C15.72 40 9 33.28 9 25"
                stroke="currentColor"
                strokeWidth="2.75"
                strokeLinecap="round"
              />
              <path
                d="M24 5L30.5 10.5L24 16"
                stroke="currentColor"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <text
                x="24"
                y="29.5"
                textAnchor="middle"
                fill="currentColor"
                fontSize="13.5"
                fontWeight="700"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                10
              </text>
            </svg>
          </button>
        </div>
      )}

      {/* ── BOTTOM OVERLAY: Scrubber Line + Centered Pill Buttons ── */}
      {!chromeOff && (
        <div
          className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-5 pb-5 pt-16 transition-opacity duration-300 sm:px-10 sm:pb-6 ${
            controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Row 1: [Elapsed Time]  [Slim Orange Scrubber with Circular Thumb]  [Total Duration]  [Speaker Circle] */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Elapsed time */}
            <span className="min-w-[42px] text-right font-sans text-xs font-medium tabular-nums text-white/90 sm:min-w-[48px] sm:text-sm">
              {formatTime(currentTime)}
            </span>

            {/* Timeline Scrubber */}
            <div
              ref={progressRef}
              className="group relative flex flex-1 cursor-pointer items-center py-3"
              onClick={handleProgressClick}
              onMouseMove={handleProgressHover}
              onMouseLeave={() => setSeekTooltip(null)}
            >
              {/* Track background */}
              <div className="relative h-1 w-full overflow-visible rounded-full bg-white/30 transition-all group-hover:h-1.5">
                {/* Buffered */}
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-white/40"
                  style={{ width: `${bufferedPct}%` }}
                />
                {/* Played (#FF6D2E theme orange) */}
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-[#FF6D2E]"
                  style={{ width: `${progressPct}%` }}
                />

                {/* Mid-roll Ad Markers */}
                {duration > 0 &&
                  adMarkers.map((marker) => {
                    const pct = Math.min(100, Math.max(0, (marker / duration) * 100));
                    const isFired = firedAdMarkers.includes(marker);
                    return (
                      <span
                        key={marker}
                        className={`absolute top-1/2 z-10 h-2.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition ${
                          isFired ? 'bg-white/45' : 'bg-[#FF8A54] ring-1 ring-black/60'
                        }`}
                        style={{ left: `${pct}%` }}
                        title={`Ad break at ${formatTime(marker)}`}
                        aria-label={`Ad break at ${formatTime(marker)}`}
                      />
                    );
                  })}

                {/* Always-visible circular orange thumb */}
                <div
                  className="
                    absolute top-1/2 z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2
                    rounded-full bg-[#FF6D2E] shadow-[0_0_10px_rgba(255,109,46,0.9)]
                    transition-transform group-hover:scale-125
                  "
                  style={{ left: `${progressPct}%` }}
                />
              </div>

              {/* Hover timestamp tooltip */}
              {seekTooltip && (
                <div
                  className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-[#141414]/95 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white shadow-lg ring-1 ring-white/10"
                  style={{ left: seekTooltip.x }}
                >
                  {seekTooltip.time}
                </div>
              )}
            </div>

            {/* Total duration */}
            <span className="min-w-[42px] font-sans text-xs font-medium tabular-nums text-white/90 sm:min-w-[52px] sm:text-sm">
              {formatTime(duration)}
            </span>

            {/* Circular Speaker / Volume Button */}
            <div
              className="relative flex items-center"
              onMouseEnter={() => setShowVolumePopover(true)}
              onMouseLeave={() => setShowVolumePopover(false)}
            >
              {showVolumePopover && (
                <div className="absolute bottom-11 right-0 z-30 flex items-center gap-2.5 rounded-full border border-white/15 bg-[#141414]/95 px-3.5 py-2 shadow-2xl backdrop-blur-md">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={muted ? 0 : volume}
                    onChange={(e) => changeVolume(Number(e.target.value))}
                    className="h-1 w-20 cursor-pointer accent-[#FF6D2E]"
                    aria-label="Volume"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={toggleMute}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition hover:bg-white/30"
                title={muted || volume === 0 ? 'Unmute (M)' : 'Mute (M)'}
                aria-label={muted || volume === 0 ? 'Unmute' : 'Mute'}
              >
                {muted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" strokeWidth={2.2} />
                ) : (
                  <Volume2 className="h-4 w-4" strokeWidth={2.2} />
                )}
              </button>
            </div>
          </div>

          {/* Row 2: Centered Pill Buttons ("Quality" and "Audio & Subtitles") */}
          <div className="mt-3 flex items-center justify-center gap-3">
            {/* Quality Pill + Upward Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowQualityMenu((v) => !v);
                  setShowSubMenu(false);
                }}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-md transition ${
                  showQualityMenu
                    ? 'bg-white/30 ring-1 ring-white/40'
                    : 'bg-white/15 hover:bg-white/25'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2.2} />
                <span>
                  Quality
                  {currentQuality !== -1
                    ? ` • ${
                        fallbackQualityOptions.find((q) => q.index === currentQuality)?.height ??
                        ''
                      }p`
                    : ''}
                </span>
              </button>

              {showQualityMenu && (
                <div className="absolute bottom-11 left-1/2 z-30 w-60 -translate-x-1/2 rounded-2xl border border-white/15 bg-[#141414]/95 p-3 shadow-2xl backdrop-blur-xl">
                  <p className="px-2.5 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/45">
                    Video Quality
                  </p>
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => changeQuality(-1)}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition ${
                        currentQuality === -1
                          ? 'bg-[#FF6D2E]/15 text-[#FF6D2E]'
                          : 'text-white/85 hover:bg-white/10'
                      }`}
                    >
                      <span>Auto ({qualityTag})</span>
                      {currentQuality === -1 && <Check className="h-3.5 w-3.5 text-[#FF6D2E]" />}
                    </button>

                    {fallbackQualityOptions.map((q) => (
                      <button
                        key={q.index}
                        type="button"
                        onClick={() => changeQuality(q.index)}
                        className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition ${
                          currentQuality === q.index
                            ? 'bg-[#FF6D2E]/15 text-[#FF6D2E]'
                            : 'text-white/85 hover:bg-white/10'
                        }`}
                      >
                        <span>{q.label}</span>
                        {currentQuality === q.index && (
                          <Check className="h-3.5 w-3.5 text-[#FF6D2E]" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Playback Speed row inside Quality popover */}
                  <div className="mt-3 border-t border-white/10 pt-2.5">
                    <p className="px-2.5 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/45">
                      Playback Speed
                    </p>
                    <div className="grid grid-cols-3 gap-1 px-1">
                      {SPEEDS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => changeSpeed(s)}
                          className={`rounded-lg py-1 text-center text-[11px] font-semibold transition ${
                            speed === s
                              ? 'bg-[#FF6D2E] text-white'
                              : 'bg-white/5 text-white/75 hover:bg-white/15'
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Audio & Subtitles Pill + Upward Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowSubMenu((v) => !v);
                  setShowQualityMenu(false);
                }}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-md transition ${
                  showSubMenu
                    ? 'bg-white/30 ring-1 ring-white/40'
                    : 'bg-white/15 hover:bg-white/25'
                }`}
              >
                <Subtitles className="h-3.5 w-3.5" strokeWidth={2.2} />
                <span>Audio & Subtitles</span>
              </button>

              {showSubMenu && (
                <div className="absolute bottom-11 left-1/2 z-30 w-72 -translate-x-1/2 rounded-2xl border border-white/15 bg-[#141414]/95 p-3.5 shadow-2xl backdrop-blur-xl sm:w-80">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Audio column */}
                    <div>
                      <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/45">
                        Audio
                      </p>
                      <div className="space-y-0.5">
                        {(audioTracks.length > 0
                          ? audioTracks
                          : [{ index: 0, label: 'Original' }]
                        ).map((track) => (
                          <button
                            key={track.index}
                            type="button"
                            onClick={() => changeAudioTrack(track.index)}
                            className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition ${
                              activeAudioTrack === track.index
                                ? 'bg-[#FF6D2E]/15 text-[#FF6D2E]'
                                : 'text-white/85 hover:bg-white/10'
                            }`}
                          >
                            <span className="truncate">{track.label}</span>
                            {activeAudioTrack === track.index && (
                              <Check className="h-3.5 w-3.5 shrink-0 text-[#FF6D2E]" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Subtitles column */}
                    <div className="border-l border-white/10 pl-3">
                      <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/45">
                        Subtitles
                      </p>
                      <div className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => changeSubtitle(-1)}
                          className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition ${
                            activeSubtitle === -1
                              ? 'bg-[#FF6D2E]/15 text-[#FF6D2E]'
                              : 'text-white/85 hover:bg-white/10'
                          }`}
                        >
                          <span>Off</span>
                          {activeSubtitle === -1 && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-[#FF6D2E]" />
                          )}
                        </button>

                        {subtitles.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => changeSubtitle(i)}
                            className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition ${
                              activeSubtitle === i
                                ? 'bg-[#FF6D2E]/15 text-[#FF6D2E]'
                                : 'text-white/85 hover:bg-white/10'
                            }`}
                          >
                            <span className="truncate">{s.label}</span>
                            {activeSubtitle === i && (
                              <Check className="h-3.5 w-3.5 shrink-0 text-[#FF6D2E]" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
