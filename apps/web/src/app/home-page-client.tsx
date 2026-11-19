'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useQueryClient } from '@tanstack/react-query';
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
import ContentCard from '@/components/home/ContentCard';
import { GoogleAdBanner } from '@/components/ads';
import type { HomeInitialData } from '@/lib/ott-api-server';

const HeroBanner = dynamic(() => import('@/components/home/HeroBanner'), {
  loading: () => <BannerSkeleton />,
});

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

function isAiContentItem(item: any): boolean {
  if (!item) return false;
  const tId = Number(item.type_id || item.typeId || item.video_type || item.type || 0);
  if (tId === 7) return true;
  const contentType = String(item.content_type || '').toUpperCase();
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
}: {
  initial: HomeInitialData;
  typeId: number;
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
    if (lower === 'microdrama' || lower === 'micro-drama' || lower === '4') return 4;
    if (lower === 'podcasts' || lower === 'podcast' || lower === '5') return 5;
    if (lower === 'series' || lower === 'web-series' || lower === 'shows' || lower === 'show' || lower === '6') return 6;
    if (lower === 'ai-cinema' || lower === 'ai' || lower === 'ai_movie' || lower === '7') return 7;
    const n = Number(val);
    return !isNaN(n) ? n : 0;
  };

  const paramType = searchParams?.get('type');
  const paramLang = searchParams?.get('lang');
  const urlTypeId = paramType !== null && paramType !== undefined ? resolveTypeId(paramType) : initialTypeId;

  const [activeCategory, setActiveCategory] = useState<string>('Kannada Entertainment');
  const [typeId, setTypeId] = useState<number>(urlTypeId);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('kannada');
  const [langMode, setLangMode] = useState<'kannada' | 'all_indian' | 'non_kannada' | 'lang_specific'>(
    paramLang === 'all-indian' || paramLang === 'all_indian'
      ? 'all_indian'
      : paramLang === 'non-kannada'
      ? 'non_kannada'
      : paramLang && paramLang !== 'kannada'
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
    const raw = searchParams?.get('type');
    const rawLang = searchParams?.get('lang');
    const nextType = raw !== null && raw !== undefined ? resolveTypeId(raw) : initialTypeId;
    setTypeId(nextType);

    if (rawLang === 'all-indian' || rawLang === 'all_indian') {
      setLangMode('all_indian');
      setSelectedLanguage('all');
      setActiveCategory('All Indian Languages');
    } else if (rawLang === 'non-kannada') {
      setLangMode('non_kannada');
      setSelectedLanguage('all');
      setActiveCategory('All Languages (Excl. Kannada)');
    } else if (rawLang && rawLang !== 'kannada') {
      setLangMode('lang_specific');
      setSelectedLanguage(rawLang.toLowerCase().trim());
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
      else setActiveCategory('Kannada Cinema & Shows');
    }
  }, [searchParams, initialTypeId]);

  const bannerOpts = typeId === 0 && initial.banners ? { initialData: initial.banners } : undefined;
  const sectionOpts = typeId === 0 && initial.sections ? { initialData: initial.sections } : undefined;
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
      const tId = Number(item.type_id || item.typeId || item.video_type || item.type || 1);
      return tId === typeId;
    }

    if (langMode === 'non_kannada') {
      if (!isNonKannadaContentItem(item) || isAiContentItem(item)) return false;
      if (typeId === 0) return true;
      const tId = Number(item.type_id || item.typeId || item.video_type || item.type || 1);
      return tId === typeId;
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
      const tId = Number(item.type_id || item.typeId || item.video_type || item.type || 1);
      return tId === effectiveType;
    }

    // Default: Strictly Kannada ONLY. Zero non-Kannada items can pass.
    if (!isKannadaContentItem(item) || isAiContentItem(item)) return false;
    if (typeId === 0) return true;
    const tId = Number(item.type_id || item.typeId || item.video_type || item.type || 1);
    return tId === typeId;
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

    const filtered = list.filter(filterItemByLanguageAndAi);
    return sortByLatest(filtered);
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

    const filtered = list.filter(filterItemByLanguageAndAi);
    return sortByLatest(filtered);
  }, [latestQ.data, nonKannadaQ.data, langSpecificQ.data, isMoviesMode, langMode, selectedLanguage, langSpecificTypeId, typeId]);

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
        title: typeId === 1 ? 'Top Kannada Movies' : 'Trending & New Releases',
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
    action_url: '/?lang=all-indian',
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
    action_url: '/?lang=kannada',
  } as any as Banner, findManagedPortalBanner(['kannada', 'kannada-movies', 'movies & entertainment'])), [managedPortalBanners]);

  const effectiveBanners = useMemo((): Banner[] => {
    // 1. Gather all candidate banners from bannersQ
    let promoList: Banner[] = [];
    if (langMode === 'all_indian' || langMode === 'non_kannada') {
      promoList = banners.filter(isNonKannadaContentItem);
    } else if (langMode === 'lang_specific') {
      promoList = banners;
    } else {
      promoList = banners.filter(isKannadaContentItem);
    }

    // 2. Candidate content items from latest catalog to augment hero banners
    const contentCandidates = (latestItems || []).filter(
      (item: any) =>
        item &&
        (item.landscapeImageUrl ||
          item.landscape_image_url ||
          item.bannerUrl ||
          item.banner_url ||
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

    // 3. Pool actual banners first (promo banners + actual content banners, deduplicated by id)
    const result: Banner[] = [];
    const seenIds = new Set<string | number>();

    if (langMode === 'all_indian' || langMode === 'non_kannada' || langMode === 'lang_specific') {
      result.push(allIndianBanner);
      if (allIndianBanner.id != null) {
        seenIds.add(allIndianBanner.id);
      }
      for (const b of promoList) {
        const key = (b as any).content_id || (b as any).video_id || b.id;
        if (key && !seenIds.has(key)) {
          seenIds.add(key);
          result.push(b);
        }
      }
      for (const b of contentCandidates) {
        const key = (b as any).content_id || (b as any).video_id || b.id;
        if (key && !seenIds.has(key)) {
          seenIds.add(key);
          result.push(b);
        }
      }
      result.push(kannadaBanner);
    } else {
      for (const b of promoList) {
        const key = (b as any).content_id || (b as any).video_id || b.id;
        if (key && !seenIds.has(key)) {
          seenIds.add(key);
          result.push(b);
        }
      }
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

    const nkRaw = (nonKannadaQ.data as any)?.result ?? (nonKannadaQ.data as any)?.data ?? (Array.isArray(nonKannadaQ.data) ? nonKannadaQ.data : []);
    if (Array.isArray(nkRaw)) nkRaw.forEach(add);

    const lsRaw = langSpecificQ.data?.pages?.flatMap((p: any) => p?.result ?? p?.data ?? (Array.isArray(p) ? p : [])) ?? [];
    if (Array.isArray(lsRaw)) lsRaw.forEach(add);

    return list;
  }, [latestQ.data, sectionsQ.data, nonKannadaQ.data, langSpecificQ.data]);

  // Dedicated rails by language when "All" is selected in All Indian Portal
  const allIndianLanguageRails = useMemo(() => {
    if (!isAllIndianPortal || (langMode !== 'all_indian' && selectedLanguage !== 'all')) return [];

    const languages = [
      { name: 'Telugu', label: 'Telugu Cinema & Shows' },
      { name: 'Tamil', label: 'Tamil Cinema & Shows' },
      { name: 'Malayalam', label: 'Malayalam Cinema & Shows' },
      { name: 'Hindi', label: 'Hindi Cinema & Shows' },
      { name: 'Bengali', label: 'Bengali Cinema & Shows' },
      { name: 'Marathi', label: 'Marathi Cinema & Shows' },
      { name: 'Gujarati', label: 'Gujarati Cinema & Shows' },
      { name: 'Punjabi', label: 'Punjabi Cinema & Shows' },
      { name: 'Odia', label: 'Odia Cinema & Shows' },
    ];

    return languages
      .map((lang) => {
        const target = lang.name.toLowerCase();
        const items = allRawItems.filter((item) => {
          if (!isNonKannadaContentItem(item) || isAiContentItem(item)) return false;
          if (typeId > 0) {
            const tId = Number(item.type_id || item.typeId || item.video_type || item.type || 1);
            if (tId !== typeId) return false;
          }
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

    const movies = langItems.filter((i) => Number(i.type_id || (i as any).video_type || 1) === 1);
    const series = langItems.filter((i) => Number(i.type_id || (i as any).video_type) === 6);
    const songs = langItems.filter((i) => Number(i.type_id || (i as any).video_type) === 2);
    const shorts = langItems.filter((i) => {
      const t = Number(i.type_id || (i as any).video_type);
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
    <div className="relative isolate min-h-screen overflow-hidden bg-[#08090C] pb-24 text-white">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-radial-gradient from-[#180A10]/40 via-[#08090C] to-[#08090C]" />

      {/* Hero Carousel */}
      {bannersQ.isLoading && effectiveBanners.length === 0 ? <BannerSkeleton /> : <HeroBanner banners={effectiveBanners} />}

      {/* STICKY PORTAL FILTER BAR - ALL INDIAN LANGUAGES OR KANNADA MAIN TYPES */}
      <div className="sticky top-[66px] z-40 border-y border-white/10 bg-[#08090C]/90 px-4 py-3 backdrop-blur-2xl sm:px-6 lg:px-12">
        {isAllIndianPortal ? (
          /* ALL INDIAN PORTAL: STRICTLY INDIAN LANGUAGES PILLS */
          <div className="mx-auto flex max-w-[1600px] items-center gap-2.5 overflow-x-auto scrollbar-hide">
            {ALL_INDIAN_LANGUAGES_PILLS.map((lang) => {
              const isActive =
                lang.param === 'all-indian'
                  ? selectedLanguage === 'all' || langMode === 'all_indian'
                  : selectedLanguage.toLowerCase() === lang.name.toLowerCase();

              return (
                <button
                  key={`all-indian-pill-${lang.name}`}
                  onClick={() => {
                    if (lang.param === 'all-indian') {
                      setLangMode('all_indian');
                      setSelectedLanguage('all');
                      setActiveCategory('All Indian Languages');
                      router.push('/?lang=all-indian', { scroll: false });
                    } else {
                      setLangMode('lang_specific');
                      setSelectedLanguage(lang.name);
                      setActiveCategory(lang.name);
                      router.push(`/?lang=${lang.param}`, { scroll: false });
                    }
                  }}
                  className={`whitespace-nowrap rounded-full px-5 py-2 text-xs font-black tracking-wide transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.6)] scale-105 font-black'
                      : 'border border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {lang.name === 'All' ? 'All Languages' : lang.name}
                </button>
              );
            })}
          </div>
        ) : (
          /* KANNADA PORTAL: STRICTLY KANNADA MAIN TYPE PILLS */
          <div className="mx-auto flex max-w-[1600px] items-center gap-2.5 overflow-x-auto scrollbar-hide">
            {KANNADA_PORTAL_PILLS.map((pill) => {
              const isActive = typeId === pill.typeId;
              return (
                <button
                  key={`kn-pill-${pill.label}`}
                  onClick={() => {
                    setTypeId(pill.typeId);
                    if (pill.typeId > 0) {
                      router.push(`/?type=${pill.typeId}`, { scroll: false });
                    } else {
                      router.push('/', { scroll: false });
                    }
                  }}
                  className={`whitespace-nowrap rounded-full px-5 py-2 text-xs font-black tracking-wide transition-all duration-200 ${
                    isActive
                      ? 'bg-[#E50914] text-white shadow-[0_0_20px_rgba(229,9,20,0.6)] scale-105 font-black'
                      : 'border border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="relative z-20 space-y-12 pt-6">

        {/* 1. CONTINUE WATCHING RAIL */}
        {cw.length > 0 && (
          <ContentRail
            title="Continue Watching for You"
            items={typeId === 1 ? cw.filter((i) => i.video_type === 1 || (i as any).content_type === 'MOVIE') : cw}
            landscape
            resume
            seeAllHref="/continuewatching"
          />
        )}

        {/* 2. TOP 10 IN INDIA TODAY RAIL */}
        {top10Items.length > 0 && (
          <section className="group/rail relative mt-12 lg:mt-16">
            <div className="mb-6 flex items-end justify-between px-4 sm:px-6 lg:px-12">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#E50914] text-white shadow-[0_0_15px_rgba(229,9,20,0.5)]">
                  <Flame size={18} fill="currentColor" />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF5A60]">Ranked daily</p>
                  <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl lg:text-3xl">
                    {isAiMode
                      ? 'Top 10 AI Cinema Originals'
                      : langMode === 'lang_specific'
                      ? `Top 10 ${selectedLanguage} Today`
                      : isAllIndianPortal
                      ? 'Top 10 in India Today'
                      : 'Top 10 Kannada Today'}
                  </h2>
                </div>
              </div>
            </div>

            {/* TOP 10 RANKED CAROUSEL ROW */}
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-6 pt-2 scrollbar-hide sm:px-6 lg:px-12">
              {top10Items.map((item: ContentItem, idx: number) => (
                <div key={item.id ?? `top10-${idx}`} className="flex snap-start items-end flex-shrink-0">
                  <span className="top10-rank-number mr-[-28px] z-10 select-none">
                    {idx + 1}
                  </span>
                  <ContentCard item={item} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* GOOGLE ADSENSE IN-FEED BANNER (TOP) */}
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10">
          <GoogleAdBanner slot="home-top-banner" className="my-2" />
        </div>

        {/* 3. DEDICATED LANGUAGE RAILS FOR ALL INDIAN HUB (WHEN 'ALL' IS SELECTED) */}
        {isAllIndianPortal && (selectedLanguage === 'all' || langMode === 'all_indian') && allIndianLanguageRails.length > 0 && (
          allIndianLanguageRails.map((rail) => (
            <ContentRail
              key={`all-indian-rail-${rail.langName}`}
              title={rail.title}
              items={rail.items}
              seeAllHref={`/?lang=${rail.langName.toLowerCase()}`}
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
        {sectionsQ.isLoading ? (
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
              {index === 1 && (
                <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10">
                  <GoogleAdBanner slot="home-mid-banner" className="my-3" />
                </div>
              )}
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
                  href="/?lang=all-indian"
                  className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-xs font-black text-black shadow-md transition hover:brightness-110"
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

        {/* 8. VIP PREMIUM UPGRADE BANNER */}
        <section className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-12">
          <div className="relative overflow-hidden rounded-3xl border border-[#E50914]/40 bg-gradient-to-r from-[#180A10] via-[#0D0F17] to-[#140810] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(229,9,20,0.25)] sm:p-12">
            <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#E50914]/20 blur-3xl" />
            <div className="relative z-10 flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
              <div className="max-w-2xl space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-amber-400">
                  <Sparkles size={14} /> VIP 4K Ultra HD Access
                </span>
                <h2 className="text-2xl font-black tracking-tight text-white sm:text-4xl">
                  Stream Without Ads in 4K UHD & Dolby Atmos
                </h2>
                <p className="text-sm font-medium text-white/70 sm:text-base">
                  Unlock unlimited access to Kannada Blockbusters, Exclusive Web Series, Live Sports, and Micro-Dramas across 4 devices simultaneously.
                </p>
              </div>
              <Link
                href="/subscription"
                className="inline-flex items-center gap-2 rounded-2xl bg-[#E50914] px-8 py-4 text-base font-black text-white shadow-[0_0_30px_rgba(229,9,20,0.6)] transition-transform duration-200 hover:scale-105 hover:bg-[#FF1E27]"
              >
                <Zap size={18} fill="currentColor" /> Upgrade to VIP Premium
              </Link>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
