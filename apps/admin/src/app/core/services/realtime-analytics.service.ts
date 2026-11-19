import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface LiveAnalyticsCounters {
  totalViews: number;
  uniqueViews24h: number;
  watchEvents24h: number;
  activeStreams: number;
  liveUsers: number;
  generatedAt: string;
}

/**
 * Subscribes the admin portal to the API's SSE counter stream.
 *
 * EventSource cannot attach an Authorization header, so the existing JWT is
 * passed as a query parameter on the dedicated stream route. Reconnect is
 * handled by EventSource; the dashboard polling timer remains as a fallback.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeAnalyticsService {
  connect(
    onCounters: (counters: LiveAnalyticsCounters) => void,
    onStatus?: (connected: boolean) => void,
  ): () => void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return () => {};
    }

    const token =
      localStorage.getItem('ott_access_token') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('token');
    if (!token) {
      return () => {};
    }

    const url = `${environment.apiBaseUrl}/admin/analytics/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    source.addEventListener('counters', (event: MessageEvent) => {
      try {
        onCounters(JSON.parse(event.data) as LiveAnalyticsCounters);
      } catch {
        // Ignore malformed frames; the next event will carry fresh counters.
      }
    });
    source.onopen = () => onStatus?.(true);
    source.onerror = () => onStatus?.(false);

    return () => source.close();
  }
}
