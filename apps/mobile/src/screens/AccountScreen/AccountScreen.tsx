import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  ArrowLeft,
  User as UserIcon,
  Mail,
  Phone,
  Lock,
  Crown,
  Camera,
  Save,
  Check,
  X,
  Sparkles,
  Link as LinkIcon,
  ImageIcon,
  UploadCloud,
} from 'lucide-react-native';
import { launchImageLibrary, ImagePickerResponse, Asset } from 'react-native-image-picker';
import { AppTheme } from '../../core/theme';
import { useAuth } from '../../context/AuthContext';
import { AuthService } from '../../services/authService';
import { Toast } from '../../components/Toast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Curated cinematic avatar presets
const PRESET_AVATARS = [
  { id: '1', name: 'VIP Gold', uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80' },
  { id: '2', name: 'Cinema Director', uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80' },
  { id: '3', name: 'Neon Cyber', uri: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80' },
  { id: '4', name: 'Studio Artist', uri: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80' },
  { id: '5', name: 'Action Hero', uri: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80' },
  { id: '6', name: 'Screen Legend', uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80' },
  { id: '7', name: 'Anime Star', uri: 'https://api.dicebear.com/7.x/bottts/png?seed=MaxxStar&size=200' },
  { id: '8', name: 'Cyber Bot', uri: 'https://api.dicebear.com/7.x/bottts/png?seed=CyberMaxx&size=200' },
];

export const AccountScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, updateProfile, refreshProfile, syncSubscription } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || user?.userName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [selectedAvatar, setSelectedAvatar] = useState(user?.image || '');
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name?: string; type?: string; base64?: string } | null>(null);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      let isMounted = true;
      const syncData = async () => {
        try {
          await syncSubscription();
          if (isMounted) {
            await refreshProfile();
          }
        } catch (e) {
          console.warn('AccountScreen syncData error:', e);
        }
      };
      syncData();
      return () => {
        isMounted = false;
      };
    }, [syncSubscription, refreshProfile])
  );

  useEffect(() => {
    if (user) {
      if (user.fullName || user.userName) setFullName(user.fullName || user.userName || '');
      if (user.email) setEmail(user.email);
      if (user.image && !selectedFile) setSelectedAvatar(user.image);
    }
  }, [user]);

  const handlePickFromGallery = async () => {
    try {
      const response: ImagePickerResponse = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 800,
        maxHeight: 800,
        selectionLimit: 1,
        includeBase64: true,
      });

      if (response.didCancel) return;

      if (response.errorCode) {
        Toast.error(response.errorMessage || 'Could not open photo gallery.', 'Gallery Error');
        return;
      }

      const asset: Asset | undefined = response.assets?.[0];
      if (asset?.uri) {
        setSelectedAvatar(asset.uri);
        setSelectedFile({
          uri: asset.uri,
          name: asset.fileName || `avatar_${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
          base64: asset.base64,
        });
        setShowAvatarModal(false);
        Toast.success('Photo selected! Tap "Save Changes" to upload.', 'Photo Ready');
      }
    } catch (e: any) {
      Toast.error(e.message || 'Failed to select image.', 'Error');
    }
  };

  const handleSelectPreset = (uri: string) => {
    setSelectedAvatar(uri);
    setSelectedFile(null);
    setShowAvatarModal(false);
    Toast.success('Avatar selected! Tap "Save Changes" to apply.', 'Avatar Selected');
  };

  const handleApplyCustomUrl = () => {
    if (!customAvatarUrl.trim()) {
      Toast.warning('Please enter a valid image URL.', 'Invalid URL');
      return;
    }
    setSelectedAvatar(customAvatarUrl.trim());
    setSelectedFile(null);
    setCustomAvatarUrl('');
    setShowAvatarModal(false);
    Toast.success('Custom avatar URL set! Tap "Save Changes" to apply.', 'Avatar Selected');
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Toast.warning('Full name is required.', 'Validation Error');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      Toast.warning('Please enter a valid email address.', 'Validation Error');
      return;
    }

    setSaving(true);
    try {
      const updatedUser = await updateProfile({
        fullName: fullName.trim(),
        email: cleanEmail,
        image: selectedAvatar || user?.image,
        imageBase64: selectedFile?.base64,
        imageFile: selectedFile || undefined,
      });

      if (updatedUser?.image) {
        setSelectedAvatar(updatedUser.image);
        setSelectedFile(null);
      }

      Toast.success('Your profile details and picture have been updated.', 'Profile Saved');
      setTimeout(() => {
        navigation.goBack();
      }, 600);
    } catch (e: any) {
      Toast.error(e.message || 'Failed to update profile.', 'Update Failed');
    } finally {
      setSaving(false);
    }
  };

  const currentAvatarDisplay = selectedAvatar || user?.image;

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
        <Text style={styles.headerTitle}>Edit Profile</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar with Camera & Upload Button */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowAvatarModal(true)}
            style={styles.avatarWrap}
          >
            {currentAvatarDisplay ? (
              <Image source={{ uri: currentAvatarDisplay }} style={styles.avatar} />
            ) : (
              <View style={styles.placeholderAvatar}>
                <UserIcon size={44} color="#64748B" />
              </View>
            )}
            <View style={styles.cameraIconBtn}>
              <Camera size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowAvatarModal(true)}
            style={styles.changePhotoLink}
          >
            <View style={styles.uploadActionPill}>
              <UploadCloud size={14} color="#60A5FA" />
              <Text style={styles.changePhotoText}>Upload / Change Photo</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 1. Full Name Input (Editable) */}
        <Text style={styles.inputLabel}>FULL NAME</Text>
        <View style={styles.inputBox}>
          <UserIcon size={18} color="#64748B" style={styles.iconPrefix} />
          <TextInput
            placeholder="Enter full name"
            placeholderTextColor="#475569"
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
          />
        </View>

        {/* 2. Email Address Input (Editable) */}
        <Text style={[styles.inputLabel, { marginTop: 18 }]}>EMAIL ADDRESS</Text>
        <View style={styles.inputBox}>
          <Mail size={18} color="#64748B" style={styles.iconPrefix} />
          <TextInput
            placeholder="Enter email address"
            placeholderTextColor="#475569"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
        </View>

        {/* 3. Mobile Number (Strictly Read-Only) */}
        <Text style={[styles.inputLabel, { marginTop: 18 }]}>MOBILE NUMBER (READ ONLY)</Text>
        <View style={[styles.inputBox, styles.disabledBox]}>
          <Phone size={18} color="#475569" style={styles.iconPrefix} />
          <Text style={styles.disabledText}>{user?.mobileNumber || 'No number linked'}</Text>
          <View style={styles.lockBadge}>
            <Lock size={12} color="#94A3B8" />
            <Text style={styles.lockBadgeText}>Protected</Text>
          </View>
        </View>
        <Text style={styles.readOnlyHelpText}>
          Your registered mobile number is verified for OTP sign-in and cannot be changed here for account security.
        </Text>

        {/* Plan card */}
        {(() => {
          const isVip = AuthService.isSubscriptionActive(user);
          const rawPackageName = user?.packageName || AuthService.user?.packageName;
          const planTitle = rawPackageName || (isVip ? 'VIP Membership' : 'Free Plan');
          const planSub = isVip
            ? (user?.expiryDate ? `Active • Valid until ${new Date(user.expiryDate).toLocaleDateString()}` : 'Streaming access active on this account')
            : 'No active streaming membership';

          return (
            <View style={styles.planCard}>
              <View style={[styles.planIconWrap, isVip && { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
                <Crown size={20} color={isVip ? '#FBBF24' : AppTheme.primary} />
              </View>
              <View style={styles.planTextWrap}>
                <Text style={styles.planTitle}>{planTitle}</Text>
                <Text style={styles.planExpiry}>{planSub}</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Subscription')}
              >
                <Text style={[styles.upgradeLink, isVip && { color: '#FBBF24' }]}>{isVip ? 'Manage' : 'Upgrade'}</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* Save Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSave}
          disabled={saving}
          style={styles.saveButton}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Save size={18} color="#FFFFFF" />
              <Text style={styles.saveText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Avatar & Photo Picker Modal */}
      <Modal
        visible={showAvatarModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Camera size={18} color={AppTheme.primary} />
                <Text style={styles.modalTitle}>Update Profile Photo</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAvatarModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Option 1: Upload from Gallery */}
              <Text style={styles.presetSectionLabel}>UPLOAD PHOTO</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handlePickFromGallery}
                style={styles.singleUploadCard}
              >
                <View style={styles.singleUploadIconCircle}>
                  <ImageIcon size={24} color="#3B82F6" />
                </View>
                <View style={styles.singleUploadTextWrap}>
                  <Text style={styles.singleUploadTitle}>Upload from Gallery</Text>
                  <Text style={styles.singleUploadSub}>Select a photo or image from your device</Text>
                </View>
                <UploadCloud size={20} color="#60A5FA" />
              </TouchableOpacity>

              {/* Option 3: Curated Character Avatars */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 12, gap: 6 }}>
                <Sparkles size={14} color="#FBBF24" />
                <Text style={styles.presetSectionLabel}>OR CHOOSE CHARACTER AVATAR</Text>
              </View>
              <View style={styles.presetGrid}>
                {PRESET_AVATARS.map((item) => {
                  const isSelected = selectedAvatar === item.uri && !selectedFile;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.8}
                      onPress={() => handleSelectPreset(item.uri)}
                      style={[
                        styles.presetCard,
                        isSelected && styles.presetCardSelected,
                      ]}
                    >
                      <Image source={{ uri: item.uri }} style={styles.presetImage} />
                      {isSelected && (
                        <View style={styles.presetCheckWrap}>
                          <Check size={14} color="#FFFFFF" />
                        </View>
                      )}
                      <Text style={styles.presetName} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Option 4: Custom Image URL Input */}
              <Text style={[styles.presetSectionLabel, { marginTop: 18 }]}>
                OR ENTER CUSTOM IMAGE URL
              </Text>
              <View style={styles.urlInputRow}>
                <View style={styles.urlInputBox}>
                  <LinkIcon size={16} color="#64748B" style={{ marginRight: 8 }} />
                  <TextInput
                    placeholder="https://example.com/avatar.jpg"
                    placeholderTextColor="#475569"
                    value={customAvatarUrl}
                    onChangeText={setCustomAvatarUrl}
                    autoCapitalize="none"
                    style={styles.urlInput}
                  />
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleApplyCustomUrl}
                  style={styles.urlApplyBtn}
                >
                  <Text style={styles.urlApplyText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AccountScreen;

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
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2.5,
    borderColor: AppTheme.primary,
    position: 'relative',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  placeholderAvatar: {
    flex: 1,
    borderRadius: 48,
    backgroundColor: AppTheme.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIconBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: AppTheme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: AppTheme.background,
  },
  changePhotoLink: {
    marginTop: 12,
  },
  uploadActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
    gap: 6,
  },
  changePhotoText: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '700',
  },
  inputLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTheme.surfaceElevated,
    paddingHorizontal: 14,
    height: 50,
  },
  disabledBox: {
    backgroundColor: '#0A0F1D',
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  disabledText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },
  lockBadge: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  lockBadgeText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  readOnlyHelpText: {
    color: '#475569',
    fontSize: 11,
    marginTop: 6,
    lineHeight: 16,
    paddingHorizontal: 2,
  },
  iconPrefix: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.surface,
    borderRadius: 14,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: AppTheme.surfaceElevated,
  },
  planIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(45, 114, 217, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  planTextWrap: {
    flex: 1,
  },
  planTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  planExpiry: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  upgradeLink: {
    color: AppTheme.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 28,
    gap: 8,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  modalCloseBtn: {
    padding: 4,
  },
  presetSectionLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  singleUploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    gap: 12,
  },
  singleUploadIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  singleUploadTextWrap: {
    flex: 1,
  },
  singleUploadTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  singleUploadSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  presetCard: {
    width: (SCREEN_WIDTH - 40 - 36) / 4,
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  presetCardSelected: {
    transform: [{ scale: 1.05 }],
  },
  presetImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 4,
  },
  presetCheckWrap: {
    position: 'absolute',
    top: 0,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  presetName: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  urlInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  urlInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0F1D',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    height: 44,
  },
  urlInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
  },
  urlApplyBtn: {
    backgroundColor: AppTheme.primary,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  urlApplyText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
