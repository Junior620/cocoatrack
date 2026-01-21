'use client';

// CocoaTrack V2 - Auth Callback Page (Client-side)
// Handles hash-based auth callbacks (implicit flow)

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const hasRun = useRef(false);

  useEffect(() => {
    // Prevent multiple executions using ref
    if (hasRun.current) return;
    hasRun.current = true;

    const handleCallback = async () => {
      try {
        const supabase = createClient();
        
        // Get hash parameters
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        if (!accessToken || !refreshToken) {
          // No tokens, redirect to login
          window.location.href = '/login';
          return;
        }

        // Set the session
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        // Redirect based on type
        if (type === 'recovery') {
          window.location.href = '/reset-password';
        } else {
          window.location.href = '/dashboard';
        }
      } catch (error) {
        console.error('Callback error:', error);
        window.location.href = '/login';
      }
    };

    // Small delay to ensure DOM is ready
    setTimeout(handleCallback, 100);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#234D1E] to-[#1a3a16]">
      <div className="bg-white rounded-2xl p-8 shadow-xl">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#234D1E] border-t-transparent mx-auto mb-4" />
        <p className="text-gray-700 font-medium">Redirection en cours...</p>
      </div>
    </div>
  );
}
