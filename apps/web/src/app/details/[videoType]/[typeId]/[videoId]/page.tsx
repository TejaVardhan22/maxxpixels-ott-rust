'use client';

import ContentDetailPage from '@/components/detail/ContentDetailPage';
import { useParams } from 'next/navigation';

export default function DetailPage() {
  const params = useParams<{ videoType?: string; typeId?: string; videoId?: string; slug?: string }>();
  return (
    <ContentDetailPage
      videoType={params?.videoType ? Number(params.videoType) : undefined}
      typeId={params?.typeId ? Number(params.typeId) : undefined}
      videoId={params?.videoId && !isNaN(Number(params.videoId)) ? Number(params.videoId) : undefined}
      slug={params?.slug || (params?.videoId && isNaN(Number(params.videoId)) && params?.videoId !== 'NaN' ? params?.videoId : undefined)}
    />
  );
}
