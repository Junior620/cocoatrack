'use client';

// CocoaTrack V2 - Auth Callback Page (Client-side)
// Handles hash-based auth callbacks (implicit flow)

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient();
      
      // Check if we have hash parameters (implicit flow)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      const errorCode = hashParams.get('error_code');
      const errorDescription = hashParams.get('error_description');

      // Handle errors from Supabase
      if (errorCode) {
        console.error('Auth error:', errorCode, errorDescription);
        
        if (errorCode === 'otp_expired') {
          setError('Le lien a expiré. Veuillez demander un nouveau lien.');
          setTimeout(() => {
            router.push('/forgot-password');
          }, 3000);
          return;
        }
        
        setError(errorDescription || 'Une erreur est survenue');
        setTimeout(() => {
          router.push('/login');
        }, 3000);
        return;
      }

      // If we have tokens, set the session
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          console.error('Session error:', sessionError);
          setError('Erreur lors de la connexion');
          setTimeout(() => {
            router.push('/login');
          }, 3000);
          return;
        }

        // If this is a password recovery, redirect to reset password page
        if (type === 'recovery') {
          router.push('/reset-password');
          return;
        }

        // Normal login, redirect to dashboard
        router.push('/dashboard');
        return;
      }

      // No tokens found, redirect to login
      router.push('/login');
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#234D1E] to-[#1a3a16]">
      <div className="text-center">
        {error ? (
          <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <svg className="h-8 w-8 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Erreur</h2>
            <p className="text-gray-600">{error}</p>
            <p className="text-sm text-gray-500 mt-4">Redirection en cours...</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 shadow-xl">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#234D1E] border-t-transparent mx-auto mb-4" />
            <p className="text-gray-700 font-medium">Vérification en cours...</p>
          </div>
        )}
      </div>
    </div>
  );
}
