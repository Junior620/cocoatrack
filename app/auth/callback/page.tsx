'use client';

// CocoaTrack V2 - Auth Callback Page (Client-side)
// Handles hash-based auth callbacks (implicit flow)

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const hasRun = useRef(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    // Prevent multiple executions using ref
    if (hasRun.current) return;
    hasRun.current = true;

    const handleCallback = async () => {
      try {
        const supabase = createClient();
        
        // Get hash parameters (for access_token, refresh_token)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        // Get query parameters (for type, code, etc.)
        const searchParams = new URLSearchParams(window.location.search);
        const type = searchParams.get('type') || hashParams.get('type');
        const code = searchParams.get('code');

        // Debug logging
        const debug = {
          url: window.location.href,
          hash: window.location.hash,
          search: window.location.search,
          type,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          hasCode: !!code,
        };
        console.log('Auth callback debug:', debug);
        setDebugInfo(JSON.stringify(debug, null, 2));

        // If we have a code (PKCE flow), exchange it for a session
        if (code) {
          console.log('Using PKCE flow with code');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('Code exchange error:', error);
            window.location.href = '/login?error=' + encodeURIComponent(error.message);
            return;
          }

          console.log('Code exchanged successfully:', data.session ? 'Session exists' : 'No session');

          // Wait a bit for cookies to be set
          await new Promise(resolve => setTimeout(resolve, 500));

          // Redirect based on type using router for client-side navigation
          if (type === 'recovery') {
            console.log('Redirecting to reset-password (PKCE)');
            router.replace('/reset-password');
          } else {
            console.log('Redirecting to dashboard (PKCE)');
            router.replace('/dashboard');
          }
          return;
        }

        // If we have tokens (implicit flow), set the session
        if (accessToken && refreshToken) {
          console.log('Using implicit flow with tokens');
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('Session set error:', error);
            window.location.href = '/login?error=' + encodeURIComponent(error.message);
            return;
          }

          console.log('Session set successfully:', data.session ? 'Session exists' : 'No session');

          // Wait a bit for cookies to be set
          await new Promise(resolve => setTimeout(resolve, 500));

          // Redirect based on type using router for client-side navigation
          if (type === 'recovery') {
            console.log('Redirecting to reset-password (implicit)');
            router.replace('/reset-password');
          } else {
            console.log('Redirecting to dashboard (implicit)');
            router.replace('/dashboard');
          }
          return;
        }

        // No auth data found, redirect to login
        console.log('No auth data found, redirecting to login');
        window.location.href = '/login';
      } catch (error) {
        console.error('Callback error:', error);
        setDebugInfo('Error: ' + (error instanceof Error ? error.message : String(error)));
        window.location.href = '/login?error=' + encodeURIComponent('callback_error');
      }
    };

    // Small delay to ensure DOM is ready
    setTimeout(handleCallback, 100);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#234D1E] to-[#1a3a16] p-4">
      <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md w-full">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#234D1E] border-t-transparent mx-auto mb-4" />
        <p className="text-gray-700 font-medium text-center mb-4">Redirection en cours...</p>
        {debugInfo && (
          <pre className="text-xs text-gray-500 overflow-auto max-h-40 bg-gray-50 p-2 rounded">
            {debugInfo}
          </pre>
        )}
      </div>
    </div>
  );
}
