'use client';

/**
 * SatelliteImageryOverlay Component
 * 
 * Displays satellite imagery as a map overlay with opacity control.
 * Integrates with both Leaflet and Google Maps implementations.
 * 
 * Features:
 * - Loading state with spinner
 * - Error state with retry button
 * - Opacity slider control (0-100%)
 * - Cloud cover display
 * - Acquisition date display
 */

import { useState, useEffect, useCallback } from 'react';
import type { ImageryData } from '@/lib/satellite/types';

export interface SatelliteImageryOverlayProps {
  /** ID of the parcelle to display imagery for */
  parcelleId: string;
  /** Optional specific date for imagery (defaults to most recent) */
  date?: Date;
  /** Initial opacity value (0-1, defaults to 0.7) */
  opacity?: number;
  /** Callback when opacity changes */
  onOpacityChange?: (opacity: number) => void;
  /** Callback when imagery loads successfully */
  onImageryLoaded?: (imagery: ImageryData) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Cloud cover threshold (0-100, defaults to 20) */
  cloudCoverThreshold?: number;
}

interface SatelliteImageryState {
  imagery: ImageryData | null;
  loading: boolean;
  error: Error | null;
}

export function SatelliteImageryOverlay({
  parcelleId,
  date,
  opacity: initialOpacity = 0.7,
  onOpacityChange,
  onImageryLoaded,
  onError,
  cloudCoverThreshold = 20,
}: SatelliteImageryOverlayProps) {
  const [state, setState] = useState<SatelliteImageryState>({
    imagery: null,
    loading: false,
    error: null,
  });
  const [opacity, setOpacity] = useState(initialOpacity);

  // Fetch satellite imagery
  const fetchImagery = useCallback(async () => {
    setState({ imagery: null, loading: true, error: null });

    try {
      // Build query parameters
      const params = new URLSearchParams({
        parcelleId,
        cloudCoverThreshold: cloudCoverThreshold.toString(),
      });

      if (date) {
        params.append('date', date.toISOString());
      }

      // Call imagery API endpoint
      const response = await fetch(`/api/satellite/imagery?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to fetch imagery: ${response.statusText}`
        );
      }

      const data = await response.json();
      const imagery: ImageryData = {
        ...data.imagery,
        acquisitionDate: new Date(data.imagery.acquisitionDate),
        createdAt: new Date(data.imagery.createdAt),
      };

      setState({ imagery, loading: false, error: null });

      // Notify parent component
      if (onImageryLoaded) {
        onImageryLoaded(imagery);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      setState({ imagery: null, loading: false, error: err });

      // Notify parent component
      if (onError) {
        onError(err);
      }
    }
  }, [parcelleId, date, cloudCoverThreshold, onImageryLoaded, onError]);

  // Fetch imagery on mount and when dependencies change
  useEffect(() => {
    if (parcelleId) {
      fetchImagery();
    }
  }, [parcelleId, date, cloudCoverThreshold, fetchImagery]);

  // Handle opacity change
  const handleOpacityChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newOpacity = parseFloat(event.target.value) / 100;
      setOpacity(newOpacity);

      if (onOpacityChange) {
        onOpacityChange(newOpacity);
      }
    },
    [onOpacityChange]
  );

  // Handle retry
  const handleRetry = useCallback(() => {
    fetchImagery();
  }, [fetchImagery]);

  // Format date for display
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  return (
    <div className="satellite-imagery-overlay">
      {/* Loading State */}
      {state.loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            <p className="text-sm font-medium text-gray-700">
              Chargement de l&apos;imagerie satellite...
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
                  Erreur de chargement
                </h3>
                <p className="mt-1 text-sm text-gray-600">{state.error.message}</p>
              </div>
            </div>
            <button
              onClick={handleRetry}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Réessayer
            </button>
          </div>
        </div>
      )}

      {/* Imagery Controls (shown when imagery is loaded) */}
      {state.imagery && !state.loading && !state.error && (
        <div className="absolute bottom-20 left-4 z-[1000] rounded-lg bg-white p-4 shadow-lg">
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-gray-700">
              Imagerie Satellite
            </h4>
            <p className="mt-1 text-xs text-gray-500">
              {formatDate(state.imagery.acquisitionDate)}
            </p>
            <p className="text-xs text-gray-500">
              Couverture nuageuse: {state.imagery.cloudCoverPercent.toFixed(1)}%
            </p>
          </div>

          {/* Opacity Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="opacity-slider"
                className="text-xs font-medium text-gray-700"
              >
                Opacité
              </label>
              <span className="text-xs text-gray-600">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              id="opacity-slider"
              type="range"
              min="0"
              max="100"
              value={opacity * 100}
              onChange={handleOpacityChange}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
              style={{
                background: `linear-gradient(to right, #2563eb 0%, #2563eb ${
                  opacity * 100
                }%, #e5e7eb ${opacity * 100}%, #e5e7eb 100%)`,
              }}
            />
          </div>

          {/* Imagery Info */}
          <div className="mt-3 border-t border-gray-200 pt-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <svg
                className="h-4 w-4"
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
                {state.imagery.satelliteSource === 'sentinel-2'
                  ? 'Sentinel-2'
                  : state.imagery.satelliteSource}
              </span>
              <span>•</span>
              <span>{state.imagery.resolutionMeters}m</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SatelliteImageryOverlay;
