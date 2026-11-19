import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ArrowLeft,
  Bell,
  CheckCircle,
  Sparkles,
  ShoppingBag,
  Car,
  Package,
  Shield,
  Zap,
  Tag,
  Clock,
  Compass,
  Gamepad2,
  Trophy,
  Clapperboard,
} from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { SweetAlert } from '../../components/SweetAlert';
import { Toast } from '../../components/Toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ComingSoonScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const portalType: 'ecommerce' | 'games' | 'ai_movies' | 'yellowboard' =
    route.params?.portalType || 'ecommerce';

  const [contactInput, setContactInput] = useState('');
  const [isJoined, setIsJoined] = useState(false);

  const isEcommerce = portalType === 'ecommerce';
  const isGames = portalType === 'games';
  const isAiMovies = portalType === 'ai_movies';
  const isYellowBoard = portalType === 'yellowboard';

  const bannerSource = isAiMovies
    ? require('../../assets/images/banner_ai_movies.jpg')
    : isGames
    ? require('../../assets/images/banner_games.jpg')
    : isYellowBoard
    ? require('../../assets/images/banner_yellowboard.jpg')
    : require('../../assets/images/banner_ecommerce.jpg');

  const title = isAiMovies
    ? 'MAXX AI MOVIES'
    : isGames
    ? 'MAXX GAMES'
    : isYellowBoard
    ? 'MAXX YELLOW BOARD'
    : 'MAXX E-COMMERCE';

  const subtitle = isAiMovies
    ? 'Stories Created by Intelligence • Fueled by Human Imagination'
    : isGames
    ? 'Cloud Gaming, Esports Tournaments, Live Play & Gaming Rewards'
    : isYellowBoard
    ? "Karnataka's Premier Commercial Fleet, Taxi & Transport Logistics Network"
    : 'Official Movie Merchandise, Apparel & Fan Collectibles';

  const accentColor = isAiMovies
    ? '#FF3B30'
    : isGames
    ? '#A855F7'
    : isYellowBoard
    ? '#EAB308'
    : '#EC4899';
  const badgeText = isAiMovies
    ? 'AI CINEMA LAB • COMING SOON'
    : isYellowBoard
    ? 'MOBILITY NETWORK • Q4 2026'
    : 'PHASE 2 • Q4 2026';

  const features = isAiMovies
    ? [
        {
          icon: Sparkles,
          title: 'AI-Generated Feature Films',
          desc: 'Immerse in groundbreaking cinema created with cutting-edge visual AI models and cinematic storytelling.',
        },
        {
          icon: Clapperboard,
          title: 'Interactive Choice-Driven Movies',
          desc: 'Shape the narrative in real-time. Choose character decisions and explore multiple divergent plot endings.',
        },
        {
          icon: Zap,
          title: 'Smart Multilingual Voice Dubbing',
          desc: 'Studio-grade natural voice dubbing and seamless lip-sync across Kannada, Telugu, Tamil, Hindi & English.',
        },
        {
          icon: Shield,
          title: 'Personalized AI Story Recommendations',
          desc: 'Intelligent AI curation that customizes movie narratives and genres to your emotional preference.',
        },
      ]
    : isGames
    ? [
        {
          icon: Gamepad2,
          title: 'AAA Cloud & Console Streaming',
          desc: 'Play console & PC titles instantly on your smartphone, tablet & smart TV with ultra-low latency.',
        },
        {
          icon: Trophy,
          title: 'Esports Tournaments & Prizes',
          desc: 'Compete in daily multiplayer tournaments, rank up on live leaderboards, and claim cash prize pools.',
        },
        {
          icon: Zap,
          title: 'Live Play & Gaming Pass',
          desc: 'Watch live interactive streams, participate in viewer lobbies, and unlock exclusive game skins.',
        },
        {
          icon: Shield,
          title: 'Cross-Device Controller Sync',
          desc: 'Seamlessly pair PS5 DualSense, Xbox Wireless, and Switch controllers with full custom button mapping.',
        },
      ]
    : isYellowBoard
    ? [
        {
          icon: Car,
          title: 'Direct Taxi & Cab Aggregator',
          desc: 'Reliable, transparent city and outstation commercial cab bookings across Bengaluru and Karnataka.',
        },
        {
          icon: Shield,
          title: 'Zero-Commission Driver Network',
          desc: 'Empowering yellow board vehicle drivers and fleet owners with fair earnings and direct passenger connections.',
        },
        {
          icon: Zap,
          title: 'Instant Airport & Outstation Travel',
          desc: 'Seamless scheduled rides, 24/7 airport transfers, and intercity travel with transparent pricing.',
        },
        {
          icon: Tag,
          title: 'VIP MaxxPixels Travel Discounts',
          desc: 'Exclusive travel rewards and automatic ride savings linked with your MaxxPixels subscription.',
        },
      ]
    : [
        {
          icon: ShoppingBag,
          title: 'Official Cinema Merch',
          desc: 'Exclusive hoodies, t-shirts, caps & limited collector props.',
        },
        {
          icon: Zap,
          title: 'Direct Doorstep Delivery',
          desc: 'Fast express shipping across Karnataka & pan-India.',
        },
        {
          icon: Tag,
          title: '25% VIP OTT Discounts',
          desc: 'Automatic discounts linked directly to your MaxxPixels VIP subscription.',
        },
        {
          icon: Shield,
          title: '100% Authentic & Certified',
          desc: 'Verified licensed production house merchandise.',
        },
      ];

  const handleJoinWaitlist = () => {
    if (!contactInput.trim()) {
      Toast.warning('Please enter your mobile number or email address.', 'Early Access');
      return;
    }
    setIsJoined(true);
    Toast.success(
      `Thank you! Registered ${contactInput.trim()} for exclusive launch perks and early access.`,
      '🎉 VIP List Joined!'
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Bar / Back Button */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={[styles.phasePill, { borderColor: accentColor }]}>
          <Clock size={12} color={accentColor} />
          <Text style={[styles.phasePillText, { color: accentColor }]}>{badgeText}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Visual Banner Showcase */}
          <View style={styles.bannerContainer}>
            <Image
              source={bannerSource}
              style={styles.bannerImage}
              resizeMode="cover"
            />
            <View style={styles.bannerGradient} />
            <View style={styles.bannerGlow} />
          </View>

          {/* Title & Description */}
          <View style={styles.headerBlock}>
            <View style={styles.titleBadge}>
              <Sparkles size={14} color={accentColor} />
              <Text style={[styles.titleBadgeText, { color: accentColor }]}>
                COMING SOON TO MAXXPIXELS
              </Text>
            </View>
            <Text style={styles.mainTitle}>{title}</Text>
            <Text style={styles.mainSubtitle}>{subtitle}</Text>
          </View>

          {/* Feature Highlights Grid */}
          <View style={styles.featuresSection}>
            <Text style={styles.sectionHeader}>WHAT TO EXPECT</Text>
            <View style={styles.featuresGrid}>
              {features.map((feat, idx) => {
                const IconComponent = feat.icon;
                return (
                  <View key={idx} style={styles.featureCard}>
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}35` },
                      ]}
                    >
                      <IconComponent size={22} color={accentColor} />
                    </View>
                    <Text style={styles.featureTitle}>{feat.title}</Text>
                    <Text style={styles.featureDesc}>{feat.desc}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* VIP Early Access Card */}
          <View style={[styles.waitlistCard, { borderColor: `${accentColor}40` }]}>
            <View style={styles.waitlistHeader}>
              <Bell size={20} color={accentColor} />
              <Text style={styles.waitlistTitle}>Get Early Beta Access</Text>
            </View>
            <Text style={styles.waitlistDesc}>
              Be the first to experience {title}. Early access members receive exclusive launch coupons and priority bookings.
            </Text>

            {isJoined ? (
              <View style={styles.joinedBadge}>
                <CheckCircle size={20} color="#10B981" />
                <Text style={styles.joinedText}>You're on the VIP Launch List!</Text>
              </View>
            ) : (
              <View style={styles.inputActionRow}>
                <TextInput
                  placeholder="Mobile number or email"
                  placeholderTextColor="#64748B"
                  value={contactInput}
                  onChangeText={setContactInput}
                  style={styles.waitlistInput}
                />
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleJoinWaitlist}
                  style={[styles.joinBtn, { backgroundColor: accentColor }]}
                >
                  <Text style={styles.joinBtnText}>Notify Me</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.footerActions}>
            {isEcommerce && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigation.navigate('MaxxShopping')}
                style={styles.previewBtn}
              >
                <Compass size={18} color="#FFFFFF" />
                <Text style={styles.previewBtnText}>Explore Demo Merchandise Store</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.goBack()}
              style={styles.returnBtn}
            >
              <Text style={styles.returnBtnText}>Return to Ecosystem</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default ComingSoonScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.background,
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
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: AppTheme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  phasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  phasePillText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  bannerContainer: {
    width: '100%',
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 20,
    backgroundColor: AppTheme.surface,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerGradient: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 10, 21, 0.15)',
  },
  bannerGlow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(5, 10, 21, 0.6)',
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  titleBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  mainTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
  },
  mainSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  featuresSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  featuresGrid: {
    gap: 12,
  },
  featureCard: {
    backgroundColor: AppTheme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 10,
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  featureDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  waitlistCard: {
    backgroundColor: AppTheme.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  waitlistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  waitlistTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  waitlistDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  inputActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  waitlistInput: {
    flex: 1,
    backgroundColor: AppTheme.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTheme.surfaceElevated,
    color: '#FFFFFF',
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
  },
  joinBtn: {
    paddingHorizontal: 18,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinBtnText: {
    color: AppTheme.background,
    fontSize: 14,
    fontWeight: '900',
  },
  joinedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    gap: 10,
  },
  joinedText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '800',
  },
  footerActions: {
    gap: 12,
    alignItems: 'center',
  },
  previewBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EC4899',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  previewBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  returnBtn: {
    paddingVertical: 10,
  },
  returnBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '800',
  },
});
