import ContentDetailPage from '@/components/detail/ContentDetailPage';
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
  const description = String(content?.shortDescription || content?.description || `Stream ${title} full series and episodes online on MaxxPixels.`);
  const image = String(content?.backdropUrl || content?.posterUrl || '/logo.png');
  const canonicalUrl = `/shows/${content?.slug || params.slug}`;

  return {
    title: `${title} - Watch Web Series Online | MaxxPixels`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${title} - Watch on MaxxPixels`,
      description,
      type: 'video.tv_show',
      url: canonicalUrl,
      images: [
        {
          url: image,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} - Watch on MaxxPixels`,
      description,
      images: [image],
    },
  };
}

export default async function ShowDetailSlugPage({ params }: { params: { slug: string } }) {
  const content = (await fetchContentDetailServer(params.slug)) as any;
  const title = String(content?.title || content?.name || params.slug);
  const description = String(content?.shortDescription || content?.description || '');
  const image = String(content?.backdropUrl || content?.posterUrl || '/logo.png');

  const jsonLd = content ? {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    name: title,
    description: description,
    image: image,
    datePublished: content.releaseDate || (content.releaseYear ? `${content.releaseYear}-01-01` : undefined),
    inLanguage: content.originalLanguage || 'Kannada',
    numberOfSeasons: content.totalSeasons || 1,
    numberOfEpisodes: content.totalEpisodes || undefined,
    genre: Array.isArray(content.genres)
      ? content.genres.map((g: any) => (typeof g === 'string' ? g : g?.name || g?.slug || '')).filter(Boolean).join(', ')
      : undefined,
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ContentDetailPage slug={params.slug} contentType="series" videoType={2} />
    </>
  );
}
