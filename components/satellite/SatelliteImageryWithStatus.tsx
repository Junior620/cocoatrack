/**
 * Satellite Imagery with Status Component
 * 
 * Wrapper component that displays satellite imagery with cache status indicators.
 * Integrates useSatelliteImagery hook with CacheStatusIndicator component.
 * 
 * Requirements: Task 6.3.2
 * - Display satellite imagery
 * - Show cache status indicators
 * - Handle offline mode gracefully
 */

'use client';

import React from 'react';
import { useSatelliteImagery } from '@/hooks/satellite/useSatelliteImagery';
import { CacheStatusIndicator } from './CacheStatusIndicator';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

/**
 * Component props
 */
interface SatelliteImageryWithStatusProps {
  /** Parcelle ID */
  parcelleId: string;
  /** Optional date for imagery (defaults to most recent) */
  date?: Date;
  /** Cloud cover threshold (0-100) */
  cloudCoverThreshold?: number;
  /** Whether to automatically fetch on mount */
  autoFetch?: boolean;
  /** Whether to show detailed cache information */
  showCacheDetails?: boolean;
  /** Custom className */
  className?: string;
  /** Render function for imagery display */
  renderImagery?: (imagery: {
    tileUrl: string;
    acquisitionDate: Date;
    cloudCover: number;
  }) => React.ReactNode;
  /** Callback when imagery is loaded */
  onImageryLoaded?: (imagery: {
    tileUrl: string;
    acquisitionDate: Date;
    cloudCover: number;
  }) => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Satellite Imagery with Status Component
 * 
 * Displays satellite imagery with cache status indicators and offline support.
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <SatelliteImageryWithStatus
 *   parcelleId="parcelle-123"
 *   autoFetch={true}
 * />
 * 
 * // With custom rendering
 * <SatelliteImageryWithStatus
 *   parcelleId="parcelle-123"
 *   autoFetch={true}
 *   renderImagery={({ tileUrl, acquisitionDate }) => (
 *     <div>
 *       <img src={tileUrl} alt="Satellite imagery" />
 *       <p>Acquired: {acquisitionDate.toLocaleDateString()}</p>
 *     </div>
 *   )}
 * />
 * 
 * // With cache details
 * <SatelliteImageryWithStatus
 *   parcelleId="parcelle-123"
 *   autoFetch={true}
 *   showCacheDetails={true}
 * />
 * ```
 */
export function SatelliteImageryWithStatus({
  parcelleId,
  date,
  cloudCoverThreshold = 20,
  autoFetch = true,
  showCacheDetails = false,
  className = '',
  renderImagery,
  onImageryLoaded,
}: SatelliteImageryWithStatusProps): React.ReactElement {
  // Use satellite imagery hook with offline support
  const {
    imagery,
    loading,
    error,
    refetch,
    cloudCover,
    acquisitionDate,
    cached,
    offline,
    isStale,
    cachedAt,
  } = useSatelliteImagery({
    parcelleId,
    date,
    cloudCoverThreshold,
    autoFetch,
  });

  // Notify parent when imagery is loaded
  React.useEffect(() => {
    if (imagery && onImageryLoaded) {
      onImageryLoaded({
        tileUrl: imagery.tileUrl,
        acquisitionDate: imagery.acquisitionDate,
        cloudCover: imagery.cloudCoverPercent,
      });
    }
  }, [imagery, onImageryLoaded]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Cache Status Indicators */}
      <CacheStatusIndicator
        offline={offline}
        cached={cached}
        cachedAt={cachedAt}
        isStale={isStale}
        showDetails={showCacheDetails}
      />

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-gray-600">
              {offline ? 'Loading cached imagery...' : 'Loading satellite imagery...'}
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && !imagery && (
        <div className="flex flex-col gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Failed to load imagery</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
          
          {!offline && (
            <button
              onClick={() => refetch()}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-md text-sm font-medium transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          )}
        </div>
      )}

      {/* Imagery Display */}
      {imagery && !loading && (
        <div className="space-y-2">
          {/* Custom rendering or default display */}
          {renderImagery ? (
            renderImagery({
              tileUrl: imagery.tileUrl,
              acquisitionDate: imagery.acquisitionDate,
              cloudCover: imagery.cloudCoverPercent,
            })
          ) : (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Tile URL:</span>
                  <code className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                    {imagery.tileUrl.substring(0, 50)}...
                  </code>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Acquisition Date:</span>
                  <span className="text-sm text-gray-600">
                    {imagery.acquisitionDate.toLocaleDateString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Cloud Cover:</span>
                  <span className="text-sm text-gray-600">
                    {imagery.cloudCoverPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Refresh button (only when online) */}
          {!offline && (
            <button
              onClick={() => refetch()}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Imagery
            </button>
          )}
        </div>
      )}

      {/* Offline help text */}
      {offline && !imagery && !loading && (
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Offline Mode:</strong> No cached imagery available for this parcelle.
            Connect to the internet to load satellite data.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Compact Variant
// ============================================================================

/**
 * Compact Satellite Imagery Status
 * 
 * Minimal component showing only status badges without full imagery display.
 * Useful for list views or compact displays.
 * 
 * @example
 * ```tsx
 * <CompactSatelliteStatus
 *   parcelleId="parcelle-123"
 *   autoFetch={true}
 * />
 * ```
 */
export function CompactSatelliteStatus({
  parcelleId,
  date,
  autoFetch = true,
}: Pick<SatelliteImageryWithStatusProps, 'parcelleId' | 'date' | 'autoFetch'>): React.ReactElement {
  const {
    imagery,
    loading,
    error,
    cached,
    offline,
    isStale,
    cachedAt,
  } = useSatelliteImagery({
    parcelleId,
    date,
    autoFetch,
  });

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  if (error && !imagery) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600">
        <AlertCircle className="h-4 w-4" />
        <span>Error</span>
      </div>
    );
  }

  if (imagery) {
    return (
      <div className="flex items-center gap-2">
        <CacheStatusIndicator
          offline={offline}
          cached={cached}
          cachedAt={cachedAt}
          isStale={isStale}
          size="sm"
        />
        <span className="text-xs text-gray-600">
          {imagery.acquisitionDate.toLocaleDateString()}
        </span>
      </div>
    );
  }

  return (
    <span className="text-sm text-gray-500">No imagery</span>
  );
}
