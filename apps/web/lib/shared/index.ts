export {
  setApiConfig,
  getApiConfig,
  getApiConfigOrNull,
  hasApiConfig,
  normalizeApiBaseUrl,
  type OttApiConfig,
} from './config';
export {
  getApiClient,
  resetApiClient,
  postJson,
  getJson,
  setUserToken,
  getUserToken,
} from './api/client';
export { OttApiError, normalizeAxiosError, type ApiErrorBody } from './api/errors';

export {
  authApi,
  catalogApi,
  engagementApi,
  paymentApi,
  payload,
  type SessionContext,
} from './api/services';

export {
  videoAccessApi,
  type PlayUrlResult,
  type SubscriptionStatus,
  type VideoMetadataResult,
  type TrailerApiResult,
} from './api/videoAccess';
export { resolveSecurePlayback, type SecurePlayback } from './api/playback';

export {
  adApi,
  type AdEntry,
  type AdQueue,
  type AdContext,
  type RecordImpressionParams,
  type RecordAdClickParams,
} from './api/adServices';

export * from './types/models';
export { queryKeys } from './queryKeys';

export * from './hooks/useAuth';
export * from './hooks/useCatalog';
export * from './hooks/useEngagement';
export * from './hooks/usePayment';
export { useSubscriptionStatus } from './hooks/useSubscriptionStatus';
export {
  useAdQueue,
  type AdPhase,
  type ActiveAd,
  type UseAdQueueOptions,
  type UseAdQueueReturn,
} from './hooks/useAdQueue';

export * from './utils/image';
export * from './utils/content';
export {
  checkPlaybackGate,
  type PlaybackGateResult,
} from './utils/playbackGate';
export * from './analytics-events';
