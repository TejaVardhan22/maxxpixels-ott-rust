import UniversalWatchExperience from '@/components/player/UniversalWatchExperience';

export default function MovieWatchWithIdPage({
  params,
}: {
  params: { slug: string; id: string };
}) {
  return (
    <UniversalWatchExperience
      slug={params.slug}
      contentId={Number(params.id)}
      contentType="movie"
    />
  );
}
