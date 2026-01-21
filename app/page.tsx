'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Check if we have auth tokens in the URL hash (from Supabase email links)
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      
      // If we have an access token, redirect to auth callback
      if (accessToken) {
        router.push(`/auth/callback${window.location.hash}`);
      }
    }
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-gray-900">CocoaTrack V2</h1>
        <p className="mb-8 text-lg text-gray-600">
          Application de suivi des achats de cacao - Version 2
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          Se connecter
        </Link>
      </div>
    </main>
  );
}
