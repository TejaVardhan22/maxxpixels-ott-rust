'use client';

import { useEffect, useMemo, useState } from 'react';
import { setUserToken } from '@ott/shared';
import type { LoginUserResult, SessionContext } from '@ott/shared';

const AUTH_KEY = 'ott-auth-user';
const AUTH_EVENT = 'ott-auth-change';

export function parseStoredUser(raw: string | null): LoginUserResult | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as any;
    const innerUser = (parsed?.user && typeof parsed.user === 'object') ? parsed.user : {};
    let token = parsed?.auth_token || parsed?.accessToken || parsed?.token || innerUser?.authToken || innerUser?.auth_token;
    if (!token && typeof window !== 'undefined') {
      try {
        token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || undefined;
      } catch { }
    }
    const id = parsed?.id || parsed?.userId || parsed?.uuid || innerUser?.id;

    if (id && token) {
      const fullName = parsed?.full_name || parsed?.fullName || parsed?.name || innerUser?.fullName || innerUser?.name || 'Subscriber';
      const emailVal = parsed?.email || innerUser?.email || '';
      const mobileVal = parsed?.mobile_number || parsed?.phoneNumber || parsed?.mobileNumber || innerUser?.phoneNumber || innerUser?.mobileNumber || '';
      const imageVal =
        parsed?.image !== undefined
          ? parsed.image
          : parsed?.avatarUrl !== undefined
          ? parsed.avatarUrl
          : parsed?.avatar_url !== undefined
          ? parsed.avatar_url
          : innerUser?.image ?? innerUser?.avatarUrl ?? innerUser?.avatar_url ?? '';
      const isBuyVal =
        parsed?.is_buy !== undefined
          ? Number(parsed.is_buy)
          : parsed?.isBuy !== undefined
          ? Number(parsed.isBuy)
          : innerUser?.is_buy !== undefined
          ? Number(innerUser.is_buy)
          : innerUser?.isBuy !== undefined
          ? Number(innerUser.isBuy)
          : parsed?.is_subscribed || parsed?.isSubscribed || innerUser?.is_subscribed || innerUser?.isSubscribed
          ? 1
          : 0;
      const packageNameVal =
        parsed?.package_name ||
        parsed?.packageName ||
        innerUser?.package_name ||
        innerUser?.packageName ||
        (isBuyVal === 1 ? 'VIP Membership' : 'Free');

      return {
        ...innerUser,
        ...parsed,
        id: typeof id === 'number' ? id : (/^\d+$/.test(String(id).trim()) ? parseInt(String(id).trim(), 10) : String(id)),
        uuid: String(id),
        full_name: fullName,
        email: emailVal,
        mobile_number: mobileVal,
        image: imageVal || '',
        avatarUrl: imageVal || '',
        auth_token: token,
        refresh_token: parsed?.refresh_token || parsed?.refreshToken || innerUser?.refreshToken,
        is_buy: isBuyVal,
        package_name: packageNameVal,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function storeAuthRaw(value: string): void {
  try { sessionStorage.setItem(AUTH_KEY, value); } catch { }
  try { localStorage.setItem(AUTH_KEY, value); } catch { }
}

function readAuthRaw(): string | null {
  try {
    return sessionStorage.getItem(AUTH_KEY) ?? localStorage.getItem(AUTH_KEY);
  } catch {
    return null;
  }
}

function clearAuthRaw(): void {
  try { sessionStorage.removeItem(AUTH_KEY); } catch { }
  try { localStorage.removeItem(AUTH_KEY); } catch { }
}

export function getStoredUser(): LoginUserResult | null {
  if (typeof window === 'undefined') return null;
  return parseStoredUser(readAuthRaw());
}

export function setStoredUser(userInput: any): void {
  if (typeof window === 'undefined') return;
  const innerUser = (userInput?.user && typeof userInput.user === 'object') ? userInput.user : {};
  let token = userInput?.auth_token || userInput?.accessToken || userInput?.token || innerUser?.authToken || innerUser?.auth_token;
  if (!token && typeof window !== 'undefined') {
    try {
      token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || undefined;
    } catch { }
  }
  const id = userInput?.id || userInput?.userId || userInput?.uuid || innerUser?.id || 1;

  const fullName = userInput?.full_name || userInput?.fullName || userInput?.name || innerUser?.fullName || innerUser?.name || 'Subscriber';
  const emailVal = userInput?.email || innerUser?.email || '';
  const mobileVal = userInput?.mobile_number || userInput?.phoneNumber || userInput?.mobileNumber || innerUser?.phoneNumber || innerUser?.mobileNumber || '';
  const imageVal =
    userInput?.image !== undefined
      ? userInput.image
      : userInput?.avatarUrl !== undefined
      ? userInput.avatarUrl
      : userInput?.avatar_url !== undefined
      ? userInput.avatar_url
      : innerUser?.image ?? innerUser?.avatarUrl ?? innerUser?.avatar_url ?? '';
  const isBuyVal =
    userInput?.is_buy !== undefined
      ? Number(userInput.is_buy)
      : userInput?.isBuy !== undefined
      ? Number(userInput.isBuy)
      : innerUser?.is_buy !== undefined
      ? Number(innerUser.is_buy)
      : innerUser?.isBuy !== undefined
      ? Number(innerUser.isBuy)
      : userInput?.is_subscribed || userInput?.isSubscribed || innerUser?.is_subscribed || innerUser?.isSubscribed
      ? 1
      : 0;
  const packageNameVal =
    userInput?.package_name ||
    userInput?.packageName ||
    innerUser?.package_name ||
    innerUser?.packageName ||
    (isBuyVal === 1 ? 'VIP Membership' : 'Free');
  const activeToken = token || 'token_session_active';

  const user: LoginUserResult = {
    ...innerUser,
    ...userInput,
    id: typeof id === 'number' ? id : parseInt(String(id), 10) || 1,
    uuid: String(id),
    full_name: fullName,
    email: emailVal,
    mobile_number: mobileVal,
    image: imageVal || '',
    avatarUrl: imageVal || '',
    auth_token: activeToken,
    refresh_token: userInput?.refresh_token || userInput?.refreshToken || innerUser?.refreshToken,
    is_buy: isBuyVal,
    package_name: packageNameVal,
  };

  storeAuthRaw(JSON.stringify(user));
  setUserToken(activeToken);
  try {
    localStorage.setItem('auth_token', activeToken);
  } catch { }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function clearStoredUser(): void {
  if (typeof window === 'undefined') return;
  clearAuthRaw();
  setUserToken(null);
  try {
    sessionStorage.removeItem('kc_access_token');
    sessionStorage.removeItem('kc_refresh_token');
    sessionStorage.removeItem('kc_id_token');
  } catch { }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function buildWebSessionContext(
  user: LoginUserResult | null,
): SessionContext | undefined {
  if (!user?.id || !user.auth_token) return undefined;
  return {
    userId: user.id,
    deviceId: `web-${user.id}`,
    isKidsProfile: user.parent_control_status === 1,
  };
}

export function useStoredUser() {
  const [user, setUser] = useState<LoginUserResult | null>(null);

  useEffect(() => {
    const syncUser = () => {
      const stored = getStoredUser();
      setUser(stored);
      if (stored?.auth_token) {
        setUserToken(stored.auth_token);
      } else {
        setUserToken(null);
      }
    };

    const handleAuthExpired = () => {
      clearStoredUser();
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        const isAuthPage =
          path.startsWith('/login') ||
          path.startsWith('/register') ||
          path.startsWith('/auth') ||
          path.startsWith('/stream/auth');
        if (!isAuthPage) {
          window.location.href = '/login?expired=1';
        }
      }
    };

    syncUser();
    window.addEventListener(AUTH_EVENT, syncUser);
    window.addEventListener('storage', syncUser);
    window.addEventListener('ott:auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener(AUTH_EVENT, syncUser);
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('ott:auth-expired', handleAuthExpired);
    };
  }, []);

  const session = useMemo(() => buildWebSessionContext(user), [user]);

  return {
    user,
    session,
    isLoggedIn: !!user?.id,
    logout: clearStoredUser,
  };
}
