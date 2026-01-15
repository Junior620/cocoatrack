// CocoaTrack V2 - Post-Install Welcome Screen
// Displays after PWA installation with feature highlights and data download options
// Requirements: REQ-PWA-004

'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface PostInstallWelcomeProps {
  /** Callback when welcome screen is dismissed */
  onComplete?: () => void;
  /** Callback when user starts data download */
  onStartDownload?: (wifiOnly: boolean) => void;
  /** Estimated size of Tier_1 data in MB */
  estimatedSizeMB?: number;
}

interface FeatureHighlight {
  icon: React.ReactNode;
  title: string;
  description: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'pwa_welcome_shown';
const DEFAULT_ESTIMATED_SIZE_MB = 15;

const FEATURE_HIGHLIGHTS: FeatureHighlight[] = [
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
      </svg>
    ),
    title: 'Mode hors ligne',
    description: 'Consultez et créez des livraisons même sans connexion internet.',
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    title: 'Synchronisation automatique',
    description: 'Vos données sont synchronisées automatiquement dès que vous êtes connecté.',
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    title: 'Notifications',
    description: 'Recevez des alertes pour les nouvelles livraisons et rappels importants.',
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Accès rapide',
    description: 'Lancez l\'application directement depuis votre écran d\'accueil.',
  },
];

// ============================================================================
// POST-INSTALL WELCOME COMPONENT
// ============================================================================

/**
 * Post-install welcome screen with feature highlights and data download prompt
 * REQ-PWA-004: Post-Install Welcome
 */
export function PostInstallWelcome({
  onComplete,
  onStartDownload,
  estimatedSizeMB = DEFAULT_ESTIMATED_SIZE_MB,
}: PostInstallWelcomeProps) {
  const [step, setStep] = useState<'features' | 'download'>('features');
  const [wifiOnly, setWifiOnly] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleContinue = useCallback(() => {
    setStep('download');
  }, []);

  const handleSkip = useCallback(() => {
    // Mark welcome as shown
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    onComplete?.();
  }, [onComplete]);

  const handleStartDownload = useCallback(async () => {
    setIsDownloading(true);
    
    // Simulate download progress (in real implementation, this would track actual progress)
    const progressInterval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 500);

    try {
      onStartDownload?.(wifiOnly);
      
      // Wait for simulated download to complete
      await new Promise((resolve) => setTimeout(resolve, 5500));
      
      // Mark welcome as shown
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, 'true');
      }
      
      onComplete?.();
    } catch (error) {
      console.error('[PostInstallWelcome] Download failed:', error);
      clearInterval(progressInterval);
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }, [wifiOnly, onStartDownload, onComplete]);

  // Features step
  if (step === 'features') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600 p-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-lg">
              <svg className="h-12 w-12 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">
              Bienvenue sur CocoaTrack !
            </h1>
            <p className="mt-2 text-amber-100">
              L&apos;application est maintenant installée sur votre appareil.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="space-y-3">
            {FEATURE_HIGHLIGHTS.map((feature, index) => (
              <div
                key={index}
                className="flex items-start gap-4 rounded-xl bg-white/10 p-4 backdrop-blur-sm"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{feature.title}</h3>
                  <p className="mt-0.5 text-sm text-amber-100">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-8">
            <button
              onClick={handleContinue}
              className="w-full rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-amber-600 shadow-lg hover:bg-amber-50"
            >
              Continuer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Download step
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            Télécharger les données
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Pour utiliser l&apos;application hors ligne, téléchargez les données essentielles maintenant.
          </p>
        </div>

        {/* Download info */}
        <div className="mb-6 rounded-lg bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Taille estimée</span>
            <span className="font-semibold text-gray-900">~{estimatedSizeMB} Mo</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-gray-600">Données incluses</span>
            <span className="text-sm text-gray-700">Planteurs, Entrepôts, Livraisons récentes</span>
          </div>
        </div>

        {/* Wi-Fi only option */}
        <label className="mb-6 flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
            <div>
              <span className="font-medium text-gray-900">Wi-Fi uniquement</span>
              <p className="text-xs text-gray-500">Économisez vos données mobiles</p>
            </div>
          </div>
          <div className="relative">
            <input
              type="checkbox"
              checked={wifiOnly}
              onChange={(e) => setWifiOnly(e.target.checked)}
              className="sr-only"
            />
            <div className={`h-6 w-11 rounded-full transition-colors ${wifiOnly ? 'bg-amber-600' : 'bg-gray-300'}`}>
              <div className={`h-5 w-5 transform rounded-full bg-white shadow transition-transform ${wifiOnly ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5`} />
            </div>
          </div>
        </label>

        {/* Progress bar (when downloading) */}
        {isDownloading && (
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-gray-600">Téléchargement en cours...</span>
              <span className="font-medium text-amber-600">{downloadProgress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-amber-600 transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleStartDownload}
            disabled={isDownloading}
            className="w-full rounded-xl bg-amber-600 px-6 py-3 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isDownloading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Téléchargement...
              </span>
            ) : (
              'Télécharger maintenant'
            )}
          </button>
          <button
            onClick={handleSkip}
            disabled={isDownloading}
            className="w-full rounded-xl px-6 py-3 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            Plus tard
          </button>
        </div>

        {/* Note */}
        <p className="mt-4 text-center text-xs text-gray-400">
          Vous pourrez télécharger les données plus tard depuis les paramètres.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// HOOK FOR POST-INSTALL WELCOME
// ============================================================================

/**
 * Hook to manage post-install welcome screen state
 */
export function usePostInstallWelcome() {
  const [shouldShowWelcome, setShouldShowWelcome] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if this is a fresh install (standalone mode + welcome not shown)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;
    
    const welcomeShown = localStorage.getItem(STORAGE_KEY) === 'true';

    if (isStandalone && !welcomeShown) {
      setShouldShowWelcome(true);
    }
  }, []);

  const dismissWelcome = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    setShouldShowWelcome(false);
  }, []);

  const resetWelcome = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    setShouldShowWelcome(true);
  }, []);

  return {
    shouldShowWelcome,
    dismissWelcome,
    resetWelcome,
  };
}
