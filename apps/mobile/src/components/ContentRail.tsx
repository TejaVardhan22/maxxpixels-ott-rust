import { AppTheme } from '../core/theme';
import React, { useCallback } from 'react';
import {
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Film, ChevronRight, ShoppingBag, Check } from 'lucide-react-native';
import { CatalogItem, getBackgroundUrl, getPosterUrl } from '../types';

export enum RailVariant {
  standard,
  ranked,
  banner,
}

interface ContentRailProps {
  title: string;
  items: CatalogItem[];
  variant?: RailVariant;
  isLandscape?: boolean;
  showProgress?: boolean;
  hideLanguageTag?: boolean;
  onItemPress?: (item: CatalogItem) => void;
  onSeeAllPress?: () => void;
}

const CARD_WIDTH = 126;
const CARD_HEIGHT = 182;
const CARD_GAP = 8;

const RailSeparator = React.memo(() => <View style={{ width: CARD_GAP }} />);

export const ContentRail: React.FC<ContentRailProps> = React.memo(({
  title,
  items,
  variant = RailVariant.standard,
  showProgress = false,
  hideLanguageTag = false,
  onItemPress,
  onSeeAllPress,
}) => {
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: CARD_WIDTH + CARD_GAP,
      offset: (CARD_WIDTH + CARD_GAP) * index,
      index,
    }),
    []
  );

  if (!items || items.length === 0) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={onSeeAllPress ? 0.7 : 1}
        onPress={onSeeAllPress}
        style={styles.headerRow}
      >
        <View style={styles.titleWithArrow}>
          <Text style={styles.title}>{title}</Text>
          {onSeeAllPress && <ChevronRight size={18} color="#94A3B8" style={{ marginLeft: 4 }} />}
        </View>
        {onSeeAllPress && (
          <View style={styles.seeAllWrap}>
            <Text style={styles.seeAll}>See all</Text>
          </View>
        )}
      </TouchableOpacity>

      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={RailSeparator}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={3}
        removeClippedSubviews={Platform.OS === 'android'}
        getItemLayout={getItemLayout}
        renderItem={({ item, index }) => {
          const imageUrl = getPosterUrl(item) || getBackgroundUrl(item);
          const isLive =
            (item.genres || []).some((g) => g.toLowerCase().includes('live')) ||
            item.videoType === 3 ||
            (item as any).contentType === 'LIVE';

          return (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => onItemPress && onItemPress(item)}
              style={styles.itemContainer}
            >
              <View style={styles.cardWrapper}>
                <View style={styles.card}>
                  {imageUrl ? (
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.image}
                      resizeMode="cover"
                      fadeDuration={0}
                    />
                  ) : (
                    <View style={styles.placeholder}>
                      <Film size={28} color="rgba(255, 255, 255, 0.25)" />
                    </View>
                  )}

                  {/* Badges & Tags */}
                  {(item.isRent === 1 || (item as any).is_rent === 1 || String((item as any).monetization || '').toUpperCase() === 'TVOD') && (
                    item.isRented === 1 || item.rentBuy === 1 || (item as any).is_rented === 1 ? (
                      <View style={[styles.tvodBadge, { backgroundColor: '#10B981', borderColor: '#059669' }]}>
                        <Check size={8.5} color="#FFFFFF" />
                        <Text style={[styles.tvodBadgeText, { color: '#FFFFFF' }]}>RENTED</Text>
                      </View>
                    ) : (
                      <View style={styles.tvodBadge}>
                        <ShoppingBag size={8.5} color="#0F172A" />
                        <Text style={styles.tvodBadgeText}>
                          RENT · ₹{item.rentPrice ?? (item as any).price ?? 0}
                        </Text>
                      </View>
                    )
                  )}

                  {isLive && (
                    <View style={styles.liveBadge}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveBadgeText}>LIVE</Text>
                    </View>
                  )}

                  {/* Resume / Continue Watching Progress Bar - only shown on Continue Watching rail */}
                  {Boolean(showProgress && (
                    (item.percentage !== undefined && item.percentage > 0) ||
                    (item.stopTime !== undefined && item.stopTime > 0)
                  )) && (
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(
                              100,
                              Math.max(
                                5,
                                item.percentage !== undefined
                                  ? item.percentage
                                  : item.stopTime && item.videoDuration
                                  ? Math.round((item.stopTime / item.videoDuration) * 100)
                                  : 0
                              )
                            )}%`,
                          },
                        ]}
                      />
                    </View>
                  )}
                </View>

                {/* Ranked numbering if rail is ranked */}
                {variant === RailVariant.ranked && (
                  <View style={styles.rankContainer}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                  </View>
                )}
              </View>

              {/* Content Title & Subtitle below card */}
              <View style={styles.cardTextContainer}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardSubtitle} numberOfLines={1}>
                  {[
                    item.releaseYear || item.releaseDate?.match(/\b(19|20)\d{2}\b/)?.[0],
                    item.genres?.[0],
                  ]
                    .filter(Boolean)
                    .join(' • ') || 'Exclusive'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
});

export default ContentRail;

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  titleWithArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  seeAllWrap: {
    paddingLeft: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  seeAll: {
    color: AppTheme.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  itemContainer: {
    width: CARD_WIDTH,
  },
  cardWrapper: {
    position: 'relative',
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
    backgroundColor: AppTheme.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: AppTheme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tvodBadge: {
    position: 'absolute',
    left: 6,
    top: 6,
    backgroundColor: '#F59E0B',
    borderColor: '#D97706',
    borderWidth: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.4,
    shadowRadius: 2.5,
    elevation: 4,
    zIndex: 10,
  },
  tvodBadgeText: {
    color: '#0F172A',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  liveBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardTextContainer: {
    marginTop: 6,
    paddingHorizontal: 1,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  cardSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  rankContainer: {
    position: 'absolute',
    left: -4,
    bottom: -6,
  },
  rankText: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
  },
  progressBarTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: AppTheme.primary,
  },
});
