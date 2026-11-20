import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
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
  Mail,
  Phone,
  User as UserIcon,
  KeyRound,
  LogIn,
  UserPlus,
  ShieldCheck,
  CheckSquare,
  Square,
} from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { AppConfig } from '../../core/config';
import { validateRegistration, isValidPhone, COUNTRY_CODES } from '../../core/authValidation';
import { AuthService } from '../../services/authService';
import { Toast } from '../../components/Toast';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ScreenMode = 'signin' | 'signup';

export const LoginScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // Start on sign-in by default; allow deep-link to open register
  const [mode, setMode] = useState<ScreenMode>(route.params?.mode === 'signup' ? 'signup' : 'signin');
  const [countryCode, setCountryCode] = useState('+91');
  const [countryPicker, setCountryPicker] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setTimeout(() => setResendSeconds((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  // ---------- Sign In State ----------
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  // ---------- Sign Up State ----------
  const [signupFirstName, setSignupFirstName] = useState('');
  const [signupLastName, setSignupLastName] = useState('');
  const [signupReferralCode, setSignupReferralCode] = useState('');
  const [signupMobile, setSignupMobile] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupOtp, setSignupOtp] = useState('');
  const [signupOtpSent, setSignupOtpSent] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);

  const signupFullName = `${signupFirstName.trim()} ${signupLastName.trim()}`.trim();

  // Load pending referral code from deep-link or storage
  useEffect(() => {
    let active = true;
    const loadReferralCode = async () => {
      try {
        const stored = await AsyncStorage.getItem('pending_referral_code');
        const routed =
          route.params?.ref ||
          route.params?.reference_code ||
          route.params?.referral ||
          route.params?.agentCode;
        const initial = (routed || stored || '').trim().toUpperCase();
        if (active && initial) setSignupReferralCode(initial);
      } catch {}
    };
    void loadReferralCode();
    return () => {
      active = false;
    };
  }, [route.params]);

  const navigatePostAuth = async (userObj: any) => {
    let hasActiveSub = false;
    try {
      const status = await Promise.race([
        AuthService.syncSubscriptionStatus(),
        new Promise<{ ok: boolean; active: boolean }>((resolve) =>
          setTimeout(() => resolve({ ok: false, active: AuthService.isSubscriptionActive(userObj) }), 8000),
        ),
      ]);
      hasActiveSub = status.ok ? status.active : AuthService.isSubscriptionActive();
    } catch {
      hasActiveSub = AuthService.isSubscriptionActive(userObj) || AuthService.isSubscriptionActive();
    }

    if (!hasActiveSub) {
      Toast.info('Please choose a membership plan to activate streaming access.', 'Activate Subscription');
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }, { name: 'Subscription' }],
      });
    } else {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.replace('Main');
    }
  };

  // ---------- Sign In Handlers ----------
  const handleSendOtp = async () => {
    if (!isValidPhone(mobileNumber, countryCode)) {
      Toast.warning('Please enter a valid mobile number.', 'Validation Error');
      return;
    }

    setOtpLoading(true);
    try {
      await AuthService.sendMobileOtp(`${countryCode}${mobileNumber}`, otpSent, false);
      setResendSeconds(30);
      setOtpSent(true);
      Toast.success(`Verification code sent to ${countryCode} ${mobileNumber}.`, 'OTP Sent');
    } catch (e: any) {
      if (e?.message && /not registered|user_not_registered|404/i.test(e.message)) {
        Toast.warning('This mobile number is not registered. Please register to continue.', 'Registration Required');
        setSignupMobile(mobileNumber);
        setMode('signup');
        return;
      }
      Toast.error(e.message || 'Could not send verification code.', 'OTP Request Failed');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = (codeToVerify || otpCode).trim();
    if (!/^\d{6}$/.test(code)) {
      Toast.warning('Please enter the 6-digit verification code.', 'Validation Error');
      return;
    }

    setOtpLoading(true);
    try {
      const loggedInUser = await AuthService.loginWithMobileOtp(`${countryCode}${mobileNumber}`, code, undefined, {
        isRegistration: false,
      });
      Toast.success('Signed in successfully to MaxxPixels.', 'Welcome!');
      await navigatePostAuth(loggedInUser);
    } catch (e: any) {
      if (e?.message && /not registered|register first|user_not_registered/i.test(e.message)) {
        Toast.warning('This mobile number is not registered. Please register to continue.', 'Registration Required');
        setSignupMobile(mobileNumber);
        setMode('signup');
        setOtpSent(false);
        setOtpCode('');
        return;
      }
      Toast.error(e.message || 'Invalid verification code. Please try again.', 'Verification Failed');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpChange = (value: string) => {
    const clean = value.replace(/\D/g, '').substring(0, 6);
    setOtpCode(clean);
    if (clean.length === 6 && !otpLoading) {
      void handleVerifyOtp(clean);
    }
  };

  // ---------- Sign Up Handlers ----------
  const handleSendSignupOtp = async () => {
    if (!signupFirstName.trim() || !signupLastName.trim()) {
      Toast.warning('Please enter your first name and last name.', 'Check your details');
      return;
    }
    const validationError = validateRegistration({
      name: signupFullName,
      email: signupEmail,
      phone: signupMobile,
      countryCode,
      consent: adultConfirmed,
    });
    if (validationError) {
      Toast.warning(validationError, 'Check your details');
      return;
    }

    setSignupLoading(true);
    try {
      await AuthService.sendMobileOtp(`${countryCode}${signupMobile}`, signupOtpSent, true, {
        referenceCode: signupReferralCode,
        agentCode: signupReferralCode,
      });
      setResendSeconds(30);
      setSignupOtpSent(true);
      Toast.success(`Verification code sent to ${countryCode} ${signupMobile}.`, 'OTP Sent');
    } catch (e: any) {
      if (e?.message && /already registered|user already exists/i.test(e.message)) {
        Toast.info('User already exists', 'Already Registered');
        setMobileNumber(signupMobile);
        setMode('signin');
        return;
      }
      Toast.error(e.message || 'Could not send SMS code.', 'Registration Failed');
    } finally {
      setSignupLoading(false);
    }
  };

  const handleVerifyAndRegister = async (codeToVerify?: string) => {
    const code = (codeToVerify || signupOtp).trim();
    if (!/^\d{6}$/.test(code)) {
      Toast.warning('Please enter the 6-digit SMS verification code.', 'Validation Error');
      return;
    }

    setSignupLoading(true);
    try {
      let pendingRef = signupReferralCode.trim().toUpperCase() || undefined;
      if (!pendingRef) {
        try {
          const stored = await AsyncStorage.getItem('pending_referral_code');
          if (stored && stored.trim()) pendingRef = stored.trim().toUpperCase();
        } catch {}
      }
      const referralCode = pendingRef;

      const newUser = await AuthService.loginWithMobileOtp(`${countryCode}${signupMobile}`, code, signupFullName, {
        firstName: signupFirstName.trim(),
        lastName: signupLastName.trim(),
        email: signupEmail,
        referenceCode: referralCode,
        agentCode: referralCode,
        isRegistration: true,
      });

      if (referralCode) {
        AsyncStorage.removeItem('pending_referral_code').catch(() => {});
      }

      Toast.success('Account created and verified successfully!', 'Account Created');
      await navigatePostAuth(newUser);
    } catch (e: any) {
      Toast.error(e.message || 'Verification failed. Please check the code.', 'Registration Error');
    } finally {
      setSignupLoading(false);
    }
  };

  const handleSignupOtpChange = (value: string) => {
    const clean = value.replace(/\D/g, '').substring(0, 6);
    setSignupOtp(clean);
    if (clean.length === 6 && !signupLoading) {
      void handleVerifyAndRegister(clean);
    }
  };

  const switchMode = useCallback(() => {
    setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'));
    setOtpCode('');
    setSignupOtp('');
    setCountryPicker(false);
    setOtpSent(false);
    setSignupOtpSent(false);
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        accessibilityLabel="Go back"
        onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('Main')}
        style={[styles.backBtn, { top: insets.top + 10 }]}
      >
        <ArrowLeft size={22} color="#FFFFFF" />
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() =>
          navigation.reset({
            index: 0,
            routes: [{ name: 'PortalSelection' }],
          })
        }
        style={[styles.skipBtn, { top: insets.top + 10 }]}
      >
        <Text style={styles.skipBtnText}>Skip</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Branding */}
        <View style={styles.brandingHeader}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appTitle}>MAXXPIXELS</Text>
        </View>

        {/* ================= SIGN IN VIEW ================= */}
        {mode === 'signin' ? (
          <>
            <View style={styles.signinCard}>
              <Text style={styles.eyebrow}>Welcome back</Text>
              <Text style={styles.heading}>Sign in to MaxxPixels</Text>
              <Text style={styles.description}>
                Enter your mobile number to receive a 6-digit verification code.
              </Text>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Select country code"
                disabled={otpSent || otpLoading}
                onPress={() => setCountryPicker(!countryPicker)}
                style={styles.countrySelector}
              >
                <Text style={styles.countryCodeText}>
                  {COUNTRY_CODES.find((c) => c.code === countryCode)?.name} ({countryCode})
                </Text>
                <Phone size={16} color={AppTheme.textSecondary} />
              </TouchableOpacity>

              {countryPicker && (
                <View style={styles.countryPickerOverlay}>
                  {COUNTRY_CODES.map((country) => (
                    <TouchableOpacity
                      key={country.code}
                      accessibilityRole="button"
                      onPress={() => {
                        setCountryCode(country.code);
                        setCountryPicker(false);
                      }}
                      style={styles.countryOption}
                    >
                      <Text style={styles.countryCodeText}>
                        {country.name} {country.code}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>MOBILE NUMBER</Text>
                <View style={styles.inputBox}>
                  <View style={styles.countryCodeBadge}>
                    <Text style={styles.countryCodeText}>{countryCode}</Text>
                  </View>
                  <TextInput
                    placeholder="Mobile phone number"
                    placeholderTextColor={AppTheme.textSecondary}
                    value={mobileNumber}
                    onChangeText={(value) => setMobileNumber(value.replace(/\D/g, ''))}
                    editable={!otpSent && !otpLoading}
                    accessibilityLabel="Mobile phone number"
                    keyboardType="phone-pad"
                    maxLength={15 - countryCode.length + 1}
                    style={styles.input}
                  />
                </View>

                {otpSent ? (
                  <>
                    <View style={styles.otpHeaderRow}>
                      <Text style={styles.inputLabel}>6-DIGIT VERIFICATION CODE</Text>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleSendOtp}
                        disabled={otpLoading || resendSeconds > 0}
                      >
                        <Text style={styles.resendText}>
                          {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend code'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.inputBox}>
                      <KeyRound size={20} color="#64748B" style={styles.fieldIcon} />
                      <TextInput
                        placeholder="Enter 6-digit OTP"
                        placeholderTextColor={AppTheme.textSecondary}
                        value={otpCode}
                        onChangeText={handleOtpChange}
                        autoComplete="sms-otp"
                        textContentType="oneTimeCode"
                        importantForAutofill="yes"
                        autoFocus={true}
                        accessibilityLabel="Verification code"
                        keyboardType="number-pad"
                        maxLength={6}
                        style={[styles.input, { letterSpacing: 4, fontWeight: '900' }]}
                      />
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => void handleVerifyOtp()}
                      disabled={otpLoading}
                      style={styles.actionButton}
                    >
                      {otpLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <ShieldCheck size={18} color="#FFFFFF" />
                          <Text style={styles.btnText}>Verify & Sign In</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleSendOtp}
                    disabled={otpLoading}
                    style={styles.actionButton}
                  >
                    {otpLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Phone size={18} color="#FFFFFF" />
                        <Text style={styles.btnText}>Send Verification Code</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Bottom link: Don't have an account? Register */}
              <View style={styles.bottomLink}>
                <Text style={styles.bottomLinkText}>Don't have an account?</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={switchMode}
                  style={styles.bottomLinkTouch}
                >
                  <Text style={styles.bottomLinkBold}>Create account</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          // ================= SIGN UP VIEW =================
          <>
            <View style={styles.signupCard}>
              <Text style={styles.eyebrow}>Create account</Text>
              <Text style={styles.heading}>Join MaxxPixels</Text>
              <Text style={styles.description}>
                Fill in your details, then verify your mobile number to start streaming.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>FIRST NAME *</Text>
                <View style={styles.inputBox}>
                  <UserIcon size={18} color="#64748B" style={styles.fieldIcon} />
                  <TextInput
                    placeholder="e.g. Rahul"
                    placeholderTextColor={AppTheme.textSecondary}
                    value={signupFirstName}
                    onChangeText={setSignupFirstName}
                    editable={!signupOtpSent && !signupLoading}
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>LAST NAME *</Text>
                <View style={styles.inputBox}>
                  <UserIcon size={18} color="#64748B" style={styles.fieldIcon} />
                  <TextInput
                    placeholder="e.g. Sharma"
                    placeholderTextColor={AppTheme.textSecondary}
                    value={signupLastName}
                    onChangeText={setSignupLastName}
                    editable={!signupOtpSent && !signupLoading}
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>EMAIL ADDRESS (OPTIONAL)</Text>
                <View style={styles.inputBox}>
                  <Mail size={18} color="#64748B" style={styles.fieldIcon} />
                  <TextInput
                    placeholder="name@example.com (optional)"
                    placeholderTextColor={AppTheme.textSecondary}
                    value={signupEmail}
                    onChangeText={setSignupEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!signupOtpSent && !signupLoading}
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>MOBILE NUMBER *</Text>
                <View style={styles.inputBox}>
                  <View style={styles.countryCodeBadge}>
                    <Text style={styles.countryCodeText}>{countryCode}</Text>
                  </View>
                  <TextInput
                    placeholder="Mobile phone number"
                    placeholderTextColor={AppTheme.textSecondary}
                    value={signupMobile}
                    onChangeText={(value) => setSignupMobile(value.replace(/\D/g, ''))}
                    keyboardType="phone-pad"
                    maxLength={15 - countryCode.length + 1}
                    editable={!signupOtpSent && !signupLoading}
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>REFERRAL CODE (OPTIONAL)</Text>
                <View style={styles.inputBox}>
                  <KeyRound size={18} color="#64748B" style={styles.fieldIcon} />
                  <TextInput
                    placeholder="e.g. MKT-A1B2C3D4"
                    placeholderTextColor={AppTheme.textSecondary}
                    value={signupReferralCode}
                    onChangeText={(value) => setSignupReferralCode(value.trim().toUpperCase())}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={!signupOtpSent && !signupLoading}
                    style={styles.input}
                  />
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setAdultConfirmed(!adultConfirmed)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: adultConfirmed }}
                style={styles.checkboxRow}
                disabled={signupOtpSent || signupLoading}
              >
                {adultConfirmed ? (
                  <CheckSquare size={18} color={AppTheme.primary} />
                ) : (
                  <Square size={18} color="#64748B" />
                )}
                <Text style={styles.checkboxLabel}>
                  I agree to the <Text style={styles.legalLink}>Terms of Use</Text> and{' '}
                  <Text style={styles.legalLink}>Privacy Policy</Text>.
                </Text>
              </TouchableOpacity>

              {signupOtpSent ? (
                <>
                  <View style={styles.otpHeaderRow}>
                    <Text style={styles.inputLabel}>ENTER 6-DIGIT SMS CODE</Text>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={handleSendSignupOtp}
                      disabled={signupLoading || resendSeconds > 0}
                    >
                      <Text style={styles.resendText}>
                        {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend code'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputBox}>
                    <KeyRound size={20} color="#64748B" style={styles.fieldIcon} />
                    <TextInput
                      placeholder="Enter 6-digit code"
                      placeholderTextColor={AppTheme.textSecondary}
                      value={signupOtp}
                      onChangeText={handleSignupOtpChange}
                      autoComplete="sms-otp"
                      textContentType="oneTimeCode"
                      importantForAutofill="yes"
                      autoFocus={true}
                      accessibilityLabel="Registration verification code"
                      keyboardType="number-pad"
                      maxLength={6}
                      style={[styles.input, { letterSpacing: 4, fontWeight: '900' }]}
                    />
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => void handleVerifyAndRegister()}
                    disabled={signupLoading}
                    style={styles.actionButton}
                  >
                    {signupLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <ShieldCheck size={18} color="#FFFFFF" />
                        <Text style={styles.btnText}>Verify & Create Account</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleSendSignupOtp}
                  disabled={signupLoading}
                  style={styles.actionButton}
                >
                  {signupLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <UserPlus size={18} color="#FFFFFF" />
                      <Text style={styles.btnText}>Send Verification OTP</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Bottom link: Already have an account? Sign in */}
              <View style={styles.bottomLink}>
                <Text style={styles.bottomLinkText}>Already have an account?</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={switchMode}
                  style={styles.bottomLinkTouch}
                >
                  <Text style={styles.bottomLinkBold}>Sign in</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.legalLinks}>
        <Text
          accessibilityRole="link"
          onPress={() =>
            Linking.openURL(AppConfig.termsUrl).catch(() =>
              Toast.error('Unable to open Terms of Use.'),
            )
          }
          style={styles.legalLink}
        >
          Terms of Use
        </Text>
        <Text style={styles.legalSeparator}>&nbsp;</Text>
        <Text
          accessibilityRole="link"
          onPress={() =>
            Linking.openURL(AppConfig.privacyUrl).catch(() =>
              Toast.error('Unable to open Privacy Policy.'),
            )
          }
          style={styles.legalLink}
        >
          Privacy Policy
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 99,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppTheme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    top: 10,
  },
  skipBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 99,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: AppTheme.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    top: 10,
  },
  skipBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  brandingHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 68,
    height: 68,
    marginBottom: 10,
  },
  appTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1,
  },
  // ---------- Sign In Card ----------
  signinCard: {
    backgroundColor: AppTheme.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  // ---------- Sign Up Card ----------
  signupCard: {
    backgroundColor: AppTheme.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  eyebrow: {
    color: AppTheme.primaryLight,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  heading: {
    color: AppTheme.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 8,
  },
  description: {
    color: AppTheme.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  countrySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: AppTheme.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },
  countryPickerOverlay: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    backgroundColor: AppTheme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
    zIndex: 100,
    maxHeight: 260,
  },
  countryOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: AppTheme.background,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  countryCodeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: AppTheme.surface,
  },
  countryCodeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  fieldIcon: {
    marginLeft: 12,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 14,
  },
  otpHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  resendText: {
    color: AppTheme.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  actionButton: {
    marginTop: 16,
    backgroundColor: AppTheme.primary,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 8,
  },
  checkboxLabel: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 15,
  },
  legalLink: {
    color: AppTheme.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  // ---------- Bottom mode switch ----------
  bottomLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  bottomLinkText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  bottomLinkTouch: {
    marginLeft: 4,
  },
  bottomLinkBold: {
    color: AppTheme.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 20,
    paddingBottom: 20,
  },
});

export default LoginScreen;
