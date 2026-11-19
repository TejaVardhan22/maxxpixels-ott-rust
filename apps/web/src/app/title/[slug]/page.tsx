import ContentDetailPage from '@/components/detail/ContentDetailPage';

export default function UniversalTitlePage({ params }: { params: { slug: string } }) {
  return <ContentDetailPage slug={params.slug} contentType="title" />;
}
