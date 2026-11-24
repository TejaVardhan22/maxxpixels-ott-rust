import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  narrow?: boolean;
}

export function PageShell({ children, className, narrow }: PageShellProps) {
  return (
    <div className={cn('relative min-h-screen overflow-hidden pb-24 pt-6 md:pt-10', className)}>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[#0A0A0A]" />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[440px] bg-[radial-gradient(ellipse_at_top,_rgba(255,109,46,0.09)_0%,_transparent_70%)]"
        aria-hidden
      />
      <div
        className={cn(
          'mx-auto w-full px-4 sm:px-6 lg:px-10',
          narrow ? 'max-w-4xl' : 'max-w-[1600px]',
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
}

export function PageHero({
  eyebrow,
  title,
  description,
  backHref,
  backLabel = 'Back',
  icon: Icon = Sparkles,
  children,
}: PageHeroProps) {
  return (
    <section className="relative mb-8 border-b border-white/[0.07] pb-7 pt-1 sm:pb-8 lg:mb-10">
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={14} />
            {backLabel}
          </Link>
        )}
        {eyebrow && (
          <div className="mb-2.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#FF8A54]">
            <Icon size={13} />
            <span>{eyebrow}</span>
          </div>
        )}
        <h1 className="max-w-4xl font-display text-3xl font-black leading-[1.08] tracking-tight text-white sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-[15px]">
            {description}
          </p>
        )}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  icon?: LucideIcon;
}

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  icon: Icon = Sparkles,
}: EmptyStateProps) {
  return (
    <div className="mx-auto my-14 max-w-md rounded-2xl border border-white/[0.08] bg-[#1E222A] p-8 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#FF6D2E]/15 text-[#FF8A54]">
        <Icon size={22} />
      </div>
      <p className="font-display text-lg font-bold text-white">{title}</p>
      {description && <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>}
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-6 text-sm font-bold text-white transition hover:brightness-110"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function GlassPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/[0.08] bg-[#1E222A]/90 p-5 backdrop-blur-xl sm:p-6',
        className,
      )}
    >
      {children}
    </div>
  );
}
