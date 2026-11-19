'use client';

import { usePages, type PageItem } from '@ott/shared';
import { EmptyState, GlassPanel, PageHero, PageShell } from '@/components/layout/PageChrome';
import { FileText, ChevronRight, Info } from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  const pagesQ = usePages();
  const raw = pagesQ.data as any;
  const pagesList: PageItem[] = (
    Array.isArray(raw?.result)
      ? raw.result
      : Array.isArray(raw)
      ? raw
      : []
  ).filter((p: PageItem) => Boolean(p && p.title));

  return (
    <PageShell narrow>
      <PageHero
        eyebrow="Company & Policies"
        title="About MaxxPixels"
        description="Official company policies, compliance documentation, terms, and community guidelines."
        icon={Info}
      />
      <GlassPanel className="mb-8 divide-y divide-white/10 p-0">
        {pagesList.map((p) => (
          <Link
            key={p.id}
            href={`/pages/${p.id}`}
            className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-white/[0.055]"
          >
            <div>
              <p className="text-sm font-bold text-white">{p.title}</p>
              {p.page_subtitle && (
                <p className="mt-0.5 text-xs text-desc-text">{p.page_subtitle}</p>
              )}
            </div>
            <ChevronRight size={18} className="text-gold" />
          </Link>
        ))}
        {pagesList.length === 0 && !pagesQ.isLoading && (
          <EmptyState
            title="No pages available"
            description="Policy and legal pages will appear here once configured."
            icon={FileText}
          />
        )}
      </GlassPanel>
    </PageShell>
  );
}

