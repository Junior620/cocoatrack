/**
 * NDVIBackfillButton Component
 * 
 * Button to trigger historical NDVI data calculation from Google Earth Engine.
 * Populates the ndvi_results table with historical data for temporal analysis.
 * 
 * This component:
 * - Calls /api/satellite/ndvi/backfill endpoint
 * - Calculates NDVI for past N months from Sentinel-2 archives
 * - Shows progress and results
 * - Refreshes temporal data after completion
 */

'use client';

import { useState } from 'react';
import { Database } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface NDVIBackfillButtonProps {
  parcelleId: string;
  onComplete?: () => void;
  className?: string;
}

interface BackfillResult {
  calculated: number;
  skipped: number;
  failed: number;
  monthsRequested: number;
  mode: 'batch' | 'sequential';
}

// ============================================================================
// Component
// ============================================================================

export default function NDVIBackfillButton({
  parcelleId,
  onComplete,
  className = '',
}: NDVIBackfillButtonProps) {
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<BackfillResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleCalculateHistoricalNDVI = async () => {
    setIsCalculating(true);
    setError(null);
    setResult(null);

    try {
      // Calculate NDVI for the last 24 months (2 years of data)
      // This provides enough historical context for temporal analysis
      const response = await fetch('/api/satellite/ndvi/backfill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parcelleId,
          months: 24, // 2 years of historical data
          forceRecalculate: false, // Skip months already in database
          mode: 'batch', // Use fast batch mode
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Échec du calcul NDVI historique');
      }

      const responseData = await response.json();

      if (responseData.success && responseData.data) {
        setResult(responseData.data);
        setShowDetails(true);

        // Call onComplete callback to refresh temporal data
        if (onComplete) {
          onComplete();
        }
      } else {
        throw new Error('Réponse invalide du serveur');
      }
    } catch (err) {
      console.error('Error calculating historical NDVI:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du calcul NDVI historique');
    } finally {
      setIsCalculating(false);
    }
  };

  // Success state - show results
  if (result && showDetails) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-start gap-3">
          <svg
            className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-green-900">
              Calcul NDVI historique terminé
            </h3>
            <div className="mt-2 space-y-1 text-sm text-green-700">
              <p>
                <span className="font-medium">{result.calculated}</span> mois calculés
              </p>
              {result.skipped > 0 && (
                <p>
                  <span className="font-medium">{result.skipped}</span> mois ignorés (déjà en base)
                </p>
              )}
              {result.failed > 0 && (
                <p className="text-orange-700">
                  <span className="font-medium">{result.failed}</span> mois échoués
                </p>
              )}
              <p className="text-xs text-green-600 mt-2">
                Mode: {result.mode === 'batch' ? 'Batch (rapide)' : 'Séquentiel'}
              </p>
            </div>
            <button
              onClick={() => setShowDetails(false)}
              className="mt-3 text-sm font-medium text-green-600 hover:text-green-700 underline"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-start gap-3">
          <svg
            className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-900">Erreur</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-sm font-medium text-red-600 hover:text-red-700 underline"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default state - show button
  return (
    <button
      onClick={handleCalculateHistoricalNDVI}
      disabled={isCalculating}
      className={`inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors ${className}`}
      title="Calculer le NDVI historique depuis les archives Sentinel-2"
    >
      {isCalculating ? (
        <>
          <LoadingSpinner className="h-4 w-4" />
          Calcul en cours...
        </>
      ) : (
        <>
          <Database className="h-4 w-4" />
          Calculer NDVI Historique
        </>
      )}
    </button>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
