import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Heart, Share2 } from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { AppConfig } from '../../core/config';
import { CatalogService } from '../../services/catalogService';
import { CatalogItem } from '../../types';
import { ShortVideoPlayer } from '../../components/ShortVideoPlayer';
import { useAuth } from '../../context/AuthContext';
import { AdMobService } from '../../services/adMobService';
import { Toast } from '../../components/Toast';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ShortsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, isLoggedIn } = useAuth();

  const [shorts, setShorts] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedIds, setLikedIds] = useState<Set<number | string>>(new Set());

  useEffect(() => {
    CatalogService.getShortsList()
      .then((res) => setShorts(res))
      .catch(() => setShorts([]))
      .finally(() => setLoading(false));
  }, []);

  const toggleLike = (id: number | string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleShare = async (item: CatalogItem) => {
    try {
      const refCode = user?.referenceCode;
      const shareUrl = AppConfig.getShortShareUrl(item.id, refCode);
      await Share.share({
        message: `📱 Watch "${item.name}" on MaxxPixels Shorts!\n\nStream Now: ${shareUrl}`,
        title: `Watch ${item.name} on MaxxPixels`,
      });
    } catch {}
  };

  if (loading && shorts.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={AppTheme.primary} />
      </View>
    );
  }

  if (shorts.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No shorts available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top back button */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => navigation.goBack()}
        style={[styles.backBtn, { top: insets.top + 10 }]}
      >
        <ArrowLeft size={22} color="#FFFFFF" />
      </TouchableOpacity>

      <FlatList
        data={shorts}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.y / SCREEN_HEIGHT);
          if (index !== currentIndex) {
            setCurrentIndex(index);
            // Show interstitial ad every 5 shorts viewed
            if (index > 0 && index % 5 === 0) {
              AdMobService.showInterstitial(undefined, 'shorts_swipe');
            }
          }
        }}
        renderItem={({ item, index }) => {
          const isLiked = likedIds.has(item.id);

          return (
            <View style={{ width: '100%', height: SCREEN_HEIGHT, position: 'relative' }}>
              <ShortVideoPlayer
                item={item}
                isActive={index === currentIndex}
                onPressPlay={() => {
                  if (!isLoggedIn) {
                    Toast.info('Please sign in to stream video.', 'Login Required');
                    navigation.navigate('Login');
                    return;
                  }
                  navigation.navigate('Player', {
                    videoId: item.id,
                    videoType: item.videoType,
                    title: item.name,
                    item,
                  });
                }}
              />

              {/* Side Floating Action Buttons */}
              <View style={[styles.sideActions, { bottom: insets.bottom + 60 }]}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => toggleLike(item.id)}
                  style={styles.actionBtn}
                >
                  <Heart
                    size={28}
                    color={isLiked ? '#EF4444' : '#FFFFFF'}
                    fill={isLiked ? '#EF4444' : 'transparent'}
                  />
                  <Text style={styles.actionLabel}>{isLiked ? 'Liked' : 'Like'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleShare(item)}
                  style={styles.actionBtn}
                >
                  <Share2 size={28} color="#FFFFFF" />
                  <Text style={styles.actionLabel}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
};

export default ShortsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 99,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideActions: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
    gap: 20,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
