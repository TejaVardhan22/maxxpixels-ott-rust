import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiClient } from './apiClient';

export class SettingsService {
  private static readonly KEY_WIFI_ONLY = 'settings_wifi_only';
  private static readonly KEY_AUTOPLAY = 'settings_autoplay';
  private static readonly KEY_PUSH_NOTIFICATIONS = 'settings_push_notifications';
  private static readonly KEY_VIDEO_QUALITY = 'settings_video_quality';
  private static readonly KEY_CELLULAR_DATA = 'settings_cellular_data';
  private static readonly KEY_PLAYER_THEME = 'settings_player_theme';

  // Default values
  private static _wifiOnly = false;
  private static _autoplay = true;
  private static _pushNotifications = true;
  private static _videoQuality = 'High'; // High, Medium, Low
  private static _cellularData = 'Automatic'; // Automatic, Save Data
  private static _playerTheme = 'netflix'; // netflix, hotstar
  private static _remoteSettings: Record<string, string> = {};

  public static async init(): Promise<void> {
    try {
      const [wifiOnly, autoplay, push, quality, cellular, theme] = await Promise.all([
        AsyncStorage.getItem(this.KEY_WIFI_ONLY),
        AsyncStorage.getItem(this.KEY_AUTOPLAY),
        AsyncStorage.getItem(this.KEY_PUSH_NOTIFICATIONS),
        AsyncStorage.getItem(this.KEY_VIDEO_QUALITY),
        AsyncStorage.getItem(this.KEY_CELLULAR_DATA),
        AsyncStorage.getItem(this.KEY_PLAYER_THEME),
      ]);

      if (wifiOnly !== null) this._wifiOnly = wifiOnly === 'true';
      if (autoplay !== null) this._autoplay = autoplay === 'true';
      if (push !== null) this._pushNotifications = push === 'true';
      if (quality !== null) this._videoQuality = quality;
      if (cellular !== null) this._cellularData = cellular;
      if (theme !== null) this._playerTheme = theme;

      // Fetch remote system settings from backend
      await this.refreshRemoteSettings();
    } catch (e) {
      console.warn('SettingsService.init error:', e);
    }
  }

  public static async refreshRemoteSettings(): Promise<Record<string, string>> {
    try {
      const remote = await ApiClient.getApi('settings');
      if (remote && typeof remote === 'object') {
        const data = (remote as any).data ?? (remote as any).result ?? remote;
        if (data && typeof data === 'object') {
          const nested = (data as any).settings;
          this._remoteSettings =
            nested && typeof nested === 'object' && !Array.isArray(nested)
              ? { ...data, ...nested }
              : data;
        }
      }
    } catch {}
    return this._remoteSettings;
  }

  public static getMaintenanceStatus(): {
    active: boolean;
    message: string;
    appName: string;
    logoUrl: string;
  } {
    const raw =
      this.getRemoteSetting('maintenanceMode') ||
      this.getRemoteSetting('maintenance_mode') ||
      this.getRemoteSetting('maintenance_mode_enabled') ||
      'false';
    const norm = raw.trim().toLowerCase();
    const active = norm === 'true' || norm === '1' || norm === 'yes' || norm === 'on';
    const message =
      this.getRemoteSetting('maintenanceMessage') ||
      this.getRemoteSetting('maintenance_message') ||
      'We are currently performing scheduled maintenance to improve your experience. Please check back shortly.';
    const brand = this.getBrandIdentity();
    return {
      active,
      message,
      appName: brand.name || 'MaxxPixels',
      logoUrl: brand.darkLogoUrl || brand.logoUrl || '',
    };
  }

  public static get wifiOnly(): boolean {
    return this._wifiOnly;
  }

  public static get autoplay(): boolean {
    return this._autoplay;
  }

  public static get pushNotifications(): boolean {
    return this._pushNotifications;
  }

  public static get videoQuality(): string {
    return this._videoQuality;
  }

  public static get cellularData(): string {
    return this._cellularData;
  }

  public static get playerTheme(): string {
    return this._playerTheme;
  }

  public static getRemoteSetting(key: string, defaultValue: string = ''): string {
    const value: unknown = this._remoteSettings[key];
    // Backend may return booleans/numbers (e.g. admob_enabled: false); coerce safely.
    if (value === undefined || value === null || value === '') return defaultValue;
    return String(value);
  }

  public static getBrandIdentity(): {
    name: string;
    shortName: string;
    logoUrl: string;
    darkLogoUrl: string;
    description: string;
    supportEmail: string;
    supportPhone: string;
  } {
    const pick = (...keys: string[]): string => {
      for (const k of keys) {
        const v = this.getRemoteSetting(k);
        if (v) return v;
      }
      return '';
    };
    const shortName = pick('app_short_name', 'appShortName', 'app_name', 'appName', 'platform_name') || 'MaxxPixels';
    const name = pick('app_name', 'appName', 'platform_name', 'app_short_name', 'appShortName') || shortName;
    const darkLogoUrl = pick('darkLogoUrl', 'dark_logo_url', 'logoUrl', 'logo_url', 'APP_LOGO_URL', 'app_logo');
    const logoUrl = pick('logoUrl', 'logo_url', 'APP_LOGO_URL', 'darkLogoUrl', 'dark_logo_url', 'app_logo');
    return {
      name,
      shortName,
      logoUrl,
      darkLogoUrl,
      description: pick('seo_description', 'seoDescription', 'app_description'),
      supportEmail: pick('support_email', 'supportEmail'),
      supportPhone: pick('support_phone', 'supportPhone'),
    };
  }

  public static async setWifiOnly(val: boolean): Promise<void> {
    this._wifiOnly = val;
    await AsyncStorage.setItem(this.KEY_WIFI_ONLY, String(val));
  }

  public static async setAutoplay(val: boolean): Promise<void> {
    this._autoplay = val;
    await AsyncStorage.setItem(this.KEY_AUTOPLAY, String(val));
  }

  public static async setPushNotifications(val: boolean): Promise<void> {
    this._pushNotifications = val;
    await AsyncStorage.setItem(this.KEY_PUSH_NOTIFICATIONS, String(val));
  }

  public static async setVideoQuality(val: string): Promise<void> {
    this._videoQuality = val;
    await AsyncStorage.setItem(this.KEY_VIDEO_QUALITY, val);
  }

  public static async setCellularData(val: string): Promise<void> {
    this._cellularData = val;
    await AsyncStorage.setItem(this.KEY_CELLULAR_DATA, val);
  }

  public static async setPlayerTheme(val: string): Promise<void> {
    this._playerTheme = val;
    await AsyncStorage.setItem(this.KEY_PLAYER_THEME, val);
  }

  public static async clearCache(): Promise<void> {
    throw new Error('Manage cached files from your device app settings.');
  }
}
