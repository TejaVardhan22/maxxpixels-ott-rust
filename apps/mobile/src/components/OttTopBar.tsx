import { AppTheme } from '../core/theme';
import React, { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tv, Search, Bell } from 'lucide-react-native';
import { NotificationService } from '../services/notificationService';

interface OttTopBarProps {
  title?: string;
  transparent?: boolean;
  floating?: boolean;
  brandText?: string;
  onSearchPress?: () => void;
  onNotificationsPress?: () => void;
  onCastPress?: () => void;
  onPortalPress?: () => void;
}

export const OttTopBar: React.FC<OttTopBarProps> = ({
  title,
  transparent = false,
  floating = false,
  brandText = 'MaxxPixels',
  onSearchPress,
  onNotificationsPress,
  onCastPress,
  onPortalPress,
}) => {
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(NotificationService.unreadCount);

  useEffect(() => {
    const unsub = NotificationService.subscribeCount((c) => setUnreadCount(c));
    return unsub;
  }, []);

  const barContent = (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 6,
          backgroundColor: transparent ? 'rgba(5, 8, 20, 0.4)' : AppTheme.background,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={onPortalPress ? 0.7 : 1}
        onPress={onPortalPress}
        style={styles.brandRow}
      >
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.brandTextContainer}>
          <Text style={styles.brandText} numberOfLines={1}>
            {brandText}
          </Text>
          {title ? (
            <Text style={styles.subTitle} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      <View style={styles.actionRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onCastPress}
          style={styles.iconButton}
        >
          <Tv size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onSearchPress}
          style={styles.iconButton}
        >
          <Search size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onNotificationsPress}
          style={styles.iconButton}
        >
          <Bell size={20} color="#FFFFFF" />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (floating) {
    return <View style={styles.floatingWrapper}>{barContent}</View>;
  }

  return barContent;
};

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99,
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  brandTextContainer: {
    marginLeft: 9,
    justifyContent: 'center',
    flex: 1,
  },
  brandText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0,
  },
  subTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(5, 8, 20, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
});
