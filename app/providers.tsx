'use client';

// CocoaTrack V2 - App Providers
// Wraps the app with all necessary providers

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { AuthProvider } from '@/lib/auth';
import { ServiceWorkerProvider } from '@/components/pwa';
import type { Profile } from '@/types/database.gen';

interface ProvidersProps {
  children: React.ReactNode;
  initialProfile?: Profile | null;
}

export function Providers({ children, initialProfile }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Favor cached data immediately when the connection is unstable.
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 30 * 60 * 1000, // 30 minutes
            refetchOnWindowFocus: false,
            refetchOnMount: false,
            refetchOnReconnect: true,
            networkMode: 'offlineFirst',
            retry: 2,
            retryDelay: (attemptIndex) =>
              Math.min(1_000 * 2 ** attemptIndex, 10_000),
          },
          mutations: {
            // Do not retry writes automatically: it could create duplicates.
            networkMode: 'offlineFirst',
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider initialProfile={initialProfile}>
        <ServiceWorkerProvider>{children}</ServiceWorkerProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
