import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?:   'rect' | 'circle' | 'text';
}

export default function Skeleton({ className, variant = 'rect' }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'shimmer',
        variant === 'circle' && 'rounded-full',
        variant === 'text'   && 'rounded h-4',
        variant === 'rect'   && 'rounded-md',
        className,
      )}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="flex-shrink-0 w-[160px] space-y-2">
      <Skeleton className="w-full aspect-[2/3]" />
      <Skeleton variant="text" className="w-3/4 h-3" />
    </div>
  );
}

export function LandscapeCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-[260px] space-y-2">
      <Skeleton className="w-full aspect-video" />
      <Skeleton variant="text" className="w-2/3 h-3" />
    </div>
  );
}

export function BannerSkeleton() {
  return (
    <section className="relative w-full bg-[#0A0A0A] px-3 pb-3 pt-[104px] sm:px-6 sm:pt-[112px] lg:px-12 lg:pt-[82px]">
      <div className="relative mx-auto max-w-[1680px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#141414] min-h-[300px] sm:rounded-2xl sm:aspect-[16/9] sm:min-h-[380px] lg:aspect-[16/8.2] lg:max-h-[82svh]">
        <div className="shimmer absolute inset-0 opacity-60" />
        <div className="absolute bottom-6 left-4 sm:bottom-10 sm:left-11 space-y-3">
          <div className="h-3 w-32 sm:w-40 rounded bg-white/[0.07]" />
          <div className="h-8 w-52 sm:h-10 sm:w-72 rounded-md bg-white/[0.08]" />
          <div className="h-3.5 w-44 sm:h-4 sm:w-60 rounded bg-white/[0.06]" />
          <div className="mt-4 flex gap-2.5 sm:gap-3">
            <div className="h-9 w-24 sm:h-11 sm:w-28 rounded-full bg-white/[0.08]" />
            <div className="h-9 w-24 sm:h-11 sm:w-28 rounded-full bg-white/[0.06]" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function RailSkeleton({ landscape = false }: { landscape?: boolean }) {
  return (
    <div className="mt-10 px-4 sm:px-6 lg:px-12">
      <Skeleton variant="text" className="w-44 h-5 mb-4" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: landscape ? 5 : 8 }).map((_, i) =>
          landscape ? <LandscapeCardSkeleton key={i} /> : <CardSkeleton key={i} />,
        )}
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="w-full h-[50vh] bg-surface rounded-none" />
      <div className="page-section space-y-4">
        <div className="w-72 h-8 bg-surface rounded-md" />
        <div className="w-48 h-4 bg-surface rounded" />
        <div className="flex gap-3">
          <div className="w-28 h-11 bg-surface rounded-md" />
          <div className="w-28 h-11 bg-surface rounded-md" />
        </div>
        <div className="w-full h-20 bg-surface rounded-md" />
      </div>
    </div>
  );
}
