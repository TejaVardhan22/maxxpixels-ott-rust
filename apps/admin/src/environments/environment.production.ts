const runtimeEnv = (typeof window !== 'undefined' ? (window as any).__ENV__ : {}) || {};

export const environment = {
  production: true,
  apiHost: runtimeEnv.API_HOST || '',
  apiBaseUrl: runtimeEnv.API_BASE_URL || '/api/v1',
  appName: runtimeEnv.APP_NAME || 'MaxxPixels OTT Admin'
};
