export interface OttApiConfig {
  baseUrl: string;
  apiToken?: string;
  investorBaseUrl?: string;
  timeoutMs?: number;
}

let runtimeConfig: OttApiConfig | null = null;

export function normalizeApiBaseUrl(baseUrl: string): string {
  const trimmed = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '/api/v1';
  if (trimmed === '/api/v1' || trimmed === '/api') return '/api/v1';

  try {
    const url = new URL(trimmed);
    if (!url.pathname.endsWith('/api/v1')) {
      if (url.pathname.endsWith('/api')) {
        url.pathname = `${url.pathname}/v1`;
      } else if (!url.pathname || url.pathname === '/') {
        url.pathname = '/api/v1';
      }
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    if (!trimmed.endsWith('/api/v1')) {
      return trimmed.endsWith('/api') ? `${trimmed}/v1` : `${trimmed}/api/v1`;
    }
    return trimmed;
  }
}

export function setApiConfig(config: OttApiConfig): void {
  runtimeConfig = {
    ...config,
    baseUrl: normalizeApiBaseUrl(config.baseUrl),
    investorBaseUrl: config.investorBaseUrl
      ? normalizeApiBaseUrl(config.investorBaseUrl)
      : config.investorBaseUrl,
  };
}

export function getApiConfigOrNull(): OttApiConfig | null {
  return runtimeConfig;
}

export function hasApiConfig(): boolean {
  return runtimeConfig !== null;
}

export function getApiConfig(): OttApiConfig {
  if (!runtimeConfig) {
    // Next.js proxies this path to the configured Express backend.
    return {
      baseUrl: '/api/v1',
      apiToken: 'SJJWq4c5fEeADaiZjEO8P9EeXhvvzsY2',
      timeoutMs: 20000,
    };
  }
  return runtimeConfig;
}
