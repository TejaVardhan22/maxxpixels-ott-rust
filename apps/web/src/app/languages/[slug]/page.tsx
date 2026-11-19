import ByLanguagePage from '@/app/bylanguage/[id]/page';
import type { Metadata } from 'next';

export const revalidate = 120;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const languageTitle = params.slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    title: `${languageTitle} Movies & Web Series | MaxxPixels`,
    description: `Stream the best ${languageTitle} movies, films, and series in 4K UHD on MaxxPixels.`,
    alternates: {
      canonical: `/languages/${params.slug}`,
    },
    openGraph: {
      title: `${languageTitle} Movies & Web Series | MaxxPixels`,
      description: `Stream the best ${languageTitle} movies, films, and series in 4K UHD on MaxxPixels.`,
      url: `/languages/${params.slug}`,
    },
  };
}

export default function LanguageSlugPage() {
  return <ByLanguagePage />;
}
