import ByCategoryPage from '@/app/bycategory/[id]/page';
import type { Metadata } from 'next';

export const revalidate = 120;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const genreTitle = params.slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    title: `${genreTitle} Movies & Web Series - Stream Online | MaxxPixels`,
    description: `Browse and watch top ${genreTitle} movies, original web series, and short films on MaxxPixels.`,
    alternates: {
      canonical: `/genres/${params.slug}`,
    },
    openGraph: {
      title: `${genreTitle} Movies & Web Series | MaxxPixels`,
      description: `Browse and watch top ${genreTitle} movies, original web series, and short films on MaxxPixels.`,
      url: `/genres/${params.slug}`,
    },
  };
}

export default function GenreSlugPage() {
  return <ByCategoryPage />;
}
