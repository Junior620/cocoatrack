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
            // With SSR, we usually want to set some default staleTime
            // above 0 to avoid refetching immediately on the client
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
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
