import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Play, Plus, Check, ShoppingBag } from 'lucide-react-native';
import { AppTheme } from '../core/theme';
import { CatalogItem, getBackgroundUrl, getPosterUrl } from '../types';
import { formatDurationMinutes, formatReleaseYear } from '../utils/contentUtils';

export interface HeroCarouselProps {
  items: CatalogItem[];
  watchlistMap?: Record<number, boolean>;
  onWatchlistToggle?: (item: CatalogItem) => void;
  onItemPress?: (item: CatalogItem) => void;
  loading?: boolean;
  autoPlayIntervalMs?: number;
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({
  items,
  watchlistMap = {},
  onWatchlistToggle,
  onItemPress,
  loading = false,
  autoPlayIntervalMs = 5000,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [failedLogos, setFailedLogos] = useState<Record<string, boolean>>({});
  const carouselRef = useRef<FlatList>(null);

  const isLandscape = screenWidth > screenHeight;
  const cardWidth = Math.min(screenWidth - 36, 480);
  const cardGap = 10;
  const cardStride = cardWidth + cardGap;
  const cardInset = (screenWidth - cardWidth) / 2;
  const heroHeight = isLandscape ? Math.max(300, screenHeight * 0.8) : Math.round(cardWidth * 1.27);

  // Auto-advance
  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % items.length;
        try {
          carouselRef.current?.scrollToIndex({ index: next, animated: true });
        } catch {}
        return next;
      });
    }, autoPlayIntervalMs);
    return () => clearInterval(interval);
  }, [items.length, autoPlayIntervalMs]);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: cardStride,
      offset: cardStride * index,
      index,
    }),
    [cardStride]
  );

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { width: screenWidth, height: heroHeight },
          styles.placeholder,
        ]}
      >
        <ActivityIndicator size="large" color={AppTheme.primary} />
      </View>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { width: screenWidth, height: heroHeight }]}>
      <FlatList
        ref={carouselRef}
        data={items}
        horizontal
        snapToInterval={cardStride}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: cardInset }}
        ItemSeparatorComponent={() => <View style={{ width: cardGap }} />}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => `${item?.id ?? index}-${index}`}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews={Platform.OS === 'android'}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={() => {
          try {
            carouselRef.current?.scrollToOffset({ offset: 0, animated: false });
          } catch {}
        }}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / cardStride);
          setCurrentIndex(Math.max(0, Math.min(index, items.length - 1)));
        }}
        renderItem={({ item, index }) => {
          if (!item) return null;
          const heroImage = getBackgroundUrl(item) || getPosterUrl(item) || '';
          const isWatchlisted = Boolean(item.id && watchlistMap[item.id]);
          const releaseYearText = formatReleaseYear(item);
          const durationText = formatDurationMinutes(item.videoDuration);
          const genresList = Array.isArray(item.genres) ? item.genres : [];

          const metadataParts = [
            releaseYearText,
            ...genresList,
            item.language,
            item.maturityRating,
            durationText,
          ].filter(Boolean);

          return (
            <View
              style={[
                styles.slide,
                {
                  width: cardWidth,
                  height: heroHeight,
                  transform: [{ scale: index === currentIndex ? 1 : 0.95 }],
                },
              ]}
            >
              {heroImage ? (
                <Image
                  source={{ uri: heroImage }}
                  style={styles.image}
                  resizeMode="cover"
                  fadeDuration={0}
                />
              ) : (
                <View style={[styles.image, styles.placeholder]} />
              )}

              {/* Gradient Vignette */}
              <Svg style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="topVignette" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={AppTheme.background} stopOpacity="0.1" />
                    <Stop offset="0.6" stopColor={AppTheme.background} stopOpacity="0.05" />
                    <Stop offset="1" stopColor={AppTheme.background} stopOpacity="0" />
                  </LinearGradient>
                  <LinearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={AppTheme.background} stopOpacity="0" />
                    <Stop offset="0.3" stopColor={AppTheme.background} stopOpacity="0.25" />
                    <Stop offset="0.6" stopColor={AppTheme.background} stopOpacity="0.8" />
                    <Stop offset="0.85" stopColor={AppTheme.background} stopOpacity="0.96" />
                    <Stop offset="1" stopColor={AppTheme.background} stopOpacity="1" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width={cardWidth} height={120} fill="url(#topVignette)" />
                <Rect
                  x="0"
                  y={heroHeight * 0.35}
                  width={cardWidth}
                  height={heroHeight * 0.65}
                  fill="url(#bottomFade)"
                />
              </Svg>

              <TouchableOpacity
                activeOpacity={0.95}
                accessibilityRole="button"
                accessibilityLabel={`View details for ${item.name}`}
                onPress={() => onItemPress?.(item)}
                style={StyleSheet.absoluteFill}
              />

              {(item.isRent === 1 || (item as any).is_rent === 1 || String((item as any).monetization || '').toUpperCase() === 'TVOD') && (
                <View pointerEvents="none" style={styles.heroTvodFlag}>
                  {item.isRented === 1 || item.rentBuy === 1 || (item as any).is_rented === 1 ? (
                    <View style={[styles.heroTvodPill, { backgroundColor: '#10B981' }]}>
                      <Check size={11} color="#FFFFFF" />
                      <Text style={[styles.heroTvodText, { color: '#FFFFFF' }]}>RENTED</Text>
                    </View>
                  ) : (
                    <View style={styles.heroTvodPill}>
                      <ShoppingBag size={11} color="#0F172A" />
                      <Text style={styles.heroTvodText}>
                        RENT · ₹{item.rentPrice ?? (item as any).price ?? 0}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View pointerEvents="box-none" style={styles.captionArea}>
                <View pointerEvents="none" style={styles.titleArea}>
                  {item.logoImage && !failedLogos[item.logoImage] ? (
                    <Image
                      source={{ uri: item.logoImage }}
                      resizeMode="contain"
                      style={styles.logo}
                      accessibilityLabel={item.name}
                      onError={() =>
                        setFailedLogos((cur) => ({ ...cur, [item.logoImage!]: true }))
                      }
                    />
                  ) : (
                    <Text style={styles.title} numberOfLines={2}>
                      {item.name}
                    </Text>
                  )}
                </View>
                <Text pointerEvents="none" style={styles.metadata} numberOfLines={2}>
                  {metadataParts.join(' • ')}
                </Text>
              </View>

              <View style={styles.actionsArea}>
                {onWatchlistToggle && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={
                      isWatchlisted
                        ? `Remove ${item.name} from watchlist`
                        : `Add ${item.name} to watchlist`
                    }
                    activeOpacity={0.8}
                    onPress={() => onWatchlistToggle(item)}
                    style={styles.saveButton}
                  >
                    {isWatchlisted ? (
                      <Check size={24} color="#FFFFFF" />
                    ) : (
                      <Plus size={24} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Watch ${item.name}`}
                  activeOpacity={0.8}
                  onPress={() => onItemPress?.(item)}
                  style={styles.playButton}
                >
                  <Play size={22} color="#08090C" fill="#08090C" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {items.length > 1 && (
        <View style={styles.indicatorsRow}>
          {items.map((_, i) => {
            const safeCurrent = Math.max(0, Math.min(currentIndex, items.length - 1));
            const isActive = safeCurrent === i;
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                onPress={() => {
                  setCurrentIndex(i);
                  try {
                    carouselRef.current?.scrollToIndex({ index: i, animated: true });
                  } catch {}
                }}
                style={[styles.indicatorDot, isActive && styles.indicatorPillActive]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: 24,
  },
  slide: {
    borderRadius: 26,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: AppTheme.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captionArea: {
    position: 'absolute',
    bottom: 16,
    left: 14,
    right: 14,
  },
  titleArea: {
    marginRight: 62,
    minHeight: 62,
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  logo: {
    width: '100%',
    height: 88,
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 28,
    lineHeight: 32,
    textShadowColor: '#000000',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 2 },
  },
  metadata: {
    color: '#D3D3D6',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    paddingRight: 60,
  },
  actionsArea: {
    position: 'absolute',
    right: 14,
    bottom: 43,
    gap: 12,
  },
  saveButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D7DBE4',
    borderWidth: 1,
    borderColor: '#F0F1F5',
  },
  indicatorsRow: {
    position: 'absolute',
    bottom: -16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    zIndex: 20,
  },
  indicatorDot: {
    width: 6,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  indicatorPillActive: {
    width: 22,
    backgroundColor: AppTheme.primary,
    borderRadius: 2,
  },
  heroTvodFlag: {
    position: 'absolute',
    top: 14,
    left: 14,
    zIndex: 20,
  },
  heroTvodPill: {
    backgroundColor: '#F59E0B',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 3,
    elevation: 5,
  },
  heroTvodText: {
    color: '#0F172A',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
