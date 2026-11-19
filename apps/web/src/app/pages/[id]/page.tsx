'use client';

import { useParams } from 'next/navigation';
import { FileText } from 'lucide-react';
import { usePages, type PageItem } from '@ott/shared';
import { EmptyState, GlassPanel, PageHero, PageShell } from '@/components/layout/PageChrome';

export default function AdminPageDetail() {
  const params = useParams<{ id: string }>();
  const pagesQ = usePages();
  const pageId = Number(params.id);
  const page = (pagesQ.data?.result ?? []).find(
    (item: PageItem) => Number(item.id) === pageId,
  );

  if (pagesQ.isLoading) {
    return (
      <PageShell narrow>
        <div className="min-h-[55vh] animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />
      </PageShell>
    );
  }

  if (!page) {
    return (
      <PageShell narrow>
        <EmptyState
          title="Page not found"
          description="This page is unavailable or has been disabled in the admin panel."
          actionHref="/about"
          actionLabel="View All Pages"
          icon={FileText}
        />
      </PageShell>
    );
  }

  return (
    <PageShell narrow>
      <PageHero
        backHref="/about"
        backLabel="All Pages"
        eyebrow="MaxxPixels"
        title={page.title ?? 'Page'}
        description={page.page_subtitle}
        icon={FileText}
      />
      <GlassPanel className="overflow-hidden p-0">
        {page.icon && (
          <img
            src={page.icon}
            alt=""
            className="max-h-72 w-full border-b border-white/10 object-cover"
          />
        )}
        <article
          className="px-5 py-6 text-sm leading-7 text-body-text sm:px-8 sm:py-9
            [&_a]:text-gold [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-gold
            [&_blockquote]:pl-4 [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-black [&_h1]:text-white
            [&_h2]:mb-3 [&_h2]:mt-7 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:text-white
            [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-white
            [&_li]:mb-2 [&_ol]:mb-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-4
            [&_table]:mb-5 [&_table]:w-full [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:pl-6"
          dangerouslySetInnerHTML={{
            __html: page.description || '<p>No content has been added to this page.</p>',
          }}
        />
      </GlassPanel>
    </PageShell>
  );
}
