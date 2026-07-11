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
            // Keep data fresh enough without refetching on every navigation
            staleTime: 2 * 60 * 1000, // 2 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes
            refetchOnWindowFocus: false,
            refetchOnMount: false,
            refetchOnReconnect: true,
            retry: 1,
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
