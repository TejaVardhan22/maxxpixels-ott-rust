import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { User, parseUser } from '../types';
import { ApiClient } from './apiClient';
import { GraphQLService } from './graphqlService';
import { setupPushNotifications } from './pushNotificationService';

const SESSION_KEY = 'ott-mobile-session';
const REFRESH_TOKEN_KEY = 'ott-mobile-refresh-token';
const DEVICE_ID_KEY = 'ott-mobile-device-id';
const LAST_ACTIVE_KEY = 'ott-mobile-last-active';

// Production token obfuscation helper to protect tokens at rest on device
const encryptData = (plain: string): string => {
  try {
    const encoded = encodeURIComponent(plain);
    let out = 'enc_';
    for (let i = 0; i < encoded.length; i++) {
      const code = encoded.charCodeAt(i) ^ (0x5A + (i % 7));
      out += code.toString(16).padStart(4, '0');
    }
    return out;
  } catch {
    return plain;
  }
};

const decryptData = (payload: string): string => {
  try {
    if (!payload.startsWith('enc_')) return payload;
    const hex = payload.slice(4);
    let decoded = '';
    for (let i = 0; i < hex.length; i += 4) {
      const chunk = hex.substr(i, 4);
      const code = parseInt(chunk, 16) ^ (0x5A + ((i / 4) % 7));
      decoded += String.fromCharCode(code);
    }
    return decodeURIComponent(decoded);
  } catch {
    return payload;
  }
};

type Listener = () => void;

class AuthServiceClass {
  private _user: User | null = null;
  private _authToken: string | null = null;
  private _refreshToken: string | null = null;
  private _isLoadingSession = true;
  private listeners: Set<Listener> = new Set();
  private initPromise: Promise<void> | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private sessionVersion = 0;

  constructor() {
    ApiClient.setAuthTokenGetter(() => this._authToken || undefined);
    ApiClient.setSessionRefresher(() => this.refreshSession());
    ApiClient.setUnauthorizedHandler(() => {
      void this.logout();
    });
  }

  public async refreshSession(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;
    if (!this._refreshToken || !this._user) return false;
    const version = this.sessionVersion;
    this.refreshPromise = (async () => {
      try {
        const response = await ApiClient.postApi('auth/refresh', { refreshToken: this._refreshToken });
        if (version !== this.sessionVersion) return false;
        const { user, accessToken, refreshToken } = this.parseAuthResponse(response);
        await this.saveSession(user, accessToken, refreshToken);
        return true;
      } catch { return false; }
      finally { this.refreshPromise = null; }
    })();
    return this.refreshPromise;
  }

  public get user(): User | null {
    return this._user;
  }

  public get currentUser(): User | null {
    return this._user;
  }

  public get authToken(): string | null {
    return this._authToken;
  }

  public get refreshToken(): string | null {
    return this._refreshToken;
  }

  public get isLoadingSession(): boolean {
    return this._isLoadingSession;
  }

  public get isLoggedIn(): boolean {
    return !!(this._authToken && this._user);
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public init(): Promise<void> {
    if (!this.initPromise) this.initPromise = this.restoreSession();
    return this.initPromise;
  }

  private async restoreSession(): Promise<void> {
    const version = this.sessionVersion;
    try {
      const stored = await AsyncStorage.getItem(SESSION_KEY);
      const storedRefreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      const lastActiveStr = await AsyncStorage.getItem(LAST_ACTIVE_KEY);

      if (version !== this.sessionVersion) return;
      let sessionValid = true;
      if (stored) {
        if (lastActiveStr) {
          const lastActive = new Date(lastActiveStr);
          const diffDays = (Date.now() - lastActive.getTime()) / (1000 * 3600 * 24);
          if (diffDays >= 30) {
            sessionValid = false;
            await AsyncStorage.removeItem(SESSION_KEY);
            await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
            await AsyncStorage.removeItem(LAST_ACTIVE_KEY);
          }
        }

        if (sessionValid) {
          try {
            const rawDecrypted = decryptData(stored);
            const session = JSON.parse(rawDecrypted);
            if (session.user && session.authToken) {
              this._user = parseUser(session.user);
              this._authToken = session.authToken;
              this._refreshToken = storedRefreshToken ? decryptData(storedRefreshToken) : session.refreshToken || null;
              await AsyncStorage.setItem(LAST_ACTIVE_KEY, new Date().toISOString());
              // Silently sync latest subscription entitlements and register push token in background
              this.syncSubscription().catch(() => {});
              setupPushNotifications(this._authToken || undefined).catch(() => {});
            }
          } catch {
            await AsyncStorage.removeItem(SESSION_KEY);
          }
        }
      }
    } catch (e) {
      console.warn('AuthService.init error:', e);
    } finally {
      this._isLoadingSession = false;
      this.notify();
    }
  }

  public async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId = `mobile-${Platform.OS}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
      }
      return deviceId;
    } catch {
      return `mobile-${Platform.OS}-${Date.now()}`;
    }
  }

  private parseAuthResponse(response: any): { user: User; accessToken: string; refreshToken?: string } {
    if (!response) {
      throw new Error('Empty authentication response from server.');
    }

    const payload = Array.isArray(response) ? response[0] : response;
    const userData = payload?.user || payload;
    const accessToken = payload?.accessToken || payload?.access_token || payload?.token || payload?.auth_token || userData?.authToken || userData?.auth_token;
    const refreshToken = payload?.refreshToken || payload?.refresh_token;
    if (typeof accessToken !== 'string' || !accessToken.trim() || !userData?.id) {
      throw new Error('The server did not return a valid login session. Please try again.');
    }
    const userObj: User = { ...parseUser(userData), authToken: accessToken };
    return { user: userObj, accessToken, refreshToken };
  }

  private async saveSession(user: User, accessToken?: string, refreshToken?: string): Promise<void> {
    this.sessionVersion++;
    this._user = user;
    if (accessToken) {
      this._authToken = accessToken;
    }
    if (refreshToken) {
      this._refreshToken = refreshToken;
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, encryptData(refreshToken));
    }

    try {
      const sessionJson = JSON.stringify({
        user: this._user,
        authToken: this._authToken,
        refreshToken: this._refreshToken,
      });
      await AsyncStorage.setItem(SESSION_KEY, encryptData(sessionJson));
      await AsyncStorage.setItem(LAST_ACTIVE_KEY, new Date().toISOString());
      setupPushNotifications(this._authToken || undefined).catch(() => {});
    } catch (e) {
      console.warn('saveSession error:', e);
    }
    this.notify();
  }

  public async refreshProfile(): Promise<User | null> {
    if (!this._authToken) return this._user;

    // Direct REST auth/profile endpoint
    try {
      const result = await ApiClient.getApi('auth/profile', { userToken: this._authToken });
      const userData = Array.isArray(result) ? result[0] : (result?.data || result?.user || result);
      if (userData && (userData.id || userData.fullName || userData.full_name || userData.phone)) {
        const parsed = parseUser(userData);
        const updated: User = {
          ...this._user,
          ...parsed,
          packageName: parsed.packageName || this._user?.packageName,
          isBuy: parsed.isBuy !== undefined && parsed.isBuy !== null && parsed.isBuy !== 0 ? parsed.isBuy : (this._user?.isBuy ?? parsed.isBuy),
          expiryDate: parsed.expiryDate || this._user?.expiryDate,
          authToken: this._authToken,
        };
        await this.saveSession(updated, this._authToken, this._refreshToken || undefined);
        return updated;
      }
    } catch (e) {
      console.warn('refreshProfile via auth/profile notice:', e);
      try {
        const result = await ApiClient.getApi('profiles', { userToken: this._authToken });
        if (Array.isArray(result) && result.length > 0) {
          const primaryProfile = result[0];
          const updated: User = {
            ...this._user,
            id: this._user?.id,
            fullName: primaryProfile.name || this._user?.fullName,
            image: primaryProfile.avatarUrl || this._user?.image,
            packageName: this._user?.packageName,
            isBuy: this._user?.isBuy,
            expiryDate: this._user?.expiryDate,
          };
          await this.saveSession(updated, this._authToken, this._refreshToken || undefined);
          return updated;
        }
      } catch (fallbackErr) {
        console.warn('refreshProfile fallback error:', fallbackErr);
      }
    }
    return this._user;
  }

  public async sendMobileOtp(
    mobile: string,
    isResend: boolean = false,
    isRegister: boolean = false,
    referral?: { referenceCode?: string; agentCode?: string }
  ): Promise<{ success: boolean; message: string }> {
    const cleanMobile = mobile.trim();
    const e164 = cleanMobile.startsWith('+') ? cleanMobile : `+91${cleanMobile.replace(/\D/g, '')}`;
    const endpoint = isResend ? 'auth/resend-otp' : 'auth/send-otp';

    // Backend send-otp may wait on MSG91 Flow + fallback (up to ~40s); allow enough time on real devices/networks.
    const agentCode = (referral?.agentCode || referral?.referenceCode || '').trim().toUpperCase() || undefined;
    const response = await ApiClient.postApi(
      endpoint,
      {
        identifier: e164,
        phone: e164,
        mode: isRegister ? 'register' : 'login',
        isRegister,
        ...(agentCode ? { agentCode } : {}),
      },
      { timeoutMs: 60000 },
    );
    const msg = typeof response === 'string'
      ? response
      : (response?.data || response?.message || `Verification OTP sent to ${e164} via SMS.`);
    return { success: true, message: msg };
  }

  public async loginWithMobileOtp(
    mobile: string,
    otp: string,
    fullName?: string,
    extra?: {
      firstName?: string;
      lastName?: string;
      email?: string;
      referenceCode?: string;
      reference_code?: string;
      agentCode?: string;
      isRegistration?: boolean;
    }
  ): Promise<User> {
    const deviceId = await this.getDeviceId();
    const cleanMobile = mobile.trim();
    const e164 = cleanMobile.startsWith('+') ? cleanMobile : `+91${cleanMobile.replace(/\D/g, '')}`;
    const refCode = extra?.referenceCode || extra?.reference_code || extra?.agentCode || undefined;

    // Backend Redis OTP Verification
    const payload: Record<string, any> = {
      identifier: e164,
      phone: e164,
      otp: otp.trim(),
      mode: extra?.isRegistration ? 'register' : 'login',
      isRegister: extra?.isRegistration === true,
      deviceId,
      platform: Platform.OS.toUpperCase(),
    };
    const fn = (fullName || '').trim();
    const first = (extra?.firstName || '').trim();
    const last = (extra?.lastName || '').trim();
    const email = (extra?.email || '').trim();
    const ref = (refCode || '').trim().toUpperCase();
    if (fn) payload.fullName = fn;
    if (first) payload.firstName = first;
    if (last) payload.lastName = last;
    if (email) payload.email = email;
    if (ref) payload.agentCode = ref;

    const result = await ApiClient.postApi('auth/verify-otp', payload);

    const { user, accessToken, refreshToken } = this.parseAuthResponse(result);
    await this.saveSession(user, accessToken, refreshToken);
    return user;
  }

  public async loginWithEmail(email: string, pass: string): Promise<User> {
    const identifier = email.trim();
    const result = await ApiClient.postApi('auth/login', {
      identifier,
      email: identifier,
      username: identifier,
      password: pass.trim(),
    });
    const { user, accessToken, refreshToken } = this.parseAuthResponse(result);
    await this.saveSession(user, accessToken, refreshToken);
    return user;
  }

  public async loginWithDemoUser(): Promise<User> {
    return this.loginWithEmail('subscriber@maxxpixels.com', 'SubscriberPass#2026');
  }

  public async register(params: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    mobileNumber?: string;
    phone?: string;
    password?: string;
    agentCode?: string;
    referenceCode?: string;
  }): Promise<User> {
    const deviceId = await this.getDeviceId();
    const fullName =
      params.fullName?.trim() ||
      [params.firstName, params.lastName].filter(Boolean).join(' ').trim() ||
      undefined;
    const rawPhone = (params.mobileNumber || params.phone || '').trim();
    const phone = rawPhone
      ? rawPhone.startsWith('+')
        ? rawPhone
        : `+91${rawPhone.replace(/\D/g, '')}`
      : undefined;
    const agentCode = (params.agentCode || params.referenceCode || '').trim().toUpperCase() || undefined;

    const result = await ApiClient.postApi('auth/register', {
      email: params.email?.trim() || undefined,
      phone,
      mobile: phone,
      mobileNumber: phone,
      mobile_number: phone,
      phoneNumber: phone,
      phone_number: phone,
      fullName,
      full_name: fullName,
      firstName: params.firstName?.trim() || undefined,
      first_name: params.firstName?.trim() || undefined,
      lastName: params.lastName?.trim() || undefined,
      last_name: params.lastName?.trim() || undefined,
      password: params.password,
      agentCode,
      agent_code: agentCode,
      referenceCode: agentCode,
      reference_code: agentCode,
      deviceId,
      device_id: deviceId,
      platform: Platform.OS.toUpperCase(),
    });
    const { user, accessToken, refreshToken } = this.parseAuthResponse(result);
    await this.saveSession(user, accessToken, refreshToken);
    return user;
  }

  public async updateProfile(params: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    dateOfBirth?: string;
    dob?: string;
    profession?: string;
    pincode?: string;
    image?: string;
    imageBase64?: string;
    imageFile?: {
      uri: string;
      name?: string;
      type?: string;
      base64?: string;
    };
  }): Promise<User> {
    if (!this._user) throw new Error('You must be signed in to update your profile.');
    
    const name = params.fullName || [params.firstName, params.lastName].filter(Boolean).join(' ') || this._user.fullName;
    const email = params.email !== undefined ? params.email.trim() : this._user.email;
    const dob = params.dateOfBirth || params.dob || this._user.dateOfBirth || this._user.dob;
    const profession = params.profession || this._user.profession;
    const pincode = params.pincode || this._user.pincode;
    let avatar = params.image || params.imageBase64 || this._user.image;

    try {
      const base64Data = params.imageBase64 || params.imageFile?.base64;
      const payload: any = {
        userId: this._user.id,
        fullName: name,
        email: email,
        dateOfBirth: dob,
        profession: profession,
        pincode: pincode,
      };

      if (base64Data) {
        payload.avatarBase64 = base64Data;
        payload.imageType = params.imageFile?.type || 'image/jpeg';
      } else if (avatar && !avatar.startsWith('file:') && !avatar.startsWith('content:')) {
        payload.avatarUrl = avatar;
      }

      const response = await ApiClient.putApi('profile', payload);

      if (response) {
        const profileObj = Array.isArray(response)
          ? response[0]
          : (response?.result?.[0] || response?.data?.[0] || response?.user || response?.result || response?.data || response);
        const resolvedAvatar = profileObj?.image || profileObj?.avatarUrl || profileObj?.avatar_url;
        if (resolvedAvatar && !resolvedAvatar.startsWith('file:') && !resolvedAvatar.startsWith('content:')) {
          avatar = AppConfig.normalizeMediaUrl(resolvedAvatar);
        }
      }
    } catch (e: any) {
      console.warn('Backend update_profile error:', e?.message || e);
      throw e instanceof Error ? e : new Error(e?.message || 'Failed to update profile.');
    }

    const updatedUser: User = {
      ...this._user,
      fullName: name,
      email: email,
      dateOfBirth: dob,
      dob: dob,
      profession: profession,
      pincode: pincode,
      image: avatar || this._user.image,
    };

    await this.saveSession(updatedUser, this._authToken || undefined, this._refreshToken || undefined);
    return updatedUser;
  }

  public isSubscriptionActive(user?: User | null): boolean {
    const target = user !== undefined ? user : this._user;
    if (!target) return false;
    const rawBuy =
      target.isBuy ??
      (target as any).is_buy ??
      (target as any).is_buy_package ??
      ((target as any).isSubscribed || (target as any).is_subscribed || (target as any).subscribed || (target as any).subscription?.status === 'ACTIVE' ? 1 : 0);
    const isBuy = Number(rawBuy);
    if (isBuy !== 1) return false;

    const expStr =
      target.expiryDate ||
      (target as any).expire_date ||
      (target as any).expiry_date ||
      (target as any).endDate ||
      (target as any).end_date ||
      (target as any).subscription?.endDate;

    if (expStr) {
      const exp = new Date(expStr).getTime();
      if (!isNaN(exp) && exp < Date.now()) {
        return false;
      }
    }
    return true;
  }

  public async setSubscribedPlan(planName: string, expiryDate?: string): Promise<void> {
    if (!this._user) return;
    const updatedUser: User = {
      ...this._user,
      packageName: planName,
      isBuy: 1,
      expiryDate: expiryDate || this._user.expiryDate,
    };
    await this.saveSession(updatedUser, this._authToken || undefined, this._refreshToken || undefined);
  }

  public async syncSubscription(): Promise<boolean> {
    const status = await this.syncSubscriptionStatus();
    return status.active;
  }

  /**
   * Authoritative subscription sync that reports whether the server was actually
   * reachable. Unlike syncSubscription(), callers can distinguish
   * "server says not subscribed" (ok=true, active=false) from a failed request
   * (ok=false) — e.g. to avoid demoting a locally-purchased subscription on
   * network/server errors.
   */
  public async syncSubscriptionStatus(): Promise<{ ok: boolean; active: boolean }> {
    if (!this._authToken) return { ok: false, active: false };
    try {
      const result = await ApiClient.getApi('payments/my-subscription', { userToken: this._authToken });
      const sub = Array.isArray(result) ? result[0] : (result?.data || result?.subscription || result);
      if (sub) {
        const isBuy =
          Number(sub.is_buy ?? sub.isBuy) === 1 ||
          sub.isSubscribed === true ||
          sub.is_subscribed === true ||
          sub.status === 'ACTIVE' ||
          sub.subscription?.status === 'ACTIVE'
            ? 1
            : 0;
        const packageName =
          sub.package_name ||
          sub.packageName ||
          sub.plan_name ||
          sub.planName ||
          sub.subscription?.plan?.name ||
          this._user?.packageName ||
          (isBuy ? 'VIP Membership' : 'Free Plan');
        const expiryDate =
          sub.expire_date ||
          sub.expiry_date ||
          sub.expiryDate ||
          sub.end_date ||
          sub.endDate ||
          sub.expires_at ||
          sub.subscription?.endDate;

        // Demotion guard: don't erase a locally-recorded ACTIVE purchase unless
        // the server can prove it has expired. A stale/misconfigured backend that
        // reports isSubscribed=false (e.g. without the coupon-order fulfillment
        // fix) would otherwise re-prompt the paywall on every app launch.
        const localActive = this.isSubscriptionActive(this._user);
        if (isBuy === 0 && localActive) {
          const serverExpiryMs = expiryDate ? new Date(expiryDate).getTime() : NaN;
          const serverProvesExpired = !isNaN(serverExpiryMs) && serverExpiryMs < Date.now();
          if (!serverProvesExpired) {
            return { ok: true, active: true };
          }
        }

        if (this._user) {
          const updatedUser: User = {
            ...this._user,
            isBuy,
            packageName,
            expiryDate: expiryDate || this._user.expiryDate,
          };
          await this.saveSession(updatedUser, this._authToken, this._refreshToken || undefined);
          return { ok: true, active: this.isSubscriptionActive(updatedUser) };
        }
        return { ok: true, active: isBuy === 1 };
      }
      return { ok: true, active: false };
    } catch (e) {
      console.warn('AuthService.syncSubscription error:', e);
      return { ok: false, active: this.isSubscriptionActive() };
    }
  }

  public async logout(): Promise<void> {
    try {
      if (this._refreshToken) {
        await ApiClient.postApi('auth/logout', { refreshToken: this._refreshToken }).catch(() => {});
      }
    } catch {}

    this.sessionVersion++;
    this._user = null;
    this._authToken = null;
    this._refreshToken = null;
    await AsyncStorage.removeItem(SESSION_KEY);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem(LAST_ACTIVE_KEY);
    this.notify();
  }
}

export const AuthService = new AuthServiceClass();
