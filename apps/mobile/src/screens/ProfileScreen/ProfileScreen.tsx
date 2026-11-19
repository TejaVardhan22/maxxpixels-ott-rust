import React, { useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  User as UserIcon,
  Crown,
  Clapperboard,
  Settings,
  HelpCircle,
  FileText,
  Share2,
  LogOut,
  ChevronRight,
  Edit2,
  LogIn,
  Sliders,
  HardDrive,
  DownloadCloud,
  Camera,
  AlertCircle,
} from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { AppConfig } from '../../core/config';
import { useAuth } from '../../context/AuthContext';
import { AuthService } from '../../services/authService';
import { Toast } from '../../components/Toast';

export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, isLoggedIn, logout, refreshProfile, syncSubscription } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      let isMounted = true;
      if (isLoggedIn) {
        syncSubscription()
          .then(() => {
            if (isMounted) refreshProfile().catch(() => {});
          })
          .catch(() => {});
      }
      return () => {
        isMounted = false;
      };
    }, [isLoggedIn, syncSubscription, refreshProfile])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshProfile(), syncSubscription()]);
    } catch {}
    finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      Toast.info('You have been safely signed out.', 'Signed Out');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch {
      navigation.navigate('Login');
    }
  };

  const handleShareApp = async () => {
    try {
      const refCode = user?.referenceCode;
      const shareUrl = AppConfig.getAppShareUrl(refCode);
      const message = refCode
        ? `🔥 Stream blockbuster movies, web series & short films on ${AppConfig.appName} OTT!\n\nUse my referral code: ${refCode}\n\nDownload App: ${shareUrl}`
        : `🔥 Stream blockbuster movies, web series & short films on ${AppConfig.appName} OTT!\n\nDownload App: ${shareUrl}`;

      await Share.share({
        message,
        title: `Download ${AppConfig.appName} OTT`,
      });
    } catch {}
  };

  if (!isLoggedIn) {
    return (
      <View style={[styles.container, styles.guestContainer, { paddingTop: insets.top }]}>
        <View style={styles.guestIconCircle}>
          <UserIcon size={48} color="#64748B" />
        </View>
        <Text style={styles.guestTitle}>Sign in to My Space</Text>
        <Text style={styles.guestSubtitle}>
          Manage your subscription plan, movie rentals, watchlist, and personalized
          settings from one place.
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Login')}
          style={styles.signInButton}
        >
          <LogIn size={18} color="#FFFFFF" />
          <Text style={styles.signInText}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Login', { mode: 'signup' })} style={{ padding: 16 }}>
          <Text style={{ color: AppTheme.primary, fontWeight: '700' }}>Create account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayName = user?.fullName || user?.userName || 'MaxxPixels User';
  const isVip = AuthService.isSubscriptionActive(user);
  const rawPackageName = user?.packageName || AuthService.user?.packageName;
  const planName = rawPackageName || (isVip ? 'VIP Membership' : 'Free Plan');

  const missingList = [
    !user?.fullName && 'Full Name',
    !user?.email && 'Email Address',
    !(user?.dateOfBirth || user?.dob) && 'Date of Birth (18+)',
    !user?.profession && 'Profession',
    !user?.pincode && '6-Digit Pincode',
  ].filter(Boolean) as string[];

  const isProfileIncomplete = missingList.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
        {/* User Card */}
        <View style={styles.userCard}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Account')}
            style={styles.avatarSectionTouch}
          >
            <View style={styles.avatarWrap}>
              {user?.image ? (
                <Image source={{ uri: user.image }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <UserIcon size={32} color="#FFFFFF" />
                </View>
              )}
            </View>
            <View style={styles.avatarCameraBadge}>
              <Camera size={12} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Account')}
            style={styles.userInfo}
          >
            <Text style={styles.userName} numberOfLines={1}>
              {displayName}
            </Text>
            <View style={[styles.planBadge, isVip && { backgroundColor: 'rgba(251, 191, 36, 0.15)', borderColor: '#FBBF24' }]}>
              <Crown size={12} color={isVip ? '#FBBF24' : '#94A3B8'} />
              <Text style={[styles.planBadgeText, isVip && { color: '#FBBF24', fontWeight: '700' }]}>{planName}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Account')}
            style={styles.editBtn}
          >
            <Edit2 size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Action Required Alert Box */}
        {isProfileIncomplete && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Account')}
            style={styles.missingAlertBox}
          >
            <View style={styles.alertIconCircle}>
              <AlertCircle size={22} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>Action Required: Complete Profile</Text>
              <Text style={styles.alertSub}>
                Missing: {missingList.join(', ')}. Tap here to update your profile details.
              </Text>
            </View>
            <ChevronRight size={18} color="#F59E0B" />
          </TouchableOpacity>
        )}

        {/* Section 1: Subscriptions & Content */}
        <Text style={styles.sectionHeading}>SUBSCRIPTION & PURCHASES</Text>
        <View style={styles.menuBox}>
          <MenuItem
            icon={<Crown size={20} color={isVip ? '#FBBF24' : '#94A3B8'} />}
            title={isVip ? `Plan: ${planName}` : 'Subscription'}
            subtitle={
              isVip
                ? `Active Membership${user?.expiryDate ? ` • Valid until ${new Date(user.expiryDate).toLocaleDateString()}` : ''}`
                : 'Manage your active membership plan'
            }
            onPress={() => navigation.navigate('Subscription')}
          />
          <MenuItem
            icon={<Clapperboard size={20} color="#A855F7" />}
            title="My Rentals"
            subtitle="View purchased pay-per-view movies"
            onPress={() => navigation.navigate('Rentals')}
          />
          <MenuItem
            icon={<DownloadCloud size={20} color="#3B82F6" />}
            title="My Downloads"
            subtitle="Offline watched content"
            onPress={() => navigation.navigate('MyDownloads')}
          />
        </View>

        {/* Section 2: Account & Settings */}
        <Text style={styles.sectionHeading}>ACCOUNT & SETTINGS</Text>
        <View style={styles.menuBox}>
          <MenuItem
            icon={<UserIcon size={20} color="#60A5FA" />}
            title="Account"
            subtitle="Update personal details and profile picture"
            onPress={() => navigation.navigate('Account')}
          />
          <MenuItem
            icon={<HardDrive size={20} color="#F472B6" />}
            title="Storage & Data"
            subtitle="Manage cache and offline storage"
            onPress={() => navigation.navigate('Storage')}
          />
          <MenuItem
            icon={<Settings size={20} color="#94A3B8" />}
            title="App Settings"
            subtitle="Video quality, Wi-Fi only streaming"
            onPress={() => navigation.navigate('Settings')}
          />
        </View>

        {/* Section 3: Support & Legal */}
        <Text style={styles.sectionHeading}>SUPPORT & ABOUT</Text>
        <View style={styles.menuBox}>
          <MenuItem
            icon={<HelpCircle size={20} color="#38BDF8" />}
            title="Help & Support"
            subtitle="FAQs, ticketing and customer care"
            onPress={() => navigation.navigate('HelpSupport')}
          />
          <MenuItem
            icon={<FileText size={20} color="#94A3B8" />}
            title="Pages & Legal"
            subtitle="Terms, Privacy Policy, Refunds"
            onPress={() => navigation.navigate('PrivacyLegal')}
          />
          <MenuItem
            icon={<Share2 size={20} color="#FBBF24" />}
            title="Share App"
            subtitle="Invite friends & earn rewards"
            onPress={handleShareApp}
          />
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleLogout}
          style={styles.logoutButton}
        >
          <LogOut size={18} color="#EF4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const MenuItem: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}> = ({ icon, title, subtitle, onPress }) => (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={onPress}
    style={styles.menuItem}
  >
    <View style={styles.menuIconWrap}>{icon}</View>
    <View style={styles.menuTextWrap}>
      <Text style={styles.menuTitle}>{title}</Text>
      <Text style={styles.menuSubtitle}>{subtitle}</Text>
    </View>
    <ChevronRight size={18} color="#334155" />
  </TouchableOpacity>
);

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  userCard: {
    backgroundColor: AppTheme.surface,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  avatarSectionTouch: {
    position: 'relative',
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: AppTheme.primary,
    overflow: 'hidden',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: AppTheme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: AppTheme.surface,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    flex: 1,
    backgroundColor: AppTheme.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    marginLeft: 14,
    flex: 1,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.goldBg,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 6,
    gap: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  planBadgeText: {
    color: AppTheme.gold,
    fontSize: 11,
    fontWeight: '800',
  },
  editBtn: {
    padding: 8,
  },
  sectionHeading: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 12,
  },
  menuBox: {
    backgroundColor: AppTheme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuTextWrap: {
    flex: 1,
  },
  menuTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  menuSubtitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    gap: 8,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '900',
  },
  guestContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  guestIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: AppTheme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppTheme.surfaceElevated,
    marginBottom: 20,
  },
  guestTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
  },
  guestSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  missingAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  alertIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertTitle: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '800',
  },
  alertSub: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});
