import type { LoginUserResult } from '../types/models';

export type PlaybackGateResult = 'ok' | 'needs_auth' | 'needs_sub';

/**
 * Client-side guard before requesting secure stream URLs.
 * Enforces that any user must be authenticated AND have an active subscription (`is_buy === 1`)
 * before streaming any content.
 */
export function checkPlaybackGate(
  user: Pick<LoginUserResult, 'id' | 'is_buy' | 'auth_token'> | null | undefined,
  _isPremium: boolean = true,
): PlaybackGateResult {
  const isAuthenticated = Boolean(user?.id && user?.auth_token);
  if (!isAuthenticated) {
    return 'needs_auth';
  }
  const subscribed = Number((user as LoginUserResult).is_buy ?? 0) === 1;
  if (!subscribed) {
    return 'needs_sub';
  }
  return 'ok';
}
