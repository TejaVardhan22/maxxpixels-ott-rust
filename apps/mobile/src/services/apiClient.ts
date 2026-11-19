import { AppConfig } from '../core/config';

export interface ApiRequestOptions {
  userToken?: string;
  queryParams?: Record<string, any>;
  timeoutMs?: number;
  headers?: Record<string, string>;
  isFormUrlEncoded?: boolean;
}

export class ApiClient {
  private static userTokenGetter?: () => string | undefined;
  private static sessionRefresher?: () => Promise<boolean>;
  private static unauthorizedHandler?: () => void | Promise<void>;

  public static setSessionRefresher(refresher: () => Promise<boolean>) {
    this.sessionRefresher = refresher;
  }

  public static setAuthTokenGetter(getter: () => string | undefined) {
    this.userTokenGetter = getter;
  }

  public static setUnauthorizedHandler(handler: () => void | Promise<void>) {
    this.unauthorizedHandler = handler;
  }

  public static getUserToken(): string | undefined {
    return this.userTokenGetter ? this.userTokenGetter() : undefined;
  }

  private static encodeFormBody(body: Record<string, any>): string {
    return Object.entries(body)
      .map(([key, value]) => {
        const encodedKey = encodeURIComponent(key);
        const encodedVal = encodeURIComponent(value !== undefined && value !== null ? String(value) : '');
        return `${encodedKey}=${encodedVal}`;
      })
      .join('&');
  }

  private static buildUrl(path: string, queryParams?: Record<string, any>): string {
    const cleanPath = path.replace(/^\/+/, '');
    let url = `${AppConfig.apiBaseUrl}/${cleanPath}`;

    if (queryParams && Object.keys(queryParams).length > 0) {
      const queryStr = Object.entries(queryParams)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      if (queryStr.length > 0) {
        url = `${url}?${queryStr}`;
      }
    }
    return url;
  }

  private static buildHeaders(options?: ApiRequestOptions, isJson: boolean = true): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': isJson ? 'application/json' : 'application/x-www-form-urlencoded',
      ...(options?.headers || {}),
    };

    const tokenToUse = options?.userToken || this.getUserToken();
    if (tokenToUse) {
      headers['Authorization'] = tokenToUse.startsWith('Bearer ') ? tokenToUse : `Bearer ${tokenToUse}`;
    }

    return headers;
  }

  private static async executeRequest(
    method: string,
    path: string,
    body?: any,
    options?: ApiRequestOptions,
    retried = false
  ): Promise<any> {
    const url = this.buildUrl(path, options?.queryParams);
    const isForm = options?.isFormUrlEncoded === true;
    const headers = this.buildHeaders(options, !isForm);

    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (isFormData) {
      delete headers['Content-Type'];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs || 25000);

    const requestInit: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };

    if (body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD') {
      if (isFormData) {
        requestInit.body = body;
      } else if (isForm && typeof body === 'object') {
        requestInit.body = this.encodeFormBody(body);
      } else if (typeof body === 'string') {
        requestInit.body = body;
      } else {
        requestInit.body = JSON.stringify(body);
      }
    }

    try {
      const response = await fetch(url, requestInit);
      clearTimeout(timeoutId);

      const responseText = await response.text();
      let payload: any = null;
      if (responseText && responseText.trim().length > 0) {
        try {
          payload = JSON.parse(responseText);
        } catch {
          payload = responseText;
        }
      }

      const isAuthPath = path.replace(/^\/+/, '').startsWith('auth/');
      if (response.status === 401 && !retried && !isAuthPath && this.getUserToken()) {
        let refreshed = false;
        if (this.sessionRefresher) {
          try {
            refreshed = await this.sessionRefresher();
          } catch {
            refreshed = false;
          }
        }
        if (refreshed) {
          return this.executeRequest(method, path, body, { ...options, userToken: this.getUserToken() }, true);
        }
        // Unrecoverable auth failure (expired/invalid token and refresh failed or unavailable)
        try {
          await this.unauthorizedHandler?.();
        } catch {}
        const sessionErr: any = new Error('Session expired. Please sign in again.');
        sessionErr.isSessionExpired = true;
        sessionErr.status = 401;
        sessionErr.originalMessage =
          payload && typeof payload === 'object'
            ? payload.message || payload.error || payload.errors
            : payload;
        throw sessionErr;
      }

      if (!response.ok || payload?.success === false || (typeof payload?.status === 'number' && payload.status >= 400)) {
        let errorMsg = `API request failed with HTTP ${response.status}`;
        if (payload && typeof payload === 'object') {
          errorMsg = payload.message || payload.error || payload.errors || errorMsg;
        }
        if (typeof errorMsg === 'string') {
          const lower = errorMsg.toLowerCase();
          // Keep technical/internal details out of user-facing messages, except for auth/session expiry.
          if (
            lower.includes('ambiguous') ||
            lower.includes('handler') ||
            lower.includes('internal error') ||
            lower.includes('exception') ||
            lower.includes('sql')
          ) {
            errorMsg = 'Unable to complete your request at this time. Please try again shortly.';
          } else if (response.status >= 500) {
            // Keep meaningful server messages for 5xx; fall back to generic only when absent.
            const hasSpecificMessage =
              payload &&
              typeof payload === 'object' &&
              typeof payload.message === 'string' &&
              payload.message.trim().length > 0 &&
              payload.message.trim() !== errorMsg.trim();
            if (!hasSpecificMessage && errorMsg === `API request failed with HTTP ${response.status}`) {
              errorMsg = 'Unable to complete your request at this time. Please try again shortly.';
            }
          }
        } else if (response.status >= 500) {
          errorMsg = 'Unable to complete your request at this time. Please try again shortly.';
        }
        const err: any = new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
        err.status = response.status;
        err.payload = payload;
        throw err;
      }

      if (payload && typeof payload === 'object') {
        if (payload.data !== undefined) {
          if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
            if (Array.isArray((payload.data as any).content)) {
              return (payload.data as any).content;
            }
            if (Array.isArray((payload.data as any).result)) {
              return (payload.data as any).result;
            }
          }
          return payload.data;
        }
        if (payload.result !== undefined) {
          if (payload.result && typeof payload.result === 'object' && !Array.isArray(payload.result)) {
            if (Array.isArray((payload.result as any).content)) {
              return (payload.result as any).content;
            }
          }
          return payload.result;
        }
      }

      return payload;
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        throw new Error('Request timed out. Please verify server connection.');
      }
      throw new Error(e.message || 'Network request failed');
    }
  }

  public static async getApi(path: string, options?: ApiRequestOptions): Promise<any> {
    return this.executeRequest('GET', path, undefined, options);
  }

  public static async postApi(path: string, body?: any, options?: ApiRequestOptions): Promise<any> {
    return this.executeRequest('POST', path, body, options);
  }

  public static async putApi(path: string, body?: any, options?: ApiRequestOptions): Promise<any> {
    return this.executeRequest('PUT', path, body, options);
  }

  public static async deleteApi(path: string, options?: ApiRequestOptions): Promise<any> {
    return this.executeRequest('DELETE', path, undefined, options);
  }

  public static async patchApi(path: string, body?: any, options?: ApiRequestOptions): Promise<any> {
    return this.executeRequest('PATCH', path, body, options);
  }

  public static async executeGraphQL<T = any>(
    query: string,
    variables?: Record<string, any>,
    options?: ApiRequestOptions
  ): Promise<T> {
    const url = AppConfig.graphqlUrl;
    const headers = this.buildHeaders(options, true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeoutMs || 25000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await response.json();
      if (json.errors && json.errors.length > 0) {
        const errorMsg = json.errors[0]?.message || 'GraphQL Query Execution Error';
        throw new Error(errorMsg);
      }
      return json.data as T;
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        throw new Error('GraphQL request timed out. Please check network.');
      }
      throw e;
    }
  }

  public static async graphqlQuery<T = any>(
    query: string,
    variables?: Record<string, any>,
    options?: ApiRequestOptions
  ): Promise<T> {
    return this.executeGraphQL<T>(query, variables, options);
  }
}
