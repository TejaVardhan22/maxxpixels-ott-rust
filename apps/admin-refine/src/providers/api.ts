export const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";
export const TOKEN_KEY = "admin_token";
export const USER_KEY = "admin_user";

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function resolveUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/api/")) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const isForm = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...authHeaders(isForm ? {} : { "Content-Type": "application/json" }),
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(resolveUrl(path), { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    if (!window.location.pathname.includes("/login")) {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text };
  }
  if (!res.ok) {
    throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
  }
  return (json?.data !== undefined ? json.data : json?.result !== undefined ? json.result : json) as T;
}

export const apiGet = <T = any>(path: string) => apiRequest<T>(path, { method: "GET" });
export const apiPost = <T = any>(path: string, body?: any) =>
  apiRequest<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined });
export const apiPut = <T = any>(path: string, body?: any) =>
  apiRequest<T>(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined });
export const apiDelete = <T = any>(path: string) => apiRequest<T>(path, { method: "DELETE" });

export async function apiUpload(path: string, file: File, fieldName = "file"): Promise<any> {
  const fd = new FormData();
  fd.append(fieldName, file);
  return apiRequest(path, { method: "POST", body: fd });
}

export function extractArray<T = any>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.logs)) return data.logs;
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.result)) return data.result;
  return [];
}
