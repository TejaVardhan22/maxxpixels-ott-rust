import { redirect } from 'next/navigation';
import { getContentUrl } from '@ott/shared';
import { fetchContentDetailServer } from '@/lib/ott-api-server';

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

  const item = await fetchContentDetailServer(id);
  if (item) {
    const target = getContentUrl({ ...item, id: item.id ?? id });
    if (target && target !== '/' && !target.startsWith('/video/')) {
      redirect(target);
    }
  }

  redirect(`/movies/watch/${encodeURIComponent(id)}`);
}
