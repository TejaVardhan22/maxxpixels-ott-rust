import { hasApiConfig, resetApiClient, setApiConfig } from '@ott/shared';

export function initApiFromEnv() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || '/api/v1';
  const investorBaseUrl = process.env.NEXT_PUBLIC_INVESTOR_API_BASE_URL?.trim();
  const apiToken = process.env.NEXT_PUBLIC_API_TOKEN?.trim() || '';
  if (!baseUrl) return false;

  if (hasApiConfig()) return true;

  setApiConfig({ baseUrl, investorBaseUrl, apiToken });
  resetApiClient();
  return true;
}

export function initApiFromEnvIsomorphic() {
  return initApiFromEnv();
}

initApiFromEnv();
