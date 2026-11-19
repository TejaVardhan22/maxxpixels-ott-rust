'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { initApiFromEnv } from '@/lib/api-init';
import { AnalyticsProvider } from './AnalyticsProvider';
import { OneSignalProvider } from './OneSignalProvider';

import { ScreenSecurityGuard } from '@/components/security/ScreenSecurityGuard';

initApiFromEnv();

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          retry: (failureCount, error) => {
            const status = (error as { status?: number })?.status;
            if (status === 429 || status === 401 || status === 403) {
              return false;
            }
            return failureCount < 2;
          },
          staleTime: 60_000,
          refetchOnWindowFocus: false,
        },
      },
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AnalyticsProvider>
        <OneSignalProvider />
        <ScreenSecurityGuard>
          {children}
        </ScreenSecurityGuard>
      </AnalyticsProvider>
    </QueryClientProvider>
  );
}
