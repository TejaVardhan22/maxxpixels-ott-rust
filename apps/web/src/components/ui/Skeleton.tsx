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
    <div className="relative w-full h-[56vh] sm:h-[70vh] lg:h-[88vh] -mt-[68px] bg-surface overflow-hidden">
      <div className="shimmer absolute inset-0" />
      {/* Fake hero content */}
      <div className="absolute bottom-24 left-4 sm:left-12 space-y-4 animate-pulse">
        <div className="w-48 h-3 bg-white/10 rounded" />
        <div className="w-80 h-10 bg-white/10 rounded-md" />
        <div className="w-64 h-4 bg-white/10 rounded" />
        <div className="flex gap-3 mt-6">
          <div className="w-28 h-11 bg-white/10 rounded-md" />
          <div className="w-28 h-11 bg-white/10 rounded-md" />
        </div>
      </div>
    </div>
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
