import { MetadataRoute } from 'next';
import { serverPostJson } from '@/lib/ott-api-server';
import type { ApiListResponse, Category, ContentItem } from '@ott/shared';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://maxxpixels.com';
  const now = new Date();

  const routes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/movies`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/shows`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/genres`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/legal/privacy-policy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/legal/terms-of-use`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/legal/refund-policy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  try {
    const res = await serverPostJson<ApiListResponse<ContentItem[]>>('search', { q: '', size: 200 });
    const items = res?.result ?? [];
    for (const item of items) {
      const rawItem = item as any;
      const slug = rawItem.slug || rawItem.id;
      if (!slug) continue;
      const isSeries = rawItem.contentType === 'SERIES' || rawItem.videoType === 2;
      const path = isSeries ? `/shows/${slug}` : `/movies/${slug}`;
      const updatedAt = rawItem.updatedAt || rawItem.created_at ? new Date(String(rawItem.updatedAt || rawItem.created_at)) : now;

      routes.push({
        url: `${baseUrl}${path}`,
        lastModified: updatedAt,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  } catch (err: any) {
    if (err?.code !== 'ECONNREFUSED' && err?.cause?.code !== 'ECONNREFUSED') {
      console.warn('[sitemap] Catalog items not available at build time');
    }
  }

  try {
    const catRes = await serverPostJson<ApiListResponse<Category[]>>('categories', {});
    const categories = catRes?.result ?? [];
    for (const cat of categories) {
      const rawCat = cat as any;
      const slug = rawCat.slug || String(rawCat.id);
      if (!slug) continue;
      routes.push({
        url: `${baseUrl}/genres/${slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }
  } catch (err: any) {
    if (err?.code !== 'ECONNREFUSED' && err?.cause?.code !== 'ECONNREFUSED') {
      console.warn('[sitemap] Categories not available at build time');
    }
  }

  return routes;
}
