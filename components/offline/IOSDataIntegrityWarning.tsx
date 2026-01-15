// CocoaTrack V2 - iOS Data Integrity Warning
// Prompts user to re-download Tier_1 data when iOS has purged it
// Requirements: REQ-IOS-002

'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { AlertCircle, Download, X, RefreshCw, Database } from 'lucide-react';

import type { DetailedIntegrityResult } from '@/lib/pwa/ios-data-integrity';

// ============================================================================
// TYPES
// ============================================================================

export interface IOSDataIntegrityWarningProps {
  /** The integrity check result */
  result: DetailedIntegrityResult;
  /** Callback when user wants to re-download data */
  onRedownload?: () => void;
  /** Callback when warning is dismissed */
  onDismiss?: () => void;
  /** Whether re-download is in progress */
  isDownloading?: boolean;
  /** Download progress (0-100) */
  downloadProgress?: number;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * iOS Data Integrity Warning Modal
 * 
 * Displays when iOS has purged IndexedDB data after inactivity.
 * Prompts user to re-download Tier_1 data.
 * 
 * REQ-IOS-002: Prompt to re-download Tier_1
 */
export function IOSDataIntegrityWarning({
  result,
  onRedownload,
  onDismiss,
  isDownloading = false,
  downloadProgress = 0,
  className = '',
}: IOSDataIntegrityWarningProps) {
  const [showDetails, setShowDetails] = useState(false);

  const toggleDetails = useCallback(() => {
    setShowDetails(prev => !prev);
  }, []);

  // Don't show if data is intact
  if (result.isIntact) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`w-full max-w-md rounded-lg bg-white shadow-xl ${className}`}>
        {/* Header */}
        <div className="flex items-start gap-4 border-b border-gray-100 p-6">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              Données supprimées
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              iOS a supprimé les données locales après une période d&apos;inactivité.
            </p>
          </div>
          {onDismiss && !isDownloading && (
            <button
              onClick={onDismiss}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Stats */}
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {result.planteursCount}
              </div>
              <div className="text-xs text-gray-500">Planteurs</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {result.chefPlanteursCount}
              </div>
              <div className="text-xs text-gray-500">Chefs</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {result.warehousesCount}
              </div>
              <div className="text-xs text-gray-500">Entrepôts</div>
            </div>
          </div>

          {/* Pending operations warning */}
          {result.opsQueueCount > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                <RefreshCw className="h-4 w-4" />
                {result.opsQueueCount} opération(s) en attente
              </div>
              <p className="mt-1 text-xs text-amber-700">
                Vos opérations non synchronisées sont préservées et seront envoyées lors de la prochaine synchronisation.
              </p>
            </div>
          )}

          {/* Details toggle */}
          <button
            onClick={toggleDetails}
            className="mb-4 text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            {showDetails ? 'Masquer les détails' : 'Afficher les détails'}
          </button>

          {/* Expandable details */}
          {showDetails && (
            <div className="mb-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              <div className="space-y-1">
                <p>
                  <strong>Jours d&apos;inactivité:</strong> {result.daysSinceActivity}
                </p>
                <p>
                  <strong>Vérification:</strong>{' '}
                  {new Date(result.checkTimestamp).toLocaleString('fr-FR')}
                </p>
                <p>
                  <strong>Métadonnées sync:</strong> {result.syncMetadataCount}
                </p>
              </div>
              <div className="mt-2 border-t border-gray-200 pt-2">
                <p className="font-medium">Dernières synchronisations:</p>
                {Object.entries(result.lastSyncDates).length > 0 ? (
                  <ul className="mt-1 space-y-0.5">
                    {Object.entries(result.lastSyncDates).map(([table, date]) => (
                      <li key={table}>
                        {table}: {date ? new Date(date).toLocaleDateString('fr-FR') : 'Jamais'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 italic">Aucune synchronisation enregistrée</p>
                )}
              </div>
            </div>
          )}

          {/* Download progress */}
          {isDownloading && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>Téléchargement en cours...</span>
                <span>{downloadProgress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-green-500 transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Message */}
          <p className="text-sm text-gray-600">
            Pour utiliser l&apos;application hors ligne, vous devez re-télécharger les données essentielles.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t border-gray-100 p-6">
          <button
            onClick={onRedownload}
            disabled={isDownloading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isDownloading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Téléchargement...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Télécharger les données
              </>
            )}
          </button>
          
          {!isDownloading && (
            <Link
              href="/sync"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Database className="h-4 w-4" />
              Voir la page de synchronisation
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Inline version of the data integrity warning
 * For embedding in page content
 */
export function IOSDataIntegrityInlineWarning({
  result,
  onRedownload,
  onDismiss,
  isDownloading = false,
  downloadProgress = 0,
  className = '',
}: IOSDataIntegrityWarningProps) {
  // Don't show if data is intact
  if (result.isIntact) {
    return null;
  }

  return (
    <div className={`rounded-lg border border-red-200 bg-red-50 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-red-800">
            Données locales supprimées
          </h4>
          <p className="mt-1 text-xs text-red-700">
            iOS a supprimé les données après {result.daysSinceActivity} jours d&apos;inactivité.
            Re-téléchargez les données pour utiliser l&apos;application hors ligne.
          </p>
          
          {/* Download progress */}
          {isDownloading && (
            <div className="mt-3">
              <div className="h-1.5 w-full rounded-full bg-red-200">
                <div
                  className="h-1.5 rounded-full bg-red-500 transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-red-600">{downloadProgress}%</p>
            </div>
          )}
          
          {/* Actions */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onRedownload}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isDownloading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {isDownloading ? 'Téléchargement...' : 'Télécharger'}
            </button>
            {onDismiss && !isDownloading && (
              <button
                onClick={onDismiss}
                className="text-xs text-red-600 hover:text-red-800 hover:underline"
              >
                Ignorer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default IOSDataIntegrityWarning;
