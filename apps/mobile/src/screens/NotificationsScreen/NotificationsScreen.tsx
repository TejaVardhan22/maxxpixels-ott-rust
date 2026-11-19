import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Bell, BellOff, Trash2, X } from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { BackendNotification, NotificationService } from '../../services/notificationService';
import { useAuth } from '../../context/AuthContext';
import { Toast } from '../../components/Toast';

export const NotificationsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { isLoggedIn } = useAuth();

  const [notifications, setNotifications] = useState<BackendNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await NotificationService.getBackendNotifications();
      setNotifications(res);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDismissOne = async (item: BackendNotification) => {
    setNotifications((prev) => prev.filter((n) => n.id !== item.id));
    await NotificationService.clearNotification(item.id);
  };

  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    const currentNotifs = [...notifications];
    setNotifications([]);
    await NotificationService.clearAllNotifications(currentNotifs);
    Toast.info('All notifications cleared', 'Notifications');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>

        {isLoggedIn && notifications.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={handleClearAll}
            style={styles.clearAllBtn}
            accessibilityLabel="Clear all notifications"
          >
            <Trash2 size={15} color={AppTheme.textSecondary} />
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {!isLoggedIn ? (
        <View style={styles.centerEmpty}>
          <BellOff size={48} color="#64748B" />
          <Text style={styles.emptyTitle}>Sign in for notifications</Text>
          <Text style={styles.emptySub}>
            Please sign in to receive personalized alerts and updates.
          </Text>
        </View>
      ) : loading && notifications.length === 0 ? (
        <View style={styles.centerEmpty}>
          <ActivityIndicator size="large" color={AppTheme.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerEmpty}>
          <Bell size={48} color="rgba(255, 255, 255, 0.2)" />
          <Text style={styles.emptyTitle}>No Notifications</Text>
          <Text style={styles.emptySub}>
            You're all caught up! New trailers, releases, and alerts will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={styles.listContent}
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
          renderItem={({ item }) => (
            <View style={styles.notifCard}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.thumb} />
              ) : (
                <View style={styles.iconCircle}>
                  <Bell size={20} color={AppTheme.primary} />
                </View>
              )}

              <View style={styles.infoWrap}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.message}>{item.message}</Text>
                {item.created_at ? (
                  <Text style={styles.time}>{item.created_at}</Text>
                ) : null}
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleDismissOne(item)}
                style={styles.dismissBtn}
                accessibilityLabel="Dismiss notification"
              >
                <X size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
};

export default NotificationsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppTheme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: AppTheme.surface,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  clearAllText: {
    color: AppTheme.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: AppTheme.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: AppTheme.border,
    position: 'relative',
  },
  thumb: {
    width: 56,
    height: 72,
    borderRadius: 8,
    backgroundColor: AppTheme.surfaceElevated,
    marginRight: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppTheme.tagBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  infoWrap: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    color: AppTheme.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  message: {
    color: AppTheme.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  time: {
    color: AppTheme.primaryLight,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
  dismissBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  centerEmpty: {
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
  },
});
