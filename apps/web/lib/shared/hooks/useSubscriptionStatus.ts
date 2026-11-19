'use client';

import { useQuery } from '@tanstack/react-query';
import { getUserToken } from '../api/client';
import { videoAccessApi } from '../api/videoAccess';

/** Server-backed subscription; requires User-Token. */
export function useSubscriptionStatus(enabled: boolean = true) {
  const hasUser = typeof getUserToken === 'function' && !!getUserToken();

  return useQuery({
    queryKey: ['subscription', 'status'],
    queryFn: () => videoAccessApi.getSubscriptionStatus(),
    enabled: enabled && hasUser,
    staleTime: 60_000,
  });
}
