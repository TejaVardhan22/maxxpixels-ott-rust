import { AuthService } from './authService';

export interface ErrorContext {
  screen?: string;
  action?: string;
  userId?: number | string;
  extra?: Record<string, any>;
}

class ErrorTrackerService {
  private initialized = false;

  public init() {
    if (this.initialized) return;
    this.initialized = true;

    const g = globalThis as any;
    // 1. Global JS Exception Handler
    const defaultHandler = g.ErrorUtils?.getGlobalHandler?.();
    if (g.ErrorUtils) {
      g.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
        this.recordError(error, {
          action: isFatal ? 'FATAL_GLOBAL_ERROR' : 'NON_FATAL_GLOBAL_ERROR',
        });
        if (defaultHandler) {
          defaultHandler(error, isFatal);
        }
      });
    }

    // 2. Global Unhandled Promise Rejection Handler
    if (typeof g.addEventListener === 'function') {
      g.addEventListener('unhandledrejection', (event: any) => {
        const reason = event?.reason || event;
        this.recordError(reason, { action: 'UNHANDLED_PROMISE_REJECTION' });
      });
    }

    console.log('[ErrorTracker] Initialized Mobile Error Monitoring Pipeline.');
  }

  public recordError(error: any, context?: ErrorContext) {
    const errorMsg = error instanceof Error ? error.message : String(error || 'Unknown Error');
    const stack = error instanceof Error ? error.stack : undefined;
    const userId = context?.userId || AuthService.user?.id || 'guest';
    const timestamp = new Date().toISOString();

    const report = {
      timestamp,
      userId,
      message: errorMsg,
      stack,
      screen: context?.screen,
      action: context?.action,
      extra: context?.extra,
    };

    if (__DEV__) {
      console.warn('🔴 [MOBILE ERROR TRACKER]', JSON.stringify(report, null, 2));
    } else {
      try {
        console.error('[PROD ERROR REPORT]', JSON.stringify(report));
      } catch (e) {}
    }
  }

  public logEvent(eventName: string, params?: Record<string, any>) {
    const userId = AuthService.user?.id || 'guest';
    const payload = {
      eventName,
      userId,
      timestamp: new Date().toISOString(),
      ...params,
    };

    if (__DEV__) {
      console.log('📊 [MOBILE RUM EVENT]', payload);
    }
  }
}

export const ErrorTracker = new ErrorTrackerService();
