import ContentDetailPage from '@/components/detail/ContentDetailPage';
import { fetchContentDetailServer } from '@/lib/ott-api-server';
import type { Metadata } from 'next';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: { slug: string; id: string };
}): Promise<Metadata> {
  const content = (await fetchContentDetailServer(params.slug || params.id)) as any;
  const title = String(content?.title || content?.name || params.slug);
  const description = String(content?.shortDescription || content?.description || `Watch ${title} on MaxxPixels.`);
  const canonicalUrl = `/shows/${content?.slug || params.slug}`;

  return {
    title: `${title} - Watch Web Series Online | MaxxPixels`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default function ShowDetailWithIdPage({
  params,
}: {
  params: { slug: string; id: string };
}) {
  return (
    <ContentDetailPage
      slug={params.slug}
      videoId={Number(params.id)}
      contentType="series"
      videoType={2}
    />
  );
}
