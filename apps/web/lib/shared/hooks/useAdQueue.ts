'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { adApi, resolveTaggedEntries, type AdEntry, type AdQueue } from '../api/adServices';

export type AdPhase = 'pre_roll' | 'content' | 'mid_roll' | 'post_roll' | 'done';

export interface ActiveAd extends AdEntry {
  phase: 'pre_roll' | 'mid_roll' | 'post_roll';
  sessionId: string;
}

export interface UseAdQueueOptions {
  videoId: number;
  categoryId?: string;
  device: 'mobile' | 'tablet' | 'tv' | 'web';
  userId?: number;
}

export interface UseAdQueueReturn {
  phase: AdPhase;
  activeAd: ActiveAd | null;
  countdown: number;
  canSkip: boolean;
  resumeTime: number;
  hasPreRoll: boolean;
  hasPostRoll: boolean;
  allMidRollMarkers: number[];
  /** Remaining mid-roll cue times (derived from scheduled events; for debugging/UI) */
  pendingMidRolls: number[];
  onMidRollTrigger: (currentTime: number, duration?: number) => void;
  onAdEnded: () => void;
  onAdSkip: () => void;
  onAdTimeUpdate: (watchedSeconds: number) => void;
  loading: boolean;
  error: boolean;
  triggerPostRoll: () => void;
}

function newSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function useAdQueue({
  videoId,
  categoryId,
  device,
  userId,
}: UseAdQueueOptions): UseAdQueueReturn {
  const hasAnyAds = (q: AdQueue): boolean =>
    (q.pre_roll?.length ?? 0) > 0 || (q.mid_roll?.length ?? 0) > 0 || (q.post_roll?.length ?? 0) > 0;

  const [queue, setQueue] = useState<AdQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [phase, setPhase] = useState<AdPhase>('pre_roll');
  const [activeAd, setActiveAd] = useState<ActiveAd | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [resumeTime, setResumeTime] = useState(0);

  const preRollIdx = useRef(0);
  const postRollIdx = useRef(0);
  /** Sorted schedule of { marker, adIndex } pairs — one entry per marker across all mid-roll ads. */
  const midRollScheduleRef = useRef<{ marker: number; adIndex: number }[]>([]);
  /** How many mid-roll cues have already fired. */
  const midRollFiredCount = useRef(0);

  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const impressionSent = useRef<Set<string>>(new Set());
  /** Server ad session id (ads/queue) used for event attribution. */
  const serverSessionId = useRef('');
  /** Analytics events already fired (per ad + type) — dedup client-side. */
  const eventsSent = useRef<Set<string>>(new Set());
  /** Set when the current ad was skipped (so end != COMPLETE). */
  const skipRequested = useRef(false);

  const activateAd = useCallback(
    (ad: AdEntry, adPhase: 'pre_roll' | 'mid_roll' | 'post_roll') => {
      const sessionId = newSessionId();
      setActiveAd({ ...ad, phase: adPhase, sessionId });
      setPhase(adPhase);
      setCountdown(ad.duration);
      setCanSkip(false);

      if (countdownTimer.current) clearInterval(countdownTimer.current);
      let elapsed = 0;
      countdownTimer.current = setInterval(() => {
        elapsed += 1;
        setCountdown((prev) => Math.max(0, prev - 1));
        if (ad.skip_after !== null && elapsed >= (ad.skip_after ?? Infinity)) {
          setCanSkip(true);
        }
      }, 1000);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    preRollIdx.current = 0;
    postRollIdx.current = 0;
    midRollScheduleRef.current = [];
    midRollFiredCount.current = 0;
    impressionSent.current = new Set();
    eventsSent.current = new Set();
    skipRequested.current = false;
    serverSessionId.current = '';
    setQueue(null);
    setResumeTime(0);
    setActiveAd(null);
    setPhase('pre_roll');
    setLoading(true);
    setError(false);

    const loadQueue = async () => {
      // First attempt: full targeting context.
      let q = await adApi.getAds({
        video_id: videoId,
        device,
        category: categoryId,
        user_id: userId,
      });

      // Web and some clients can miss ads due over-restrictive context/filtering.
      // Retry with minimal context before giving up.
      if (!hasAnyAds(q) && (categoryId || userId)) {
        q = await adApi.getAds({
          video_id: videoId,
          device,
        });
      }

      return q;
    };

    loadQueue()
      .then(async (q) => {
        if (cancelled) return;
        serverSessionId.current = q.session_id || '';

        // Resolve VAST tags into playable media URLs (web has no client IMA).
        const [pre, mid, post] = await Promise.all([
          resolveTaggedEntries(q.pre_roll),
          resolveTaggedEntries(q.mid_roll),
          resolveTaggedEntries(q.post_roll),
        ]);
        const resolved: AdQueue = { pre_roll: pre, mid_roll: mid, post_roll: post };
        if (cancelled) return;
        setQueue(resolved);

        // Build a sorted schedule mapping each marker to its owning ad index.
        // This ensures each marker fires the correct ad creative (not a round-robin).
        const midRollSchedule: { marker: number; adIndex: number }[] = [];
        q.mid_roll.forEach((ad, idx) => {
          (ad.time_markers ?? []).forEach((marker) => {
            const normalized = Math.floor(Number(marker));
            // Ignore invalid/zero markers to avoid immediate or repeated triggers.
            if (Number.isFinite(normalized) && normalized > 0) {
              midRollSchedule.push({ marker: normalized, adIndex: idx });
            }
          });
        });
        midRollSchedule.sort((a, b) => a.marker - b.marker);
        midRollScheduleRef.current = midRollSchedule;
        midRollFiredCount.current = 0;

        if (cancelled) return;
        if (q.pre_roll.length > 0) {
          activateAd(q.pre_roll[0], 'pre_roll');
        } else {
          setPhase('content');
        }
      })
      .catch(async () => {
        if (cancelled) return;
        try {
          // Final safety retry with minimal payload for transient web/API issues.
          const q = await adApi.getAds({
            video_id: videoId,
            device,
          });
          if (cancelled) return;
          serverSessionId.current = q.session_id || '';
          const [pre, mid, post] = await Promise.all([
            resolveTaggedEntries(q.pre_roll),
            resolveTaggedEntries(q.mid_roll),
            resolveTaggedEntries(q.post_roll),
          ]);
          if (cancelled) return;
          const resolved: AdQueue = { pre_roll: pre, mid_roll: mid, post_roll: post };
          setQueue(resolved);

          const midRollSchedule: { marker: number; adIndex: number }[] = [];
          q.mid_roll.forEach((ad, idx) => {
            (ad.time_markers ?? []).forEach((marker) => {
              const normalized = Math.floor(Number(marker));
              // Ignore invalid/zero markers to avoid immediate or repeated triggers.
              if (Number.isFinite(normalized) && normalized > 0) {
                midRollSchedule.push({ marker: normalized, adIndex: idx });
              }
            });
          });
          midRollSchedule.sort((a, b) => a.marker - b.marker);
          midRollScheduleRef.current = midRollSchedule;
          midRollFiredCount.current = 0;

          if ((q.pre_roll?.length ?? 0) > 0) {
            activateAd(q.pre_roll[0], 'pre_roll');
          } else {
            setPhase('content');
          }
        } catch {
          if (!cancelled) {
            setError(true);
            setPhase('content');
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // activateAd is stable (empty deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, categoryId, device, userId]);

  /** Fires the ad analytics event exactly once per ad + event type. */
  const trackOnce = useCallback(
    (eventType: 'IMPRESSION' | 'COMPLETE' | 'SKIP', ad: ActiveAd) => {
      const key = `${ad.sessionId}_${eventType}`;
      if (eventsSent.current.has(key)) return;
      eventsSent.current.add(key);
      void adApi.trackEvent({
        ad_id: ad.ad_id,
        video_id: videoId,
        eventType,
        sessionToken: `${serverSessionId.current || 'ad-web'}_${ad.ad_id}_${ad.phase}`,
        providerCode: ad.tag_url ? 'GAM' : 'DIRECT',
        metadata: { roll: ad.phase, device },
      });
    },
    [videoId, device],
  );

  const onAdEnded = useCallback(() => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    if (!activeAd || !queue) return;

    // Natural end (not a skip) = a fully watched ad → COMPLETE.
    if (skipRequested.current) {
      skipRequested.current = false;
      trackOnce('SKIP', activeAd);
    } else {
      trackOnce('COMPLETE', activeAd);
    }

    const { phase: adPhase } = activeAd;

    if (adPhase === 'pre_roll') {
      const next = preRollIdx.current + 1;
      if (next < queue.pre_roll.length) {
        preRollIdx.current = next;
        activateAd(queue.pre_roll[next], 'pre_roll');
      } else {
        setActiveAd(null);
        setPhase('content');
      }
    } else if (adPhase === 'mid_roll') {
      // One creative per cue; next cue comes from pendingMidRollEvents on next threshold crossing
      setActiveAd(null);
      setPhase('content');
    } else if (adPhase === 'post_roll') {
      const next = postRollIdx.current + 1;
      if (next < queue.post_roll.length) {
        postRollIdx.current = next;
        activateAd(queue.post_roll[next], 'post_roll');
      } else {
        setActiveAd(null);
        setPhase('done');
      }
    }
  }, [activeAd, queue, activateAd, trackOnce]);

  const onAdSkip = useCallback(() => {
    if (canSkip) {
      skipRequested.current = true;
      onAdEnded();
    }
  }, [canSkip, onAdEnded]);

  const onMidRollTrigger = useCallback(
    (currentTime: number, duration?: number) => {
      if (!queue || phase !== 'content') return;

      const schedule = midRollScheduleRef.current;
      const next = schedule[midRollFiredCount.current];
      if (next === undefined) return;

      const finiteDuration = Number.isFinite(duration) && duration !== undefined && duration > 0 ? duration : 0;
      const markerIsOutsideVideo = finiteDuration > 0 && next.marker >= finiteDuration - 1;
      const effectiveMarker = markerIsOutsideVideo
        ? Math.min(Math.max(5, Math.floor(finiteDuration * 0.25)), Math.max(1, Math.floor(finiteDuration - 1)))
        : next.marker;

      if (currentTime >= effectiveMarker) {
        midRollFiredCount.current += 1;
        setResumeTime(currentTime);
        const midAd = queue.mid_roll[next.adIndex];
        if (midAd) activateAd(midAd, 'mid_roll');
      }
    },
    [queue, phase, activateAd],
  );

  const triggerPostRoll = useCallback(() => {
    if (!queue || queue.post_roll.length === 0) {
      setPhase('done');
      return;
    }
    postRollIdx.current = 0;
    activateAd(queue.post_roll[0], 'post_roll');
  }, [queue, activateAd]);

  const onAdTimeUpdate = useCallback(
    (watchedSeconds: number) => {
      if (!activeAd) return;
      const key = activeAd.sessionId;

      if (watchedSeconds >= 2 && !impressionSent.current.has(key)) {
        impressionSent.current.add(key);
        // Server-side pipeline event (ad_events → producer panel Ads Run + revenue).
        trackOnce('IMPRESSION', activeAd);
      }
    },
    [activeAd, trackOnce],
  );

  useEffect(
    () => () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    },
    [],
  );

  // Derive remaining mid-roll cue times from the ref (for debugging/UI only)
  const allMidRollMarkers = midRollScheduleRef.current.map((x) => x.marker);
  const pendingMidRolls = midRollScheduleRef.current
    .slice(midRollFiredCount.current)
    .map((x) => x.marker);

  return {
    phase,
    activeAd,
    countdown,
    canSkip,
    resumeTime,
    hasPreRoll: (queue?.pre_roll.length ?? 0) > 0,
    hasPostRoll: (queue?.post_roll.length ?? 0) > 0,
    allMidRollMarkers,
    pendingMidRolls,
    onMidRollTrigger,
    onAdEnded,
    onAdSkip,
    onAdTimeUpdate,
    loading,
    error,
    triggerPostRoll,
  };
}
