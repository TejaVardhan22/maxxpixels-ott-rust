import ContentDetailPage from '@/components/detail/ContentDetailPage';

export default function SeriesSlugPage({ params }: { params: { slug: string } }) {
  return <ContentDetailPage slug={params.slug} contentType="series" videoType={2} />;
}
