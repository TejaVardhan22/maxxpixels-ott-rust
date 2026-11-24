import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../index';
import { CatalogItem } from '../../types';
import {
  INDIAN_LANGUAGES_EXCLUDING_KANNADA,
  MAIN_TYPES,
  MAIN_TYPE_IDS,
  MainTypeItem,
  PortalPill,
} from '../../constants/catalogConstants';
import {
  getItemMainType,
  isKannadaCatalogItem,
  isNonKannadaCatalogItem,
  matchesIndianSubLanguage,
  matchesMainType,
} from '../../utils/contentUtils';

// Base Selectors
export const selectCatalogState = (state: RootState) => state.catalog;
export const selectEngagementState = (state: RootState) => state.engagement;

export const selectPortalMode = (state: RootState) => state.catalog.portalMode;
export const selectSelectedTypeId = (state: RootState) => state.catalog.selectedTypeId;
export const selectSelectedIndianLanguage = (state: RootState) => state.catalog.selectedIndianLanguage;
export const selectBanners = (state: RootState) => state.catalog.banners;
export const selectSections = (state: RootState) => state.catalog.sections;
export const selectLatest = (state: RootState) => state.catalog.latest;
export const selectLanguages = (state: RootState) => state.catalog.languages;
export const selectLanguageContent = (state: RootState) => state.catalog.languageContent;
export const selectCatalogLoading = (state: RootState) => state.catalog.loading;
export const selectCatalogRefreshing = (state: RootState) => state.catalog.refreshing;
export const selectLoadingLanguage = (state: RootState) => state.catalog.loadingLanguage;
export const selectCatalogError = (state: RootState) => state.catalog.error;

export const selectWatchlistMap = (state: RootState) => state.engagement.watchlistMap;
export const selectRawContinueWatching = (state: RootState) => state.engagement.continueWatching;

// 1. Raw Combined Pool
export const selectAllRawItems = createSelector(
  [selectBanners, selectLatest, selectSections, selectLanguageContent, selectPortalMode, selectSelectedIndianLanguage],
  (banners, latest, sections, languageContent, portalMode, selectedIndianLanguage) => {
    const langKey = portalMode === 'kannada' ? 'kannada' : (selectedIndianLanguage !== 'all' ? selectedIndianLanguage : '');
    const fetched = langKey ? (languageContent[langKey] || []) : [];
    const all = [
      ...banners,
      ...latest,
      ...sections.flatMap((s) => s.data),
      ...fetched,
      ...(portalMode === 'all_indian' ? Object.values(languageContent).flat() : []),
    ];
    const unique = new Map<number | string, CatalogItem>();
    all.forEach((item) => {
      if (item && item.id !== undefined && !unique.has(item.id)) {
        unique.set(item.id, item);
      }
    });
    return Array.from(unique.values());
  }
);

// 2. Strict Portal Items (Filtered by Portal Mode + Active Language)
export const selectPortalItems = createSelector(
  [selectAllRawItems, selectPortalMode, selectSelectedIndianLanguage, selectLanguages],
  (allRawItems, portalMode, selectedIndianLanguage, languages) => {
    if (portalMode === 'kannada') {
      return allRawItems.filter(isKannadaCatalogItem);
    }
    return allRawItems
      .filter(isNonKannadaCatalogItem)
      .filter((item) => matchesIndianSubLanguage(item, selectedIndianLanguage, languages));
  }
);

// 3. All Indian Portal Items (Unfiltered by selected Indian sub-language, strictly non-Kannada)
export const selectAllIndianPortalItems = createSelector(
  [selectAllRawItems],
  (allRawItems) => allRawItems.filter(isNonKannadaCatalogItem)
);

// Helper: sort content by latest releases (newest date or ID first)
export function sortByLatest(a: CatalogItem, b: CatalogItem): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
  const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
  if (dateA !== dateB && !isNaN(dateA) && !isNaN(dateB) && dateA > 0 && dateB > 0) {
    return dateB - dateA;
  }

  const yearA = a.releaseYear ? parseInt(String(a.releaseYear), 10) : 0;
  const yearB = b.releaseYear ? parseInt(String(b.releaseYear), 10) : 0;
  if (yearA !== yearB && !isNaN(yearA) && !isNaN(yearB) && yearA > 0 && yearB > 0) {
    return yearB - yearA;
  }

  const numIdA = typeof a.id === 'number' ? a.id : parseInt(String(a.id), 10) || 0;
  const numIdB = typeof b.id === 'number' ? b.id : parseInt(String(b.id), 10) || 0;
  return numIdB - numIdA;
}

// 4. Pools per Main Type (Sorted by Latest)
export const selectMoviesPool = createSelector([selectPortalItems], (portalItems) =>
  portalItems.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.MOVIES).sort(sortByLatest)
);

export const selectPodcastsPool = createSelector([selectPortalItems], (portalItems) =>
  portalItems.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.PODCASTS).sort(sortByLatest)
);

export const selectSongsPool = createSelector([selectPortalItems], (portalItems) =>
  portalItems.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.SONGS).sort(sortByLatest)
);

export const selectSeriesPool = createSelector([selectPortalItems], (portalItems) =>
  portalItems.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.SERIES).sort(sortByLatest)
);

export const selectMicroDramaPool = createSelector([selectPortalItems], (portalItems) =>
  portalItems.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.MICRO_DRAMA).sort(sortByLatest)
);

export const selectShortsPool = createSelector([selectPortalItems], (portalItems) =>
  portalItems.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.SHORTS).sort(sortByLatest)
);

export const selectAiCinemaPool = createSelector([selectPortalItems], (portalItems) =>
  portalItems.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.AI_CINEMA).sort(sortByLatest)
);

// 5. Dedicated Indian Language Pools (Strictly Non-Kannada)
export const selectTeluguPool = createSelector(
  [selectAllIndianPortalItems, selectLanguages],
  (items, languages) => items.filter((item) => matchesIndianSubLanguage(item, 'telugu', languages))
);

export const selectTamilPool = createSelector(
  [selectAllIndianPortalItems, selectLanguages],
  (items, languages) => items.filter((item) => matchesIndianSubLanguage(item, 'tamil', languages))
);

export const selectHindiPool = createSelector(
  [selectAllIndianPortalItems, selectLanguages],
  (items, languages) => items.filter((item) => matchesIndianSubLanguage(item, 'hindi', languages))
);

export const selectMalayalamPool = createSelector(
  [selectAllIndianPortalItems, selectLanguages],
  (items, languages) => items.filter((item) => matchesIndianSubLanguage(item, 'malayalam', languages))
);

export const selectOtherIndianPool = createSelector(
  [selectAllIndianPortalItems, selectLanguages],
  (items, languages) =>
    items.filter(
      (item) =>
        !matchesIndianSubLanguage(item, 'telugu', languages) &&
        !matchesIndianSubLanguage(item, 'tamil', languages) &&
        !matchesIndianSubLanguage(item, 'hindi', languages) &&
        !matchesIndianSubLanguage(item, 'malayalam', languages)
    )
);

// 6. Language Pools per Main Type (Strictly Non-Kannada, Sorted by Latest)
export const selectTeluguMovies = createSelector([selectTeluguPool], (items) =>
  items.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.MOVIES).sort(sortByLatest)
);
export const selectTamilMovies = createSelector([selectTamilPool], (items) =>
  items.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.MOVIES).sort(sortByLatest)
);
export const selectHindiMovies = createSelector([selectHindiPool], (items) =>
  items.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.MOVIES).sort(sortByLatest)
);
export const selectMalayalamMovies = createSelector([selectMalayalamPool], (items) =>
  items.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.MOVIES).sort(sortByLatest)
);
export const selectOtherIndianMovies = createSelector([selectOtherIndianPool], (items) =>
  items.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.MOVIES).sort(sortByLatest)
);

export const selectTeluguSongs = createSelector([selectTeluguPool], (items) =>
  items.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.SONGS)
);
export const selectTamilSongs = createSelector([selectTamilPool], (items) =>
  items.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.SONGS)
);
export const selectHindiSongs = createSelector([selectHindiPool], (items) =>
  items.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.SONGS)
);
export const selectMalayalamSongs = createSelector([selectMalayalamPool], (items) =>
  items.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.SONGS)
);
export const selectOtherIndianSongs = createSelector([selectOtherIndianPool], (items) =>
  items.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.SONGS)
);

export const selectTeluguSeries = createSelector([selectTeluguPool], (items) =>
  items.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.SERIES)
);
export const selectTamilSeries = createSelector([selectTamilPool], (items) =>
  items.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.SERIES)
);
export const selectHindiSeries = createSelector([selectHindiPool], (items) =>
  items.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.SERIES)
);
export const selectMalayalamSeries = createSelector([selectMalayalamPool], (items) =>
  items.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.SERIES)
);

export const selectTeluguPodcasts = createSelector([selectTeluguPool], (items) =>
  items.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.PODCASTS)
);
export const selectTamilPodcasts = createSelector([selectTamilPool], (items) =>
  items.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.PODCASTS)
);
export const selectHindiPodcasts = createSelector([selectHindiPool], (items) =>
  items.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.PODCASTS)
);
export const selectMalayalamPodcasts = createSelector([selectMalayalamPool], (items) =>
  items.filter((item) => getItemMainType(item) === MAIN_TYPE_IDS.PODCASTS)
);

// 7. Dynamic Main Types List (Hiding Empty Categories)
export const selectAvailableMainTypes = createSelector(
  [
    selectMoviesPool,
    selectPodcastsPool,
    selectSongsPool,
    selectSeriesPool,
    selectMicroDramaPool,
    selectShortsPool,
    selectAiCinemaPool,
    selectPortalItems,
  ],
  (movies, podcasts, songs, series, microDrama, shorts, aiCinema, portalItems): MainTypeItem[] => {
    return MAIN_TYPES.filter((type) => {
      if (type.id === MAIN_TYPE_IDS.ALL) return true;
      if (type.id === MAIN_TYPE_IDS.MOVIES) return movies.length > 0;
      if (type.id === MAIN_TYPE_IDS.PODCASTS) return podcasts.length > 0;
      if (type.id === MAIN_TYPE_IDS.SONGS) return songs.length > 0;
      if (type.id === MAIN_TYPE_IDS.SERIES) return series.length > 0;
      if (type.id === MAIN_TYPE_IDS.MICRO_DRAMA) return microDrama.length > 0;
      if (type.id === MAIN_TYPE_IDS.SHORTS) return shorts.length > 0;
      if (type.id === MAIN_TYPE_IDS.AI_CINEMA) return aiCinema.length > 0;
      return portalItems.some((item) => getItemMainType(item) === type.id);
    });
  }
);

// 8. Indian Languages Pills (Excludes Kannada)
export const selectIndianLanguagePills = createSelector(
  [selectLanguages],
  (languages) => {
    const list = [{ id: 'all', label: 'All Indian' }];
    const seen = new Set<string>(['all', 'kannada', 'kn', 'english', 'en', 'null', 'undefined']);

    languages.forEach((l) => {
      if (l.name && l.name.trim()) {
        const lower = l.name.trim().toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          list.push({ id: lower, label: l.name.trim() });
        }
      }
    });

    INDIAN_LANGUAGES_EXCLUDING_KANNADA.forEach((l) => {
      const lower = l.name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        list.push({ id: lower, label: l.name });
      }
    });

    return list;
  }
);

// 9. Portal Pills Selector:
// Kannada: [For You, Movies, Podcasts, Songs, Series, Micro-Drama, Shorts, AI Cinema]
// All Indian: [For You, Telugu, Tamil, Malayalam, Hindi, ..., Movies, Podcasts, Songs, Series, Micro-Drama, Shorts, AI Cinema]
export const selectPortalPills = createSelector(
  [selectPortalMode, selectAvailableMainTypes, selectIndianLanguagePills],
  (portalMode, availableMainTypes, indianLanguagePills): PortalPill[] => {
    if (portalMode === 'kannada') {
      return availableMainTypes.map((type) => ({
        id: type.id === MAIN_TYPE_IDS.ALL ? 'all' : `type_${type.id}`,
        label: type.label,
        kind: type.id === MAIN_TYPE_IDS.ALL ? ('all' as const) : ('main_type' as const),
        mainTypeId: type.id,
        icon: type.icon,
        typeKey: type.typeKey,
      }));
    }

    // All Indian Languages Portal
    // Order: For You -> Indian Languages -> Main Types
    const forYouPill: PortalPill = {
      id: 'all',
      label: 'For You',
      kind: 'all',
      mainTypeId: MAIN_TYPE_IDS.ALL,
      icon: MAIN_TYPES[0].icon,
      typeKey: 'all',
    };

    const langPills: PortalPill[] = indianLanguagePills
      .filter((l) => l.id !== 'all')
      .map((l) => ({
        id: `lang_${l.id}`,
        label: l.label,
        kind: 'language' as const,
        langKey: l.id,
      }));

    const mainTypePills: PortalPill[] = availableMainTypes
      .filter((t) => t.id !== MAIN_TYPE_IDS.ALL)
      .map((type) => ({
        id: `type_${type.id}`,
        label: type.label,
        kind: 'main_type' as const,
        mainTypeId: type.id,
        icon: type.icon,
        typeKey: type.typeKey,
      }));

    return [forYouPill, ...langPills, ...mainTypePills];
  }
);

// 10. Filtered Items by Selected Main Type
export const selectFilteredAllItems = createSelector(
  [selectPortalItems, selectSelectedTypeId],
  (portalItems, selectedTypeId) => portalItems.filter((item) => matchesMainType(item, selectedTypeId))
);

// 11. Filtered Continue Watching
export const selectFilteredContinueWatching = createSelector(
  [selectRawContinueWatching, selectPortalMode, selectSelectedIndianLanguage, selectLanguages, selectSelectedTypeId],
  (continueWatching, portalMode, selectedIndianLanguage, languages, selectedTypeId) => {
    const base = portalMode === 'kannada'
      ? continueWatching.filter(isKannadaCatalogItem)
      : continueWatching.filter(isNonKannadaCatalogItem).filter((i) => matchesIndianSubLanguage(i, selectedIndianLanguage, languages));

    return base.filter((item) => matchesMainType(item, selectedTypeId));
  }
);

// 12. Hero Banners (Uses Admin-configured MOBILE/ALL Hero Banners first, falls back to latest catalog)
export const selectHeroBanners = createSelector(
  [selectBanners, selectPortalMode, selectSelectedIndianLanguage, selectLanguages, selectSelectedTypeId, selectFilteredAllItems],
  (banners, portalMode, selectedIndianLanguage, languages, selectedTypeId, filteredAllItems): CatalogItem[] => {
    const activeTypeSlug = (() => {
      switch (selectedTypeId) {
        case MAIN_TYPE_IDS.MOVIES: return 'movie';
        case MAIN_TYPE_IDS.SONGS: return 'album';
        case MAIN_TYPE_IDS.SHORT_FILMS: return 'short_film';
        case MAIN_TYPE_IDS.MICRO_DRAMA: return 'microdrama';
        case MAIN_TYPE_IDS.PODCASTS: return 'podcast';
        case MAIN_TYPE_IDS.WEB_SERIES: return 'series';
        default: return '';
      }
    })();

    // 1. Filter Admin Hero Banners for MOBILE + current portal/pageSlug + type
    const matchingBanners = banners
      .filter((item: any) => {
        if (!item) return false;
        const plat = String(item.platform || item.placement || 'ALL').toUpperCase().trim();
        if (plat && plat !== 'ALL' && plat !== 'MOBILE') return false;

        const pageSlug = String(item.pageSlug || item.page_slug || 'all').toLowerCase().trim();
        if (pageSlug && pageSlug !== 'all') {
          if (pageSlug.includes(':')) {
            const [slugLang, slugType] = pageSlug.split(':');
            const langMatches =
              slugLang === 'all' ||
              (slugLang === 'kannada' && portalMode === 'kannada') ||
              ((slugLang === 'all-indian' || slugLang === 'all_indian') && portalMode !== 'kannada');
            const typeMatches =
              !slugType || slugType === 'all'
                ? selectedTypeId === MAIN_TYPE_IDS.ALL
                : activeTypeSlug !== '' && slugType === activeTypeSlug;
            return langMatches && typeMatches;
          }
          if (pageSlug === 'kannada') return portalMode === 'kannada' && selectedTypeId === MAIN_TYPE_IDS.ALL;
          if (pageSlug === 'all-indian' || pageSlug === 'all_indian') {
            return portalMode !== 'kannada' && selectedTypeId === MAIN_TYPE_IDS.ALL;
          }
          return activeTypeSlug !== '' && pageSlug === activeTypeSlug;
        }

        const langOk =
          portalMode === 'kannada'
            ? isKannadaCatalogItem(item)
            : isNonKannadaCatalogItem(item) && matchesIndianSubLanguage(item, selectedIndianLanguage, languages);
        return langOk && matchesMainType(item, selectedTypeId);
      })
      .sort((a: any, b: any) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0));

    // If Admin configured active Hero Banners for this Mobile view, display them in exact displayOrder!
    if (matchingBanners.length > 0) {
      return matchingBanners.slice(0, 8);
    }

    // 2. Fallback: latest catalog items when no Admin Hero Banners are configured
    const typeItems = filteredAllItems
      .filter((item) => matchesMainType(item, selectedTypeId))
      .sort(sortByLatest);

    const unique = new Map<number | string, CatalogItem>();
    typeItems.forEach((item) => {
      if (item && item.id !== undefined && !unique.has(item.id)) {
        if (item.landscape || item.thumbnail || item.image || (item as any).posterUrl) {
          unique.set(item.id, item);
        }
      }
    });

    if (unique.size === 0) {
      typeItems.slice(0, 8).forEach((item) => {
        if (item && item.id !== undefined && !unique.has(item.id)) {
          unique.set(item.id, item);
        }
      });
    }

    return Array.from(unique.values()).slice(0, 8);
  }
);

// 13. Filtered Sections
export const selectFilteredSections = createSelector(
  [selectSections, selectPortalMode, selectSelectedIndianLanguage, selectLanguages, selectSelectedTypeId],
  (sections, portalMode, selectedIndianLanguage, languages, selectedTypeId) => {
    return sections
      .filter((s) => {
        const title = (s.title || '').toLowerCase();
        return !title.includes('continue watching') && !title.includes('continue listening') && s.id !== 999;
      })
      .map((s) => ({
        ...s,
        data: s.data
          .filter((item) =>
            portalMode === 'kannada'
              ? isKannadaCatalogItem(item)
              : isNonKannadaCatalogItem(item) && matchesIndianSubLanguage(item, selectedIndianLanguage, languages)
          )
          .filter((item) => matchesMainType(item, selectedTypeId)),
      }))
      .filter((s) => s.data.length > 0);
  }
);

