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
  const description = String(content?.shortDescription || content?.description || `Watch ${title} in HD/4K on MaxxPixels. Stream movies, originals, and entertainment.`);
  const image = String(content?.backdropUrl || content?.posterUrl || '/logo.png');
  const canonicalUrl = `/movies/${content?.slug || params.slug}`;

  return {
    title: `${title} - Watch Full Movie Online | MaxxPixels`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${title} - Watch on MaxxPixels`,
      description,
      type: 'video.movie',
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

export default async function MovieDetailSlugPage({ params }: { params: { slug: string } }) {
  const content = (await fetchContentDetailServer(params.slug)) as any;
  const title = String(content?.title || content?.name || params.slug);
  const description = String(content?.shortDescription || content?.description || '');
  const image = String(content?.backdropUrl || content?.posterUrl || '/logo.png');

  const jsonLd = content ? {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: title,
    description: description,
    image: image,
    datePublished: content.releaseDate || (content.releaseYear ? `${content.releaseYear}-01-01` : undefined),
    inLanguage: content.originalLanguage || 'Kannada',
    duration: content.durationMinutes ? `PT${content.durationMinutes}M` : undefined,
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
      <ContentDetailPage slug={params.slug} contentType="movie" videoType={1} />
    </>
  );
}
