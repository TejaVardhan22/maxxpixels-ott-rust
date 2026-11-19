import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiClient } from './apiClient';
import { AuthService } from './authService';
import { AppConfig } from '../core/config';

export interface BackendNotification {
  id: number;
  title: string;
  message: string;
  image?: string;
  created_at?: string;
  is_read?: number;
}

type CountListener = (count: number) => void;

class NotificationServiceClass {
  private static readonly KEY_CLEARED_IDS = '@maxxpixels_cleared_notifs';
  private static readonly KEY_READ_IDS = '@maxxpixels_read_notifs';

  private _unreadCount = 0;
  private listeners: Set<CountListener> = new Set();
  private _clearedIds: Set<number> = new Set();
  private _readIds: Set<number> = new Set();
  private _initialized = false;

  public get unreadCount(): number {
    return this._unreadCount;
  }

  public subscribeCount(listener: CountListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l(this._unreadCount));
  }

  private async loadPersistedIds(): Promise<void> {
    if (this._initialized) return;
    try {
      const [clearedJson, readJson] = await Promise.all([
        AsyncStorage.getItem(NotificationServiceClass.KEY_CLEARED_IDS),
        AsyncStorage.getItem(NotificationServiceClass.KEY_READ_IDS),
      ]);
      if (clearedJson) {
        const arr = JSON.parse(clearedJson);
        if (Array.isArray(arr)) {
          this._clearedIds = new Set(arr.map(Number));
        }
      }
      if (readJson) {
        const arr = JSON.parse(readJson);
        if (Array.isArray(arr)) {
          this._readIds = new Set(arr.map(Number));
        }
      }
      this._initialized = true;
    } catch (e) {
      console.warn('[NotificationService] Error loading persisted notification IDs:', e);
    }
  }

  public async getBackendNotifications(): Promise<BackendNotification[]> {
    if (!AuthService.authToken) return [];

    await this.loadPersistedIds();

    try {
      const result = await ApiClient.getApi('notifications', {
        userToken: AuthService.authToken || undefined,
      });

      if (Array.isArray(result)) {
        const allNotifications: BackendNotification[] = result.map((item: any) => {
          const id = Number(item.id || item.notification_id || 0);
          const isRead = this._readIds.has(id) || Boolean(item.read) || Number(item.is_read) === 1;
          return {
            id,
            title: item.title || item.name || 'MaxxPixels Alert',
            message: item.message || item.description || '',
            image: AppConfig.normalizeMediaUrl(item.imageUrl || item.image || item.actionUrl),
            created_at: item.createdAt || item.date || item.created_at,
            is_read: isRead ? 1 : 0,
          };
        });

        // Filter out notifications permanently cleared by the user
        const activeNotifications = allNotifications.filter(
          (n) => n.id === 0 || !this._clearedIds.has(n.id)
        );

        this._unreadCount = activeNotifications.filter((n) => !n.is_read).length;
        this.notify();
        return activeNotifications;
      }
    } catch (e) {
      console.warn('[NotificationService] Failed to fetch notifications:', e);
    }

    return [];
  }

  public async markBackendNotificationRead(notificationId: number): Promise<void> {
    await this.loadPersistedIds();
    if (notificationId) {
      this._readIds.add(notificationId);
      try {
        await AsyncStorage.setItem(
          NotificationServiceClass.KEY_READ_IDS,
          JSON.stringify(Array.from(this._readIds))
        );
      } catch {}

      // Notify backend using REST endpoint
      ApiClient.postApi(`notifications/${notificationId}/read`, {}, {
        userToken: AuthService.authToken || undefined,
      }).catch(() => {});
    }

    if (this._unreadCount > 0) {
      this._unreadCount--;
      this.notify();
    }
  }

  public async clearNotification(notificationId: number): Promise<void> {
    await this.loadPersistedIds();
    const wasUnread = !!notificationId && !this._readIds.has(notificationId);
    if (notificationId) {
      this._clearedIds.add(notificationId);
      this._readIds.add(notificationId);
      try {
        await Promise.all([
          AsyncStorage.setItem(
            NotificationServiceClass.KEY_CLEARED_IDS,
            JSON.stringify(Array.from(this._clearedIds))
          ),
          AsyncStorage.setItem(
            NotificationServiceClass.KEY_READ_IDS,
            JSON.stringify(Array.from(this._readIds))
          ),
        ]);
      } catch {}

      // Notify backend using REST endpoint
      ApiClient.postApi(`notifications/${notificationId}/read`, {}, {
        userToken: AuthService.authToken || undefined,
      }).catch(() => {});
    }

    if (wasUnread && this._unreadCount > 0) {
      this._unreadCount = Math.max(0, this._unreadCount - 1);
      this.notify();
    }
  }

  public async clearAllNotifications(notificationsToClear: BackendNotification[] = []): Promise<void> {
    await this.loadPersistedIds();
    notificationsToClear.forEach((n) => {
      if (n.id) {
        this._clearedIds.add(n.id);
        this._readIds.add(n.id);
      }
    });

    try {
      await Promise.all([
        AsyncStorage.setItem(
          NotificationServiceClass.KEY_CLEARED_IDS,
          JSON.stringify(Array.from(this._clearedIds))
        ),
        AsyncStorage.setItem(
          NotificationServiceClass.KEY_READ_IDS,
          JSON.stringify(Array.from(this._readIds))
        ),
      ]);
    } catch {}

    this._unreadCount = 0;
    this.notify();
  }
}

export const NotificationService = new NotificationServiceClass();
