'use client';

import { PageHero, PageShell } from '@/components/layout/PageChrome';
import { Users } from 'lucide-react';
import Link from 'next/link';

export default function CastHubPage() {
  return (
    <PageShell>
      <PageHero
        backHref="/"
        backLabel="Back to Home"
        eyebrow="Talent & Artists"
        title="Cast & Crew"
        description="Discover celebrated actors, directors, writers, and artists across Kannada and Indian cinema."
        icon={Users}
      />
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center max-w-xl mx-auto">
        <Users size={40} className="mx-auto mb-3 text-primary-light" />
        <h2 className="text-xl font-bold font-display text-white mb-2">Explore Filmographies</h2>
        <p className="text-sm text-white/60 mb-6">
          Click on any actor or artist profile while exploring movie and show detail pages to see their complete filmography.
        </p>
        <Link
          href="/search"
          className="btn-primary inline-flex rounded-full px-6 py-2.5 text-xs font-bold uppercase tracking-wider"
        >
          Search Talent
        </Link>
      </div>
    </PageShell>
  );
}
