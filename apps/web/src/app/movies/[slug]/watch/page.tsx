import UniversalWatchExperience from '@/components/player/UniversalWatchExperience';
import { fetchContentDetailServer } from '@/lib/ott-api-server';
import type { Metadata } from 'next';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const content = (await fetchContentDetailServer(params.slug)) as any;
  const title = String(content?.title || content?.name || params.slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
  const description = String(content?.shortDescription || content?.description || `Stream ${title} now in high quality video and sound on MaxxPixels.`);
  return {
    title: `Watch ${title} Full Movie Online | MaxxPixels`,
    description,
    alternates: {
      canonical: `/movies/${content?.slug || params.slug}`,
    },
  };
}

export default function MovieWatchSlugPage({ params }: { params: { slug: string } }) {
  return <UniversalWatchExperience slug={params.slug} contentType="movie" />;
}
