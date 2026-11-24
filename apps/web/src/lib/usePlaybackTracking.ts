'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getUserToken } from '@ott/shared';

/**
 * Sends playback telemetry to the Rust API.
 *
 * Contract (all endpoints live under the `/api/v1` proxy):
 * - `POST /video/play` (authorize) creates the `playback_sessions` row and, for
 *   non-trailer opens, writes an idempotent `content_view_events` ledger row
 *   and increments `contents.view_count`. It returns `sessionToken`.
 * - `POST /playback/heartbeat` keeps that session ACTIVE and syncs resume position.
 * - `POST /playback/stop` releases the concurrency slot when the player unmounts.
 *
 * The player therefore must never invent its own session id: heartbeats only
 * persist when they reference the token returned by authorize.
 */
export interface PlaybackTrackingOptions {
  contentId?: number;
  episodeId?: number;
  /** Token returned by `POST /api/v1/video/play`. */
  sessionToken?: string;
  deviceType?: string;
  /**
   * True while the page is still authorizing playback. Prevents a direct-open
   * interaction event from being written just before the authorize response
   * (which already increments the view counter) arrives.
   */
  awaitingAuthorization?: boolean;
}

export interface PlaybackTracking {
  /** Call from the player's timeupdate tick; feeds the next heartbeat. */
  reportProgress: (positionSeconds: number, durationSeconds?: number) => void;
  /** Call when playback reaches the end so the title is marked completed and removed from Continue Watching. */
  reportCompleted: (durationSeconds?: number) => void;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getUserToken();
  if (token) {
    headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }
  return headers;
}

function postJson(path: string, body: Record<string, unknown>, keepalive = false): void {
  try {
    void fetch(path, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
      keepalive,
    }).catch(() => {});
  } catch {
    /* telemetry must never break playback */
  }
}

export function usePlaybackTracking({
  contentId,
  episodeId,
  sessionToken,
  deviceType = 'WEB',
  awaitingAuthorization = false,
}: PlaybackTrackingOptions): PlaybackTracking {
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  // Ids can resolve after the session token arrives (slug-only watch routes),
  // so read them from refs instead of restarting the session effect.
  const contentIdRef = useRef(contentId);
  const episodeIdRef = useRef(episodeId);
  contentIdRef.current = contentId;
  episodeIdRef.current = episodeId;

  // View accounting. Authorized playback is counted by the authorize call
  // itself; only direct/URL opens need an explicit interaction row. The ref
  // guard prevents React StrictMode and async id resolution from firing it twice.
  const directViewKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!contentId || contentId <= 0) return;
    if (sessionToken || awaitingAuthorization) return;

    const viewKey = `${contentId}:${episodeId ?? 0}:${deviceType}`;
    if (directViewKeyRef.current === viewKey) return;
    directViewKeyRef.current = viewKey;

    postJson('/api/v1/analytics/event', {
      contentId,
      videoId: contentId,
      eventType: 'CONTENT_VIEW',
      interactionType: 'VIEW',
      deviceType,
    });
  }, [awaitingAuthorization, contentId, deviceType, episodeId, sessionToken]);

  // Session lifecycle: one heartbeat loop per authorized session token.
  const completedRef = useRef(false);
  useEffect(() => {
    if (!sessionToken) return;
    completedRef.current = false;

    const snapshot = () => {
      const currentContentId = contentIdRef.current;
      const currentEpisodeId = episodeIdRef.current;
      const pos = Math.max(0, Math.floor(positionRef.current));
      const dur = Math.max(0, Math.floor(durationRef.current));
      return {
        sessionToken,
        contentId: currentContentId && currentContentId > 0 ? currentContentId : undefined,
        episodeId: currentEpisodeId && currentEpisodeId > 0 ? currentEpisodeId : undefined,
        positionSeconds: pos,
        currentPositionSeconds: pos,
        durationSeconds: dur,
        totalDurationSeconds: dur,
        completed: completedRef.current || (dur > 0 && pos >= Math.floor(dur * 0.92)),
        deviceType,
      };
    };

    const sendHeartbeat = () => {
      // Skip initial 0s tick so we never overwrite a saved resume position before playback starts.
      if (positionRef.current <= 0 && !completedRef.current) return;
      postJson('/api/v1/playback/heartbeat', snapshot());
    };

    const interval = window.setInterval(sendHeartbeat, 10_000);

    return () => {
      window.clearInterval(interval);
      // keepalive lets the release & final progress request finish while the route unmounts.
      postJson('/api/v1/playback/stop', snapshot(), true);
    };
  }, [deviceType, sessionToken]);

  const reportProgress = useCallback((positionSeconds: number, durationSeconds?: number) => {
    if (Number.isFinite(positionSeconds) && positionSeconds >= 0) {
      positionRef.current = positionSeconds;
    }
    if (Number.isFinite(durationSeconds) && Number(durationSeconds) > 0) {
      durationRef.current = Number(durationSeconds);
    }
  }, []);

  const reportCompleted = useCallback(
    (durationSeconds?: number) => {
      completedRef.current = true;
      const dur = Math.max(
        0,
        Math.floor(
          Number.isFinite(durationSeconds) && Number(durationSeconds) > 0
            ? Number(durationSeconds)
            : durationRef.current || positionRef.current,
        ),
      );
      if (dur > 0) {
        durationRef.current = dur;
        positionRef.current = dur;
      }

      const currentContentId = contentIdRef.current;
      const currentEpisodeId = episodeIdRef.current;

      if (currentContentId && currentContentId > 0) {
        postJson(
          '/api/v1/watch/history',
          {
            contentId: currentContentId,
            episodeId: currentEpisodeId && currentEpisodeId > 0 ? currentEpisodeId : undefined,
            positionSeconds: dur,
            durationSeconds: dur,
            completed: true,
          },
          true,
        );
      }

      if (sessionToken) {
        postJson(
          '/api/v1/playback/heartbeat',
          {
            sessionToken,
            contentId: currentContentId && currentContentId > 0 ? currentContentId : undefined,
            episodeId: currentEpisodeId && currentEpisodeId > 0 ? currentEpisodeId : undefined,
            positionSeconds: dur,
            currentPositionSeconds: dur,
            durationSeconds: dur,
            totalDurationSeconds: dur,
            completed: true,
            deviceType,
          },
          true,
        );
      }
    },
    [deviceType, sessionToken],
  );

  return { reportProgress, reportCompleted };
}
