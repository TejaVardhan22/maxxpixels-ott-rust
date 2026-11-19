import ContentDetailPage from '@/components/detail/ContentDetailPage';

export default function MovieSlugPage({ params }: { params: { slug: string } }) {
  return <ContentDetailPage slug={params.slug} contentType="movie" videoType={1} />;
}
