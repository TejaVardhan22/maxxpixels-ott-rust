import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Search, X, Film, Sparkles, TrendingUp, ShoppingBag, Check } from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { CatalogService } from '../../services/catalogService';
import { CatalogItem, getPosterUrl, getBackgroundUrl } from '../../types';

import { EXPLORE_FILTER_CHIPS, MAIN_TYPE_IDS } from '../../constants/catalogConstants';
import { getItemMainType } from '../../utils/contentUtils';
import { AdMobBanner } from '../../components/AdMobBanner';

export const ExploreScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [trending, setTrending] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    CatalogService.getNewAndHot().then((items) => {
      setTrending(items.slice(0, 12));
    });
  }, []);

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const items = await CatalogService.searchContent(text.trim());
      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const rawDisplayItems = query.trim() ? results : trending;
  const [activeFilter, setActiveFilter] = useState('All');

  const filteredItems = rawDisplayItems.filter((item) => {
    if (activeFilter === 'Movies') return getItemMainType(item) === MAIN_TYPE_IDS.MOVIES;
    if (activeFilter === 'Podcasts') return getItemMainType(item) === MAIN_TYPE_IDS.PODCASTS;
    if (activeFilter === 'Songs') return getItemMainType(item) === MAIN_TYPE_IDS.SONGS;
    if (activeFilter === 'Web Series') return getItemMainType(item) === MAIN_TYPE_IDS.SERIES;
    if (activeFilter === 'Micro-Drama') return getItemMainType(item) === MAIN_TYPE_IDS.MICRO_DRAMA;
    if (activeFilter === 'Shorts') return getItemMainType(item) === MAIN_TYPE_IDS.SHORTS;
    if (activeFilter === 'AI Cinema') return getItemMainType(item) === MAIN_TYPE_IDS.AI_CINEMA;
    if (activeFilter === 'Free Content') return item.isPremium !== 1;
    if (activeFilter === 'VIP 4K') return item.isPremium === 1;
    return true;
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search Input Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.inputWrapper}>
          <Search size={18} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            placeholder="Search movies, series, actors..."
            placeholderTextColor="#64748B"
            value={query}
            onChangeText={handleSearch}
            style={styles.input}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')} style={styles.clearBtn}>
              <X size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips Horizontal Scroll */}
        <View style={{ marginTop: 10 }}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={EXPLORE_FILTER_CHIPS}
            keyExtractor={(chip) => chip}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item: chip }) => {
              const active = activeFilter === chip;
              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setActiveFilter(chip)}
                  style={{
                    backgroundColor: active ? AppTheme.primary : AppTheme.surface,
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: active ? AppTheme.primary : 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <Text
                    style={{
                      color: active ? '#FFFFFF' : '#94A3B8',
                      fontSize: 12,
                      fontWeight: active ? '700' : '500',
                    }}
                  >
                    {chip}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>

      {/* Title */}
      <View style={styles.headerRow}>
        {query.trim() ? (
          <Text style={styles.sectionTitle}>
            Results for "{query}" ({filteredItems.length})
          </Text>
        ) : (
          <View style={styles.trendingHeader}>
            <TrendingUp size={18} color="#FBBF24" />
            <Text style={styles.sectionTitle}>Popular & Trending Searches</Text>
          </View>
        )}
      </View>

      {/* AdMob Banner for Explore */}
      <AdMobBanner style={{ marginVertical: 6 }} />

      {/* Loading Indicator */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={AppTheme.primary} />
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Film size={48} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyTitle}>Coming Soon</Text>
          <Text style={styles.emptySub}>
            {activeFilter === 'Telugu Movies'
              ? 'Telugu movies are coming soon! Check back shortly.'
              : 'Content for this selection is coming soon! Stay tuned.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          numColumns={3}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          initialNumToRender={9}
          maxToRenderPerBatch={9}
          windowSize={5}
          renderItem={({ item }) => {
            const poster = getPosterUrl(item) || getBackgroundUrl(item);
            return (
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => navigation.navigate('Details', { movie: item })}
                style={styles.gridCard}
              >
                {poster ? (
                  <Image
                    source={{ uri: poster }}
                    style={styles.cardImage}
                    resizeMode="cover"
                    fadeDuration={0}
                  />
                ) : (
                  <View style={styles.cardPlaceholder}>
                    <Film size={24} color="rgba(255,255,255,0.3)" />
                  </View>
                )}
                {(item.isRent === 1 || (item as any).is_rent === 1 || String((item as any).monetization || '').toUpperCase() === 'TVOD') ? (
                  item.isRented === 1 || item.rentBuy === 1 || (item as any).is_rented === 1 ? (
                    <View style={[styles.tvodBadge, { backgroundColor: '#10B981' }]}>
                      <Check size={8} color="#FFFFFF" />
                      <Text style={[styles.tvodBadgeText, { color: '#FFFFFF' }]}>RENTED</Text>
                    </View>
                  ) : (
                    <View style={styles.tvodBadge}>
                      <ShoppingBag size={8} color="#0F172A" />
                      <Text style={styles.tvodBadgeText}>RENT</Text>
                    </View>
                  )
                ) : item.isPremium === 1 ? (
                  <View style={styles.vipBadge}>
                    <Text style={styles.vipBadgeText}>VIP</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

export default ExploreScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTheme.surfaceElevated,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  headerRow: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  gridContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  gridCard: {
    width: '31%',
  },
  cardImage: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    backgroundColor: AppTheme.surface,
  },
  cardPlaceholder: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    backgroundColor: AppTheme.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tvodBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 3,
  },
  tvodBadgeText: {
    color: '#0F172A',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  vipBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#EAB308',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vipBadgeText: {
    color: AppTheme.background,
    fontSize: 9,
    fontWeight: '900',
  },
  cardTitle: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
  },
  emptySub: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
});
