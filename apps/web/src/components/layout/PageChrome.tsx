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
    <div className={cn('relative min-h-screen overflow-hidden pb-20 pt-8 md:pt-12', className)}>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[#0C111B]" />
      <div className={cn('mx-auto w-full px-4 sm:px-6 lg:px-12', narrow ? 'max-w-4xl' : 'max-w-[1500px]')}>
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
  eyebrow = 'MaxxPixels',
  title,
  description,
  backHref,
  backLabel = 'Back',
  icon: Icon = Sparkles,
  children,
}: PageHeroProps) {
  return (
    <section className="relative mb-10 border-b border-white/[0.07] pb-8 pt-2 sm:pb-10 lg:mb-12">
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="mb-7 inline-flex items-center gap-2 text-xs font-bold text-white/40 transition hover:text-white"
          >
            <ArrowLeft size={15} />
            {backLabel}
          </Link>
        )}
        <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-primary-light">
          <Icon size={13} />
          {eyebrow}
        </div>
        <h1 className="max-w-5xl font-display text-[clamp(2.35rem,5vw,4.75rem)] font-black leading-[0.96] tracking-[-0.055em] text-white text-balance">
          {title}
        </h1>
        {description && (
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/48 sm:text-base">{description}</p>
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

export function EmptyState({ title, description, actionHref, actionLabel, icon: Icon = Sparkles }: EmptyStateProps) {
  return (
    <div className="mx-auto my-14 max-w-md rounded-2xl border border-white/[0.08] bg-[#111827] p-8 text-center">
      <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-white/[0.06] text-primary-light">
        <Icon size={26} />
      </div>
      <p className="font-display text-xl font-black text-white">{title}</p>
      {description && <p className="mt-2 text-sm leading-6 text-desc-text">{description}</p>}
      {actionHref && actionLabel && (
        <Link href={actionHref} className="btn-primary mt-6 rounded-full px-6 py-3 text-sm">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

export function GlassPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-white/[0.08] bg-[#111827] p-5 sm:p-6', className)}>
      {children}
    </div>
  );
}
