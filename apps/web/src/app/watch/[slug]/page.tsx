import UniversalWatchExperience from '@/components/player/UniversalWatchExperience';

export default function WatchSlugPage({ params }: { params: { slug: string } }) {
  return <UniversalWatchExperience slug={params.slug} />;
}
