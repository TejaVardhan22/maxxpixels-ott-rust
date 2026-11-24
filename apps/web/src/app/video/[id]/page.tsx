import { redirect } from 'next/navigation';
import { getContentUrl } from '@ott/shared';
import { ottServerGet } from '@/lib/ott-api-server';

export const dynamic = 'force-dynamic';

/**
 * Dynamic resolver for legacy `/video/[id]` URLs (e.g., from older CMS banners or shares).
 * Fetches the title metadata from the API and redirects to its canonical `/movies/...` or `/shows/...` route.
 */
export default async function LegacyVideoRedirectPage({
  params,
}: {
  params: { id: string };
}) {
  const id = String(params?.id ?? '').trim();
  if (!id) {
    redirect('/');
  }

  try {
    const res = await ottServerGet<any>(`/catalog/${encodeURIComponent(id)}`);
    const item = res?.data ?? res?.result ?? res;
    if (item && typeof item === 'object') {
      const target = getContentUrl({ ...item, id: item.id ?? id });
      if (target && target !== '/' && !target.startsWith('/video/')) {
        redirect(target);
      }
    }
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
  }

  redirect(`/movies/watch/${encodeURIComponent(id)}`);
}
