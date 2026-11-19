'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useContentByLanguage, useLanguages, useLatestCatalog } from '@ott/shared';
import CatalogGrid from '@/components/browse/CatalogGrid';
import { EmptyState, PageHero, PageShell } from '@/components/layout/PageChrome';
import { Globe2 } from 'lucide-react';
import { useStoredUser } from '@/lib/auth';

function isAiContentItem(item: any): boolean {
  if (!item) return false;
  const tId = Number(item.type_id || item.typeId || item.video_type || item.type || 0);
  if (tId === 7) return true;
  const contentType = String(item.content_type || '').toUpperCase();
  if (contentType === 'AI_CINEMA' || contentType === 'AI') return true;
  const title = String(item.title || item.name || '').toLowerCase();
  if (title.startsWith('ai ') || title.includes(' ai cinema') || title.includes('ai movie') || title.includes('ai series')) return true;
  const genres = Array.isArray(item.genres) ? item.genres : [];
  if (genres.some((g: string) => String(g).toLowerCase().includes('ai cinema') || String(g).toLowerCase() === 'ai')) return true;
  return false;
}

function extractLanguageString(item: any): string {
  if (!item) return '';
  if (Array.isArray(item.languages) && item.languages.length > 0) {
    const joined = item.languages
      .map((l: any) => (typeof l === 'string' ? l : l?.name || l?.code || ''))
      .join(' ')
      .trim();
    if (joined) return joined.toLowerCase();
  }
  let lang =
    item.language_name ||
    item.language ||
    item.originalLanguage ||
    item.original_language_code ||
    item.original_language ||
    item.originalLanguageCode ||
    '';
  if (typeof lang === 'object' && lang !== null) {
    lang = lang.name || lang.code || lang.language || '';
  }
  const lId = Number(item.languageId || item.language_id || 0);
  if (!lang && lId > 0) {
    if (lId === 1 || lId === 6) return 'kannada';
    if (lId === 2 || lId === 7) return 'tamil';
    if (lId === 3 || lId === 4) return 'hindi';
    if (lId === 5) return 'malayalam';
    if (lId === 8) return 'telugu';
    if (lId === 9) return 'english';
  }
  return String(lang || '').toLowerCase().trim();
}

function isKannadaContentItem(item: any): boolean {
  if (!item) return false;
  const langStr = extractLanguageString(item);
  if (langStr.includes('kannada') || langStr.includes('kn')) return true;
  if (!langStr || langStr === 'undefined' || langStr === 'null' || langStr === '[object object]') {
    const code = String(item.originalLanguageCode || item.original_language_code || '').toLowerCase().trim();
    if (code && code !== 'kn' && code !== 'kannada') return false;
    const lId = Number(item.languageId || item.language_id || 0);
    if (lId > 0 && lId !== 1 && lId !== 6) return false;
    return true;
  }
  return false;
}

function isNonKannadaContentItem(item: any): boolean {
  if (!item) return false;
  return !isKannadaContentItem(item);
}

function isLanguageMatch(item: any, targetLang: string): boolean {
  if (!item || !targetLang) return false;
  const target = targetLang.toLowerCase().trim();
  const langStr = extractLanguageString(item);
  const code = String(item.originalLanguageCode || item.original_language_code || '').toLowerCase().trim();
  const lId = Number(item.languageId || item.language_id || 0);

  if (target === 'kannada' || target === 'kn' || target === '1' || target === '6') {
    return isKannadaContentItem(item);
  }
  if (target === 'telugu' || target === 'te' || target === '8') {
    return langStr.includes('telugu') || langStr.includes('te') || code === 'te' || lId === 8;
  }
  if (target === 'hindi' || target === 'hi' || target === '3' || target === '4') {
    return langStr.includes('hindi') || langStr.includes('hi') || code === 'hi' || lId === 3 || lId === 4;
  }
  if (target === 'tamil' || target === 'ta' || target === '2' || target === '7') {
    return langStr.includes('tamil') || langStr.includes('ta') || code === 'ta' || lId === 2 || lId === 7;
  }
  if (target === 'malayalam' || target === 'ml' || target === '5') {
    return langStr.includes('malayalam') || langStr.includes('ml') || code === 'ml' || lId === 5;
  }
  return langStr.includes(target) || code === target;
}

export default function ByLanguagePage() {
  const { id } = useParams();
  const { session } = useStoredUser();
  const rawId = String(id ?? '').toLowerCase();
  const isAllExceptKannada = rawId === 'all' || rawId === '0' || rawId === 'non-kannada' || rawId === 'all-languages' || rawId === 'all-indian';
  const isKannadaOnly = rawId === 'kannada' || rawId === 'kn' || rawId === '1';
  const languageId = isNaN(Number(id)) ? 0 : Number(id);
  const languageParam = isAllExceptKannada ? 'non-kannada' : (isKannadaOnly ? 'kannada' : (rawId || languageId));
  const contentQ = useContentByLanguage(languageParam, 1, session);
  const latestQ = useLatestCatalog(1, session);
  const languagesQ = useLanguages();

  const language = languagesQ.data?.result?.find(
    (item: any) => Number(item?.id) === languageId || String(item?.code ?? '').toLowerCase() === rawId || String(item?.name ?? '').toLowerCase() === rawId
  );
  const targetLangName = language?.name || (isKannadaOnly ? 'Kannada' : rawId);

  const rawItems = useMemo(() => {
    const fromLang = contentQ.data?.pages?.flatMap((p: any) => p?.result ?? p?.data ?? (Array.isArray(p) ? p : [])) ?? [];
    if (fromLang.length > 0) return fromLang;
    const fromLatest = (latestQ.data as any)?.result ?? (latestQ.data as any)?.data ?? (Array.isArray(latestQ.data) ? latestQ.data : []);
    return Array.isArray(fromLatest) ? fromLatest : [];
  }, [contentQ.data, latestQ.data]);

  const items = useMemo(() => {
    let filtered: any[] = [];
    if (isAllExceptKannada) {
      // Show all content EXCEPT Kannada language and remove AI content
      filtered = rawItems.filter((item) => isNonKannadaContentItem(item) && !isAiContentItem(item));
    } else if (isKannadaOnly || targetLangName.toLowerCase().includes('kannada')) {
      // Show ONLY Kannada content and REMOVE all AI related content
      filtered = rawItems.filter((item) => isKannadaContentItem(item) && !isAiContentItem(item));
    } else {
      // Filter specifically by selected language (Hindi, Tamil, Telugu, Malayalam, Marathi, etc.)
      filtered = rawItems.filter((item) => isLanguageMatch(item, targetLangName) && !isAiContentItem(item));
    }

    return [...filtered].sort((a: any, b: any) => {
      const dateA = new Date(a.created_at || a.createdAt || a.release_date || a.releaseDate || 0).getTime();
      const dateB = new Date(b.created_at || b.createdAt || b.release_date || b.releaseDate || 0).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
  }, [rawItems, isAllExceptKannada, isKannadaOnly, targetLangName]);

  const displayLangTitle = targetLangName.charAt(0).toUpperCase() + targetLangName.slice(1);

  const pageTitle = isAllExceptKannada
    ? 'All Indian Languages Movies (Excluding Kannada)'
    : isKannadaOnly
    ? 'Kannada Movies & Entertainment'
    : `${displayLangTitle} Movies & Shows`;

  const pageDesc = isAllExceptKannada
    ? 'Explore cinema and entertainment across all Indian languages (Hindi, Tamil, Telugu, Malayalam, Bengali, Marathi, Punjabi, Gujarati, etc.), excluding Kannada.'
    : isKannadaOnly
    ? 'Pure Kannada blockbusters, classic cinema, and original entertainment without AI titles.'
    : `Stream ${displayLangTitle} movies, digital series, and regional entertainment.`;

  return (
    <PageShell>
      <PageHero
        backHref="/search"
        backLabel="Back to Browse"
        eyebrow="Browse by language"
        title={pageTitle}
        description={pageDesc}
        icon={Globe2}
      />
      <CatalogGrid
        items={items}
        loading={contentQ.isLoading && latestQ.isLoading}
        hasMore={contentQ.hasNextPage}
        loadingMore={contentQ.isFetchingNextPage}
        onLoadMore={() => void contentQ.fetchNextPage()}
      />
      {items.length === 0 && !contentQ.isLoading && (
        <EmptyState
          title="Coming Soon"
          description={`${displayLangTitle} titles are coming soon! Check back shortly.`}
          actionHref="/search"
          actionLabel="Explore Other Languages"
          icon={Globe2}
        />
      )}
    </PageShell>
  );
}
