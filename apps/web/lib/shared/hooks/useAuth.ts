'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/services';
import { queryKeys } from '../queryKeys';

export function useFirebasePhoneLogin() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => authApi.firebasePhoneLogin(body),
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => authApi.login(body),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => authApi.register(body),
  });
}

export function useRegistrationOtp() {
  return useMutation({
    mutationFn: (
      input: string | { phone: string; agentCode?: string; recaptchaToken?: string | null },
    ) => {
      const phone = typeof input === 'string' ? input : input.phone;
      const agentCode = typeof input === 'string' ? undefined : input.agentCode;
      const recaptchaToken = typeof input === 'string' ? undefined : input.recaptchaToken;
      return authApi.requestRegistrationOtp(phone, agentCode, recaptchaToken);
    },
  });
}

export function usePhoneLoginOtpRequest() {
  return useMutation({
    mutationFn: (input: string | { phone: string; recaptchaToken?: string | null }) => {
      const phone = typeof input === 'string' ? input : input.phone;
      const recaptchaToken = typeof input === 'string' ? undefined : input.recaptchaToken;
      return authApi.requestPhoneLoginOtp(phone, recaptchaToken);
    },
  });
}

export function usePhoneOtpLogin() {
  return useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) => authApi.phoneOtpLogin(phone, code),
  });
}

export function useProfile(userId?: number | string) {
  return useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: () => authApi.getProfile({ user_id: userId }),
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown> | FormData) => authApi.updateProfile(body),
    onSuccess: (_d, vars) => {
      const formDataUserId = vars instanceof FormData ? vars.get('user_id') : undefined;
      const userId = vars instanceof FormData
        ? typeof formDataUserId === 'string' ? formDataUserId : undefined
        : typeof vars.user_id === 'string' || typeof vars.user_id === 'number'
          ? vars.user_id
          : undefined;
      qc.invalidateQueries({ queryKey: queryKeys.profile(userId) });
    },
  });
}

export function useTvLoginCode() {
  return useMutation({ mutationFn: () => authApi.getTvLoginCode() });
}

export function useTvLogin() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => authApi.tvLogin(body),
  });
}

export function useCheckTvLogin() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => authApi.checkTvLogin(body),
  });
}

export function useDeviceSyncList(userId?: number | string) {
  return useQuery({
    queryKey: queryKeys.deviceSync(userId),
    queryFn: () => authApi.getDeviceSyncList({ user_id: userId }),
    enabled: !!userId,
  });
}

export function useParentControlCheck() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => authApi.parentControlCheckPassword(body),
  });
}

export function useKidsMode() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => authApi.addRemoveKidsMode(body),
  });
}

export function useSendEmailOtp() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => authApi.sendEmailOtp(body),
  });
}

export function useVerifyEmailOtp() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => authApi.verifyEmailOtp(body),
  });
}
