import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SweetAlert } from '../../components/SweetAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Clapperboard,
  Crown,
  Sparkles,
  Zap,
} from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { ApiClient } from '../../services/apiClient';
import { AuthService } from '../../services/authService';
import { Toast } from '../../components/Toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_HEIGHT = (CARD_WIDTH * 500) / 1024; // 2.05 Aspect Ratio matching banner graphic dimensions

interface PortalBanner {
  id?: number;
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  targetUrl?: string;
  portalKey?: string;
  buttonLabel?: string;
  isActive?: boolean;
  displayOrder?: number;
}

const LOCAL_BANNERS = {
  movies: require('../../assets/images/banner_movies_entertainment.png'),
  games: require('../../assets/images/banner_games.jpg'),
  allIndian: require('../../assets/images/banner_all_indian_languages.jpg'),
};

function resolveBannerImage(banner?: PortalBanner): any {
  const uri = banner?.mobileImageUrl || banner?.imageUrl;
  return uri ? { uri } : null;
}

function matchesPortal(banner: PortalBanner, keys: string[]): boolean {
  const key = String(banner.portalKey || '').toLowerCase();
  return keys.some((candidate) => key === candidate || key.includes(candidate));
}

export const PortalSelectionScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [banners, setBanners] = useState<PortalBanner[]>([]);

  useEffect(() => {
    let active = true;
    ApiClient.getApi('cms/portal-banners', {
      queryParams: { portalKey: 'all' },
      timeoutMs: 8000,
    })
      .then((rows: any) => {
        if (active && Array.isArray(rows)) setBanners(rows);
      })
      .catch(() => {
        // Local banner assets remain the fallback when the API is unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

  const moviesBanner = banners.find((banner) =>
    matchesPortal(banner, ['kannada', 'movies & entertainment', 'movies']),
  );
  const gamesBanner = banners.find((banner) =>
    matchesPortal(banner, ['games', 'ludo', 'carrom']),
  );
  const allIndianBanner = banners.find((banner) =>
    matchesPortal(banner, ['all-indian', 'all indian', 'telugu', 'tamil']),
  );

  const handleOttPress = () => {
    navigation.navigate('Main', { initialTypeId: 0, initialLang: 'kannada' });
  };

  const handleAllIndianPress = () => {
    navigation.navigate('Main', { initialTypeId: 0, initialLang: 'all_indian' });
  };

  const handleAiMoviesPress = () => {
    navigation.navigate('Main', { initialTypeId: 7 });
  };

  const proceedToGames = async () => {
    await AuthService.init();
    if (!AuthService.isLoggedIn) {
      Alert.alert(
        'Sign in required',
        'Please sign in to play Ludo, Carrom, Snooker and Chess on MAXX GAMES.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => navigation.navigate('Login') },
        ],
      );
      return;
    }

    // Open the games screen immediately so the user sees progress while the
    // secure launch URL is generated (avoids perceived long wait on the portal).
    navigation.navigate('GamesWebView', { title: 'MAXX GAMES' });
  };

  const handleGamesPress = async () => {
    const agreed = await SweetAlert.show({
      type: 'warning',
      title: 'Disclaimer',
      message:
        'MaxxPixels provides games to subscribers for entertainment purposes only and does not encourage betting or monetary transactions.\n\nWhile playing, you may or may not see ads for products, services, or other content, which MaxxPixels is not directly or indirectly involved in.\n\nHappy Playing,\nMaxxPixels',
      confirmText: 'I Agree',
      cancelText: 'Cancel',
      showCancel: true,
    });
    if (agreed) {
      await proceedToGames();
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Branding */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.headerTextWrap}>
            <Text style={styles.appName}>MAXXPIXELS</Text>
            <Text style={styles.appTagline}>Next-Gen Digital Ecosystem</Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>NEXT-GEN ECOSYSTEM</Text>

        {/* 1. MAXX MOVIES & ENTERTAINMENT (OTT) */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={handleOttPress}
          style={styles.bannerCard}
        >
          <Image
            source={resolveBannerImage(moviesBanner) || LOCAL_BANNERS.movies}
            style={styles.bannerImage}
            resizeMode="cover"
          />
          {(moviesBanner?.title || moviesBanner?.subtitle) && (
            <View style={styles.bannerOverlay} pointerEvents="box-none">
              {!!moviesBanner?.title && (
                <Text style={styles.bannerOverlayTitle}>{moviesBanner.title}</Text>
              )}
              {!!moviesBanner?.subtitle && (
                <Text style={styles.bannerOverlayText}>{moviesBanner.subtitle}</Text>
              )}
              {!!moviesBanner?.buttonLabel && (
                <Text style={styles.bannerOverlayCta}>{moviesBanner.buttonLabel}</Text>
              )}
            </View>
          )}
        </TouchableOpacity>

        {/* 2. MAXX GAMES */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={handleGamesPress}
          style={styles.bannerCard}
        >
          <Image
            source={resolveBannerImage(gamesBanner) || LOCAL_BANNERS.games}
            style={styles.bannerImage}
            resizeMode="cover"
          />
          {(gamesBanner?.title || gamesBanner?.subtitle) && (
            <View style={styles.bannerOverlay} pointerEvents="box-none">
              {!!gamesBanner?.title && (
                <Text style={styles.bannerOverlayTitle}>{gamesBanner.title}</Text>
              )}
              {!!gamesBanner?.subtitle && (
                <Text style={styles.bannerOverlayText}>{gamesBanner.subtitle}</Text>
              )}
              {!!gamesBanner?.buttonLabel && (
                <Text style={styles.bannerOverlayCta}>{gamesBanner.buttonLabel}</Text>
              )}
            </View>
          )}
        </TouchableOpacity>

        {/* 3. MAXX ALL INDIAN LANGUAGES MOVIES */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={handleAllIndianPress}
          style={styles.bannerCard}
        >
          <Image
            source={resolveBannerImage(allIndianBanner) || LOCAL_BANNERS.allIndian}
            style={styles.bannerImage}
            resizeMode="cover"
          />
          {(allIndianBanner?.title || allIndianBanner?.subtitle) && (
            <View style={styles.bannerOverlay} pointerEvents="box-none">
              {!!allIndianBanner?.title && (
                <Text style={styles.bannerOverlayTitle}>{allIndianBanner.title}</Text>
              )}
              {!!allIndianBanner?.subtitle && (
                <Text style={styles.bannerOverlayText}>{allIndianBanner.subtitle}</Text>
              )}
              {!!allIndianBanner?.buttonLabel && (
                <Text style={styles.bannerOverlayCta}>{allIndianBanner.buttonLabel}</Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default PortalSelectionScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  headerTextWrap: {
    marginLeft: 12,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  appTagline: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeading: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  bannerCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 18,
    marginBottom: 14,
    overflow: 'hidden',
    backgroundColor: AppTheme.surface,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 10, 21, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerOverlayTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  bannerOverlayText: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  bannerOverlayCta: {
    marginTop: 12,
    color: '#F5B301',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  gridTile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: AppTheme.surface,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  tileIconWrap: {
    padding: 10,
    borderRadius: 12,
    marginRight: 10,
  },
  tileTextWrap: {
    flex: 1,
  },
  tileTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  tileSub: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
});
