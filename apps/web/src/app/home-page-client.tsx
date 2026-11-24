'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, PlayCircle, Sparkles, Zap, Flame, Radio, Award, AlertCircle, Globe } from 'lucide-react';
import {
  useBanners,
  usePortalBanners,
  useSections,
  useContinueWatching,
  useCategories,
  useLatestCatalog,
  useContentNonKannada,
  useContentByLanguage,
  useProfile,
  queryKeys,
  resolveImageUrl,
} from '@ott/shared';
import type { Section, ContentItem, Banner, Category, PortalBanner } from '@ott/shared';
import { BannerSkeleton, RailSkeleton } from '@/components/ui/Skeleton';
import { useStoredUser } from '@/lib/auth';
import ContentRail from '@/components/home/ContentRail';
import Top10Rail from '@/components/home/Top10Rail';
import HeroBanner from '@/components/home/HeroBanner';
import type { HomeInitialData } from '@/lib/ott-api-server';

function usesLandscapeCards(section: Section): boolean {
  const layout = String(section.screen_layout ?? '').toLowerCase();
  return layout.includes('landscape') || layout.includes('horizontal') || Number(section.section_type) === 2;
}

function mergeManagedPortalBanner(fallback: Banner, managed?: PortalBanner): Banner {
  if (!managed?.imageUrl) return fallback;
  const image = managed.imageUrl;
  const subtitle = managed.subtitle || '';
  return {
    ...fallback,
    id: managed.id ?? fallback.id,
    title: managed.title || fallback.title,
    name: managed.title || fallback.name,
    description: subtitle,
    short_description: subtitle,
    image,
    landscape: image,
    banner: image,
    landscapeImageUrl: image,
    posterUrl: managed.mobileImageUrl || image,
    thumbnail: managed.mobileImageUrl || image,
    action_url: managed.targetUrl || fallback.action_url,
    actionUrl: managed.targetUrl || fallback.action_url,
    buttonLabel: managed.buttonLabel || fallback.buttonLabel,
    isPortalBanner: true,
  } as Banner;
}

function resolveItemTypeId(item: any): number {
  if (!item) return 0;
  const numericCandidates = [item.type_id, item.typeId, item.video_type, item.videoType];
  for (const val of numericCandidates) {
    const n = Number(val);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const strType = String(item.contentType || item.content_type || item.type || '')
    .toUpperCase()
    .trim();
  if (!strType) return 1;
  if (strType === 'MOVIE' || strType === 'MOVIES' || strType === 'FILM') return 1;
  if (strType === 'SONG' || strType === 'SONGS' || strType === 'MUSIC' || strType === 'ALBUM') return 2;
  if (strType === 'SHORT_FILM' || strType === 'SHORT' || strType === 'SHORTS' || strType === 'SHORTFILM') return 3;
  if (strType === 'MICRO_DRAMA' || strType === 'MICRODRAMA' || strType === 'MICRO-DRAMA') return 4;
  if (strType === 'PODCAST' || strType === 'PODCASTS') return 5;
  if (strType === 'SERIES' || strType === 'WEB_SERIES' || strType === 'SHOW' || strType === 'SHOWS' || strType === 'TV_SHOW') return 6;
  if (strType === 'AI_CINEMA' || strType === 'AI' || strType === 'AI_MOVIE') return 7;
  if (strType === 'STAGE_DRAMA' || strType === 'STAGEDRAMA') return 8;
  if (strType === 'DOCUMENTARY' || strType === 'DOCUMENTARIES') return 9;
  const parsed = Number(strType);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function isAiContentItem(item: any): boolean {
  if (!item) return false;
  if (resolveItemTypeId(item) === 7) return true;
  const contentType = String(item.contentType || item.content_type || item.type || '').toUpperCase();
  if (contentType === 'AI_CINEMA' || contentType === 'AI') return true;
  const title = String(item.title || item.name || '').toLowerCase();
  if (title.startsWith('ai ') || title.includes(' ai cinema') || title.includes('ai movie') || title.includes('ai series')) return true;
  const genres = Array.isArray(item.genres) ? item.genres : [];
  if (
    genres.some((g: any) => {
      const str = String(typeof g === 'string' ? g : g?.name || g?.slug || '').toLowerCase();
      return str.includes('ai cinema') || str === 'ai';
    })
  ) {
    return true;
  }
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
  const lId = Number(
    item.languageId ||
    item.language_id ||
    (Array.isArray(item.languages) && item.languages[0]?.id) ||
    0
  );
  if (!lang && lId > 0) {
    if (lId === 2) return 'kannada';
    if (lId === 1) return 'tamil';
    if (lId === 3) return 'malayalam';
    if (lId === 4) return 'hindi';
    if (lId === 5) return 'english';
    if (lId === 6) return 'telugu';
    if (lId === 7) return 'bhojpuri';
    if (lId === 8) return 'marathi';
    if (lId === 9) return 'gujarati';
    if (lId === 10) return 'bengali';
    if (lId === 11) return 'punjabi';
  }
  return String(lang || '').toLowerCase().trim();
}

const NON_KANNADA_LANG_IDS = new Set([1, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
const KANNADA_LANG_IDS = new Set([2]);

const NON_KANNADA_CODES = new Set([
  'te', 'ta', 'hi', 'ml', 'bn', 'mr', 'pa', 'gu', 'or', 'as', 'en', 'all_indian', 'all-indian'
]);

const NON_KANNADA_TITLE_REGEX = /\((?:telugu|tamil|hindi|malayalam|bengali|marathi|punjabi|gujarati|odia|english)\)|\[(?:telugu|tamil|hindi|malayalam|bengali|marathi|punjabi|gujarati|odia|english)\]|-(?:telugu|tamil|hindi|malayalam)/i;
const KANNADA_TITLE_REGEX = /\(kannada\)|\[kannada\]|-kannada/i;

function isKannadaContentItem(item: any): boolean {
  if (!item) return false;

  // 1. Language code check (most accurate)
  const code = String(
    item.originalLanguageCode ||
    item.original_language_code ||
    (Array.isArray(item.languages) && item.languages[0]?.code) ||
    ''
  ).toLowerCase().trim();
  if (code === 'kn' || code === 'kan') return true;
  if (NON_KANNADA_CODES.has(code)) return false;

  // 2. Fallback Language String check
  const langStr = extractLanguageString(item);
  if (langStr.includes('kannada') || langStr === 'kn') return true;

  // 3. Integer Language ID check (align with DB: 2 = Kannada)
  const lId = Number(
    item.languageId ||
    item.language_id ||
    (Array.isArray(item.languages) && item.languages[0]?.id) ||
    0
  );
  if (KANNADA_LANG_IDS.has(lId)) return true;
  if (NON_KANNADA_LANG_IDS.has(lId)) return false;

  // 4. Fast Title Regex check
  const title = String(item.title || item.name || '');
  if (title) {
    if (NON_KANNADA_TITLE_REGEX.test(title)) return false;
    if (KANNADA_TITLE_REGEX.test(title)) return true;
  }

  if (
    langStr.includes('telugu') || langStr.includes('tamil') ||
    langStr.includes('hindi') || langStr.includes('malayalam') ||
    langStr.includes('bengali') || langStr.includes('marathi') ||
    langStr.includes('punjabi') || langStr.includes('gujarati') ||
    langStr.includes('odia') || langStr.includes('english') ||
    langStr.includes('all indian') || langStr.includes('all_indian')
  ) {
    return false;
  }

  // 5. MaxxPixels OTT default is Kannada
  return true;
}

function isNonKannadaContentItem(item: any): boolean {
  if (!item) return false;
  return !isKannadaContentItem(item);
}

export function HomePageClient({
  initial,
  typeId: initialTypeId,
  language: routeLanguage,
  contentTypeSlug: routeContentTypeSlug,
}: {
  initial: HomeInitialData;
  typeId: number;
  language?: string;
  contentTypeSlug?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { session } = useStoredUser();

  const resolveTypeId = (val: string | null | undefined): number => {
    if (!val) return 0;
    const lower = val.toLowerCase().trim();
    if (lower === 'movies' || lower === 'movie' || lower === '1') return 1;
    if (lower === 'songs' || lower === 'albums' || lower === 'album' || lower === 'music' || lower === '2') return 2;
    if (lower === 'short-films' || lower === 'short_film' || lower === 'shorts' || lower === 'short' || lower === '3') return 3;
    if (lower === 'microdrama' || lower === 'micro-drama' || lower === 'micro_drama' || lower === '4') return 4;
    if (lower === 'podcasts' || lower === 'podcast' || lower === '5') return 5;
    if (lower === 'series' || lower === 'web-series' || lower === 'shows' || lower === 'show' || lower === '6') return 6;
    if (lower === 'ai-cinema' || lower === 'ai' || lower === 'ai_movie' || lower === '7') return 7;
    if (lower === 'stage_drama' || lower === 'stage-drama' || lower === 'stagedrama' || lower === '8') return 8;
    if (lower === 'documentary' || lower === 'documentaries' || lower === '9') return 9;
    const n = Number(val);
    return !isNaN(n) ? n : 0;
  };

  const paramType = routeContentTypeSlug ?? searchParams?.get('type');
  const paramLang = routeLanguage ?? searchParams?.get('lang');
  const urlTypeId = paramType !== null && paramType !== undefined && paramType !== '' ? resolveTypeId(paramType) : initialTypeId;

  const [activeCategory, setActiveCategory] = useState<string>('Kannada Entertainment');
  const [typeId, setTypeId] = useState<number>(urlTypeId);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    paramLang === 'all-indian' || paramLang === 'all_indian' || paramLang === 'non-kannada'
      ? 'all'
      : paramLang
      ? paramLang.toLowerCase().trim()
      : 'kannada',
  );
  const [langMode, setLangMode] = useState<'kannada' | 'all_indian' | 'non_kannada' | 'lang_specific'>(
    paramLang === 'all-indian' || paramLang === 'all_indian'
      ? 'all_indian'
      : paramLang === 'non-kannada'
      ? 'non_kannada'
      : paramLang && paramLang !== 'kannada' && paramLang !== 'kn'
      ? 'lang_specific'
      : 'kannada'
  );
  // Sub content-type filter for lang_specific mode (0 = All)
  const [langSpecificTypeId, setLangSpecificTypeId] = useState<number>(0);

  const KNOWN_LANGUAGES = [
    { name: 'Kannada', code: 'kn' },
    { name: 'Telugu', code: 'te' },
    { name: 'Tamil', code: 'ta' },
    { name: 'Hindi', code: 'hi' },
    { name: 'Malayalam', code: 'ml' },
    { name: 'Marathi', code: 'mr' },
    { name: 'Bengali', code: 'bn' },
    { name: 'Punjabi', code: 'pa' },
    { name: 'Gujarati', code: 'gu' },
  ];

  const CONTENT_TYPE_LABELS = [
    { id: 0, label: 'All' },
    { id: 1, label: 'Movies' },
    { id: 2, label: 'Songs & Albums' },
    { id: 3, label: 'Short Films' },
    { id: 4, label: 'Micro-Drama' },
    { id: 5, label: 'Podcasts' },
    { id: 6, label: 'Web Series' },
  ];

  const isMoviesMode = typeId === 1;
  const isAiMode = typeId === 7;

  useEffect(() => {
    const raw = routeContentTypeSlug ?? searchParams?.get('type');
    const rawLang = (routeLanguage ?? searchParams?.get('lang') ?? '').toLowerCase().trim();
    const nextType = raw !== null && raw !== undefined && raw !== '' ? resolveTypeId(raw) : initialTypeId;
    setTypeId(nextType);

    if (rawLang === 'all-indian' || rawLang === 'all_indian' || rawLang === 'all') {
      setLangMode('all_indian');
      setSelectedLanguage('all');
      setActiveCategory('All Indian Languages');
    } else if (rawLang === 'non-kannada') {
      setLangMode('non_kannada');
      setSelectedLanguage('all');
      setActiveCategory('All Languages (Excl. Kannada)');
    } else if (rawLang && rawLang !== 'kannada' && rawLang !== 'kn') {
      setLangMode('lang_specific');
      setSelectedLanguage(rawLang);
      setActiveCategory(rawLang.charAt(0).toUpperCase() + rawLang.slice(1));
    } else {
      // DEFAULT IS STRICTLY KANNADA PORTAL
      setLangMode('kannada');
      setSelectedLanguage('kannada');
      if (nextType === 1) setActiveCategory('Kannada Movies');
      else if (nextType === 2) setActiveCategory('Kannada Songs & Albums');
      else if (nextType === 3) setActiveCategory('Kannada Short Films');
      else if (nextType === 4) setActiveCategory('Kannada Micro-Drama');
      else if (nextType === 5) setActiveCategory('Kannada Podcasts');
      else if (nextType === 6) setActiveCategory('Kannada Web Series');
      else if (nextType === 7) setActiveCategory('AI Cinema');
      else if (nextType === 8) setActiveCategory('Kannada Stage Dramas');
      else if (nextType === 9) setActiveCategory('Kannada Documentaries');
      else setActiveCategory('Kannada Cinema & Shows');
    }
  }, [searchParams, initialTypeId, routeLanguage, routeContentTypeSlug]);

  const bannerOpts = initial.banners ? { initialData: initial.banners } : undefined;
  const sectionOpts = initial.sections ? { initialData: initial.sections } : undefined;
  const categoryOpts = initial.categories ? { initialData: initial.categories } : undefined;
  const latestOpts = initial.latest ? { initialData: initial.latest } : undefined;

  const bannersQ = useBanners(1, typeId, session, bannerOpts);
  const portalBannersQ = usePortalBanners('all');
  const sectionsQ = useSections(typeId, 1, session, sectionOpts);
  const cwQ = useContinueWatching(session);
  const categoriesQ = useCategories(categoryOpts);
  const latestQ = useLatestCatalog(1, session, latestOpts);
  const nonKannadaQ = useContentNonKannada();
  const langSpecificQ = useContentByLanguage(selectedLanguage, 1, session);

  // Direct backend query for active (language, contentType) so albums/microdramas/etc. beyond page 1 always load
  const typeApiParam = useMemo(() => {
    switch (typeId) {
      case 1: return 'MOVIE';
      case 2: return 'ALBUM';
      case 3: return 'SHORT_FILM';
      case 4: return 'MICRODRAMA';
      case 5: return 'PODCAST';
      case 6: return 'SERIES';
      case 7: return 'AI_CINEMA';
      case 8: return 'STAGE_DRAMA';
      case 9: return 'DOCUMENTARY';
      default: return routeContentTypeSlug ? routeContentTypeSlug.toUpperCase() : '';
    }
  }, [routeContentTypeSlug, typeId]);

  const directCatalogQ = useQuery<ContentItem[]>({
    queryKey: ['direct-catalog', langMode, selectedLanguage, typeApiParam],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const qs = new URLSearchParams({ size: '100' });
      if (langMode === 'kannada') qs.set('language', 'kannada');
      else if (langMode === 'all_indian' || langMode === 'non_kannada') {
        qs.set('language', 'non-kannada');
      } else if (langMode === 'lang_specific' && selectedLanguage && selectedLanguage !== 'all') {
        qs.set('language', selectedLanguage);
      }
      if (typeApiParam) qs.set('type', typeApiParam);

      const res = await fetch(`/api/v1/search?${qs.toString()}`);
      if (!res.ok) return [];
      const json = await res.json();
      const data = json?.data ?? json?.result ?? json;
      if (Array.isArray(data?.content)) return data.content as ContentItem[];
      if (Array.isArray(data)) return data as ContentItem[];
      return [];
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (session?.userId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.banners(1, typeId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sections(1, typeId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    }
  }, [session?.userId, queryClient, typeId]);

  const matchesSelectedSubLanguage = (item: any) => {
    if (!selectedLanguage || selectedLanguage.toLowerCase() === 'all') {
      return isNonKannadaContentItem(item);
    }
    const target = selectedLanguage.toLowerCase().trim();
    if (target !== 'kannada' && target !== 'kn' && isKannadaContentItem(item)) {
      return false;
    }

    const itemLang = extractLanguageString(item);
    const itemCode = String(item.originalLanguageCode || item.original_language_code || '').toLowerCase().trim();
    const lId = Number(item.languageId || item.language_id || 0);

    if (itemLang.includes(target) || itemCode === target) return true;
    if (target === 'telugu' && (itemCode === 'te' || itemLang.includes('telugu') || itemLang.includes('te') || lId === 6)) return true;
    if (target === 'tamil' && (itemCode === 'ta' || itemLang.includes('tamil') || itemLang.includes('ta') || lId === 1)) return true;
    if (target === 'hindi' && (itemCode === 'hi' || itemLang.includes('hindi') || itemLang.includes('hi') || lId === 4)) return true;
    if (target === 'malayalam' && (itemCode === 'ml' || itemLang.includes('malayalam') || itemLang.includes('ml') || lId === 3)) return true;
    if (target === 'kannada' && (itemCode === 'kn' || itemLang.includes('kannada') || itemLang.includes('kn') || lId === 2)) return true;
    if (target === 'english' && (itemCode === 'en' || itemLang.includes('english') || itemLang.includes('en') || lId === 5)) return true;
    return false;
  };

  const filterItemByLanguageAndAi = (item: any) => {
    if (!item) return false;

    // AI Mode filter
    if (typeId === 7) {
      return isAiContentItem(item);
    }

    if (langMode === 'all_indian') {
      if (!isNonKannadaContentItem(item) || isAiContentItem(item)) return false;
      if (!matchesSelectedSubLanguage(item)) return false;
      if (typeId === 0) return true;
      return resolveItemTypeId(item) === typeId;
    }

    if (langMode === 'non_kannada') {
      if (!isNonKannadaContentItem(item) || isAiContentItem(item)) return false;
      if (typeId === 0) return true;
      return resolveItemTypeId(item) === typeId;
    }

    if (langMode === 'lang_specific') {
      const target = selectedLanguage.toLowerCase().trim();
      if (target !== 'kannada' && target !== 'kn' && isKannadaContentItem(item)) return false;
      const itemLang = extractLanguageString(item);
      const itemCode = String(item.originalLanguageCode || item.original_language_code || '').toLowerCase().trim();
      const lId = Number(item.languageId || item.language_id || 0);
      const langMatch =
        itemLang.includes(target) ||
        itemCode === target ||
        (target === 'telugu' && (itemCode === 'te' || itemLang.includes('telugu') || itemLang.includes('te') || lId === 6)) ||
        (target === 'tamil' && (itemCode === 'ta' || itemLang.includes('tamil') || itemLang.includes('ta') || lId === 1)) ||
        (target === 'hindi' && (itemCode === 'hi' || itemLang.includes('hindi') || itemLang.includes('hi') || lId === 4)) ||
        (target === 'malayalam' && (itemCode === 'ml' || itemLang.includes('malayalam') || itemLang.includes('ml') || lId === 3)) ||
        (target === 'kannada' && (itemCode === 'kn' || itemLang.includes('kannada') || itemLang.includes('kn') || lId === 2)) ||
        (target === 'english' && (itemCode === 'en' || itemLang.includes('english') || itemLang.includes('en') || lId === 5)) ||
        (target === 'marathi' && (itemCode === 'mr' || itemLang.includes('marathi') || itemLang.includes('mr') || lId === 8)) ||
        (target === 'bengali' && (itemCode === 'bn' || itemLang.includes('bengali') || itemLang.includes('bn') || lId === 10)) ||
        (target === 'punjabi' && (itemCode === 'pa' || itemLang.includes('punjabi') || itemLang.includes('pa') || lId === 11)) ||
        (target === 'gujarati' && (itemCode === 'gu' || itemLang.includes('gujarati') || itemLang.includes('gu') || lId === 9)) ||
        (target === 'bhojpuri' && (itemCode === 'bho' || itemLang.includes('bhojpuri') || itemLang.includes('bho') || lId === 7)) ||
        (target === 'odia' && (itemCode === 'or' || itemLang.includes('odia') || itemLang.includes('or')));

      if (!langMatch || isAiContentItem(item)) return false;
      const effectiveType = langSpecificTypeId > 0 ? langSpecificTypeId : typeId;
      if (effectiveType === 0) return true;
      return resolveItemTypeId(item) === effectiveType;
    }

    // Default: Strictly Kannada ONLY. Zero non-Kannada items can pass.
    if (!isKannadaContentItem(item) || isAiContentItem(item)) return false;
    if (typeId === 0) return true;
    return resolveItemTypeId(item) === typeId;
  };

  const sortByLatest = <T extends any>(items: T[]): T[] => {
    return [...items].sort((a: any, b: any) => {
      const dateA = new Date(a.created_at || a.createdAt || a.release_date || a.releaseDate || 0).getTime();
      const dateB = new Date(b.created_at || b.createdAt || b.release_date || b.releaseDate || 0).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
  };

  const banners = useMemo((): Banner[] => {
    const raw = bannersQ.data as any;
    let list: Banner[] = [];
    if (Array.isArray(raw)) list = raw as Banner[];
    else if (Array.isArray(raw?.result)) list = raw.result as Banner[];
    else if (Array.isArray(raw?.data)) list = raw.data as Banner[];

    const activeTypeSlug = (() => {
      switch (typeId) {
        case 1: return 'movie';
        case 2: return 'album';
        case 3: return 'short_film';
        case 4: return 'microdrama';
        case 5: return 'podcast';
        case 6: return 'series';
        case 7: return 'ai_cinema';
        case 8: return 'stage_drama';
        case 9: return 'documentary';
        default: return '';
      }
    })();

    const filtered = list.filter((b: any) => {
      if (!b) return false;
      // 1. Platform check: Web accepts ALL, WEB, or unset
      const plat = String(b.platform || b.placement || 'ALL').toUpperCase().trim();
      if (plat && plat !== 'ALL' && plat !== 'WEB') return false;

      // 2. Admin pageSlug targeting (supports "kannada:movie", "all-indian:podcast", "kannada", "all-indian", "movie", "all")
      const pageSlug = String(b.pageSlug || b.page_slug || 'all').toLowerCase().trim();
      if (pageSlug && pageSlug !== 'all') {
        if (pageSlug.includes(':')) {
          const [slugLang, slugType] = pageSlug.split(':');
          const langMatches =
            slugLang === 'all' ||
            (slugLang === 'kannada' && langMode === 'kannada') ||
            ((slugLang === 'all-indian' || slugLang === 'all_indian') &&
              (langMode === 'all_indian' || langMode === 'non_kannada'));
          const typeMatches =
            !slugType || slugType === 'all'
              ? typeId === 0
              : activeTypeSlug !== '' && slugType === activeTypeSlug;
          return langMatches && typeMatches;
        }
        if (pageSlug === 'kannada') return langMode === 'kannada' && typeId === 0;
        if (pageSlug === 'all-indian' || pageSlug === 'all_indian') {
          return (langMode === 'all_indian' || langMode === 'non_kannada') && typeId === 0;
        }
        return activeTypeSlug !== '' && pageSlug === activeTypeSlug;
      }

      // 3. Default pageSlug === 'all':
      // Custom promo banners without contentId show on Home (typeId === 0)
      if (!b.contentId && !b.content_id && !b.video_id) {
        return typeId === 0;
      }
      return filterItemByLanguageAndAi(b);
    });

    return [...filtered].sort(
      (a: any, b: any) => (Number(a.displayOrder ?? a.display_order ?? 0) - Number(b.displayOrder ?? b.display_order ?? 0)),
    );
  }, [bannersQ.data, isMoviesMode, langMode, selectedLanguage, langSpecificTypeId, typeId]);

  const latestItems = useMemo((): ContentItem[] => {
    const raw = latestQ.data as any;
    let list: ContentItem[] = [];
    if (Array.isArray(raw)) list = raw as ContentItem[];
    else if (Array.isArray(raw?.result)) list = raw.result as ContentItem[];
    else if (Array.isArray(raw?.data)) list = raw.data as ContentItem[];

    if (langMode === 'all_indian' || langMode === 'non_kannada') {
      const nkRaw = (nonKannadaQ.data as any)?.result ?? (nonKannadaQ.data as any)?.data ?? (Array.isArray(nonKannadaQ.data) ? nonKannadaQ.data : []);
      if (Array.isArray(nkRaw) && nkRaw.length > 0) {
        list = [...list, ...nkRaw];
      }
    } else if (langMode === 'lang_specific') {
      const lsRaw = langSpecificQ.data?.pages?.flatMap((p: any) => p?.result ?? p?.data ?? (Array.isArray(p) ? p : [])) ?? [];
      if (lsRaw.length > 0) {
        list = [...list, ...lsRaw];
      }
    }

    if (Array.isArray(directCatalogQ.data) && directCatalogQ.data.length > 0) {
      list = [...directCatalogQ.data, ...list];
    }

    const seen = new Set<string | number>();
    const deduped: ContentItem[] = [];
    for (const it of list) {
      const id = (it as any)?.id ?? (it as any)?.video_id;
      if (id != null && seen.has(id)) continue;
      if (id != null) seen.add(id);
      deduped.push(it);
    }

    const filtered = deduped.filter(filterItemByLanguageAndAi);
    return sortByLatest(filtered);
  }, [directCatalogQ.data, latestQ.data, nonKannadaQ.data, langSpecificQ.data, isMoviesMode, langMode, selectedLanguage, langSpecificTypeId, typeId]);

  const allSections = useMemo((): Section[] => {
    const pages = sectionsQ.data?.pages;
    let list: Section[] = [];
    if (Array.isArray(pages)) {
      list = pages.flatMap((p: any) => {
        if (Array.isArray(p)) return p as Section[];
        if (Array.isArray(p?.result)) return p.result as Section[];
        if (Array.isArray(p?.data)) return p.data as Section[];
        return [];
      });
    } else {
      const raw = sectionsQ.data as any;
      if (Array.isArray(raw)) list = raw as Section[];
      else if (Array.isArray(raw?.result)) list = raw.result as Section[];
      else if (Array.isArray(raw?.data)) list = raw.data as Section[];
    }

    const resultSections = list
      .map((sec) => ({
        ...sec,
        data: sortByLatest(((sec.data && sec.data.length > 0 ? sec.data : (sec as any).items) || []).filter(filterItemByLanguageAndAi)) as ContentItem[],
      }))
      .filter((sec) => sec.data && sec.data.length > 0);

    // If section rails are empty, synthesize rail from latestItems so added content always displays
    if (resultSections.length === 0 && latestItems.length > 0) {
      resultSections.push({
        id: 9999,
        title:
          langMode === 'all_indian' || langMode === 'non_kannada'
            ? typeId === 1
              ? 'All Indian Movies (Excl. Kannada)'
              : 'All Indian Trending & New Releases'
            : typeId === 1
            ? 'Top Kannada Movies'
            : 'Trending & New Releases',
        screen_layout: 'landscape',
        section_type: 1,
        data: sortByLatest(latestItems) as ContentItem[],
      });
    }

    // If section rails are empty in non-Kannada / All-Indian portal, synthesize a rail from nonKannadaQ
    if (resultSections.length === 0 && (langMode === 'all_indian' || langMode === 'non_kannada')) {
      const nkRaw = (nonKannadaQ.data as any)?.result ?? (nonKannadaQ.data as any)?.data ?? (Array.isArray(nonKannadaQ.data) ? nonKannadaQ.data : []);
      const filteredNk = Array.isArray(nkRaw) ? nkRaw.filter(filterItemByLanguageAndAi) : [];
      if (filteredNk.length > 0) {
        return [{
          id: 9991,
          title: langMode === 'all_indian' ? 'All Indian Cinema (Telugu, Tamil, Hindi & More)' : 'All Content Except Kannada',
          screen_layout: 'portrait',
          section_type: 1,
          data: sortByLatest(filteredNk) as ContentItem[],
        }] as Section[];
      }
    }

    return resultSections as Section[];
  }, [sectionsQ.data, latestItems, nonKannadaQ.data, isMoviesMode, langMode, selectedLanguage, langSpecificTypeId, typeId]);

  const cw = useMemo((): ContentItem[] => {
    const raw = cwQ.data as any;
    let list: ContentItem[] = [];
    if (Array.isArray(raw)) list = raw as ContentItem[];
    else if (Array.isArray(raw?.result)) list = raw.result as ContentItem[];
    else if (Array.isArray(raw?.data)) list = raw.data as ContentItem[];

    return list.filter(filterItemByLanguageAndAi);
  }, [cwQ.data, isMoviesMode, langMode, selectedLanguage, langSpecificTypeId, typeId]);

  const categories = useMemo((): Category[] => {
    const raw = categoriesQ.data as any;
    if (Array.isArray(raw)) return raw as Category[];
    if (Array.isArray(raw?.result)) return raw.result as Category[];
    if (Array.isArray(raw?.data)) return raw.data as Category[];
    return [];
  }, [categoriesQ.data]);

  const managedPortalBanners = useMemo((): PortalBanner[] => {
    const raw = portalBannersQ.data as any;
    if (Array.isArray(raw)) return raw as PortalBanner[];
    if (Array.isArray(raw?.result)) return raw.result as PortalBanner[];
    if (Array.isArray(raw?.data)) return raw.data as PortalBanner[];
    return [];
  }, [portalBannersQ.data]);

  const findManagedPortalBanner = (keys: string[]): PortalBanner | undefined =>
    managedPortalBanners.find((banner) => {
      const key = String(banner.portalKey || '').toLowerCase();
      return keys.some((candidate) => key === candidate || key.includes(candidate));
    });

  const allIndianBanner = useMemo((): Banner => mergeManagedPortalBanner({
    id: 9992,
    title: 'MAXX ALL INDIAN LANGUAGES MOVIES',
    name: 'MAXX ALL INDIAN LANGUAGES MOVIES',
    description: 'Stories from Every Corner of India. Stream blockbuster cinema in Telugu, Tamil, Hindi, Malayalam, and more.',
    short_description: 'Stories from Every Corner of India.',
    image: '/banner_all_indian_languages.jpg',
    landscape: '/banner_all_indian_languages.jpg',
    banner: '/banner_all_indian_languages.jpg',
    landscapeImageUrl: '/banner_all_indian_languages.jpg',
    posterUrl: '/banner_all_indian_languages.jpg',
    thumbnail: '/banner_all_indian_languages.jpg',
    content_id: 2,
    video_id: 2,
    video_type: 1,
    type_id: 1,
    maturity_rating: 'U/A 13+',
    release_year: 2026,
    duration_seconds: 7200,
    language: 'Telugu / Tamil / Hindi / Malayalam',
    genres: ['Movies', 'Culture', 'Emotions', 'Entertainment'],
    is_premium: 0,
    action_url: '/all-indian',
  } as any as Banner, findManagedPortalBanner(['all-indian', 'all indian', 'telugu', 'tamil'])), [managedPortalBanners]);

  const kannadaBanner = useMemo((): Banner => mergeManagedPortalBanner({
    id: 9991,
    title: 'MAXX MOVIES & ENTERTAINMENT KANNADA',
    name: 'MAXX MOVIES & ENTERTAINMENT KANNADA',
    description: 'Stream top-rated Kannada blockbusters, exclusive web series, and non-stop entertainment in 4K HDR quality.',
    short_description: 'Exclusive Kannada Movies & Entertainment spotlight.',
    image: '/banner_movies_entertainment.png',
    landscape: '/banner_movies_entertainment.png',
    banner: '/banner_movies_entertainment.png',
    landscapeImageUrl: '/banner_movies_entertainment.png',
    posterUrl: '/banner_movies_entertainment.png',
    thumbnail: '/banner_movies_entertainment.png',
    content_id: 1,
    video_id: 1,
    video_type: 1,
    type_id: 1,
    maturity_rating: 'U/A 13+',
    release_year: 2026,
    duration_seconds: 7200,
    language: 'Kannada',
    genres: ['Movies', 'Entertainment', 'Drama'],
    is_premium: 0,
    action_url: '/',
  } as any as Banner, findManagedPortalBanner(['kannada', 'kannada-movies', 'movies & entertainment'])), [managedPortalBanners]);

  const effectiveBanners = useMemo((): Banner[] => {
    // 1. If Admin configured active Hero Banners for this Web page, display them in exact displayOrder!
    if (banners.length > 0) {
      return banners.slice(0, 10);
    }

    // 2. Fallback: candidate content items from latest catalog when no Admin Hero Banners are configured
    const contentCandidates = (latestItems || []).filter(
      (item: any) =>
        item &&
        (item.bannerImageUrl ||
          item.bannerUrl ||
          item.banner_url ||
          item.landscapeImageUrl ||
          item.landscape_image_url ||
          item.landscape ||
          item.banner ||
          item.posterUrl ||
          item.poster_url ||
          item.poster ||
          item.thumbnail ||
          item.image ||
          item.imageUrl ||
          item.image_url)
    ) as any as Banner[];

    const result: Banner[] = [];
    const seenIds = new Set<string | number>();

    if (langMode === 'all_indian' || langMode === 'non_kannada' || langMode === 'lang_specific') {
      result.push(allIndianBanner);
      if (allIndianBanner.id != null) {
        seenIds.add(allIndianBanner.id);
      }
      for (const b of contentCandidates) {
        const key = (b as any).content_id || (b as any).video_id || b.id;
        if (key && !seenIds.has(key)) {
          seenIds.add(key);
          result.push(b);
        }
      }
    } else {
      for (const b of contentCandidates) {
        const key = (b as any).content_id || (b as any).video_id || b.id;
        if (key && !seenIds.has(key)) {
          seenIds.add(key);
          result.push(b);
        }
      }
      result.push(kannadaBanner);
      if (kannadaBanner.id != null) {
        seenIds.add(kannadaBanner.id);
      }
      result.push(allIndianBanner);
      if (allIndianBanner.id != null) {
        seenIds.add(allIndianBanner.id);
      }
    }

    return result.slice(0, 10);
  }, [banners, latestItems, allIndianBanner, kannadaBanner, isMoviesMode, langMode, selectedLanguage]);

  const displaySections = useMemo((): Section[] => allSections.filter((section: Section) => (section.data?.length ?? 0) >= 1), [allSections]);

  const filteredSections = useMemo((): Section[] => {
    const isPortalOrMainType = [
      'all',
      'all indian languages',
      'all indian languages movies',
      'movies & entertainment (kannada only)',
      'kannada cinema & shows',
      'kannada movies',
      'kannada songs & albums',
      'kannada short films',
      'kannada micro-drama',
      'kannada podcasts',
      'kannada web series',
      'all languages (excl. kannada)',
      'movies',
      'songs',
      'short films',
      'micro-drama',
      'podcasts',
      'web series',
      'ai cinema',
    ].includes(String(activeCategory || '').toLowerCase());

    if (!isPortalOrMainType && activeCategory !== 'All' && langMode !== 'lang_specific') {
      const actCat = String(activeCategory || '').toLowerCase();
      const match = displaySections.filter((s) =>
        String(s.title ?? '').toLowerCase().includes(actCat) ||
        (s.data ?? []).some((item: any) =>
          (item.genres ?? []).some((g: any) => {
            const str = String(typeof g === 'string' ? g : g?.name || g?.slug || '').toLowerCase();
            return str.includes(actCat);
          })
        )
      );
      if (match.length > 0) return match;
    }
    return displaySections;
  }, [displaySections, activeCategory, langMode]);

  const top10Items = useMemo((): ContentItem[] => {
    if (latestItems.length >= 10) return latestItems.slice(0, 10);
    const combined = [...latestItems, ...(displaySections[0]?.data ?? [])];
    const unique = Array.from(new Map(combined.map((item: any) => [item.id, item])).values());
    return unique.slice(0, 10) as ContentItem[];
  }, [latestItems, displaySections]);

  const ALL_INDIAN_LANGUAGES_PILLS = [
    { name: 'All', param: 'all-indian' },
    { name: 'Telugu', param: 'telugu' },
    { name: 'Tamil', param: 'tamil' },
    { name: 'Malayalam', param: 'malayalam' },
    { name: 'Hindi', param: 'hindi' },
    { name: 'Bengali', param: 'bengali' },
    { name: 'Marathi', param: 'marathi' },
    { name: 'Gujarati', param: 'gujarati' },
    { name: 'Punjabi', param: 'punjabi' },
    { name: 'Odia', param: 'odia' },
  ];

  const KANNADA_PORTAL_PILLS = [
    { label: 'For You', typeId: 0 },
    { label: 'Movies', typeId: 1 },
    { label: 'Web Series', typeId: 6 },
    { label: 'Short Films', typeId: 3 },
    { label: 'Micro-Drama', typeId: 4 },
    { label: 'Songs', typeId: 2 },
    { label: 'Podcasts', typeId: 5 },
    { label: 'AI Cinema', typeId: 7 },
  ];

  const isAllIndianPortal =
    paramLang === 'all-indian' ||
    paramLang === 'all_indian' ||
    paramLang === 'non-kannada' ||
    (paramLang !== null && paramLang !== undefined && paramLang !== '' && paramLang !== 'kannada') ||
    langMode === 'all_indian' ||
    langMode === 'lang_specific';

  // Collect all unique raw items from catalog
  const allRawItems = useMemo((): ContentItem[] => {
    const list: ContentItem[] = [];
    const seen = new Set<string | number>();

    const add = (item: any) => {
      if (!item) return;
      const id = item.id || item.video_id || item.content_id;
      if (id && !seen.has(id)) {
        seen.add(id);
        list.push(item);
      }
    };

    if (Array.isArray(latestQ.data)) latestQ.data.forEach(add);
    else if (Array.isArray((latestQ.data as any)?.result)) (latestQ.data as any).result.forEach(add);
    else if (Array.isArray((latestQ.data as any)?.data)) (latestQ.data as any).data.forEach(add);

    const pages = sectionsQ.data?.pages;
    if (Array.isArray(pages)) {
      pages.forEach((p: any) => {
        const secList = Array.isArray(p) ? p : Array.isArray(p?.result) ? p.result : Array.isArray(p?.data) ? p.data : [];
        secList.forEach((s: any) => (s.data || []).forEach(add));
      });
    }

    if (Array.isArray(directCatalogQ.data)) directCatalogQ.data.forEach(add);

    const nkRaw = (nonKannadaQ.data as any)?.result ?? (nonKannadaQ.data as any)?.data ?? (Array.isArray(nonKannadaQ.data) ? nonKannadaQ.data : []);
    if (Array.isArray(nkRaw)) nkRaw.forEach(add);

    const lsRaw = langSpecificQ.data?.pages?.flatMap((p: any) => p?.result ?? p?.data ?? (Array.isArray(p) ? p : [])) ?? [];
    if (Array.isArray(lsRaw)) lsRaw.forEach(add);

    return list;
  }, [directCatalogQ.data, latestQ.data, sectionsQ.data, nonKannadaQ.data, langSpecificQ.data]);

  // Dedicated rails by language when "All" is selected in All Indian Portal (all languages except Kannada)
  const allIndianLanguageRails = useMemo(() => {
    if (!isAllIndianPortal || (langMode !== 'all_indian' && langMode !== 'non_kannada' && selectedLanguage !== 'all')) return [];

    const languages = [
      { name: 'Telugu', code: 'te', lId: 6, label: 'Telugu Cinema & Shows' },
      { name: 'Tamil', code: 'ta', lId: 1, label: 'Tamil Cinema & Shows' },
      { name: 'Malayalam', code: 'ml', lId: 3, label: 'Malayalam Cinema & Shows' },
      { name: 'Hindi', code: 'hi', lId: 4, label: 'Hindi Cinema & Shows' },
      { name: 'English', code: 'en', lId: 5, label: 'English Cinema & Shows' },
      { name: 'Bengali', code: 'bn', lId: 10, label: 'Bengali Cinema & Shows' },
      { name: 'Marathi', code: 'mr', lId: 8, label: 'Marathi Cinema & Shows' },
      { name: 'Gujarati', code: 'gu', lId: 9, label: 'Gujarati Cinema & Shows' },
      { name: 'Punjabi', code: 'pa', lId: 11, label: 'Punjabi Cinema & Shows' },
      { name: 'Bhojpuri', code: 'bho', lId: 7, label: 'Bhojpuri Cinema & Shows' },
      { name: 'Odia', code: 'or', lId: 0, label: 'Odia Cinema & Shows' },
    ];

    return languages
      .map((lang) => {
        const target = lang.name.toLowerCase();
        const items = allRawItems.filter((item) => {
          if (!isNonKannadaContentItem(item) || isAiContentItem(item)) return false;
          if (typeId > 0) {
            if (resolveItemTypeId(item) !== typeId) return false;
          }
          const itemLang = extractLanguageString(item);
          const itemCode = String(item.originalLanguageCode || item.original_language_code || '').toLowerCase().trim();
          const itemLangId = Number(item.languageId || item.language_id || 0);
          return (
            itemLang.includes(target) ||
            itemCode === target ||
            itemCode === lang.code ||
            (lang.lId > 0 && itemLangId === lang.lId)
          );
        });
        return {
          title: lang.label,
          langName: lang.name,
          items,
        };
      })
      .filter((r) => r.items.length > 0);
  }, [allRawItems, isAllIndianPortal, langMode, selectedLanguage, typeId]);

  // Dedicated rails when a specific Indian language is clicked (e.g. Telugu)
  const languageSpecificRails = useMemo(() => {
    if (langMode !== 'lang_specific' || !selectedLanguage || selectedLanguage === 'all') return [];

    const target = selectedLanguage.toLowerCase().trim();
    const langItems = allRawItems.filter((item) => {
      if (!isNonKannadaContentItem(item) || isAiContentItem(item)) return false;
      const itemLang = extractLanguageString(item);
      const itemCode = String(item.originalLanguageCode || item.original_language_code || '').toLowerCase().trim();
      return (
        itemLang.includes(target) ||
        itemCode === target ||
        (target === 'telugu' && (itemCode === 'te' || itemLang.includes('telugu'))) ||
        (target === 'tamil' && (itemCode === 'ta' || itemLang.includes('tamil'))) ||
        (target === 'hindi' && (itemCode === 'hi' || itemLang.includes('hindi'))) ||
        (target === 'malayalam' && (itemCode === 'ml' || itemLang.includes('malayalam'))) ||
        (target === 'marathi' && (itemCode === 'mr' || itemLang.includes('marathi'))) ||
        (target === 'bengali' && (itemCode === 'bn' || itemLang.includes('bengali'))) ||
        (target === 'punjabi' && (itemCode === 'pa' || itemLang.includes('punjabi'))) ||
        (target === 'gujarati' && (itemCode === 'gu' || itemLang.includes('gujarati'))) ||
        (target === 'odia' && (itemCode === 'or' || itemLang.includes('odia')))
      );
    });

    const displayLang = selectedLanguage.charAt(0).toUpperCase() + selectedLanguage.slice(1);

    const movies = langItems.filter((i) => resolveItemTypeId(i) === 1);
    const series = langItems.filter((i) => resolveItemTypeId(i) === 6);
    const songs = langItems.filter((i) => resolveItemTypeId(i) === 2);
    const shorts = langItems.filter((i) => {
      const t = resolveItemTypeId(i);
      return t === 3 || t === 4;
    });

    const effectiveType = langSpecificTypeId > 0 ? langSpecificTypeId : typeId;
    const rails = [];
    if (effectiveType === 1) {
      if (movies.length > 0) rails.push({ title: `${displayLang} Movies & Blockbusters`, items: movies });
    } else if (effectiveType === 6) {
      if (series.length > 0) rails.push({ title: `${displayLang} Web Series & Shows`, items: series });
    } else if (effectiveType === 2) {
      if (songs.length > 0) rails.push({ title: `${displayLang} Hit Songs & Music`, items: songs });
    } else if (effectiveType === 3 || effectiveType === 4) {
      if (shorts.length > 0) rails.push({ title: `${displayLang} Shorts & Micro-Drama`, items: shorts });
    } else {
      if (movies.length > 0) rails.push({ title: `${displayLang} Movies & Blockbusters`, items: movies });
      if (series.length > 0) rails.push({ title: `${displayLang} Web Series & Shows`, items: series });
      if (songs.length > 0) rails.push({ title: `${displayLang} Hit Songs & Music`, items: songs });
      if (shorts.length > 0) rails.push({ title: `${displayLang} Shorts & Micro-Drama`, items: shorts });
    }
    if (rails.length === 0 && langItems.length > 0 && effectiveType === 0) {
      rails.push({ title: `All ${displayLang} Titles`, items: langItems });
    }
    return rails;
  }, [allRawItems, langMode, selectedLanguage, langSpecificTypeId, typeId]);

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#0A0A0A] pb-10 text-white">
      {/* Subtle warm ambient glow into Netflix cinema black */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(255,109,46,0.06)_0%,_#0A0A0A_55%)]" />

      {/* Hero Carousel */}
      {bannersQ.isLoading && effectiveBanners.length === 0 ? (
        <BannerSkeleton />
      ) : (
        <motion.div
          key={`hero-${langMode}-${selectedLanguage}-${typeId}`}
          initial={{ opacity: 0.45 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <HeroBanner banners={effectiveBanners} />
        </motion.div>
      )}

      <motion.div
        key={`rails-${langMode}-${selectedLanguage}-${typeId}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-20 space-y-10 pt-2 lg:space-y-12"
      >

        {/* 1. CONTINUE WATCHING RAIL */}
        {cw.length > 0 && (
          <ContentRail
            title="Continue Watching for You"
            items={typeId === 1 ? cw.filter((i) => resolveItemTypeId(i) === 1) : cw}
            landscape
            resume
            seeAllHref="/continuewatching"
          />
        )}

        {/* 2. TOP 10 RANKED DAILY SHOWCASE RAIL */}
        {top10Items.length > 0 && (
          <Top10Rail
            title={
              isAiMode
                ? 'Top 10 AI Cinema Originals'
                : langMode === 'lang_specific'
                ? `Top 10 ${selectedLanguage} Today`
                : isAllIndianPortal
                ? 'Top 10 in India Today'
                : 'Top 10 Kannada Today'
            }
            items={top10Items}
          />
        )}

        {/* 3. DEDICATED LANGUAGE RAILS FOR ALL INDIAN HUB (ALL LANGUAGES EXCEPT KANNADA) */}
        {isAllIndianPortal && (selectedLanguage === 'all' || langMode === 'all_indian' || langMode === 'non_kannada') && allIndianLanguageRails.length > 0 && (
          allIndianLanguageRails.map((rail) => (
            <ContentRail
              key={`all-indian-rail-${rail.langName}`}
              title={rail.title}
              items={rail.items}
              seeAllHref={
                routeContentTypeSlug
                  ? `/${rail.langName.toLowerCase()}/${encodeURIComponent(routeContentTypeSlug)}`
                  : `/${rail.langName.toLowerCase()}`
              }
            />
          ))
        )}

        {/* 4. DEDICATED CATEGORY RAILS WHEN A SPECIFIC LANGUAGE IS CLICKED (e.g. TELUGU) */}
        {langMode === 'lang_specific' && languageSpecificRails.length > 0 && (
          languageSpecificRails.map((rail, idx) => (
            <ContentRail
              key={`lang-spec-rail-${idx}`}
              title={rail.title}
              items={rail.items}
            />
          ))
        )}

        {/* 5. DYNAMIC BACKEND SECTIONS / RAILS */}
        {sectionsQ.isLoading && filteredSections.length === 0 ? (
          <>
            <RailSkeleton />
            <RailSkeleton />
          </>
        ) : (
          filteredSections.map((section: Section, index: number) => (
            <div key={section.id ?? `section-${index}`}>
              <ContentRail
                title={section.title ?? section.short_title ?? 'Featured Collection'}
                items={section.data ?? []}
                seeAllHref={section.id ? `/sections/${section.id}` : undefined}
                landscape={usesLandscapeCards(section)}
              />
            </div>
          ))
        )}

        {/* 6. LATEST RELEASES RAIL */}
        {latestItems.length > 0 && allIndianLanguageRails.length === 0 && languageSpecificRails.length === 0 && (
          <ContentRail
            title={
              isAiMode
                ? 'New AI Releases'
                : typeId === 1
                ? 'Top 10 Movies Today'
                : langMode === 'lang_specific'
                ? `Latest ${selectedLanguage} Releases`
                : 'New & Popular Releases'
            }
            items={latestItems}
          />
        )}

        {/* 7. EMPTY STATE IF NO CONTENT IN SELECTED LANGUAGE/TYPE */}
        {!sectionsQ.isLoading &&
          filteredSections.length === 0 &&
          latestItems.length === 0 &&
          allIndianLanguageRails.length === 0 &&
          languageSpecificRails.length === 0 && (
            <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-xl my-8">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-white/60">
                <Globe size={28} />
              </div>
              <h3 className="text-lg font-black text-white">
                {langMode === 'lang_specific'
                  ? `No ${selectedLanguage} titles found`
                  : 'No titles found in this category'}
              </h3>
              <p className="mt-2 text-xs text-white/60">
                We are actively curating new 4K titles for this category. Explore our All Indian Languages portal or Kannada Hub.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <Link
                  href="/all-indian"
                  className="rounded-full bg-gradient-to-r from-[#FF6D2E] to-[#FF5500] px-4 py-2 text-xs font-black text-white shadow-md transition hover:brightness-110"
                >
                  Explore All Indian
                </Link>
                <Link
                  href="/"
                  className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/20"
                >
                  Go to Kannada Hub
                </Link>
              </div>
            </div>
          )}

      </motion.div>
    </div>
  );
}
