import { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchHomeCatalog,
  fetchLanguageContent as fetchLanguageContentThunk,
  setPortalMode as setPortalModeAction,
  setSelectedIndianLanguage as setSelectedIndianLanguageAction,
  setSelectedTypeId as setSelectedTypeIdAction,
} from '../store/slices/catalogSlice';
import {
  fetchContinueWatching,
  fetchWatchlist,
  toggleWatchlistThunk,
} from '../store/slices/engagementSlice';
import {
  selectAiCinemaPool,
  selectAvailableMainTypes,
  selectCatalogError,
  selectCatalogLoading,
  selectCatalogRefreshing,
  selectFilteredAllItems,
  selectFilteredContinueWatching,
  selectFilteredSections,
  selectHeroBanners,
  selectHindiMovies,
  selectHindiPodcasts,
  selectHindiPool,
  selectHindiSeries,
  selectHindiSongs,
  selectIndianLanguagePills,
  selectLanguages,
  selectLoadingLanguage,
  selectMalayalamMovies,
  selectMalayalamPodcasts,
  selectMalayalamPool,
  selectMalayalamSeries,
  selectMalayalamSongs,
  selectMicroDramaPool,
  selectMoviesPool,
  selectOtherIndianMovies,
  selectOtherIndianPool,
  selectOtherIndianSongs,
  selectPodcastsPool,
  selectPortalMode,
  selectPortalPills,
  selectSelectedIndianLanguage,
  selectSelectedTypeId,
  selectSeriesPool,
  selectShortsPool,
  selectSongsPool,
  selectTamilMovies,
  selectTamilPodcasts,
  selectTamilPool,
  selectTamilSeries,
  selectTamilSongs,
  selectTeluguMovies,
  selectTeluguPodcasts,
  selectTeluguPool,
  selectTeluguSeries,
  selectTeluguSongs,
  selectWatchlistMap,
} from '../store/selectors/catalogSelectors';
import { CatalogItem } from '../types';
import { MAIN_TYPE_IDS, PortalPill } from '../constants/catalogConstants';

export function useHomeCatalog(initialTypeId: number = MAIN_TYPE_IDS.ALL, initialLang?: string) {
  const dispatch = useAppDispatch();

  // Redux Selectors
  const portalMode = useAppSelector(selectPortalMode);
  const selectedTypeId = useAppSelector(selectSelectedTypeId);
  const selectedIndianLanguage = useAppSelector(selectSelectedIndianLanguage);
  const languages = useAppSelector(selectLanguages);
  const heroBanners = useAppSelector(selectHeroBanners);
  const filteredSections = useAppSelector(selectFilteredSections);
  const filteredAllItems = useAppSelector(selectFilteredAllItems);
  const filteredContinueWatching = useAppSelector(selectFilteredContinueWatching);
  const availableMainTypes = useAppSelector(selectAvailableMainTypes);
  const indianLanguagePills = useAppSelector(selectIndianLanguagePills);
  const portalPills = useAppSelector(selectPortalPills);

  // Main Type Pools
  const moviesPool = useAppSelector(selectMoviesPool);
  const podcastsPool = useAppSelector(selectPodcastsPool);
  const songsPool = useAppSelector(selectSongsPool);
  const seriesPool = useAppSelector(selectSeriesPool);
  const microDramaPool = useAppSelector(selectMicroDramaPool);
  const shortsPool = useAppSelector(selectShortsPool);
  const aiCinemaPool = useAppSelector(selectAiCinemaPool);

  // Language Pools (Strictly Non-Kannada)
  const teluguPool = useAppSelector(selectTeluguPool);
  const tamilPool = useAppSelector(selectTamilPool);
  const hindiPool = useAppSelector(selectHindiPool);
  const malayalamPool = useAppSelector(selectMalayalamPool);
  const otherIndianPool = useAppSelector(selectOtherIndianPool);

  // Type + Language breakdown pools
  const teluguMovies = useAppSelector(selectTeluguMovies);
  const tamilMovies = useAppSelector(selectTamilMovies);
  const hindiMovies = useAppSelector(selectHindiMovies);
  const malayalamMovies = useAppSelector(selectMalayalamMovies);
  const otherIndianMovies = useAppSelector(selectOtherIndianMovies);

  const teluguSongs = useAppSelector(selectTeluguSongs);
  const tamilSongs = useAppSelector(selectTamilSongs);
  const hindiSongs = useAppSelector(selectHindiSongs);
  const malayalamSongs = useAppSelector(selectMalayalamSongs);
  const otherIndianSongs = useAppSelector(selectOtherIndianSongs);

  const teluguSeries = useAppSelector(selectTeluguSeries);
  const tamilSeries = useAppSelector(selectTamilSeries);
  const hindiSeries = useAppSelector(selectHindiSeries);
  const malayalamSeries = useAppSelector(selectMalayalamSeries);

  const teluguPodcasts = useAppSelector(selectTeluguPodcasts);
  const tamilPodcasts = useAppSelector(selectTamilPodcasts);
  const hindiPodcasts = useAppSelector(selectHindiPodcasts);
  const malayalamPodcasts = useAppSelector(selectMalayalamPodcasts);

  const loading = useAppSelector(selectCatalogLoading);
  const refreshing = useAppSelector(selectCatalogRefreshing);
  const loadingLanguage = useAppSelector(selectLoadingLanguage);
  const error = useAppSelector(selectCatalogError);
  const watchlistMap = useAppSelector(selectWatchlistMap);

  // Initial & Portal Data Fetch
  useEffect(() => {
    dispatch(fetchHomeCatalog({ typeId: selectedTypeId }));
    dispatch(fetchWatchlist());
    dispatch(fetchContinueWatching());
  }, [dispatch, selectedTypeId, portalMode]);

  // Handle external portal / language route changes
  const prevLangRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const raw = (initialLang || '').toLowerCase().trim();
    if (!raw || raw === prevLangRef.current) return;
    prevLangRef.current = raw;

    if (raw === 'kannada' || raw === 'kn') {
      dispatch(setPortalModeAction('kannada'));
      dispatch(fetchLanguageContentThunk('kannada'));
    } else if (raw === 'all-indian' || raw === 'all_indian' || raw === 'all') {
      dispatch(setPortalModeAction('all_indian'));
      dispatch(setSelectedIndianLanguageAction('all'));
      // Preload major Indian languages for rich content rails
      dispatch(fetchLanguageContentThunk('telugu'));
      dispatch(fetchLanguageContentThunk('tamil'));
      dispatch(fetchLanguageContentThunk('hindi'));
      dispatch(fetchLanguageContentThunk('malayalam'));
    } else if (raw) {
      dispatch(setPortalModeAction('all_indian'));
      dispatch(setSelectedIndianLanguageAction(raw));
      dispatch(fetchLanguageContentThunk(raw));
    }
  }, [initialLang, dispatch]);

  // Initial fetch for Kannada or All-Indian
  useEffect(() => {
    if (portalMode === 'kannada') {
      dispatch(fetchLanguageContentThunk('kannada'));
    } else if (portalMode === 'all_indian') {
      dispatch(fetchLanguageContentThunk('telugu'));
      dispatch(fetchLanguageContentThunk('tamil'));
      dispatch(fetchLanguageContentThunk('hindi'));
      dispatch(fetchLanguageContentThunk('malayalam'));
    }
  }, [portalMode, dispatch]);

  // Fallback to 'For You' if active type is not available in current portal/language
  useEffect(() => {
    if (
      selectedTypeId !== MAIN_TYPE_IDS.ALL &&
      availableMainTypes.length > 0 &&
      !availableMainTypes.some((t) => t.id === selectedTypeId)
    ) {
      dispatch(setSelectedTypeIdAction(MAIN_TYPE_IDS.ALL));
    }
  }, [availableMainTypes, selectedTypeId, dispatch]);

  // Actions
  const setSelectedTypeId = useCallback(
    (typeId: number) => {
      dispatch(setSelectedTypeIdAction(typeId));
    },
    [dispatch]
  );

  const setPortalMode = useCallback(
    (mode: 'kannada' | 'all_indian') => {
      dispatch(setPortalModeAction(mode));
    },
    [dispatch]
  );

  const setSelectedIndianLanguage = useCallback(
    (lang: string) => {
      dispatch(setSelectedIndianLanguageAction(lang));
    },
    [dispatch]
  );

  const fetchLanguageContent = useCallback(
    (langName: string) => {
      dispatch(fetchLanguageContentThunk(langName));
    },
    [dispatch]
  );

  const handlePillSelect = useCallback(
    (pill: PortalPill) => {
      if (pill.kind === 'all') {
        dispatch(setSelectedTypeIdAction(MAIN_TYPE_IDS.ALL));
        dispatch(setSelectedIndianLanguageAction('all'));
      } else if (pill.kind === 'language') {
        const langKey = (pill.langKey || String(pill.id).replace('lang_', '')).toLowerCase().trim();
        dispatch(setSelectedIndianLanguageAction(langKey));
        dispatch(setSelectedTypeIdAction(MAIN_TYPE_IDS.ALL));
        dispatch(fetchLanguageContentThunk(langKey));
      } else if (pill.kind === 'main_type') {
        const tId = pill.mainTypeId ?? MAIN_TYPE_IDS.ALL;
        dispatch(setSelectedTypeIdAction(tId));
      }
    },
    [dispatch]
  );

  const onRefresh = useCallback(() => {
    dispatch(fetchHomeCatalog({ typeId: selectedTypeId, isRefresh: true }));
    dispatch(fetchWatchlist());
    dispatch(fetchContinueWatching());
    if (portalMode === 'kannada') {
      dispatch(fetchLanguageContentThunk('kannada'));
    } else {
      if (selectedIndianLanguage !== 'all') {
        dispatch(fetchLanguageContentThunk(selectedIndianLanguage));
      } else {
        dispatch(fetchLanguageContentThunk('telugu'));
        dispatch(fetchLanguageContentThunk('tamil'));
        dispatch(fetchLanguageContentThunk('hindi'));
        dispatch(fetchLanguageContentThunk('malayalam'));
      }
    }
  }, [selectedTypeId, portalMode, selectedIndianLanguage, dispatch]);

  const toggleWatchlist = useCallback(
    (item: CatalogItem) => {
      dispatch(toggleWatchlistThunk(item));
    },
    [dispatch]
  );

  const refreshWatchlist = useCallback(() => {
    dispatch(fetchWatchlist());
    dispatch(fetchContinueWatching());
  }, [dispatch]);

  // Active pill ID helper
  const activePillId =
    selectedIndianLanguage !== 'all'
      ? `lang_${selectedIndianLanguage}`
      : selectedTypeId !== MAIN_TYPE_IDS.ALL
      ? `type_${selectedTypeId}`
      : 'all';

  return {
    portalMode,
    setPortalMode,
    selectedTypeId,
    setSelectedTypeId,
    selectedIndianLanguage,
    setSelectedIndianLanguage,
    availableMainTypes,
    indianLanguagePills,
    portalPills,
    activePillId,
    handlePillSelect,
    languages,
    heroBanners,
    filteredSections,
    filteredAllItems,
    filteredContinueWatching,
    moviesPool,
    podcastsPool,
    songsPool,
    seriesPool,
    microDramaPool,
    shortsPool,
    aiCinemaPool,
    teluguPool,
    tamilPool,
    hindiPool,
    malayalamPool,
    otherIndianPool,
    teluguMovies,
    tamilMovies,
    hindiMovies,
    malayalamMovies,
    otherIndianMovies,
    teluguSongs,
    tamilSongs,
    hindiSongs,
    malayalamSongs,
    otherIndianSongs,
    teluguSeries,
    tamilSeries,
    hindiSeries,
    malayalamSeries,
    teluguPodcasts,
    tamilPodcasts,
    hindiPodcasts,
    malayalamPodcasts,
    loading,
    refreshing,
    loadingLanguage,
    error,
    watchlistMap,
    onRefresh,
    fetchLanguageContent,
    refreshWatchlist,
    toggleWatchlist,
  };
}

