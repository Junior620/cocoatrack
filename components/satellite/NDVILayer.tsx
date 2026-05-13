'use client';

/**
 * NDVILayer Component
 * 
 * Displays NDVI (Normalized Difference Vegetation Index) visualization as a map overlay.
 * Uses color-coded gradient from red (poor vegetation) to dark green (excellent vegetation).
 * 
 * Features:
 * - Loading state with spinner
 * - Error state with retry button
 * - Color-coded NDVI visualization
 * - Interactive legend with color scale
 * - NDVI statistics display
 * - Health status indicator
 * - Offline mode support with cached data indicator
 */

import { useState, useEffect, useCallback } from 'react';
import type { NDVIResult } from '@/lib/satellite/types';
import { 
  getNDVILegendColors, 
  ndviToHex,
  type NDVIColorRange 
} from '@/lib/satellite/utils/ndvi-colors';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export interface NDVILayerProps {
  /** ID of the parcelle to display NDVI for */
  parcelleId: string;
  /** Optional specific date for NDVI calculation (defaults to most recent) */
  date?: Date;
  /** Whether to show the color legend (defaults to true) */
  showLegend?: boolean;
  /** Callback when NDVI is calculated successfully */
  onNDVICalculated?: (ndvi: NDVIResult) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Whether to force recalculation (bypass cache) */
  forceRecalculate?: boolean;
}

interface NDVILayerState {
  ndvi: NDVIResult | null;
  loading: boolean;
  error: Error | null;
  cached: boolean;
}

export function NDVILayer({
  parcelleId,
  date,
  showLegend = true,
  onNDVICalculated,
  onError,
  forceRecalculate = false,
}: NDVILayerProps) {
  const [state, setState] = useState<NDVILayerState>({
    ndvi: null,
    loading: false,
    error: null,
    cached: false,
  });
  
  // Track online/offline status
  const { isOnline, isOffline } = useOnlineStatus();

  // Fetch and calculate NDVI
  const calculateNDVI = useCallback(async () => {
    // Check if offline - prevent calculation
    if (isOffline) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: new Error('Vous êtes hors ligne. Le calcul NDVI nécessite une connexion internet.') 
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Build request body
      const body: Record<string, unknown> = {
        parcelleId,
        forceRecalculate,
      };

      if (date) {
        body.date = date.toISOString();
      }

      // Call NDVI API endpoint
      const response = await fetch('/api/satellite/ndvi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to calculate NDVI: ${response.statusText}`
        );
      }

      const data = await response.json();
      const ndvi: NDVIResult = {
        ...data.data.ndvi,
        calculationDate: new Date(data.data.ndvi.calculationDate),
        createdAt: new Date(data.data.ndvi.createdAt),
      };
      
      const cached = data.data.cached || false;

      setState({ ndvi, loading: false, error: null, cached });

      // Notify parent component
      if (onNDVICalculated) {
        onNDVICalculated(ndvi);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      
      // Check if it's a network error (offline)
      if (error instanceof TypeError && err.message.includes('fetch')) {
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: new Error('Impossible de se connecter au serveur. Vérifiez votre connexion internet.') 
        }));
      } else {
        setState(prev => ({ ...prev, loading: false, error: err }));
      }

      // Notify parent component
      if (onError) {
        onError(err);
      }
    }
  }, [parcelleId, date, forceRecalculate, onNDVICalculated, onError, isOffline]);

  // Calculate NDVI on mount and when dependencies change
  useEffect(() => {
    if (parcelleId) {
      calculateNDVI();
    }
  }, [parcelleId, date, forceRecalculate, calculateNDVI]);

  // Handle retry
  const handleRetry = useCallback(() => {
    calculateNDVI();
  }, [calculateNDVI]);

  // Format date for display
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  // Get health status display properties
  const getHealthStatusDisplay = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; bgColor: string }> = {
      excellent: {
        label: 'Excellent',
        color: 'text-green-800',
        bgColor: 'bg-green-100',
      },
      good: {
        label: 'Bon',
        color: 'text-green-700',
        bgColor: 'bg-green-50',
      },
      fair: {
        label: 'Moyen',
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-50',
      },
      poor: {
        label: 'Faible',
        color: 'text-orange-700',
        bgColor: 'bg-orange-50',
      },
      critical: {
        label: 'Critique',
        color: 'text-red-700',
        bgColor: 'bg-red-50',
      },
    };

    return statusMap[status] || statusMap.fair;
  };

  // Get legend colors
  const legendColors: NDVIColorRange[] = getNDVILegendColors();

  return (
    <div className="ndvi-layer">
      {/* Loading State */}
      {state.loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />
            <p className="text-sm font-medium text-gray-700">
              Calcul du NDVI en cours...
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {state.error && !state.loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/90 backdrop-blur-sm">
          <div className="max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900">
                  Erreur de calcul NDVI
                </h3>
                <p className="mt-1 text-sm text-gray-600">{state.error.message}</p>
              </div>
            </div>
            <button
              onClick={handleRetry}
              className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              Réessayer
            </button>
          </div>
        </div>
      )}

      {/* NDVI Visualization (shown when NDVI is calculated) */}
      {state.ndvi && !state.loading && !state.error && (
        <>
          {/* NDVI Info Panel */}
          <div className="absolute bottom-20 right-4 z-[1000] w-72 rounded-lg bg-white p-4 shadow-lg">
            {/* Offline/Cached Indicator */}
            {(isOffline || state.cached) && (
              <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 p-2">
                <div className="flex items-start gap-2">
                  <svg
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-amber-800">
                      {isOffline ? 'Mode hors ligne' : 'Données en cache'}
                    </p>
                    <p className="mt-0.5 text-xs text-amber-700">
                      {isOffline 
                        ? 'Affichage des dernières données disponibles'
                        : 'Ces données proviennent du cache'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-gray-900">
                Analyse NDVI
              </h4>
              <p className="mt-1 text-xs text-gray-500">
                {formatDate(state.ndvi.calculationDate)}
              </p>
            </div>

            {/* Health Status Badge */}
            <div className="mb-4">
              {(() => {
                const statusDisplay = getHealthStatusDisplay(state.ndvi.healthStatus);
                return (
                  <div
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${statusDisplay.bgColor} ${statusDisplay.color}`}
                  >
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: ndviToHex(state.ndvi.meanNDVI) }}
                    />
                    <span>État: {statusDisplay.label}</span>
                  </div>
                );
              })()}
            </div>

            {/* NDVI Statistics */}
            <div className="space-y-2 border-t border-gray-200 pt-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">NDVI Moyen:</span>
                <span className="font-semibold text-gray-900">
                  {state.ndvi.meanNDVI.toFixed(3)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">NDVI Min:</span>
                <span className="font-medium text-gray-700">
                  {state.ndvi.minNDVI.toFixed(3)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">NDVI Max:</span>
                <span className="font-medium text-gray-700">
                  {state.ndvi.maxNDVI.toFixed(3)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Écart-type:</span>
                <span className="font-medium text-gray-700">
                  {state.ndvi.stdDevNDVI.toFixed(3)}
                </span>
              </div>
            </div>

            {/* Recalculate Button */}
            <button
              onClick={() => calculateNDVI()}
              disabled={isOffline}
              className={`mt-4 w-full rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                isOffline
                  ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title={isOffline ? 'Recalcul impossible hors ligne' : 'Recalculer le NDVI'}
            >
              {isOffline ? 'Hors ligne' : 'Recalculer'}
            </button>
          </div>

          {/* NDVI Legend */}
          {showLegend && (
            <div className="absolute bottom-20 left-4 z-[1000] rounded-lg bg-white p-4 shadow-lg">
              <h4 className="mb-3 text-xs font-semibold text-gray-900">
                Légende NDVI
              </h4>
              <div className="space-y-2">
                {legendColors.map((range, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className="h-4 w-4 flex-shrink-0 rounded border border-gray-300"
                      style={{ backgroundColor: range.color }}
                    />
                    <div className="flex-1">
                      <div className="text-xs font-medium text-gray-700">
                        {range.label}
                      </div>
                      <div className="text-xs text-gray-500">
                        {range.min.toFixed(1)} - {range.max.toFixed(1)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Info Note */}
              <div className="mt-3 border-t border-gray-200 pt-3">
                <div className="flex items-start gap-2 text-xs text-gray-500">
                  <svg
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>
                    Le NDVI mesure la santé de la végétation. Plus la valeur est élevée,
                    meilleure est la santé des plants.
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default NDVILayer;
