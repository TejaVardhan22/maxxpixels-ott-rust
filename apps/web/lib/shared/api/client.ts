import { getApiConfig } from '../config';
import { normalizeAxiosError, OttApiError } from './errors';

type ApiEnvelope = {
  success?: boolean;
  status?: number;
  message?: string;
  detail?: string;
  error?: { message?: string; code?: string };
  errors?: unknown;
  data?: unknown;
  result?: unknown;
  [key: string]: unknown;
};

type RequestConfig = {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

type ApiResponse<T> = {
  data: T;
  status: number;
};

type RequestBody = object | FormData;

type ApiClient = {
  get<T>(path: string, config?: RequestConfig): Promise<ApiResponse<T>>;
  post<T>(
    path: string,
    data?: RequestBody,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>>;
  put<T>(
    path: string,
    data?: RequestBody,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>>;
  delete<T>(path: string, config?: RequestConfig): Promise<ApiResponse<T>>;
};

let client: ApiClient | null = null;

// Per-user JWT token - set after login, cleared on logout
let _userToken: string | null = null;

export function setUserToken(token: string | null): void {
  _userToken = token;
  resetApiClient();
}

export function getUserToken(): string | null {
  return _userToken;
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  let suffix = path.replace(/^\/+/, '');
  if (base.endsWith('/api/v1') && suffix.startsWith('api/v1/')) {
    suffix = suffix.slice('api/v1/'.length);
  } else if (base.endsWith('/api') && suffix.startsWith('api/')) {
    suffix = suffix.slice('api/'.length);
  }
  return `${base}/${suffix}`;
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
}

function buildUrl(path: string, config?: RequestConfig): string {
  const cfg = getApiConfig();
  const url = new URL(joinUrl(cfg.baseUrl, path), typeof window === 'undefined' ? 'https://api.maxxpixels.com' : window.location.origin);
  const params = config?.params;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function buildHeaders(extra?: Record<string, string>, hasBody = false): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(extra ?? {}),
  };
  if (_userToken) {
    headers['Authorization'] = _userToken.startsWith('Bearer ') ? _userToken : `Bearer ${_userToken}`;
  }
  return headers;
}

async function parseResponseBody<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await response.json();
    return json as T;
  }
  return (await response.text()) as T;
}

function firstErrorMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstErrorMessage(item);
      if (message) return message;
    }
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const message = firstErrorMessage(item);
      if (message) return message;
    }
  }
  return '';
}

function mapEndpoint(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE'): { mappedPath: string; mappedMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' } {
  const clean = path.replace(/^\/+/, '');
  return { mappedPath: clean, mappedMethod: method };
}

async function performRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  data?: RequestBody,
  config?: RequestConfig,
): Promise<ApiResponse<T>> {
  const { mappedPath, mappedMethod } = mapEndpoint(path, method);
  const controller = new AbortController();
  const timeoutMs = config?.timeoutMs ?? getApiConfig().timeoutMs ?? 20_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const signal = config?.signal ?? controller.signal;
  const hasBody = (mappedMethod === 'POST' || mappedMethod === 'PUT') && !(data instanceof FormData);

  try {
    const response = await fetch(buildUrl(mappedPath, config), {
      method: mappedMethod,
      headers: buildHeaders(normalizeHeaders(config?.headers), hasBody),
      signal,
      body:
        (mappedMethod === 'POST' || mappedMethod === 'PUT')
          ? data instanceof FormData
            ? data
            : JSON.stringify(data ?? {})
          : undefined,
    });

    const body = (await parseResponseBody<T | ApiEnvelope>(response)) as T;

    if (!response.ok) {
      if (response.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('ott:auth-expired'));
      }

      const envelope = body as ApiEnvelope;
      const message =
        (typeof envelope?.message === 'string' && envelope.message) ||
        (typeof envelope?.detail === 'string' && envelope.detail) ||
        (typeof envelope?.error?.message === 'string' && envelope.error.message) ||
        firstErrorMessage(envelope?.errors) ||
        firstErrorMessage(envelope) ||
        `Request failed with status ${response.status}`;
      throw new OttApiError(String(message), response.status, envelope);
    }

    return { data: body, status: response.status };
  } catch (err) {
    if (err instanceof OttApiError) throw err;
    if ((err as { name?: string }).name === 'AbortError') {
      throw new OttApiError(`Request timed out after ${timeoutMs}ms`, 408);
    }
    throw normalizeAxiosError({
      message: err instanceof Error ? err.message : 'Request failed',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function createClient(): ApiClient {
  return {
    get<T>(path: string, config?: RequestConfig) {
      return performRequest<T>('GET', path, undefined, config);
    },
    post<T>(path: string, data?: RequestBody, config?: RequestConfig) {
      return performRequest<T>('POST', path, data, config);
    },
    put<T>(path: string, data?: RequestBody, config?: RequestConfig) {
      return performRequest<T>('PUT', path, data, config);
    },
    delete<T>(path: string, config?: RequestConfig) {
      return performRequest<T>('DELETE', path, undefined, config);
    },
  };
}

export function getApiClient(): ApiClient {
  if (!client) {
    client = createClient();
  }
  return client;
}

export function resetApiClient(): void {
  client = null;
}

function normalizeDataResponse<T>(resData: any): T {
  const body = resData as ApiEnvelope;
  if (!body || typeof body !== 'object') return resData as T;
  if (
    typeof body.status === 'number' &&
    body.status >= 400
  ) {
    const message =
      body.message ||
      (typeof body.errors === 'string'
        ? body.errors
        : Array.isArray(body.errors) && typeof body.errors[0] === 'string'
          ? body.errors[0]
          : 'Request failed');
    throw new OttApiError(String(message), body.status, resData);
  }

  // Handle PagedResponse nested in data or result
  const payloadTarget = (body.data && typeof body.data === 'object') ? body.data : (body.result && typeof body.result === 'object') ? body.result : body;
  if (payloadTarget && typeof payloadTarget === 'object' && Array.isArray((payloadTarget as any).content)) {
    const paged = payloadTarget as any;
    const items = paged.content || paged.items || [];
    return {
      status: body.status ?? 200,
      message: body.message || 'Success',
      result: items,
      data: items,
      total_rows: paged.total_rows ?? paged.totalRows ?? paged.totalElements ?? items.length,
      total_page: paged.total_page ?? paged.totalPages ?? (paged.totalPages !== undefined ? paged.totalPages : 1),
      current_page: paged.current_page ?? paged.currentPage ?? paged.page ?? 1,
      more_page: paged.more_page ?? paged.morePage ?? paged.hasMore ?? (paged.last !== undefined ? !paged.last : false),
    } as unknown as T;
  }

  if ('result' in body && body.result !== undefined) {
    if (Array.isArray(body.result)) {
      return {
        status: body.status ?? 200,
        message: body.message || 'Success',
        result: body.result,
        data: body.result,
        total_rows: (body as any).total_rows ?? (body as any).totalRows ?? (body as any).totalElements ?? body.result.length,
        total_page: (body as any).total_page ?? (body as any).totalPages ?? 1,
        current_page: (body as any).current_page ?? (body as any).currentPage ?? 1,
        more_page: (body as any).more_page ?? (body as any).morePage ?? (body as any).hasMore ?? false,
      } as unknown as T;
    }
    return resData as T;
  }
  if (body.data !== undefined) {
    if (Array.isArray(body.data)) {
      return {
        status: body.status ?? 200,
        message: body.message || 'Success',
        result: body.data,
        data: body.data,
        total_rows: (body as any).total_rows ?? (body as any).totalRows ?? (body as any).totalElements ?? body.data.length,
        total_page: (body as any).total_page ?? (body as any).totalPages ?? 1,
        current_page: (body as any).current_page ?? (body as any).currentPage ?? 1,
        more_page: (body as any).more_page ?? (body as any).morePage ?? (body as any).hasMore ?? false,
      } as unknown as T;
    }
    return body.data as T;
  }
  return resData as T;
}

export async function getJson<T>(path: string, config?: RequestConfig): Promise<T> {
  const res = await getApiClient().get<T>(path, config);
  return normalizeDataResponse<T>(res.data);
}

export async function postJson<T>(
  path: string,
  data?: RequestBody,
  config?: RequestConfig,
): Promise<T> {
  const res = await getApiClient().post<T>(path, data, config);
  return normalizeDataResponse<T>(res.data);
}

export async function putJson<T>(
  path: string,
  data?: RequestBody,
  config?: RequestConfig,
): Promise<T> {
  const res = await getApiClient().put<T>(path, data, config);
  return normalizeDataResponse<T>(res.data);
}

export async function deleteJson<T>(path: string, config?: RequestConfig): Promise<T> {
  const res = await getApiClient().delete<T>(path, config);
  return normalizeDataResponse<T>(res.data);
}

