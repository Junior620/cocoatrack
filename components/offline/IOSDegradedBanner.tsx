// CocoaTrack V2 - iOS Degraded Mode Banner
// Explains iOS offline limitations and recommends manual sync
// Requirements: REQ-IOS-001

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AlertTriangle, X, RefreshCw, Info } from 'lucide-react';

import {
  detectIOS,
  shouldShowIOSDegradedBanner,
  dismissBannerPermanently,
  type IOSDetectionResult,
} from '@/lib/pwa/ios-manager';

// ============================================================================
// TYPES
// ============================================================================

export interface IOSDegradedBannerProps {
  /** Additional CSS classes */
  className?: string;
  /** Callback when sync button is clicked */
  onSyncClick?: () => void;
  /** Whether to show as inline banner (not fixed) */
  inline?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * iOS Degraded Mode Banner
 * 
 * Displays a discreet banner explaining iOS offline limitations:
 * - Background Sync is not available on iOS Safari
 * - Recommends manual synchronization
 * - Can be permanently dismissed
 * 
 * REQ-IOS-001: iOS Degraded Mode Banner
 */
export function IOSDegradedBanner({
  className = '',
  onSyncClick,
  inline = false,
}: IOSDegradedBannerProps) {
  const [shouldShow, setShouldShow] = useState(false);
  const [iosInfo, setIOSInfo] = useState<IOSDetectionResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Check if banner should be shown on mount
  useEffect(() => {
    const detection = detectIOS();
    setIOSInfo(detection);
    setShouldShow(shouldShowIOSDegradedBanner());
  }, []);

  // Handle permanent dismiss
  const handleDismiss = useCallback(() => {
    dismissBannerPermanently();
    setShouldShow(false);
  }, []);

  // Toggle details
  const toggleDetails = useCallback(() => {
    setShowDetails(prev => !prev);
  }, []);

  // Don't render if not on iOS or already dismissed
  if (!shouldShow) {
    return null;
  }

  const bannerContent = (
    <>
      {/* Main message */}
      <div className="flex items-start gap-3">
        <span className="text-amber-500 flex-shrink-0 mt-0.5">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800">
            Mode hors ligne limité sur iOS
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            La synchronisation automatique en arrière-plan n&apos;est pas disponible.
            {' '}
            <button
              onClick={toggleDetails}
              className="underline hover:no-underline inline-flex items-center gap-1"
            >
              {showDetails ? 'Masquer' : 'En savoir plus'}
              <Info className="h-3 w-3" />
            </button>
          </p>
          
          {/* Expandable details */}
          {showDetails && (
            <div className="mt-2 p-2 bg-amber-100 rounded text-xs text-amber-800 space-y-1">
              <p>
                <strong>Limitations iOS Safari :</strong>
              </p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>Pas de synchronisation automatique en arrière-plan</li>
                <li>Les données peuvent être supprimées après 7 jours d&apos;inactivité</li>
                <li>Synchronisez manuellement avant de fermer l&apos;application</li>
              </ul>
              <p className="mt-2">
                <strong>Recommandations :</strong>
              </p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>Synchronisez régulièrement vos données</li>
                <li>Utilisez l&apos;application au moins une fois par semaine</li>
                <li>Vérifiez vos opérations en attente avant de quitter</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 sm:mt-0 sm:ml-4 flex-shrink-0">
        {/* Sync Button */}
        <Link
          href="/sync"
          onClick={onSyncClick}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Synchroniser
        </Link>

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="rounded-md p-1.5 text-amber-600 hover:bg-amber-100 transition-colors"
          aria-label="Ne plus afficher"
          title="Ne plus afficher ce message"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </>
  );

  // Inline variant
  if (inline) {
    return (
      <div
        className={`rounded-lg border border-amber-200 bg-amber-50 p-4 ${className}`}
        role="alert"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          {bannerContent}
        </div>
      </div>
    );
  }

  // Fixed banner variant
  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 border-t border-amber-200 bg-amber-50 px-4 py-3 shadow-lg ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          {bannerContent}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact iOS indicator for header/status bar
 * Shows a small icon when on iOS with limited offline support
 */
export function IOSIndicator({ className = '' }: { className?: string }) {
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const detection = detectIOS();
    setIsIOS(detection.isIOS);
  }, []);

  if (!isIOS) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs text-amber-600 ${className}`}
      title="Mode hors ligne limité sur iOS"
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">iOS</span>
    </span>
  );
}

export default IOSDegradedBanner;
