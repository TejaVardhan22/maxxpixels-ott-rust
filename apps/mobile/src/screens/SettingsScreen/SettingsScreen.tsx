import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  Wifi,
  Play,
  Bell,
  HardDrive,
  Trash2,
  ChevronRight,
  Shield,
  Smartphone,
} from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { SettingsService } from '../../services/settingsService';
import { SweetAlert } from '../../components/SweetAlert';
import { Toast } from '../../components/Toast';

export const SettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [wifiOnly, setWifiOnly] = useState(SettingsService.wifiOnly);
  const [autoplay, setAutoplay] = useState(SettingsService.autoplay);
  const [pushNotifs, setPushNotifs] = useState(SettingsService.pushNotifications);
  const [videoQuality, setVideoQuality] = useState(SettingsService.videoQuality);
  const [cellularData, setCellularData] = useState(SettingsService.cellularData);

  const toggleWifi = async (val: boolean) => {
    setWifiOnly(val);
    await SettingsService.setWifiOnly(val);
  };

  const toggleAutoplay = async (val: boolean) => {
    setAutoplay(val);
    await SettingsService.setAutoplay(val);
  };

  const togglePush = async (val: boolean) => {
    setPushNotifs(val);
    await SettingsService.setPushNotifications(val);
  };

  const chooseQuality = () => {
    Alert.alert('Video Quality', 'Select default streaming quality', [
      {
        text: 'High (Best Quality)',
        onPress: async () => {
          setVideoQuality('High');
          await SettingsService.setVideoQuality('High');
          Toast.info('Video quality set to High.', 'Settings Updated');
        },
      },
      {
        text: 'Medium (Balanced)',
        onPress: async () => {
          setVideoQuality('Medium');
          await SettingsService.setVideoQuality('Medium');
          Toast.info('Video quality set to Medium.', 'Settings Updated');
        },
      },
      {
        text: 'Low (Data Saver)',
        onPress: async () => {
          setVideoQuality('Low');
          await SettingsService.setVideoQuality('Low');
          Toast.info('Video quality set to Low (Data Saver).', 'Settings Updated');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleClearCache = async () => {
    navigation.navigate('Storage');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>App Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Video & Playback Section */}
        <Text style={styles.sectionHeading}>VIDEO PLAYBACK</Text>
        <View style={styles.card}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={chooseQuality}
            style={styles.rowItem}
          >
            <View style={styles.iconWrap}>
              <Smartphone size={18} color="#60A5FA" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.itemTitle}>Video Streaming Quality</Text>
              <Text style={styles.itemSub}>{videoQuality}</Text>
            </View>
            <ChevronRight size={18} color="#334155" />
          </TouchableOpacity>

          <View style={styles.rowItem}>
            <View style={styles.iconWrap}>
              <Wifi size={18} color="#34D399" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.itemTitle}>Stream on Wi-Fi Only</Text>
              <Text style={styles.itemSub}>Avoid using cellular mobile data</Text>
            </View>
            <Switch
              value={wifiOnly}
              onValueChange={toggleWifi}
              trackColor={{ false: '#334155', true: AppTheme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.rowItem}>
            <View style={styles.iconWrap}>
              <Play size={18} color="#FBBF24" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.itemTitle}>Autoplay Next Episode</Text>
              <Text style={styles.itemSub}>Automatically play the next video in series</Text>
            </View>
            <Switch
              value={autoplay}
              onValueChange={toggleAutoplay}
              trackColor={{ false: '#334155', true: AppTheme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Notifications */}
        <Text style={styles.sectionHeading}>NOTIFICATIONS</Text>
        <View style={styles.card}>
          <View style={styles.rowItem}>
            <View style={styles.iconWrap}>
              <Bell size={18} color="#A855F7" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.itemTitle}>Push Notifications</Text>
              <Text style={styles.itemSub}>New releases and recommended updates</Text>
            </View>
            <Switch
              value={pushNotifs}
              onValueChange={togglePush}
              trackColor={{ false: '#334155', true: AppTheme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Storage */}
        <Text style={styles.sectionHeading}>STORAGE & CACHE</Text>
        <View style={styles.card}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Storage')}
            style={styles.rowItem}
          >
            <View style={styles.iconWrap}>
              <HardDrive size={18} color="#F472B6" />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.itemTitle}>Device Storage Usage</Text>
              <Text style={styles.itemSub}>Check breakdown and manage files</Text>
            </View>
            <ChevronRight size={18} color="#334155" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleClearCache}
            style={styles.rowItem}
          >
            <View style={styles.iconWrap}>
              <Trash2 size={18} color="#EF4444" />
            </View>
            <View style={styles.textWrap}>
              <Text style={[styles.itemTitle, { color: '#EF4444' }]}>Clear Temporary Cache</Text>
              <Text style={styles.itemSub}>Free up disk space</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionHeading: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 16,
  },
  card: {
    backgroundColor: AppTheme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textWrap: {
    flex: 1,
  },
  itemTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  itemSub: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
