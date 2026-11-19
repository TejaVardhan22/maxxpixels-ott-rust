import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User } from '../types';
import { AuthService } from '../services/authService';
import { setupPushNotifications } from '../services/pushNotificationService';

interface AuthContextType {
  user: User | null;
  authToken: string | null;
  isLoggedIn: boolean;
  isLoadingSession: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<User>;
  loginWithFirebaseToken: (params: { idToken: string; phoneNumber?: string; email?: string; fullName?: string }) => Promise<User>;
  loginWithDemoUser: () => Promise<User>;
  register: (params: {
    fullName: string;
    email: string;
    mobileNumber: string;
    password: string;
    dob?: string;
    pincode?: string;
    profession?: string;
    emailOtpToken?: string;
    adultConfirmed?: number;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<User | null>;
  updateProfile: (params: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    dateOfBirth?: string;
    dob?: string;
    profession?: string;
    pincode?: string;
    image?: string;
    imageBase64?: string;
    imageFile?: {
      uri: string;
      name?: string;
      type?: string;
    };
  }) => Promise<User | void>;
  setSubscribedPlan: (planName: string, expiryDate?: string) => Promise<void>;
  syncSubscription: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  authToken: null,
  isLoggedIn: false,
  isLoadingSession: true,
  loginWithEmail: async () => ({ id: 0, name: '' } as any),
  loginWithFirebaseToken: async () => ({ id: 0, name: '' } as any),
  loginWithDemoUser: async () => ({ id: 0, name: '' } as any),
  register: async () => ({ id: 0, name: '' } as any),
  logout: async () => {},
  refreshProfile: async () => null,
  updateProfile: async () => {},
  setSubscribedPlan: async () => {},
  syncSubscription: async () => false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(AuthService.user);
  const [authToken, setAuthToken] = useState<string | null>(AuthService.authToken);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(AuthService.isLoadingSession);

  useEffect(() => {
    const unsubscribe = AuthService.subscribe(() => {
      setUser(AuthService.user);
      setAuthToken(AuthService.authToken);
      setIsLoadingSession(AuthService.isLoadingSession);
    });

    AuthService.init();

    // Prompt user for push notification permission on app startup
    setupPushNotifications().catch(() => {});

    return unsubscribe;
  }, []);

  const loginWithEmail = useCallback((email: string, pass: string) => AuthService.loginWithEmail(email, pass), []);
  const loginWithFirebaseToken = useCallback((params: any) => AuthService.loginWithFirebaseToken(params), []);
  const loginWithDemoUser = useCallback(() => AuthService.loginWithDemoUser(), []);
  const register = useCallback((params: any) => AuthService.register(params), []);
  const logout = useCallback(() => AuthService.logout(), []);
  const refreshProfile = useCallback(() => AuthService.refreshProfile(), []);
  const updateProfile = useCallback((params: any) => AuthService.updateProfile(params), []);
  const setSubscribedPlan = useCallback((plan: string, expiry?: string) => AuthService.setSubscribedPlan(plan, expiry), []);
  const syncSubscription = useCallback(() => AuthService.syncSubscription(), []);

  const value = useMemo(
    () => ({
      user,
      authToken,
      isLoggedIn: !!(authToken && user),
      isLoadingSession,
      loginWithEmail,
      loginWithFirebaseToken,
      loginWithDemoUser,
      register,
      logout,
      refreshProfile,
      updateProfile,
      setSubscribedPlan,
      syncSubscription,
    }),
    [
      user,
      authToken,
      isLoadingSession,
      loginWithEmail,
      loginWithFirebaseToken,
      loginWithDemoUser,
      register,
      logout,
      refreshProfile,
      updateProfile,
      setSubscribedPlan,
      syncSubscription,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
