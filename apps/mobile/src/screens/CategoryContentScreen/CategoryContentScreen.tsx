import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Film, Search, X, Star, ShoppingBag, Check } from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { CatalogService } from '../../services/catalogService';
import { CatalogItem, getBackgroundUrl, getPosterUrl } from '../../types';
import { AdMobBanner } from '../../components/AdMobBanner';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 44) / 3;

export const CategoryContentScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const categoryId: number = route.params?.categoryId || 0;
  const videoType: number | undefined = route.params?.videoType;
  const title: string = route.params?.title || 'Category Collection';
  const initialItems: CatalogItem[] | undefined = route.params?.initialItems;

  const [items, setItems] = useState<CatalogItem[]>(initialItems || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(!initialItems || initialItems.length === 0);

  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      setItems(initialItems);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (categoryId > 0) {
      CatalogService.getContentByCategory(categoryId)
        .then((res: CatalogItem[]) => setItems(res))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    } else {
      CatalogService.searchContent('')
        .then((res: CatalogItem[]) => setItems(res))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }
  }, [categoryId, initialItems]);

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      item.name.toLowerCase().includes(q) ||
      (item.categoryName && item.categoryName.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.titleWrapper}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.countSubtitle}>
            {loading ? 'Loading...' : `${filteredItems.length} Titles`}
          </Text>
        </View>
      </View>

      {/* Search Filter Input */}
      <View style={styles.searchBarWrap}>
        <View style={styles.searchBox}>
          <Search size={16} color="#64748B" style={styles.searchIcon} />
          <TextInput
            placeholder={`Search in ${title}...`}
            placeholderTextColor="#475569"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity activeOpacity={0.7} onPress={() => setSearchQuery('')}>
              <X size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* AdMob Banner for Category / Collection */}
      <AdMobBanner style={{ marginVertical: 6 }} />

      {/* Content Grid */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={AppTheme.primary} />
          <Text style={styles.loadingText}>Fetching collection...</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Film size={48} color="rgba(255, 255, 255, 0.2)" />
          <Text style={styles.emptyTitle}>No Content Found</Text>
          <Text style={styles.emptySub}>
            {searchQuery
              ? `No titles match "${searchQuery}" in this collection.`
              : `No titles currently available in "${title}".`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          numColumns={3}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={[styles.gridContainer, { paddingBottom: insets.bottom + 24 }]}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          initialNumToRender={9}
          maxToRenderPerBatch={9}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          renderItem={({ item }) => {
            const poster = getPosterUrl(item) || getBackgroundUrl(item);

            return (
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => navigation.navigate('Details', { movie: item })}
                style={[styles.card, { width: CARD_WIDTH }]}
              >
                <View style={styles.posterContainer}>
                  {poster ? (
                    <Image
                      source={{ uri: poster }}
                      style={styles.image}
                      resizeMode="cover"
                      fadeDuration={0}
                    />
                  ) : (
                    <View style={styles.placeholder}>
                      <Film size={26} color="rgba(255, 255, 255, 0.25)" />
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
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

export default CategoryContentScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppTheme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  titleWrapper: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  countSubtitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  searchBarWrap: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: AppTheme.surfaceElevated,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  gridContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  gridRow: {
    justifyContent: 'flex-start',
    gap: 6,
    marginBottom: 14,
  },
  card: {
    marginBottom: 4,
  },
  posterContainer: {
    width: '100%',
    height: CARD_WIDTH * 1.48,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: AppTheme.surface,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    backgroundColor: AppTheme.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
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
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
  cardSubtitle: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
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
    lineHeight: 18,
  },
});
