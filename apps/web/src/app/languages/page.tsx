'use client';

import { useLanguages, type Language, getLanguageUrl } from '@ott/shared';
import { EmptyState, PageHero, PageShell } from '@/components/layout/PageChrome';
import { Globe } from 'lucide-react';
import Link from 'next/link';

const FEATURED_PORTALS = [
  {
    name: 'Kannada Hub',
    subtitle: 'Exclusive Sandalwood Cinema, Web Series & Shows',
    href: '/languages/kannada',
    badge: 'Flagship Kannada Portal',
    bg: 'from-red-950/80 via-red-900/30 to-black',
    border: 'border-red-500/30 hover:border-red-500',
  },
  {
    name: 'All Indian Languages',
    subtitle: 'Telugu, Tamil, Malayalam, Hindi & Regional Pan-India Hits',
    href: '/languages/all-indian',
    badge: 'Pan-Indian Content Hub',
    bg: 'from-amber-950/80 via-amber-900/30 to-black',
    border: 'border-amber-500/30 hover:border-amber-500',
  },
];

export default function LanguagesHubPage() {
  const languagesQ = useLanguages();
  const languages = (languagesQ.data?.result ?? []) as Language[];

  return (
    <PageShell>
      <PageHero
        backHref="/"
        backLabel="Back to Home"
        eyebrow="Browse by language"
        title="Languages"
        description="Stream movies, original series, and shows in your mother tongue with studio master audio."
        icon={Globe}
      />

      {/* Featured Portals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {FEATURED_PORTALS.map((portal) => (
          <Link
            key={portal.name}
            href={portal.href}
            className={`group rounded-2xl border ${portal.border} bg-gradient-to-br ${portal.bg} p-6 transition-all duration-300 hover:scale-[1.02] shadow-xl`}
          >
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-white/10 text-white/90 mb-3">
              {portal.badge}
            </span>
            <h2 className="text-xl sm:text-2xl font-black font-display text-white mb-1.5">
              {portal.name}
            </h2>
            <p className="text-xs sm:text-sm text-white/70">
              {portal.subtitle}
            </p>
          </Link>
        ))}
      </div>

      {/* Language Pills / Cards */}
      <h3 className="text-sm font-black uppercase tracking-widest text-white/40 mb-4">
        All Languages
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {languages.map((lang) => (
          <Link
            key={lang.id}
            href={getLanguageUrl(lang as any)}
            className="group rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center transition-all duration-200 hover:border-primary/50 hover:bg-primary/10"
          >
            <p className="font-display font-bold text-white text-base group-hover:text-primary-light">
              {lang.name}
            </p>
            <p className="text-[11px] text-white/40 mt-1">Explore titles &rarr;</p>
          </Link>
        ))}
      </div>

      {languages.length === 0 && !languagesQ.isLoading && (
        <EmptyState
          title="No languages found"
          description="Languages will appear here once configured."
          actionHref="/"
          actionLabel="Back Home"
          icon={Globe}
        />
      )}
    </PageShell>
  );
}
