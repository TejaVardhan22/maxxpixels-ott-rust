import type { LoginUserResult } from '@ott/shared';

export const USER_SCOPED_PAGES = new Set([
  'myspace',
  'watchlist',
  'continuewatching',
  'editprofile',
  'notifications',
  'referandearn',
  'settings',
  'profile',
  'tvactivate',
  'subscription',
  'store',
]);

export type UserScopedPage =
  | 'myspace'
  | 'watchlist'
  | 'continuewatching'
  | 'editprofile'
  | 'notifications'
  | 'referandearn'
  | 'settings'
  | 'profile'
  | 'tvactivate'
  | 'subscription'
  | 'store';

/**
 * Derives a clean URL-safe username slug for user-specific routes (`/<username>/<page>`).
 * Falls back to numeric user id when name/username is unavailable.
 */
export function getUserRouteSlug(user?: Partial<LoginUserResult> | null): string {
  if (!user) return '';
  const raw =
    (user as any).user_name ||
    (user as any).username ||
    user.full_name ||
    (user.email ? user.email.split('@')[0] : '') ||
    (user.id ? String(user.id) : '');

  const slug = String(raw)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug) return slug;
  return user.id ? String(user.id) : '';
}

/**
 * Returns `/<username>/<page>` when signed in, or `/<page>` for guests.
 */
export function userPageHref(
  user: Partial<LoginUserResult> | null | undefined,
  page: UserScopedPage,
): string {
  const slug = getUserRouteSlug(user);
  return slug ? `/${encodeURIComponent(slug)}/${page}` : `/${page}`;
}

/**
 * Checks whether a pathname is a `/<username>/<userPage>` route.
 */
export function getUserScopedPageFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const segments = pathname
    .split('/')
    .filter(Boolean)
    .map((s) => decodeURIComponent(s).toLowerCase());
  if (segments.length === 2 && USER_SCOPED_PAGES.has(segments[1])) {
    return segments[1];
  }
  if (segments.length === 1 && USER_SCOPED_PAGES.has(segments[0])) {
    return segments[0];
  }
  return null;
}
