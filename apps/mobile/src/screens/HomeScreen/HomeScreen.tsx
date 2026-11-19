import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { AppTheme } from '../../core/theme';
import { FilterPillBar } from '../../components/FilterPillBar';
import { OttTopBar } from '../../components/OttTopBar';
import { HeroCarousel } from '../../components/HeroCarousel';
import { FeaturedHeadingRow } from '../../components/FeaturedHeadingRow';
import { FeedUpgradeBanner } from '../../components/FeedUpgradeBanner';
import { AdMobBanner } from '../../components/AdMobBanner';
import { EmptyStateView } from '../../components/EmptyStateView';
import { MainTypeRails } from '../../components/MainTypeRails';
import { useHomeCatalog } from '../../hooks/useHomeCatalog';
import {
  MAIN_TYPES,
  MAIN_TYPE_IDS,
  PortalPill,
} from '../../constants/catalogConstants';

interface HomeScreenProps {
  initialTypeId?: number;
  initialLang?: string;
  route?: {
    params?: {
      initialTypeId?: number;
      initialLang?: string;
      lang?: string;
    };
  };
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  initialTypeId: propTypeId,
  initialLang: propLang,
  route,
}) => {
  const initialTypeId = propTypeId ?? route?.params?.initialTypeId ?? MAIN_TYPE_IDS.ALL;
  const initialLang = propLang ?? route?.params?.initialLang ?? route?.params?.lang;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const {
    portalMode,
    selectedTypeId,
    setSelectedTypeId,
    selectedIndianLanguage,
    setSelectedIndianLanguage,
    portalPills,
    activePillId,
    handlePillSelect,
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
    watchlistMap,
    onRefresh,
    fetchLanguageContent,
    refreshWatchlist,
    toggleWatchlist,
  } = useHomeCatalog(initialTypeId, initialLang);

  // Sync watchlist on focus
  useFocusEffect(
    useCallback(() => {
      refreshWatchlist();
    }, [refreshWatchlist])
  );

  const featuredTitle = useMemo((): string => {
    const typeObj = MAIN_TYPES.find((t) => t.id === selectedTypeId);
    const typeName = typeObj ? typeObj.label : 'For You';

    if (portalMode === 'kannada') {
      if (selectedTypeId === MAIN_TYPE_IDS.ALL) {
        return 'Kannada Entertainment';
      }
      return `Kannada ${typeName}`;
    }

    // All Indian Languages Portal
    const langName =
      selectedIndianLanguage !== 'all'
        ? selectedIndianLanguage.charAt(0).toUpperCase() + selectedIndianLanguage.slice(1)
        : '';

    if (selectedTypeId === MAIN_TYPE_IDS.ALL) {
      return langName ? `${langName} Entertainment` : 'All Indian Cinema & Shows';
    }
    return langName ? `${langName} ${typeName}` : `Indian ${typeName}`;
  }, [portalMode, selectedTypeId, selectedIndianLanguage]);

  return (
    <View style={styles.container}>
      <OttTopBar
        transparent={false}
        floating={false}
        brandText="MaxxPixels"
        title={portalMode === 'kannada' ? 'Kannada Cinema' : 'All Indian Languages'}
        onPortalPress={() => navigation.navigate('PortalSelection')}
        onSearchPress={() => navigation.navigate('Explore')}
        onNotificationsPress={() => navigation.navigate('Notifications')}
        onCastPress={() => {}}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={AppTheme.primary}
            colors={[AppTheme.primary]}
          />
        }
      >
        {/* 1. PRIMARY FILTER PILL BAR (In All-Indian: For You -> Languages -> Main Types; in Kannada: pure Kannada) */}
        <FilterPillBar<PortalPill>
          items={portalPills}
          selectedId={activePillId}
          onSelect={handlePillSelect}
          size="normal"
          containerStyle={styles.topHubContainer}
          isItemSelected={(item, selId) => String(item.id) === String(selId)}
        />

        {/* 2. HEADING & UPGRADE ROW */}
        <FeaturedHeadingRow
          title={featuredTitle}
          onUpgradePress={() => navigation.navigate('Subscription')}
        />

        {/* 3. HERO BANNER CAROUSEL (Strictly filtered by Portal + Language + Main Type) */}
        <HeroCarousel
          items={heroBanners}
          watchlistMap={watchlistMap}
          onWatchlistToggle={toggleWatchlist}
          onItemPress={(item) => navigation.navigate('Details', { movie: item })}
          loading={loading}
        />

        {/* Top AdMob Banner below Hero Carousel */}
        <AdMobBanner style={{ marginVertical: 8 }} />

        {/* 4. RAILS CONTENT SECTION */}
        {loadingLanguage && filteredAllItems.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E50914" />
          </View>
        ) : filteredAllItems.length === 0 && filteredSections.length === 0 ? (
          <EmptyStateView
            title={`No ${featuredTitle} content available`}
            subtitle="Exciting new releases and titles are arriving soon!"
          />
        ) : (
          <MainTypeRails
            portalMode={portalMode}
            selectedTypeId={selectedTypeId}
            selectedIndianLanguage={selectedIndianLanguage}
            continueWatching={filteredContinueWatching}
            moviesPool={moviesPool}
            podcastsPool={podcastsPool}
            songsPool={songsPool}
            seriesPool={seriesPool}
            microDramaPool={microDramaPool}
            shortsPool={shortsPool}
            aiCinemaPool={aiCinemaPool}
            teluguPool={teluguPool}
            tamilPool={tamilPool}
            hindiPool={hindiPool}
            malayalamPool={malayalamPool}
            otherIndianPool={otherIndianPool}
            teluguMovies={teluguMovies}
            tamilMovies={tamilMovies}
            hindiMovies={hindiMovies}
            malayalamMovies={malayalamMovies}
            otherIndianMovies={otherIndianMovies}
            teluguSongs={teluguSongs}
            tamilSongs={tamilSongs}
            hindiSongs={hindiSongs}
            malayalamSongs={malayalamSongs}
            otherIndianSongs={otherIndianSongs}
            teluguSeries={teluguSeries}
            tamilSeries={tamilSeries}
            hindiSeries={hindiSeries}
            malayalamSeries={malayalamSeries}
            teluguPodcasts={teluguPodcasts}
            tamilPodcasts={tamilPodcasts}
            hindiPodcasts={hindiPodcasts}
            malayalamPodcasts={malayalamPodcasts}
            filteredAllItems={filteredAllItems}
            filteredSections={filteredSections}
            onItemPress={(item) => navigation.navigate('Details', { movie: item })}
            onSeeAllPress={(params) => navigation.navigate('CategoryContent', params)}
            onTypeSelect={(typeId) => setSelectedTypeId(typeId)}
            onLanguageSelect={(langKey) => {
              setSelectedIndianLanguage(langKey);
              setSelectedTypeId(MAIN_TYPE_IDS.ALL);
              fetchLanguageContent(langKey);
            }}
          />
        )}

        {/* 5. GOOGLE ADMOB BANNER */}
        <AdMobBanner style={{ marginVertical: 12 }} />

        {/* 6. BOTTOM PROMOTIONAL UPGRADE BANNER */}
        <FeedUpgradeBanner
          title={portalMode === 'kannada' ? 'Your MaxxPixels Kannada Feed' : 'Your MaxxPixels Indian Cinema Feed'}
          onSubscribePress={() => navigation.navigate('Subscription')}
        />
      </ScrollView>
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  topHubContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

