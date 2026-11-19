import type { LoginUserResult } from '../types/models';

export type PlaybackGateResult = 'ok' | 'needs_auth' | 'needs_sub';

/**
 * Client-side guard before requesting secure stream URLs.
 * Backend still enforces auth + subscription on POST /api/video/play.
 *
 * Rules (product default): any playback requires sign-in; premium also requires subscription.
 */
export function checkPlaybackGate(
  user: Pick<LoginUserResult, 'id' | 'is_buy' | 'auth_token'> | null | undefined,
  isPremium: boolean,
): PlaybackGateResult {
  const isAuthenticated = Boolean(user?.id && user?.auth_token);
  if (!isAuthenticated) {
    return 'needs_auth';
  }
  if (!isPremium) {
    return 'ok';
  }
  const subscribed = (user as LoginUserResult).is_buy === 1;
  if (!subscribed) {
    return 'needs_sub';
  }
  return 'ok';
}
