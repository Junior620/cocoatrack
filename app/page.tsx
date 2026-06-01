'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import HeroVideo from '@/components/HeroVideo';

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
    <main className="relative h-screen w-full overflow-hidden bg-gray-900">
      {/* Video Background */}
      <HeroVideo />

      {/* Overlay gradient pour améliorer la lisibilité */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/60" />

      {/* Navigation Header */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center space-x-3">
          <img src="/logo-scpb.png" alt="CocoaTrack" className="h-12 w-auto" />
          <span className="text-2xl font-bold text-white">CocoaTrack</span>
        </div>
        <Link
          href="/login"
          className="rounded-full bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-orange-700 hover:shadow-lg"
        >
          Se connecter
        </Link>
      </nav>

      {/* Hero Content */}
      <div className="relative z-10 flex h-[calc(100vh-88px)] flex-col items-start justify-center px-8 md:px-16 lg:px-24">
        <div className="max-w-4xl">
          <h1 className="mb-6 text-5xl font-bold leading-tight text-white md:text-6xl lg:text-7xl">
            Traçabilité du Cacao
            <br />
            <span className="text-orange-500">Simplifiée.</span>
          </h1>
          <p className="mb-8 max-w-2xl text-lg leading-relaxed text-gray-100 md:text-xl">
            CocoaTrack digitalise la chaîne d'approvisionnement du cacao au Cameroun. 
            Suivez vos achats, gérez vos planteurs et parcelles, et assurez la traçabilité 
            complète de la fève à l'exportation avec notre plateforme innovante.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-8 py-4 text-base font-semibold text-white transition-all hover:bg-orange-700 hover:shadow-xl"
            >
              Commencer maintenant
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
