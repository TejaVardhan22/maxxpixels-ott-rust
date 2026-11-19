import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import {
  ArrowLeft,
  Play,
  ShoppingBag,
  Plus,
  Download,
  Share2,
  Check,
  Film,
  Crown,
  Sparkles,
  Cast,
  Info,
  ChevronDown,
  Volume2,
} from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { AppConfig } from '../../core/config';
import { CatalogService } from '../../services/catalogService';
import { EngagementService } from '../../services/engagementService';
import { PaymentService } from '../../services/paymentService';
import { CatalogItem, getBackgroundUrl, getPosterUrl } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { AuthService } from '../../services/authService';
import { SweetAlert } from '../../components/SweetAlert';
import { Toast } from '../../components/Toast';
import { AdMobService } from '../../services/adMobService';
import { AdMobBanner } from '../../components/AdMobBanner';
import RazorpayCheckout from 'react-native-razorpay';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BACKDROP_HEIGHT = Math.round((SCREEN_WIDTH * 9) / 16) + 70;
const REC_CARD_WIDTH = (SCREEN_WIDTH - 32 - 16) / 3;
const REC_CARD_HEIGHT = Math.round(REC_CARD_WIDTH * 1.48);

export const DetailsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isLoggedIn, user } = useAuth();

  const [movie, setMovie] = useState<CatalogItem>(
    route.params?.movie || {
      id: 0,
      name: 'Title unavailable',
      videoType: 1,
      typeId: 1,
    }
  );
  const [loading, setLoading] = useState(true);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [rentalUnlocked, setRentalUnlocked] = useState(false);
  const [expandedSynopsis, setExpandedSynopsis] = useState(false);
  const [activeTab, setActiveTab] = useState<'more' | 'trailers' | 'cast'>('more');
  const [recommendations, setRecommendations] = useState<CatalogItem[]>([]);
  const [failedLogo, setFailedLogo] = useState(false);

  const activeMovieId = route.params?.movie?.id || route.params?.id || movie.id;

  useEffect(() => {
    if (route.params?.movie && route.params.movie.id && route.params.movie.id !== movie.id) {
      setMovie(route.params.movie);
    }
  }, [route.params?.movie]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const targetItem = route.params?.movie || movie;
    CatalogService.getContentDetail(targetItem)
      .then((detail) => {
        if (isMounted && detail) {
          if (detail.isRented === 1 || (detail as any).is_rented === 1 || detail.rentBuy === 1) {
            setRentalUnlocked(true);
          }
          setMovie((prev) => ({
            ...prev,
            ...detail,
            videoUrl: detail.videoUrl || detail.streamUrl || prev.videoUrl || prev.streamUrl,
            streamUrl: detail.streamUrl || detail.videoUrl || prev.streamUrl || prev.videoUrl,
          }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // Fetch related recommendations
    CatalogService.getNewAndHot()
      .then((items) => {
        if (isMounted) {
          const filtered = items.filter((it) => it.id !== activeMovieId);
          setRecommendations(filtered);
        }
      })
      .catch(() => {});

    // Check watchlist status if user is logged in
    EngagementService.getWatchlist()
      .then((list) => {
        if (isMounted) {
          const exists = list.some((it) => it.contentId === activeMovieId);
          setInWatchlist(exists);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [activeMovieId]);

  const handlePlayOrRent = async () => {
    // 1. Mandatory Login Guard: Users must sign in to stream or rent content
    if (!isLoggedIn) {
      Toast.info('Please sign in or create an account to start watching.', 'Login Required');
      navigation.navigate('Login');
      return;
    }

    const isRented =
      movie.isRented === 1 ||
      movie.rentBuy === 1 ||
      (movie as any).is_rented === 1 ||
      rentalUnlocked;

    const isTvod =
      movie.isRent === 1 ||
      (movie as any).is_rent === 1 ||
      String(movie.monetization || (movie as any).monetization || '').toUpperCase() === 'TVOD';

    const isRentable = isTvod && !isRented;
    const rentPrice = movie.rentPrice ?? (movie as any).price ?? 99;
    const rentDays = movie.rentDay ?? ((movie as any).validity_hours ? Math.ceil(Number((movie as any).validity_hours) / 24) : 2);

    if (isRentable) {
      if (!isLoggedIn) {
        navigation.navigate('Login');
        return;
      }

      SweetAlert.confirm(
        'Rent Movie',
        `Would you like to rent "${movie.name}" for ₹${rentPrice} for ${rentDays} days access?`,
        'Rent Now',
        'Cancel'
      ).then(async (confirmed) => {
        if (!confirmed) return;
        try {
          Toast.info('Preparing rental order...', 'Please wait');
          const order = await PaymentService.createRentOrder(movie);

          if (order.isFree) {
            await PaymentService.addRentTransaction(movie, order.orderId);
            setRentalUnlocked(true);
            setMovie((prev) => ({
              ...prev,
              isRented: 1,
              is_rented: 1,
              rentBuy: 1,
            }));
            Toast.success('Your movie rental is ready! Enjoy watching.', 'Rental Activated');
            return;
          }

          // Launch Razorpay native checkout
          const rzpOrderId =
            (order.gatewayOrderId && String(order.gatewayOrderId).startsWith('order_') ? String(order.gatewayOrderId) : null) ||
            (order.orderId && String(order.orderId).startsWith('order_') ? String(order.orderId) : null) ||
            undefined;

          const options: any = {
            description: `Rental: ${movie.name}`,
            image: movie.thumbnail || 'https://maxxpixels.com/logo.png',
            currency: order.currency || 'INR',
            key: order.keyId,
            amount: Math.round(order.amount * 100),
            name: 'MaxxPixels OTT',
            ...(rzpOrderId ? { order_id: rzpOrderId } : {}),
            prefill: {
              email: AuthService.currentUser?.email || '',
              contact: AuthService.currentUser?.phoneNumber || (AuthService.currentUser as any)?.mobile_number || '',
              name: AuthService.currentUser?.fullName || (AuthService.currentUser as any)?.name || '',
            },
            notes: {
              content_id: String(movie.id),
              content_title: String(movie.name),
              rent_days: String(rentDays),
              user_id: String(AuthService.currentUser?.id || ''),
              type: 'rent',
            },
            theme: { color: AppTheme.primary || '#e50914' },
          };

          let data: any;
          try {
            data = await RazorpayCheckout.open(options);
          } catch (razorpayErr: any) {
            console.warn('[Razorpay] Rental checkout closed or failed:', razorpayErr);
            let errMsg = 'Payment process was cancelled or failed.';
            let rawDesc = razorpayErr?.description || razorpayErr?.message || razorpayErr;
            if (typeof rawDesc === 'object' && rawDesc !== null) {
              rawDesc = rawDesc?.description || rawDesc?.error?.description || JSON.stringify(rawDesc);
            }
            if (typeof rawDesc === 'string') {
              if (rawDesc.trim().startsWith('{')) {
                try {
                  const parsed = JSON.parse(rawDesc);
                  const innerDesc = parsed?.error?.description || parsed?.description || parsed?.error?.reason;
                  if (innerDesc) errMsg = innerDesc;
                } catch {
                  errMsg = rawDesc;
                }
              } else {
                errMsg = rawDesc;
              }
            }
            if (errMsg === 'Payment Failed' || razorpayErr?.error?.reason === 'payment_cancelled') {
              errMsg = 'Payment was cancelled or could not be completed.';
            }
            Toast.error(errMsg, 'Payment Cancelled');
            return;
          }

          if (data && data.razorpay_payment_id) {
            Toast.info('Confirming rental access...', 'Almost there');
            try {
              await PaymentService.verifyPayment({
                orderId: order.gatewayOrderId || order.orderId,
                paymentId: data.razorpay_payment_id,
                signature: data.razorpay_signature,
                transactionType: 'rent',
              });
            } catch (vErr) {
              console.warn('Verify payment notice:', vErr);
            }

            try {
              await PaymentService.addRentTransaction(movie, data.razorpay_payment_id);
            } catch (aErr) {
              console.warn('Add rent transaction notice:', aErr);
            }

            setRentalUnlocked(true);
            setMovie((prev) => ({
              ...prev,
              isRented: 1,
              is_rented: 1,
              rentBuy: 1,
            }));
            Toast.success('Your movie rental is ready! Enjoy watching.', 'Rental Activated');
          }
        } catch (e: any) {
          Toast.error(e.message || 'Unable to complete rental transaction.', 'Rental Failed');
        }
      });
      return;
    }

    // Check Active Subscription Guard for Premium Content Only
    const isPremiumTitle =
      movie.isPremium === 1 ||
      (movie as any).is_premium === 1 ||
      String((movie as any).monetization || '').toUpperCase() === 'SVOD';

    if (isPremiumTitle) {
      let hasActiveSub = AuthService.isSubscriptionActive(user);
      if (!hasActiveSub && isLoggedIn) {
        // Re-verify with backend in case user has an active plan or session cache is stale
        hasActiveSub = await AuthService.syncSubscription();
      }

      if (!hasActiveSub) {
        if (!isLoggedIn) {
          navigation.navigate('Login');
          return;
        }
        Toast.warning(
          user?.isBuy === 1
            ? 'Your VIP membership has expired. Please renew your plan to continue watching.'
            : 'An active subscription is required to stream this title. Please choose a plan.',
          'Subscription Required'
        );
        navigation.navigate('Subscription');
        return;
      }
    }

    const launchPlayer = () => {
      const effectiveVideoUrl =
        movie.videoUrl ||
        movie.streamUrl ||
        route.params?.movie?.videoUrl ||
        route.params?.movie?.streamUrl ||
        (movie as any).masterPlaylistUrl ||
        '';

      navigation.navigate('Player', {
        videoId: movie.id,
        contentId: movie.id,
        videoType: movie.videoType,
        title: movie.name,
        videoUrl: effectiveVideoUrl,
        streamUrl: effectiveVideoUrl,
        item: {
          ...route.params?.movie,
          ...movie,
          videoUrl: effectiveVideoUrl,
          streamUrl: effectiveVideoUrl,
        },
      });
    };

    AdMobService.showInterstitial(launchPlayer, 'watch_now_details');
  };

  const handleWatchTrailer = () => {
    if (movie.trailerUrl && movie.trailerUrl.trim().length > 0) {
      const tUrl = movie.trailerUrl.trim();
      if (tUrl.includes('youtube.com') || tUrl.includes('youtu.be')) {
        Linking.openURL(tUrl).catch(() => {
          Toast.error('Unable to open trailer video link.', 'Trailer');
        });
        return;
      }
      navigation.navigate('Player', {
        videoId: movie.id,
        videoType: movie.videoType,
        title: `${movie.name} - Official Trailer`,
        videoUrl: tUrl,
        isTrailer: true,
        item: {
          ...movie,
          videoUrl: tUrl,
          streamUrl: tUrl,
        },
      });
    } else {
      Toast.info(`Official trailer for "${movie.name}" will be available soon.`, 'Trailer');
    }
  };

  const handleToggleWatchlist = async () => {
    if (!isLoggedIn) {
      navigation.navigate('Login');
      return;
    }

    const removing = inWatchlist;
    const success = removing
      ? await EngagementService.removeWatchlist(movie.id, movie.videoType)
      : await EngagementService.addWatchlist(movie.id, movie.videoType);

    if (success) {
      setInWatchlist(!removing);
      Toast.success(removing ? 'Removed from Watchlist' : 'Added to Watchlist');
    } else {
      Toast.error('Unable to update watchlist. Please try again.');
    }
  };

  const handleDownload = () => {
    Toast.info('Offline downloading will be available in the next release.', 'Downloads');
  };

  const handleShare = async () => {
    try {
      const refCode = user?.referenceCode;
      const shareUrl = AppConfig.getContentShareUrl(movie, {
        referralCode: refCode,
      });
      const appUrl = AppConfig.getAppShareUrl(refCode);
      const message = `🎬 Watch "${movie.name}" on MaxxPixels!\n\n🍿 Stream in 4K UHD with Dolby Atmos:\n${shareUrl}\n\n📲 Or open in the MaxxPixels App:\n${appUrl}`;

      await Share.share(
        Platform.OS === 'ios'
          ? {
              url: shareUrl,
              message,
              title: `Watch ${movie.name} on MaxxPixels`,
            }
          : {
              message,
              title: `Watch ${movie.name} on MaxxPixels`,
            },
        {
          dialogTitle: `Share ${movie.name}`,
        }
      );
    } catch {}
  };

  const backdrop = getBackgroundUrl(movie) || getPosterUrl(movie);
  const isRented =
    movie.isRented === 1 ||
    movie.rentBuy === 1 ||
    (movie as any).is_rented === 1 ||
    rentalUnlocked;
  const isTvod =
    movie.isRent === 1 ||
    (movie as any).is_rent === 1 ||
    String(movie.monetization || (movie as any).monetization || '').toUpperCase() === 'TVOD';
  const isRentable = isTvod && !isRented;
  const rentPrice = isRentable ? (movie.rentPrice ?? (movie as any).price ?? 99) : 0;
  const rentDays = isRentable ? (movie.rentDay ?? ((movie as any).validity_hours ? Math.ceil(Number((movie as any).validity_hours) / 24) : 2)) : 0;

  // Format duration string
  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins > 0 ? `${mins}m` : ''}`.trim();
    return `${mins}m`;
  };

  const durationText = formatDuration(movie.videoDuration);
  const releaseYear = movie.releaseYear || movie.releaseDate?.match(/\b(19|20)\d{2}\b/)?.[0];
  const maturityRating = movie.maturityRating || 'U/A 13+';
  const audioLanguages = movie.language ? `${movie.language}` : 'Original Audio';

  return (
    <View style={styles.container}>
      {/* Floating Top Navigation Bar */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.goBack()}
          style={styles.circleBtn}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.topBarRightActions}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => Toast.info('Cast device search initiated...', 'Chromecast')}
            style={styles.circleBtn}
            accessibilityLabel="Cast to TV"
          >
            <Cast size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleShare}
            style={styles.circleBtn}
            accessibilityLabel="Share title"
          >
            <Share2 size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 48 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Immersive Cinematic Backdrop Header */}
        <View style={styles.backdropContainer}>
          {backdrop ? (
            <Image
              source={{ uri: backdrop }}
              style={styles.backdropImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderBackdrop}>
              <Film size={48} color="rgba(255, 255, 255, 0.25)" />
            </View>
          )}

          {/* Cinematic Vignette Gradients */}
          <Svg style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="topShadow" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={AppTheme.background} stopOpacity="0.85" />
                <Stop offset="0.5" stopColor={AppTheme.background} stopOpacity="0.3" />
                <Stop offset="1" stopColor={AppTheme.background} stopOpacity="0" />
              </LinearGradient>
              <LinearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={AppTheme.background} stopOpacity="0" />
                <Stop offset="0.4" stopColor={AppTheme.background} stopOpacity="0.45" />
                <Stop offset="0.75" stopColor={AppTheme.background} stopOpacity="0.9" />
                <Stop offset="1" stopColor={AppTheme.background} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={SCREEN_WIDTH} height={100} fill="url(#topShadow)" />
            <Rect
              x="0"
              y={BACKDROP_HEIGHT * 0.3}
              width={SCREEN_WIDTH}
              height={BACKDROP_HEIGHT * 0.7}
              fill="url(#bottomFade)"
            />
          </Svg>

          {/* Logo / Title Area inside Backdrop */}
          <View style={styles.backdropTitleContainer}>
            {movie.logoImage && !failedLogo ? (
              <Image
                source={{ uri: movie.logoImage }}
                style={styles.heroLogo}
                resizeMode="contain"
                onError={() => setFailedLogo(true)}
              />
            ) : (
              <Text style={styles.heroTitleText} numberOfLines={2}>
                {movie.name}
              </Text>
            )}
          </View>
        </View>

        {/* 2. Metadata, Badges & Audio Row */}
        <View style={styles.metadataSection}>
          <View style={styles.badgeRow}>
            {isRentable ? (
              <View style={[styles.vipBadge, { backgroundColor: 'rgba(251, 191, 36, 0.15)', borderColor: AppTheme.gold }]}>
                <ShoppingBag size={11} color={AppTheme.gold} />
                <Text style={[styles.vipBadgeText, { color: AppTheme.gold }]}>RENT · ₹{rentPrice}</Text>
              </View>
            ) : isRented ? (
              <View style={[styles.vipBadge, { backgroundColor: 'rgba(16, 185, 129, 0.18)', borderColor: '#10B981' }]}>
                <Check size={11} color="#10B981" />
                <Text style={[styles.vipBadgeText, { color: '#10B981' }]}>
                  RENTED{movie.rentExpiryDate ? ` · Until ${new Date(movie.rentExpiryDate).toLocaleDateString()}` : ''}
                </Text>
              </View>
            ) : movie.isPremium === 1 ? (
              <View style={styles.vipBadge}>
                <Crown size={11} color={AppTheme.gold} />
                <Text style={styles.vipBadgeText}>VIP</Text>
              </View>
            ) : null}

            <View style={styles.qualityBadge}>
              <Text style={styles.qualityBadgeText}>4K UHD</Text>
            </View>

            <View style={styles.qualityBadge}>
              <Text style={styles.qualityBadgeText}>Dolby 5.1</Text>
            </View>

            {releaseYear ? (
              <Text style={styles.metaDotItem}>{releaseYear}</Text>
            ) : null}

            <View style={styles.maturityBadge}>
              <Text style={styles.maturityBadgeText}>{maturityRating}</Text>
            </View>

            {durationText ? (
              <Text style={styles.metaDotItem}>{durationText}</Text>
            ) : null}
          </View>

          {/* Audio & Subtitles Banner Pill */}
          <View style={styles.audioPill}>
            <Volume2 size={12} color={AppTheme.textSecondary} />
            <Text style={styles.audioPillText} numberOfLines={1}>
              {audioLanguages} • English Subtitles
            </Text>
          </View>

          {/* 3. Primary Watch / Rent Action Button */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handlePlayOrRent}
            style={[
              styles.primaryWatchButton,
              isRentable && { backgroundColor: AppTheme.gold, shadowColor: AppTheme.gold },
            ]}
          >
            {isRentable ? (
              <ShoppingBag size={20} color={AppTheme.textDark} />
            ) : (
              <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
            )}
            <Text
              style={[
                styles.primaryWatchButtonText,
                isRentable && { color: AppTheme.textDark },
              ]}
            >
              {isRentable
                ? `Rent for ₹${rentPrice} • ${rentDays} Days`
                : 'Watch Now'}
            </Text>
          </TouchableOpacity>

          {/* 4. Action Row */}
          <View style={styles.actionBar}>
            {/* Watchlist */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={handleToggleWatchlist}
              style={styles.actionBtn}
            >
              <View style={[styles.actionIconCircle, inWatchlist && styles.actionIconCircleActive]}>
                {inWatchlist ? (
                  <Check size={20} color={AppTheme.primary} />
                ) : (
                  <Plus size={20} color="#FFFFFF" />
                )}
              </View>
              <Text style={[styles.actionLabel, inWatchlist && { color: AppTheme.primary }]}>
                {inWatchlist ? 'Added' : 'Watchlist'}
              </Text>
            </TouchableOpacity>

            {/* Trailer */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={handleWatchTrailer}
              style={styles.actionBtn}
            >
              <View style={styles.actionIconCircle}>
                <Film size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.actionLabel}>Trailer</Text>
            </TouchableOpacity>

            {/* Download */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={handleDownload}
              style={styles.actionBtn}
            >
              <View style={styles.actionIconCircle}>
                <Download size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.actionLabel}>Download</Text>
            </TouchableOpacity>

            {/* Share */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={handleShare}
              style={styles.actionBtn}
            >
              <View style={styles.actionIconCircle}>
                <Share2 size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.actionLabel}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* 5. Genres Capsules */}
          {((movie.genres && movie.genres.length > 0) || movie.categoryName) && (
            <View style={styles.genreChipsRow}>
              {(movie.genres && movie.genres.length > 0
                ? movie.genres
                : Array.isArray(movie.categoryName)
                ? movie.categoryName
                : String(movie.categoryName || '').split(',')
              ).map((genre: string, idx: number) => (
                <View key={idx} style={styles.genreChip}>
                  <Text style={styles.genreChipText}>{genre.trim()}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 6. Expandable Synopsis */}
          {movie.description ? (
            <View style={styles.synopsisContainer}>
              <Text
                style={styles.synopsisText}
                numberOfLines={expandedSynopsis ? undefined : 3}
              >
                {movie.description.replace(/<[^>]*>/g, '')}
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setExpandedSynopsis(!expandedSynopsis)}
                style={styles.moreToggleBtn}
              >
                <Text style={styles.moreToggleText}>
                  {expandedSynopsis ? 'Show less' : '...more'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* AdMob Banner for Free/Non-VIP users */}
        <AdMobBanner style={{ marginVertical: 8 }} />

        {/* 7. Tab Bar (More Like This | Trailers & Extras | Cast & Details) */}
        <View style={styles.tabSection}>
          <View style={styles.tabBar}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveTab('more')}
              style={[styles.tabItem, activeTab === 'more' && styles.tabItemActive]}
            >
              <Text style={[styles.tabText, activeTab === 'more' && styles.tabTextActive]}>
                More Like This
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveTab('trailers')}
              style={[styles.tabItem, activeTab === 'trailers' && styles.tabItemActive]}
            >
              <Text style={[styles.tabText, activeTab === 'trailers' && styles.tabTextActive]}>
                Trailers & Extras
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveTab('cast')}
              style={[styles.tabItem, activeTab === 'cast' && styles.tabItemActive]}
            >
              <Text style={[styles.tabText, activeTab === 'cast' && styles.tabTextActive]}>
                Cast & Details
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: More Like This (3-Column Poster Grid) */}
          {activeTab === 'more' && (
            <View style={styles.tabContentGrid}>
              {recommendations.length > 0 ? (
                <View style={styles.recommendationGrid}>
                  {recommendations.slice(0, 9).map((rec, i) => {
                    const poster = getPosterUrl(rec) || getBackgroundUrl(rec);
                    return (
                      <TouchableOpacity
                        key={rec.id || i}
                        activeOpacity={0.82}
                        onPress={() => {
                          navigation.push('Details', { movie: rec });
                        }}
                        style={[styles.recCard, { width: REC_CARD_WIDTH }]}
                      >
                        <View style={[styles.recImageWrap, { height: REC_CARD_HEIGHT }]}>
                          {poster ? (
                            <Image
                              source={{ uri: poster }}
                              style={styles.recPoster}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.recPlaceholder}>
                              <Film size={22} color="rgba(255,255,255,0.3)" />
                            </View>
                          )}
                          {rec.language && (
                            <View style={styles.recLanguageTag}>
                              <Text style={styles.recLanguageText}>{rec.language}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.recTitle} numberOfLines={1}>
                          {rec.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyTabBox}>
                  <Text style={styles.emptyTabText}>Loading recommendations...</Text>
                </View>
              )}
            </View>
          )}

          {/* TAB 2: Trailers & Extras */}
          {activeTab === 'trailers' && (
            <View style={styles.tabContentList}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleWatchTrailer}
                style={styles.extraCard}
              >
                <View style={styles.extraThumbWrap}>
                  <Image
                    source={{ uri: backdrop || getPosterUrl(movie) }}
                    style={styles.extraThumb}
                    resizeMode="cover"
                  />
                  <View style={styles.extraPlayOverlay}>
                    <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
                  </View>
                  <View style={styles.extraDurationBadge}>
                    <Text style={styles.extraDurationText}>2m 14s</Text>
                  </View>
                </View>
                <View style={styles.extraMeta}>
                  <Text style={styles.extraTitle}>Official Main Trailer</Text>
                  <Text style={styles.extraSub}>Watch the official preview of {movie.name}</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* TAB 3: Cast & Crew */}
          {activeTab === 'cast' && (
            <View style={styles.tabContentList}>
              {movie.cast && movie.cast.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.castRowScroll}
                >
                  {movie.cast.map((c, idx) => (
                    <View key={c.id || idx} style={styles.castAvatarCard}>
                      <View style={styles.castAvatarCircle}>
                        {c.image ? (
                          <Image source={{ uri: c.image }} style={styles.castPhoto} />
                        ) : (
                          <View style={styles.castPhotoPlaceholder}>
                            <Text style={styles.castInitialText}>{(c.name || 'C')[0]}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.castActorName} numberOfLines={1}>
                        {c.name}
                      </Text>
                      {c.type ? (
                        <Text style={styles.castActorRole} numberOfLines={1}>
                          {c.type}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.emptyTabBox}>
                  <Text style={styles.emptyTabText}>
                    Director & cast details verified by MaxxPixels.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default DetailsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(17, 20, 30, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppTheme.surfaceBorder,
  },
  backdropContainer: {
    width: SCREEN_WIDTH,
    height: BACKDROP_HEIGHT,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  backdropImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  placeholderBackdrop: {
    width: '100%',
    height: '100%',
    backgroundColor: AppTheme.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropTitleContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 10,
  },
  heroLogo: {
    width: 220,
    height: 70,
    marginBottom: 4,
  },
  heroTitleText: {
    color: AppTheme.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 8,
  },
  metadataSection: {
    paddingHorizontal: 16,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.goldBg,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: AppTheme.gold,
    gap: 3,
  },
  vipBadgeText: {
    color: AppTheme.goldLight,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  qualityBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: AppTheme.border,
  },
  qualityBadgeText: {
    color: AppTheme.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  maturityBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: AppTheme.border,
  },
  maturityBadgeText: {
    color: AppTheme.textSecondary,
    fontSize: 10,
    fontWeight: '800',
  },
  metaDotItem: {
    color: AppTheme.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  audioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 6,
    marginBottom: 16,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  audioPillText: {
    color: AppTheme.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  primaryWatchButton: {
    width: '100%',
    backgroundColor: AppTheme.primary,
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
    shadowColor: AppTheme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryWatchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: AppTheme.border,
    marginBottom: 18,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 6,
  },
  actionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: AppTheme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppTheme.surfaceBorder,
  },
  actionIconCircleActive: {
    backgroundColor: AppTheme.tagBg,
    borderColor: AppTheme.primary,
  },
  actionLabel: {
    color: AppTheme.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  genreChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  genreChip: {
    backgroundColor: AppTheme.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppTheme.surfaceBorder,
  },
  genreChipText: {
    color: AppTheme.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  synopsisContainer: {
    marginBottom: 20,
  },
  synopsisText: {
    color: AppTheme.textSecondary,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: '500',
  },
  moreToggleBtn: {
    marginTop: 4,
  },
  moreToggleText: {
    color: AppTheme.primaryLight,
    fontSize: 12,
    fontWeight: '800',
  },
  tabSection: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: AppTheme.border,
    paddingTop: 12,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 20,
    marginBottom: 16,
  },
  tabItem: {
    paddingBottom: 8,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: AppTheme.primary,
  },
  tabText: {
    color: AppTheme.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  tabContentGrid: {
    paddingHorizontal: 16,
  },
  recommendationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recCard: {
    marginBottom: 12,
  },
  recImageWrap: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: AppTheme.surface,
    borderWidth: 1,
    borderColor: AppTheme.border,
    position: 'relative',
    marginBottom: 6,
  },
  recPoster: {
    width: '100%',
    height: '100%',
  },
  recPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppTheme.surfaceElevated,
  },
  recLanguageTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: AppTheme.overlay,
    paddingVertical: 2,
    alignItems: 'center',
  },
  recLanguageText: {
    color: AppTheme.textSecondary,
    fontSize: 9.5,
    fontWeight: '700',
  },
  recTitle: {
    color: AppTheme.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  tabContentList: {
    paddingHorizontal: 16,
  },
  extraCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.surface,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  extraThumbWrap: {
    width: 120,
    height: 68,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    marginRight: 12,
  },
  extraThumb: {
    width: '100%',
    height: '100%',
  },
  extraPlayOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  extraDurationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: AppTheme.overlay,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  extraDurationText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  extraMeta: {
    flex: 1,
  },
  extraTitle: {
    color: AppTheme.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  extraSub: {
    color: AppTheme.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  castRowScroll: {
    gap: 16,
    paddingVertical: 4,
  },
  castAvatarCard: {
    width: 72,
    alignItems: 'center',
  },
  castAvatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: AppTheme.surfaceBorder,
    marginBottom: 6,
    backgroundColor: AppTheme.surface,
  },
  castPhoto: {
    width: '100%',
    height: '100%',
  },
  castPhotoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppTheme.surfaceElevated,
  },
  castInitialText: {
    color: AppTheme.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  castActorName: {
    color: AppTheme.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  castActorRole: {
    color: AppTheme.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 1,
  },
  emptyTabBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyTabText: {
    color: AppTheme.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
