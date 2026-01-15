// CocoaTrack V2 - PWA Install Prompt Components
// Platform-specific install prompts for PWA installation
// Requirements: REQ-PWA-001, REQ-PWA-003, REQ-PWA-006

'use client';

import { useState, useEffect, useCallback } from 'react';

import { getInstallManager, type Platform } from '@/lib/pwa/install-manager';

// ============================================================================
// TYPES
// ============================================================================

interface InstallPromptProps {
  /** Callback when prompt is dismissed */
  onDismiss?: () => void;
  /** Callback when install is triggered */
  onInstall?: () => void;
}

// ============================================================================
// DESKTOP BANNER COMPONENT
// ============================================================================

/**
 * Desktop install banner - displays in header area
 * REQ-PWA-006: Desktop prompt in header
 */
export function DesktopInstallBanner({ onDismiss, onInstall }: InstallPromptProps) {
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstall = useCallback(async () => {
    setIsInstalling(true);
    try {
      const manager = getInstallManager();
      const success = await manager.triggerInstallPrompt();
      if (success) {
        onInstall?.();
      }
    } catch (error) {
      console.error('[InstallPrompt] Install failed:', error);
    } finally {
      setIsInstalling(false);
    }
  }, [onInstall]);

  const handleDismiss = useCallback(() => {
    const manager = getInstallManager();
    manager.dismissPrompt(7); // Dismiss for 7 days
    onDismiss?.();
  }, [onDismiss]);

  return (
    <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              Installez CocoaTrack pour un accès rapide
            </p>
            <p className="text-xs text-amber-100">
              Accédez à l&apos;application même hors ligne
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleDismiss}
            className="rounded px-3 py-1.5 text-sm text-amber-100 hover:bg-white/10"
          >
            Plus tard
          </button>
          <button
            onClick={handleInstall}
            disabled={isInstalling}
            className="rounded bg-white px-4 py-1.5 text-sm font-medium text-amber-600 hover:bg-amber-50 disabled:opacity-50"
          >
            {isInstalling ? 'Installation...' : 'Installer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MOBILE BOTTOM SHEET COMPONENT
// ============================================================================

/**
 * Mobile install bottom sheet - displays at bottom of screen
 * REQ-PWA-006: Mobile prompt as bottom sheet
 */
export function MobileInstallBottomSheet({ onDismiss, onInstall }: InstallPromptProps) {
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstall = useCallback(async () => {
    setIsInstalling(true);
    try {
      const manager = getInstallManager();
      const success = await manager.triggerInstallPrompt();
      if (success) {
        onInstall?.();
      }
    } catch (error) {
      console.error('[InstallPrompt] Install failed:', error);
    } finally {
      setIsInstalling(false);
    }
  }, [onInstall]);

  const handleDismiss = useCallback(() => {
    const manager = getInstallManager();
    manager.dismissPrompt(7); // Dismiss for 7 days
    onDismiss?.();
  }, [onDismiss]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up">
      <div className="mx-4 mb-4 rounded-2xl bg-white p-5 shadow-2xl">
        {/* Handle bar */}
        <div className="mb-4 flex justify-center">
          <div className="h-1 w-12 rounded-full bg-gray-300" />
        </div>

        {/* Content */}
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100">
            <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Installer CocoaTrack
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Ajoutez l&apos;application à votre écran d&apos;accueil pour un accès rapide, 
              même sans connexion internet.
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-2">
            <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs text-gray-700">Accès hors ligne</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-2">
            <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs text-gray-700">Notifications</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-2">
            <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs text-gray-700">Lancement rapide</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-2">
            <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs text-gray-700">Plein écran</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex gap-3">
          <button
            onClick={handleDismiss}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Plus tard
          </button>
          <button
            onClick={handleInstall}
            disabled={isInstalling}
            className="flex-1 rounded-xl bg-amber-600 px-4 py-3 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isInstalling ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Installation...
              </span>
            ) : (
              'Installer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// IOS INSTRUCTIONS MODAL COMPONENT
// ============================================================================

/**
 * iOS-specific install instructions modal
 * REQ-PWA-003: Install Instructions iOS with screenshots/icons
 */
export function IOSInstallInstructions({ onDismiss }: { onDismiss?: () => void }) {
  const handleDismiss = useCallback(() => {
    const manager = getInstallManager();
    manager.dismissPrompt(7); // Dismiss for 7 days
    onDismiss?.();
  }, [onDismiss]);

  const handleDismissPermanently = useCallback(() => {
    const manager = getInstallManager();
    manager.dismissPrompt(365); // Dismiss for 1 year
    onDismiss?.();
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Installer CocoaTrack
          </h2>
          <button
            onClick={handleDismiss}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Fermer"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Instructions */}
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 font-semibold">
              1
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">
                Appuyez sur le bouton Partager
              </p>
              <p className="mt-1 text-sm text-gray-600">
                En bas de l&apos;écran Safari, appuyez sur l&apos;icône de partage
              </p>
              <div className="mt-2 flex items-center justify-center rounded-lg bg-gray-100 p-3">
                {/* Share icon representation */}
                <svg className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 font-semibold">
              2
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">
                Sélectionnez &quot;Sur l&apos;écran d&apos;accueil&quot;
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Faites défiler et appuyez sur cette option
              </p>
              <div className="mt-2 flex items-center gap-3 rounded-lg bg-gray-100 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-200">
                  <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-sm text-gray-700">Sur l&apos;écran d&apos;accueil</span>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 font-semibold">
              3
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">
                Confirmez l&apos;ajout
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Appuyez sur &quot;Ajouter&quot; en haut à droite
              </p>
              <div className="mt-2 flex items-center justify-end rounded-lg bg-gray-100 p-3">
                <span className="text-sm font-medium text-blue-500">Ajouter</span>
              </div>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="mt-6 rounded-lg bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            Avantages de l&apos;installation :
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-700">
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Accès rapide depuis l&apos;écran d&apos;accueil
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Consultation des données hors ligne
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Expérience plein écran
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={handleDismiss}
            className="w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-medium text-white hover:bg-amber-700"
          >
            J&apos;ai compris
          </button>
          <button
            onClick={handleDismissPermanently}
            className="w-full rounded-xl px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Ne plus afficher
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SMART INSTALL PROMPT COMPONENT
// ============================================================================

/**
 * Smart install prompt that shows the appropriate UI based on platform
 * REQ-PWA-006: Platform-specific prompts
 */
export function SmartInstallPrompt({ onDismiss, onInstall }: InstallPromptProps) {
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [shouldShow, setShouldShow] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    const manager = getInstallManager();
    manager.initialize();

    const state = manager.getState();
    setPlatform(state.platform);

    // Check if we should show the prompt
    if (manager.shouldShowPrompt()) {
      setShouldShow(true);
    } else if (manager.shouldShowIOSInstructions()) {
      setShowIOSInstructions(true);
    }

    return () => {
      manager.destroy();
    };
  }, []);

  const handleDismiss = useCallback(() => {
    setShouldShow(false);
    setShowIOSInstructions(false);
    onDismiss?.();
  }, [onDismiss]);

  const handleInstall = useCallback(() => {
    setShouldShow(false);
    onInstall?.();
  }, [onInstall]);

  // iOS instructions modal
  if (showIOSInstructions) {
    return <IOSInstallInstructions onDismiss={handleDismiss} />;
  }

  // Don't show anything if conditions not met
  if (!shouldShow) {
    return null;
  }

  // Desktop banner
  if (platform === 'desktop') {
    return <DesktopInstallBanner onDismiss={handleDismiss} onInstall={handleInstall} />;
  }

  // Mobile bottom sheet (Android and unknown)
  return <MobileInstallBottomSheet onDismiss={handleDismiss} onInstall={handleInstall} />;
}

// ============================================================================
// HOOK FOR INSTALL PROMPT
// ============================================================================

/**
 * Hook to manage install prompt state
 */
export function useInstallPrompt() {
  const [shouldShowPrompt, setShouldShowPrompt] = useState(false);
  const [shouldShowIOSInstructions, setShouldShowIOSInstructions] = useState(false);
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const manager = getInstallManager();
    manager.initialize();

    const updateState = () => {
      const state = manager.getState();
      setPlatform(state.platform);
      setIsInstalled(state.is_installed);
      setShouldShowPrompt(manager.shouldShowPrompt());
      setShouldShowIOSInstructions(manager.shouldShowIOSInstructions());
    };

    updateState();

    // Listen for install events
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShouldShowPrompt(false);
      setShouldShowIOSInstructions(false);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
      manager.destroy();
    };
  }, []);

  const dismissPrompt = useCallback((days: number = 7) => {
    const manager = getInstallManager();
    manager.dismissPrompt(days);
    setShouldShowPrompt(false);
    setShouldShowIOSInstructions(false);
  }, []);

  const triggerInstall = useCallback(async () => {
    const manager = getInstallManager();
    return manager.triggerInstallPrompt();
  }, []);

  return {
    shouldShowPrompt,
    shouldShowIOSInstructions,
    platform,
    isInstalled,
    dismissPrompt,
    triggerInstall,
  };
}
