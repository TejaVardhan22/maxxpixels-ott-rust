/**
 * Server-only OTT API fetch (RSC / Route Handlers).
 * Uses native fetch with Next.js Data Cache — no shared axios client / global config.
 */

import type { ApiListResponse, Banner, Category, ContentItem, Section } from '@ott/shared';
import { normalizeApiBaseUrl } from '@ott/shared';
import {
  executeWebGraphQL,
  WEB_CONTENT_DETAIL_GRAPHQL_QUERY,
  WEB_HOME_GRAPHQL_QUERY,
} from './graphql-client';

const REVALIDATE_SEC = 15;
const API_TIMEOUT_MS = 10_000;

function mapToBackendEndpoint(path: string): { targetPath: string; method: 'GET' | 'POST' } {
  const clean = path.replace(/^\/+/, '');

  switch (clean) {
    case 'banner':
    case 'banners':
    case 'cms/banners':
      return { targetPath: 'cms/banners', method: 'GET' };
    case 'sections':
    case 'cms/sections':
      return { targetPath: 'cms/sections', method: 'GET' };
    case 'categories':
      return { targetPath: 'categories', method: 'GET' };
    case 'types':
    case 'content-types':
      return { targetPath: 'content-types', method: 'GET' };
    case 'search':
      return { targetPath: 'search', method: 'GET' };
    case 'settings':
    case 'social_links':
    case 'social-links':
      return { targetPath: 'settings', method: 'GET' };
    case 'legal':
    case 'pages':
      return { targetPath: 'legal', method: 'GET' };
    case 'packages':
    case 'plans':
      return { targetPath: 'plans', method: 'GET' };
    default:
      return { targetPath: clean, method: 'GET' };
  }
}

function apiUrl(path: string): string {
  const rawPublicBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const rawServerBase = process.env.API_BACKEND_URL?.trim();
  const raw =
    rawServerBase ||
    (rawPublicBase && !rawPublicBase.startsWith('/')
      ? rawPublicBase
      : 'http://127.0.0.1:8080/api/v1');

  const base = normalizeApiBaseUrl(raw);
  const p = path.replace(/^\//, '');
  return `${base}/${p}`;
}

export async function serverPostJson<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const { targetPath, method } = mapToBackendEndpoint(path);
  let url = apiUrl(targetPath);

  if (method === 'GET' && body && Object.keys(body).length > 0) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && v !== null && v !== '') {
        qs.set(k, String(v));
      }
    }
    const queryStr = qs.toString();
    if (queryStr) {
      url = `${url}?${queryStr}`;
    }
  }

  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
    next: { revalidate: REVALIDATE_SEC },
  };

  if (method === 'POST') {
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OTT API ${path} failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const rawJson = await res.json();
  const data = rawJson.data ?? rawJson.result ?? rawJson;
  const unwrapped = data && typeof data === 'object' && Array.isArray((data as any).content)
    ? (data as any).content
    : data;

  if (Array.isArray(unwrapped) || (unwrapped && typeof unwrapped === 'object')) {
    return {
      status: 200,
      message: rawJson.message || 'Success',
      result: unwrapped,
      data: unwrapped,
    } as unknown as T;
  }

  return rawJson as Promise<T>;
}

export type HomeInitialData = {
  banners?: ApiListResponse<Banner[]>;
  sections?: ApiListResponse<Section[]>;
  categories?: ApiListResponse<Category[]>;
  latest?: ApiListResponse<ContentItem[]>;
};

/**
 * Parallel fetch for home page (guest). Uses Go GraphQL single round-trip first with REST fallback.
 */
export async function fetchHomeInitialData(): Promise<HomeInitialData> {
  try {
    const gql = await executeWebGraphQL<{
      home?: { banners?: Banner[]; sections?: Section[]; categories?: Category[] };
      browse?: { items?: ContentItem[] };
    }>(WEB_HOME_GRAPHQL_QUERY, { platform: 'WEB', language: '' });

    if (gql?.home || gql?.browse) {
      const wrap = <T,>(arr: T[]): ApiListResponse<T[]> => ({
        status: 200,
        message: 'Success',
        result: arr,
      });
      return {
        banners: wrap(gql.home?.banners ?? []),
        sections: wrap(gql.home?.sections ?? []),
        categories: wrap(gql.home?.categories ?? []),
        latest: wrap(gql.browse?.items ?? []),
      };
    }
  } catch {
    // Fall back to REST below
  }

  try {
    const [banners, sections, categories, latest] = await Promise.all([
      serverPostJson<ApiListResponse<Banner[]>>('cms/banners', { platform: 'WEB' }),
      serverPostJson<ApiListResponse<Section[]>>('cms/sections'),
      serverPostJson<ApiListResponse<Category[]>>('categories'),
      serverPostJson<ApiListResponse<ContentItem[]>>('search', { q: '', size: 100 }),
    ]);
    return { banners, sections, categories, latest };
  } catch (e: any) {
    const code = e?.code || e?.cause?.code;
    if (code === 'ECONNREFUSED') {
      // Backend is offline or build-time prerendering; client fetches on mount
      return {};
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('Set NEXT_PUBLIC_API_BASE_URL or API_BACKEND_URL')) {
      console.warn('[fetchHomeInitialData] Backend unavailable:', msg);
    }
    return {};
  }
}

/**
 * Server fetch for content detail (for SSR, metadata, Schema.org JSON-LD).
 * Uses Go GraphQL first (single round-trip with seasons & episodes) with REST fallback.
 */
export async function fetchContentDetailServer(idOrSlug: string): Promise<ContentItem | null> {
  if (!idOrSlug) return null;
  try {
    const gql = await executeWebGraphQL<{ content?: ContentItem }>(
      WEB_CONTENT_DETAIL_GRAPHQL_QUERY,
      { idOrSlug },
    );
    if (gql?.content && ((gql.content as any).id || (gql.content as any).title)) {
      return gql.content;
    }
  } catch {
    // Fall back to REST below
  }
  try {
    const res = await serverPostJson<any>(`content/${encodeURIComponent(idOrSlug)}`);
    const raw = res?.result ?? res?.data ?? res;
    if (raw && (raw.id || raw.name || raw.title)) {
      return raw as ContentItem;
    }
  } catch {
    // If not found, return null so caller falls back gracefully
  }
  return null;
}
