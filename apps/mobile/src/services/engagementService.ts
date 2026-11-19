import { ApiClient } from './apiClient';
import { AuthService } from './authService';

export class EngagementService {
  public static async addWatchlist(contentId: number | string, _videoType?: number): Promise<boolean> {
    try {
      await ApiClient.postApi(
        `watchlist/${contentId}`,
        { content_id: contentId, video_id: contentId },
        {
          userToken: AuthService.authToken || undefined,
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  public static async removeWatchlist(contentId: number | string, _videoType?: number): Promise<boolean> {
    try {
      await ApiClient.deleteApi(
        `watchlist/${contentId}`,
        {
          userToken: AuthService.authToken || undefined,
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  public static async getWatchlist(profileId?: number): Promise<any[]> {
    try {
      const result = await ApiClient.getApi('watchlist', {
        queryParams: { profileId },
        userToken: AuthService.authToken || undefined,
      });
      return Array.isArray(result) ? result : [];
    } catch {
      return [];
    }
  }

  public static async addContinueWatching(
    contentId: number | string,
    _videoType: number,
    stopTime: number,
    duration: number = 7200
  ): Promise<boolean> {
    try {
      await ApiClient.postApi(
        'playback/progress',
        {
          contentId: contentId,
          content_id: contentId,
          video_id: contentId,
          positionSeconds: Math.floor(stopTime),
          stop_time: Math.floor(stopTime),
          durationSeconds: Math.floor(duration),
          video_duration: Math.floor(duration),
        },
        { userToken: AuthService.authToken || undefined }
      );
      return true;
    } catch {
      return false;
    }
  }

  public static async getContinueWatching(profileId?: number): Promise<any[]> {
    const pId = profileId || AuthService.user?.id || 1;
    try {
      const result = await ApiClient.getApi(`profiles/${pId}/continue-watching`, {
        userToken: AuthService.authToken || undefined,
      });
      return Array.isArray(result) ? result : [];
    } catch {
      return [];
    }
  }
}
