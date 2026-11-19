import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import {
  Flame,
  Sparkles,
  Bell,
  BellRing,
  Share2,
  Play,
  Plus,
  Check,
  Film,
  Calendar,
  Trophy,
  Star,
  Info,
  Crown,
  Clapperboard,
} from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { AppConfig } from '../../core/config';
import { CatalogService } from '../../services/catalogService';
import { EngagementService } from '../../services/engagementService';
import { AuthService } from '../../services/authService';
import { CatalogItem, getBackgroundUrl, getPosterUrl } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Toast } from '../../components/Toast';
import { SweetAlert } from '../../components/SweetAlert';
import { AdMobBanner } from '../../components/AdMobBanner';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MEDIA_HEIGHT = Math.round((SCREEN_WIDTH - 32) * (9 / 16));

type HotTabType = 'all' | 'coming_soon' | 'trending' | 'top10' | 'ai_cinema';

interface HotTabOption {
  id: HotTabType;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; fill?: string }>;
}

const TAB_OPTIONS: HotTabOption[] = [
  { id: 'all', label: '🔥 All New', icon: Flame },
  { id: 'coming_soon', label: '🗓️ Coming Soon', icon: Calendar },
  { id: 'trending', label: "🍿 Everyone's Watching", icon: Sparkles },
  { id: 'top10', label: '🏆 Top 10', icon: Trophy },
];

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const getReleaseDateDetails = (item: CatalogItem, index: number) => {
  if (item.releaseDate) {
    const parsed = new Date(item.releaseDate);
    if (!isNaN(parsed.getTime())) {
      const m = MONTH_NAMES[parsed.getMonth()];
      const d = String(parsed.getDate()).padStart(2, '0');
      const year = parsed.getFullYear();
      return {
        month: m,
        day: d,
        releaseBadge: `Coming ${d} ${m}`,
        fullText: `Arriving ${d} ${m} ${year}`,
      };
    }

    const isoMatch = item.releaseDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const monthIdx = parseInt(isoMatch[2], 10) - 1;
      const m = MONTH_NAMES[Math.max(0, Math.min(11, monthIdx))];
      const d = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
      return {
        month: m,
        day: d,
        releaseBadge: `Coming ${d} ${m}`,
        fullText: `Coming ${d} ${m} ${isoMatch[1]}`,
      };
    }
  }

  const numId = typeof item.id === 'number' && Number.isFinite(item.id) ? item.id : (String(item.id || '1').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) || 1);

  if (item.releaseYear) {
    const cleanYear = item.releaseYear.trim();
    const curYear = new Date().getFullYear();
    const day = String(((numId * 7 + index * 3) % 28) + 1).padStart(2, '0');
    const month = MONTH_NAMES[(numId + index) % 12];
    return {
      month,
      day,
      releaseBadge: cleanYear === String(curYear) ? `Coming ${month}` : `Coming ${cleanYear}`,
      fullText: `Arriving ${month} ${cleanYear}`,
    };
  }

  const d = String(((numId * 5 + 7) % 27) + 1).padStart(2, '0');
  const m = MONTH_NAMES[(numId + 2) % 12];
  return {
    month: m,
    day: d,
    releaseBadge: 'Coming Soon',
    fullText: `Coming ${d} ${m}`,
  };
};

export const NewHotScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<HotTabType>('all');
  const [allItems, setAllItems] = useState<CatalogItem[]>([]);
  const [trendingItems, setTrendingItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // User engagement state
  const [remindedIds, setRemindedIds] = useState<Record<string, boolean>>({});
  const [watchlistMap, setWatchlistMap] = useState<Record<string, boolean>>({});

  // Load saved reminders on mount
  useEffect(() => {
    AsyncStorage.getItem('@maxx_reminders').then((data) => {
      if (data) {
        try {
          setRemindedIds(JSON.parse(data));
        } catch {}
      }
    });
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [newHot, homeCatalog] = await Promise.all([
        CatalogService.getNewAndHot().catch(() => []),
        CatalogService.getHomeCatalog(0).catch(() => ({ banners: [], sections: [], latest: [], types: [], categories: [], errors: [] })),
      ]);

      const combined = [
        ...newHot,
        ...homeCatalog.latest,
        ...homeCatalog.banners,
        ...homeCatalog.sections.flatMap((s) => s.data),
      ];

      // Deduplicate by ID
      const seen = new Set<string | number>();
      const uniqueItems: CatalogItem[] = [];
      for (const item of combined) {
        if (item && item.id !== undefined && !seen.has(item.id)) {
          seen.add(item.id);
          uniqueItems.push(item);
        }
      }

      setAllItems(uniqueItems);
      setTrendingItems(newHot.length > 0 ? newHot : uniqueItems.slice(0, 10));
    } catch {
      setAllItems([]);
      setTrendingItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync Watchlist
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!AuthService.authToken) {
        setWatchlistMap({});
        return;
      }
      EngagementService.getWatchlist().then((items) => {
        if (active) {
          setWatchlistMap(Object.fromEntries(items.map((item) => [String(item.contentId ?? item.id), true])));
        }
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const toggleRemind = async (item: CatalogItem) => {
    const key = String(item.id);
    const nextState = !remindedIds[key];
    const updated = { ...remindedIds, [key]: nextState };
    if (!nextState) {
      delete updated[key];
    }
    setRemindedIds(updated);
    try {
      await AsyncStorage.setItem('@maxx_reminders', JSON.stringify(updated));
    } catch {}

    if (nextState) {
      Toast.success(`We will notify you as soon as "${item.name}" arrives!`, '🔔 Reminder Set');
    } else {
      Toast.info(`Reminder removed for "${item.name}".`, 'Reminder Cancelled');
    }
  };

  const toggleWatchlist = async (item: CatalogItem) => {
    if (!AuthService.authToken) {
      Toast.info('Please sign in to save titles to your watchlist.', 'Sign In Required');
      navigation.navigate('Login');
      return;
    }
    const key = String(item.id);
    const removing = !!watchlistMap[key];
    const ok = removing
      ? await EngagementService.removeWatchlist(item.id)
      : await EngagementService.addWatchlist(item.id, item.videoType);

    if (!ok) {
      Toast.error('Unable to update watchlist. Please try again.');
      return;
    }

    setWatchlistMap((prev) => ({ ...prev, [key]: !removing }));
    Toast.success(removing ? `Removed from Watchlist` : `Added to Watchlist`);
  };

  const handleShare = async (item: CatalogItem) => {
    try {
      const refCode = user?.referenceCode || AuthService.currentUser?.referenceCode;
      const shareUrl = AppConfig.getContentShareUrl(item, {
        referralCode: refCode,
      });
      const appUrl = AppConfig.getAppShareUrl(refCode);
      const message = `🎬 Watch "${item.name}" on MaxxPixels!\n\n🍿 Stream in 4K UHD with Dolby Atmos:\n${shareUrl}\n\n📲 Or open in the MaxxPixels App:\n${appUrl}`;

      await Share.share(
        Platform.OS === 'ios'
          ? {
              url: shareUrl,
              message,
              title: `Watch ${item.name} on MaxxPixels`,
            }
          : {
              message,
              title: `Watch ${item.name} on MaxxPixels`,
            },
        {
          dialogTitle: `Share ${item.name}`,
        }
      );
    } catch {}
  };

  // Filter content by active tab
  const getFilteredItems = (): CatalogItem[] => {
    switch (activeTab) {
      case 'coming_soon':
        return allItems.filter((i) => i.isPremium === 1 || !i.videoUrl).slice(0, 15);
      case 'trending':
        return trendingItems.length > 0 ? trendingItems : allItems.slice(0, 15);
      case 'top10':
        return (trendingItems.length > 0 ? trendingItems : allItems).slice(0, 10);
      case 'ai_cinema':
        return allItems.slice(0, 8);
      case 'all':
      default:
        return allItems.length > 0 ? allItems : trendingItems;
    }
  };

  const filteredItems = getFilteredItems();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.flameCircle}>
            <Flame size={20} color="#EF4444" fill="#EF4444" />
          </View>
          <View>
            <Text style={styles.headerTitle}>New & Hot</Text>
            <Text style={styles.headerSubtitle}>
              Fresh drops, trending trailers & upcoming blockbusters
            </Text>
          </View>
        </View>
      </View>

      {/* Segmented Filter Pills */}
      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TAB_OPTIONS}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.tabsScroll}
          renderItem={({ item: tab }) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setActiveTab(tab.id)}
                style={[styles.tabPill, active && styles.tabPillActive]}
              >
                <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* AdMob Banner for New & Hot */}
      <AdMobBanner style={{ marginVertical: 6 }} />

      {/* Feed List */}
      {loading && allItems.length === 0 ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={AppTheme.primary} />
          <Text style={styles.loadingText}>Fetching hottest premieres...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item, index) => `${item.id}-${activeTab}-${index}`}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData(true);
              }}
              tintColor={AppTheme.primary}
              colors={[AppTheme.primary]}
            />
          }
          ListHeaderComponent={
            activeTab === 'ai_cinema' ? (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() =>
                  SweetAlert.info(
                    'MAXX AI MOVIES',
                    'AI Cinema Lab is currently under active production and will launch soon with groundbreaking interactive AI cinema!'
                  )
                }
                style={styles.aiSpotlightCard}
              >
                <Image
                  source={require('../../assets/images/banner_ai_movies.jpg')}
                  style={styles.aiSpotlightImage}
                  resizeMode="cover"
                />
                <View style={styles.aiSpotlightOverlay}>
                  <View style={styles.aiBadgeRow}>
                    <View style={styles.aiGlowBadge}>
                      <Sparkles size={12} color="#FBBF24" />
                      <Text style={styles.aiGlowBadgeText}>AI CINEMA LAB</Text>
                    </View>
                    <View style={styles.aiComingSoonPill}>
                      <Text style={styles.aiComingSoonText}>COMING SOON</Text>
                    </View>
                  </View>
                  <Text style={styles.aiSpotlightTitle}>MAXX AI MOVIES</Text>
                  <Text style={styles.aiSpotlightSubtitle}>
                    Next-Gen AI Generated Cinema & Interactive Stories
                  </Text>
                </View>
              </TouchableOpacity>
            ) : undefined
          }
          renderItem={({ item, index }) => {
            const backdrop = getBackgroundUrl(item) || getPosterUrl(item);
            const isReminded = !!remindedIds[String(item.id)];
            const isWatchlisted = !!watchlistMap[String(item.id)];
            const isTop10 = activeTab === 'top10';
            const rank = index + 1;
            const dateInfo = getReleaseDateDetails(item, index);

            const metadataList = [
              item.categoryName,
              item.language,
              item.maturityRating || 'U/A 13+',
              item.videoDuration ? `${Math.floor(item.videoDuration / 60)} min` : '',
            ].filter(Boolean);

            return (
              <View style={styles.feedCard}>
                {/* Timeline / Rank Header */}
                <View style={styles.timelineRow}>
                  {isTop10 ? (
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankTopText}>TOP</Text>
                      <Text style={styles.rankNumberText}>{rank}</Text>
                    </View>
                  ) : (
                    <View style={styles.dateBadge}>
                      <Text style={styles.dateMonth}>{dateInfo.month}</Text>
                      <Text style={styles.dateDay}>{dateInfo.day}</Text>
                    </View>
                  )}

                  <View style={styles.metaWrap}>
                    <View style={styles.titleBadgeRow}>
                      <Text style={styles.metaTitle} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.isPremium === 1 && (
                        <View style={styles.vipBadge}>
                          <Crown size={10} color="#FBBF24" />
                          <Text style={styles.vipBadgeText}>VIP 4K</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.metaSub} numberOfLines={1}>
                      {metadataList.join(' • ') || 'Exclusive on MaxxPixels'}
                    </Text>
                  </View>
                </View>

                {/* Media Artwork with Hotstar Cinematic Glow */}
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => navigation.navigate('Details', { movie: item })}
                  style={styles.mediaContainer}
                >
                  {backdrop ? (
                    <Image source={{ uri: backdrop }} style={styles.mediaImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.mediaPlaceholder}>
                      <Film size={44} color="rgba(255,255,255,0.3)" />
                    </View>
                  )}

                  {/* Gradient Overlay */}
                  <Svg style={StyleSheet.absoluteFill}>
                    <Defs>
                      <LinearGradient id={`cardGrad-${item.id}-${index}`} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#08090C" stopOpacity="0.1" />
                        <Stop offset="0.6" stopColor="#08090C" stopOpacity="0.2" />
                        <Stop offset="1" stopColor="#08090C" stopOpacity="0.9" />
                      </LinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width="100%" height="100%" fill={`url(#cardGrad-${item.id}-${index})`} />
                  </Svg>

                  {/* Center Play Trailer Button */}
                  <View style={styles.playOverlay}>
                    <View style={styles.playCircle}>
                      <Play size={22} color="#08090C" fill="#08090C" style={{ marginLeft: 2 }} />
                    </View>
                  </View>

                  {/* Status Pill Badge */}
                  <View style={styles.cardStatusBadge}>
                    <Text style={styles.cardStatusText}>
                      {isTop10 ? `#${rank} in India` : dateInfo.releaseBadge.toUpperCase()}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Hotstar JioHotstar Action Bar */}
                <View style={styles.actionRow}>
                  {/* Left: Quick Watch Primary Button */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('Details', { movie: item })}
                    style={styles.watchNowButton}
                  >
                    <Play size={16} color="#08090C" fill="#08090C" />
                    <Text style={styles.watchNowText}>Watch Now</Text>
                  </TouchableOpacity>

                  {/* Right Action Icons: Remind Me, Watchlist, Share */}
                  <View style={styles.actionsRight}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => toggleRemind(item)}
                      style={styles.iconBtn}
                    >
                      {isReminded ? (
                        <BellRing size={20} color="#FBBF24" fill="#FBBF24" />
                      ) : (
                        <Bell size={20} color="#94A3B8" />
                      )}
                      <Text style={[styles.btnLabel, isReminded && { color: '#FBBF24' }]}>
                        {isReminded ? 'Reminded' : 'Remind Me'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => toggleWatchlist(item)}
                      style={styles.iconBtn}
                    >
                      {isWatchlisted ? (
                        <Check size={20} color="#34D399" />
                      ) : (
                        <Plus size={20} color="#94A3B8" />
                      )}
                      <Text style={[styles.btnLabel, isWatchlisted && { color: '#34D399' }]}>
                        {isWatchlisted ? 'Added' : 'Watchlist'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleShare(item)}
                      style={styles.iconBtn}
                    >
                      <Share2 size={20} color="#94A3B8" />
                      <Text style={styles.btnLabel}>Share</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Description Synopsis */}
                {item.description ? (
                  <Text style={styles.description} numberOfLines={3}>
                    {item.description}
                  </Text>
                ) : (
                  <Text style={styles.description} numberOfLines={2}>
                    Experience cinematic storytelling in ultra crisp 4K with immersive sound only on {AppConfig.appName}.
                  </Text>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

export default NewHotScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flameCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  tabsContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  tabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  tabPillText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  tabPillTextActive: {
    color: '#08090C',
    fontWeight: '800',
  },
  listContent: {
    paddingTop: 10,
  },
  feedCard: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateBadge: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#1E222A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dateMonth: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dateDay: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  rankBadge: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankTopText: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  rankNumberText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  metaWrap: {
    flex: 1,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    flexShrink: 1,
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#F59E0B',
  },
  vipBadgeText: {
    color: '#FBBF24',
    fontSize: 9,
    fontWeight: '800',
  },
  metaSub: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  mediaContainer: {
    width: '100%',
    height: CARD_MEDIA_HEIGHT,
    borderRadius: 14,
    backgroundColor: '#13161F',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E222A',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  cardStatusBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(8, 9, 12, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardStatusText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  watchNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
  },
  watchNowText: {
    color: '#08090C',
    fontSize: 13,
    fontWeight: '800',
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  iconBtn: {
    alignItems: 'center',
    minWidth: 46,
  },
  btnLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  description: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    marginTop: 12,
  },
  aiSpotlightCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
  },
  aiSpotlightImage: {
    width: '100%',
    height: '100%',
  },
  aiSpotlightOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 10, 15, 0.72)',
    padding: 14,
    justifyContent: 'flex-end',
  },
  aiBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  aiGlowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(234, 179, 8, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FBBF24',
  },
  aiGlowBadgeText: {
    color: '#FEF08A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  aiComingSoonPill: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiComingSoonText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  aiSpotlightTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  aiSpotlightSubtitle: {
    color: '#D4D4D8',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
  },
});
