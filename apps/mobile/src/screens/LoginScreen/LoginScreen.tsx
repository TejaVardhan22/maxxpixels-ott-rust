import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
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
  Mail,
  Phone,
  User as UserIcon,
  Calendar,
  Briefcase,
  MapPin,
  KeyRound,
  LogIn,
  UserPlus,
  ShieldCheck,
  CheckSquare,
  Square,
  ChevronDown,
} from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { AppConfig } from '../../core/config';
import { validateRegistration, isValidPhone, COUNTRY_CODES } from '../../core/authValidation';
import { AuthService } from '../../services/authService';
import { Toast } from '../../components/Toast';
import { DobCalendarModal } from '../../components/DobCalendarModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ScreenMode = 'signin' | 'signup';

const PROFESSION_OPTIONS = [
  'Employee',
  'Student',
  'Self-employed',
  'Business owner',
  'Homemaker',
  'Retired',
  'Other',
];

export const LoginScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const route = useRoute<any>();
  const [mode, setMode] = useState<ScreenMode>(route.params?.mode || 'signin');
  const [countryCode, setCountryCode] = useState('+91');
  const [countryPicker, setCountryPicker] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setTimeout(() => setResendSeconds(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  // Sign In Mobile OTP State
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  // Sign Up State
  const [signupFirstName, setSignupFirstName] = useState('');
  const [signupLastName, setSignupLastName] = useState('');
  const [signupReferralCode, setSignupReferralCode] = useState('');
  const [signupMobile, setSignupMobile] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupDob, setSignupDob] = useState('');
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [signupProfession, setSignupProfession] = useState('');
  const [signupOtherProfession, setSignupOtherProfession] = useState('');
  const [signupPincode, setSignupPincode] = useState('');
  const [showProfessionPicker, setShowProfessionPicker] = useState(false);
  const [signupOtp, setSignupOtp] = useState('');
  const [signupOtpSent, setSignupOtpSent] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);

  const signupFullName = `${signupFirstName.trim()} ${signupLastName.trim()}`.trim();

  useEffect(() => {
    let active = true;
    const loadReferralCode = async () => {
      try {
        const stored = await AsyncStorage.getItem('pending_referral_code');
        const routed = route.params?.ref || route.params?.reference_code || route.params?.referral || route.params?.agentCode;
        const initial = (routed || stored || '').trim().toUpperCase();
        if (active && initial) setSignupReferralCode(initial);
      } catch {}
    };
    void loadReferralCode();
    return () => { active = false; };
  }, [route.params]);

  const getAgeDisplay = (dobStr: string): string => {
    if (!dobStr || !/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) return '';
    try {
      const [y, m, d] = dobStr.split('-').map(Number);
      const today = new Date();
      let age = today.getFullYear() - y;
      if (today.getMonth() < m - 1 || (today.getMonth() === m - 1 && today.getDate() < d)) age--;
      return `${age} yrs`;
    } catch {
      return '';
    }
  };

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

  // Sign In SMS OTP Handlers
  const handleSendOtp = async () => {
    if (!isValidPhone(mobileNumber, countryCode)) {
      Toast.warning('Please enter a valid Mobile phone number.', 'Validation Error');
      return;
    }

    setOtpLoading(true);
    try {
      await AuthService.sendMobileOtp(`${countryCode}${mobileNumber}`, otpSent);
      setResendSeconds(30);
      setOtpSent(true);
      Toast.success(`A verification code was sent to ${countryCode} ${mobileNumber}.`, 'Verification Code Sent');
    } catch (e: any) {
      if (e?.message && /not registered/i.test(e.message)) {
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
      const loggedInUser = await AuthService.loginWithMobileOtp(`${countryCode}${mobileNumber}`, code);
      Toast.success('Signed in successfully to MaxxPixels.', 'Welcome!');
      await navigatePostAuth(loggedInUser);
    } catch (e: any) {
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

  // Sign Up Handlers (Password-less OTP Registration)
  const handleSendSignupOtp = async () => {
    if (!signupFirstName.trim() || !signupLastName.trim()) {
      Toast.warning('Please enter your first name and last name.', 'Check your details');
      return;
    }
    const validationError = validateRegistration({
      name: signupFullName, email: signupEmail, phone: signupMobile, countryCode,
      dateOfBirth: signupDob,
      profession: signupProfession === 'Other' ? signupOtherProfession : signupProfession,
      pincode: signupPincode,
      consent: adultConfirmed,
    });
    if (validationError) { Toast.warning(validationError, 'Check your details'); return; }

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

      const prof = signupProfession === 'Other' ? signupOtherProfession.trim() : signupProfession.trim();
      const newUser = await AuthService.loginWithMobileOtp(`${countryCode}${signupMobile}`, code, signupFullName, {
        firstName: signupFirstName.trim(),
        lastName: signupLastName.trim(),
        email: signupEmail,
        dob: signupDob,
        profession: prof,
        pincode: signupPincode.trim(),
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
          { paddingTop: insets.top + 50, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandingHeader}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appTitle}>MAXXPIXELS</Text>
          <Text style={styles.subHeading}>
            {mode === 'signin'
              ? 'Unlimited movies, TV series & originals.'
              : 'Your next great watch starts here.'}
          </Text>
        </View>

        {/* Main Mode Toggle: Sign In vs Sign Up */}
        <View style={styles.modeContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={otpLoading || signupLoading}
            onPress={() => {
              setMode('signin');
              setOtpSent(false);
            }}
            style={[styles.modeButton, mode === 'signin' && styles.modeButtonActive]}
          >
            <LogIn size={15} color={mode === 'signin' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.modeButtonText, mode === 'signin' && styles.modeButtonTextActive]}>
              Sign In (OTP)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setMode('signup');
              setSignupOtpSent(false);
            }}
            style={[styles.modeButton, mode === 'signup' && styles.modeButtonActive]}
          >
            <UserPlus size={15} color={mode === 'signup' ? '#FFFFFF' : '#64748B'} />
            <Text style={[styles.modeButtonText, mode === 'signup' && styles.modeButtonTextActive]}>
              Register (OTP)
            </Text>
          </TouchableOpacity>
        </View>

        {/* SIGN IN VIEW (OTP ONLY) */}
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>{mode === 'signin' ? 'WELCOME BACK' : 'NEW MEMBER REGISTRATION'}</Text>
          <Text accessibilityRole="header" style={styles.heading}>{mode === 'signin' ? 'Sign in to MaxxPixels' : 'Create MaxxPixels Account'}</Text>
          <Text style={styles.description}>{mode === 'signin' ? 'Enter your mobile number to receive a 6-digit verification code.' : 'Fill in your details, then verify your mobile number to start streaming.'}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Select country code" disabled={otpSent || signupOtpSent || otpLoading || signupLoading} onPress={() => setCountryPicker(!countryPicker)} style={styles.countrySelector}>
          <Text style={styles.countryCodeText}>{COUNTRY_CODES.find(country => country.code === countryCode)?.name} ({countryCode})</Text>
          <ChevronDown size={16} color={AppTheme.textSecondary} />
        </TouchableOpacity>
        {countryPicker && COUNTRY_CODES.map(country => (
          <TouchableOpacity key={country.code} accessibilityRole="button" onPress={() => { setCountryCode(country.code); setCountryPicker(false); }} style={styles.countryOption}>
            <Text style={styles.countryCodeText}>{country.name} {country.code}</Text>
          </TouchableOpacity>
        ))}
        {mode === 'signin' ? (
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>MOBILE NUMBER</Text>
            <View style={styles.inputBox}>
              <View style={styles.countryCodeBadge}>
                <Text style={styles.countryCodeText}>{countryCode}</Text>
              </View>
              <TextInput
                placeholder="Mobile phone number"
                placeholderTextColor={AppTheme.textSecondary}
                value={mobileNumber}
                onChangeText={value => setMobileNumber(value.replace(/\D/g, ''))}
                editable={!otpSent && !otpLoading}
                accessibilityLabel="Mobile phone number"
                keyboardType="phone-pad"
                maxLength={15 - countryCode.length + 1}
                style={styles.input}
              />
            </View>

            {otpSent ? (
              <View style={{ marginTop: 14 }}>
                <View style={styles.otpHeaderRow}>
                  <Text style={styles.inputLabel}>6-DIGIT VERIFICATION CODE</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleSendOtp}
                    disabled={otpLoading || resendSeconds > 0}
                  >
                    <Text style={styles.resendText}>{resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend code'}</Text>
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
                  style={styles.loginButton}
                >
                  {otpLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <ShieldCheck size={18} color="#FFFFFF" />
                      <Text style={styles.loginBtnText}>Verify & Sign In</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSendOtp}
                disabled={otpLoading}
                style={styles.loginButton}
              >
                {otpLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Phone size={18} color="#FFFFFF" />
                    <Text style={styles.loginBtnText}>Send Verification Code</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* SIGN UP VIEW (FULL 6-FIELD PASSWORD-LESS REGISTRATION) */
          <View style={styles.formContainer}>
            {/* 1. First & Last Name */}
            <Text style={styles.inputLabel}>FIRST NAME *</Text>
            <View style={styles.inputBox}>
              <UserIcon size={18} color="#64748B" style={styles.fieldIcon} />
              <TextInput
                placeholder="e.g. Alexander"
                placeholderTextColor={AppTheme.textSecondary}
                value={signupFirstName}
                onChangeText={setSignupFirstName}
                editable={!signupOtpSent && !signupLoading}
                style={styles.input}
              />
            </View>

            <Text style={[styles.inputLabel, { marginTop: 12 }]}>LAST NAME *</Text>
            <View style={styles.inputBox}>
              <UserIcon size={18} color="#64748B" style={styles.fieldIcon} />
              <TextInput
                placeholder="e.g. Pierce"
                placeholderTextColor={AppTheme.textSecondary}
                value={signupLastName}
                onChangeText={setSignupLastName}
                editable={!signupOtpSent && !signupLoading}
                style={styles.input}
              />
            </View>

            {/* 2. Email Address */}
            <Text style={[styles.inputLabel, { marginTop: 12 }]}>EMAIL ADDRESS (OPTIONAL)</Text>
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

            {/* 3. Marketing Agent / Referral Code */}
            <Text style={[styles.inputLabel, { marginTop: 12 }]}>REFERRAL CODE (OPTIONAL)</Text>
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

            {/* 4. Mobile Number */}
            <Text style={[styles.inputLabel, { marginTop: 12 }]}>MOBILE PHONE NUMBER *</Text>
            <View style={styles.inputBox}>
              <View style={styles.countryCodeBadge}>
                <Text style={styles.countryCodeText}>{countryCode}</Text>
              </View>
              <TextInput
                placeholder="Mobile phone number"
                placeholderTextColor={AppTheme.textSecondary}
                value={signupMobile}
                onChangeText={value => setSignupMobile(value.replace(/\D/g, ''))}
                keyboardType="phone-pad"
                maxLength={15 - countryCode.length + 1}
                editable={!signupOtpSent && !signupLoading}
                style={styles.input}
              />
            </View>

            {/* 4. Date of Birth */}
            <Text style={[styles.inputLabel, { marginTop: 12 }]}>DATE OF BIRTH (OPTIONAL)</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={signupOtpSent || signupLoading}
              onPress={() => setShowDobPicker(true)}
              style={styles.inputBox}
            >
              <Calendar size={18} color={signupDob ? AppTheme.primary : '#64748B'} style={styles.fieldIcon} />
              <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 14 }}>
                <Text style={{ color: signupDob ? '#FFFFFF' : AppTheme.textSecondary, fontSize: 14, fontWeight: signupDob ? '700' : '400' }}>
                  {signupDob ? signupDob : 'Tap to select Date of Birth'}
                </Text>
              </View>
              {signupDob ? (
                <View style={styles.dobAgeBadge}>
                  <Text style={styles.dobAgeBadgeText}>
                    {getAgeDisplay(signupDob)}
                  </Text>
                </View>
              ) : (
                <ChevronDown size={16} color="#64748B" style={{ marginRight: 12 }} />
              )}
            </TouchableOpacity>

            {/* 5. Profession Selector */}
            <Text style={[styles.inputLabel, { marginTop: 12 }]}>PROFESSION (OPTIONAL)</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={signupOtpSent || signupLoading}
              onPress={() => setShowProfessionPicker(!showProfessionPicker)}
              style={styles.inputBox}
            >
              <Briefcase size={18} color="#64748B" style={styles.fieldIcon} />
              <Text style={[styles.input, { paddingVertical: 14, color: signupProfession ? '#FFFFFF' : AppTheme.textSecondary }]}>
                {signupProfession || 'Tap to select Profession'}
              </Text>
              <ChevronDown size={16} color="#64748B" style={{ marginRight: 12 }} />
            </TouchableOpacity>

            {showProfessionPicker && !signupOtpSent && (
              <View style={styles.professionOptionsList}>
                {PROFESSION_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSignupProfession(opt);
                      setShowProfessionPicker(false);
                    }}
                    style={[
                      styles.professionOptionItem,
                      signupProfession === opt && styles.professionOptionActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.professionOptionText,
                        signupProfession === opt && styles.professionOptionTextActive,
                      ]}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {signupProfession === 'Other' && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.inputLabel}>SPECIFY PROFESSION (OPTIONAL)</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    placeholder="Enter your profession"
                    placeholderTextColor={AppTheme.textSecondary}
                    value={signupOtherProfession}
                    onChangeText={setSignupOtherProfession}
                    editable={!signupOtpSent && !signupLoading}
                    style={styles.input}
                  />
                </View>
              </View>
            )}

            {/* PINCODE / POSTAL CODE */}
            <Text style={[styles.inputLabel, { marginTop: 12 }]}>PINCODE / POSTAL CODE (OPTIONAL)</Text>
            <View style={styles.inputBox}>
              <MapPin size={18} color="#64748B" style={styles.fieldIcon} />
              <TextInput
                placeholder="6-digit Pincode (e.g. 500001)"
                placeholderTextColor={AppTheme.textSecondary}
                value={signupPincode}
                onChangeText={(val) => setSignupPincode(val.replace(/\D/g, '').substring(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                editable={!signupOtpSent && !signupLoading}
                style={[styles.input, { letterSpacing: 1, fontWeight: '700' }]}
              />
            </View>

            {/* 6. 18+ Age & Terms & Conditions Consent */}
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
                I agree to the Terms of Use and Privacy Policy.
              </Text>
            </TouchableOpacity>

            {signupOtpSent ? (
              <View style={{ marginTop: 14 }}>
                <View style={styles.otpHeaderRow}>
                  <Text style={styles.inputLabel}>ENTER 6-DIGIT SMS CODE *</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleSendSignupOtp}
                    disabled={signupLoading || resendSeconds > 0}
                  >
                    <Text style={styles.resendText}>{resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend code'}</Text>
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
                  style={styles.loginButton}
                >
                  {signupLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <ShieldCheck size={18} color="#FFFFFF" />
                      <Text style={styles.loginBtnText}>Verify & Create Account</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSendSignupOtp}
                disabled={signupLoading}
                style={styles.loginButton}
              >
                {signupLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <UserPlus size={18} color="#FFFFFF" />
                    <Text style={styles.loginBtnText}>Send Verification OTP</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {(otpSent || signupOtpSent) && (
          <TouchableOpacity accessibilityRole="button" disabled={otpLoading || signupLoading} onPress={() => { setOtpSent(false); setSignupOtpSent(false); setOtpCode(''); setSignupOtp(''); }} style={styles.editDetails}>
            <Text style={styles.switchModeLink}>Change mobile number or details</Text>
          </TouchableOpacity>
        )}
        <View style={styles.legalLinks}>
          <Text accessibilityRole="link" onPress={() => Linking.openURL(AppConfig.termsUrl).catch(() => Toast.error('Unable to open Terms of Use.'))} style={styles.switchModeLink}>Terms of Use</Text>
          <Text accessibilityRole="link" onPress={() => Linking.openURL(AppConfig.privacyUrl).catch(() => Toast.error('Unable to open Privacy Policy.'))} style={styles.switchModeLink}>Privacy Policy</Text>
        </View>
        <View style={styles.switchModeWrap}>
          <Text style={styles.switchModeText}>
            {mode === 'signin' ? "Don't have an account? " : 'Already registered? '}
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setOtpCode(''); setSignupOtp(''); setCountryPicker(false);
              setOtpSent(false);
              setSignupOtpSent(false);
            }}
          >
            <Text style={styles.switchModeLink}>
              {mode === 'signin' ? 'Register' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <DobCalendarModal
        visible={showDobPicker}
        initialDate={signupDob}
        onClose={() => setShowDobPicker(false)}
        onSelectDate={(selectedDate) => setSignupDob(selectedDate)}
        minAge={18}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  intro: { marginBottom: 20 },
  eyebrow: { color: AppTheme.primaryLight, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  heading: { color: AppTheme.textPrimary, fontSize: 28, fontWeight: '800', marginBottom: 8 },
  description: { color: AppTheme.textSecondary, fontSize: 14, lineHeight: 21 },
  countrySelector: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, backgroundColor: AppTheme.surface, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: AppTheme.border },
  countryOption: { padding: 14, backgroundColor: AppTheme.surfaceElevated },
  editDetails: { paddingVertical: 16, alignItems: 'center' },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 20 },
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
    marginBottom: 20,
  },
  logo: {
    width: 68,
    height: 68,
    marginBottom: 8,
  },
  appTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  subHeading: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  modeContainer: {
    flexDirection: 'row',
    backgroundColor: AppTheme.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  modeButtonActive: {
    backgroundColor: AppTheme.surfaceElevated,
  },
  modeButtonText: {
    color: AppTheme.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  formContainer: {
    backgroundColor: AppTheme.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
  dobAgeBadge: {
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderWidth: 1,
    borderColor: '#00E676',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  dobAgeBadgeText: {
    color: '#00E676',
    fontSize: 11,
    fontWeight: '800',
  },
  professionOptionsList: {
    backgroundColor: AppTheme.background,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  professionOptionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  professionOptionActive: {
    backgroundColor: AppTheme.tagBg,
  },
  professionOptionText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  professionOptionTextActive: {
    color: AppTheme.primary,
    fontWeight: '800',
  },
  otpHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resendText: {
    color: AppTheme.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  loginButton: {
    marginTop: 18,
    backgroundColor: AppTheme.primary,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loginBtnText: {
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
  switchModeWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  switchModeText: {
    color: '#64748B',
    fontSize: 13,
  },
  switchModeLink: {
    color: AppTheme.primary,
    fontSize: 13,
    fontWeight: '800',
  },
});

export default LoginScreen;
