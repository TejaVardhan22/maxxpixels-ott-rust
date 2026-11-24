'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentApi, catalogApi } from '../api/services';
import { queryKeys } from '../queryKeys';

export function usePackages(userId?: number | string) {
  return useQuery({
    queryKey: queryKeys.packages(userId),
    queryFn: () => paymentApi.getPackage({ user_id: userId ?? 0 }),
    staleTime: 5 * 60_000,
  });
}

export function useApplyCoupon() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => paymentApi.applyCoupon(body),
  });
}

/**
 * Validates a coupon code against the new Spring Boot /api/v1/coupons/validate endpoint.
 * Returns the discount amount in INR (BigDecimal from the backend).
 */
export function useValidateCouponV1() {
  return useMutation({
    mutationFn: ({ code, amount, planId }: { code: string; amount: number; planId?: number | string }) =>
      paymentApi.validateCouponV1(code, amount, planId),
  });
}

export function useCreateRazorpayOrder() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => paymentApi.createRazorpayOrder(body),
  });
}

export function useAddTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => paymentApi.addTransaction(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['subscription'] });
      qc.invalidateQueries({ queryKey: queryKeys.rentContent });
      qc.invalidateQueries({ queryKey: ['userRentContent'] });
    },
  });
}

export function useAddRentTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => paymentApi.addRentTransaction(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rentContent });
      qc.invalidateQueries({ queryKey: ['userRentContent'] });
    },
  });
}

export function useVerifyRazorpayPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => paymentApi.verifyRazorpayPayment(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useTransactions(userId?: number | string) {
  return useQuery({
    queryKey: queryKeys.transactions(userId),
    queryFn: () => paymentApi.getTransactionList({ user_id: userId }),
    enabled: !!userId,
  });
}

export function useCoupons() {
  return useQuery({
    queryKey: queryKeys.coupons,
    queryFn: () => catalogApi.getCouponList({}),
  });
}

export function useReferEarnHistory(userId?: number | string) {
  return useQuery({
    queryKey: queryKeys.referEarn(userId),
    queryFn: () => catalogApi.getReferEarnHistory({ user_id: userId }),
    enabled: !!userId,
  });
}
