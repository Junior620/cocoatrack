/**
 * Cache Status Indicator Component
 * 
 * Displays visual indicators for cached satellite data status including:
 * - Cached data indicator with cache date
 * - Stale data warning (>30 days old)
 * - Offline mode indicator
 * 
 * Requirements: Task 6.3.2
 * - Display "cached data" indicator with cache date
 * - Show warning for stale data (>30 days)
 * - Indicate offline mode
 */

'use client';

import React from 'react';
import { WifiOff, Database, AlertTriangle, Clock } from 'lucide-react';
import { getCacheAgeString, formatCacheDate } from '@/lib/satellite/utils/offline-detection';

// ============================================================================
// Types
// ============================================================================

/**
 * Component props
 */
interface CacheStatusIndicatorProps {
  /** Whether currently offline */
  offline?: boolean;
  /** Whether data is from cache */
  cached?: boolean;
  /** Date when data was cached */
  cachedAt?: Date | null;
  /** Whether cached data is stale (>30 days old) */
  isStale?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show detailed information */
  showDetails?: boolean;
  /** Custom className */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Cache Status Indicator Component
 * 
 * Displays badges and warnings for cache status and offline mode.
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <CacheStatusIndicator
 *   offline={false}
 *   cached={true}
 *   cachedAt={new Date('2024-01-15')}
 *   isStale={false}
 * />
 * 
 * // With stale warning
 * <CacheStatusIndicator
 *   cached={true}
 *   cachedAt={new Date('2023-11-01')}
 *   isStale={true}
 *   showDetails={true}
 * />
 * 
 * // Offline mode
 * <CacheStatusIndicator
 *   offline={true}
 *   cached={true}
 *   cachedAt={new Date('2024-01-10')}
 * />
 * ```
 */
export function CacheStatusIndicator({
  offline = false,
  cached = false,
  cachedAt = null,
  isStale = false,
  size = 'md',
  showDetails = false,
  className = '',
}: CacheStatusIndicatorProps): React.ReactElement | null {
  // Don't render if no status to show
  if (!offline && !cached) {
    return null;
  }

  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  const iconSize = iconSizes[size];
  const sizeClass = sizeClasses[size];

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Offline indicator */}
      {offline && (
        <div
          className={`inline-flex items-center gap-1.5 rounded-md bg-gray-100 text-gray-700 font-medium ${sizeClass}`}
          role="status"
          aria-label="Offline mode"
        >
          <WifiOff size={iconSize} className="text-gray-600" />
          <span>Offline Mode</span>
        </div>
      )}

      {/* Cached data indicator */}
      {cached && cachedAt && !isStale && (
        <div
          className={`inline-flex items-center gap-1.5 rounded-md bg-blue-50 text-blue-700 font-medium ${sizeClass}`}
          role="status"
          aria-label="Cached data"
        >
          <Database size={iconSize} className="text-blue-600" />
          <span>Cached Data</span>
          {showDetails && (
            <span className="text-blue-600 font-normal">
              ({getCacheAgeString(cachedAt)})
            </span>
          )}
        </div>
      )}

      {/* Stale data warning */}
      {cached && cachedAt && isStale && (
        <div
          className={`inline-flex items-center gap-1.5 rounded-md bg-amber-50 text-amber-800 font-medium ${sizeClass}`}
          role="alert"
          aria-label="Stale cached data"
        >
          <AlertTriangle size={iconSize} className="text-amber-600" />
          <span>Stale Data</span>
          {showDetails && (
            <span className="text-amber-700 font-normal">
              (Cached {getCacheAgeString(cachedAt)})
            </span>
          )}
        </div>
      )}

      {/* Detailed cache information */}
      {showDetails && cached && cachedAt && (
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Clock size={12} className="text-gray-500" />
          <span>Cached on {formatCacheDate(cachedAt)}</span>
        </div>
      )}

      {/* Stale data explanation */}
      {isStale && showDetails && (
        <div className="text-xs text-amber-700 bg-amber-50 rounded-md p-2 border border-amber-200">
          <p className="font-medium mb-1">⚠️ Data may be outdated</p>
          <p>
            This data is more than 30 days old. Connect to the internet to load
            the latest satellite imagery.
          </p>
        </div>
      )}

      {/* Offline explanation */}
      {offline && showDetails && (
        <div className="text-xs text-gray-700 bg-gray-50 rounded-md p-2 border border-gray-200">
          <p className="font-medium mb-1">📡 Offline Mode</p>
          <p>
            You're currently offline. Showing cached data from your last visit.
            Connect to the internet to load fresh satellite imagery.
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
 * Compact Cache Status Badge
 * 
 * A minimal badge showing only the most important status.
 * Useful for displaying in tight spaces like table cells or map popups.
 * 
 * @example
 * ```tsx
 * <CacheStatusBadge
 *   offline={true}
 *   isStale={false}
 * />
 * ```
 */
export function CacheStatusBadge({
  offline = false,
  cached = false,
  isStale = false,
}: Pick<CacheStatusIndicatorProps, 'offline' | 'cached' | 'isStale'>): React.ReactElement | null {
  // Priority: offline > stale > cached
  if (offline) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
        title="Offline mode - showing cached data"
      >
        <WifiOff size={10} />
        Offline
      </span>
    );
  }

  if (isStale) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800"
        title="Cached data is more than 30 days old"
      >
        <AlertTriangle size={10} />
        Stale
      </span>
    );
  }

  if (cached) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"
        title="Showing cached data"
      >
        <Database size={10} />
        Cached
      </span>
    );
  }

  return null;
}

// ============================================================================
// Inline Variant
// ============================================================================

/**
 * Inline Cache Status Text
 * 
 * Plain text status for inline display without badges.
 * 
 * @example
 * ```tsx
 * <p>
 *   Satellite imagery <CacheStatusText cached={true} cachedAt={date} />
 * </p>
 * ```
 */
export function CacheStatusText({
  offline = false,
  cached = false,
  cachedAt = null,
  isStale = false,
}: Pick<CacheStatusIndicatorProps, 'offline' | 'cached' | 'cachedAt' | 'isStale'>): React.ReactElement | null {
  if (offline) {
    return <span className="text-gray-600 text-sm">(offline mode)</span>;
  }

  if (isStale && cachedAt) {
    return (
      <span className="text-amber-700 text-sm">
        (cached {getCacheAgeString(cachedAt)} - may be outdated)
      </span>
    );
  }

  if (cached && cachedAt) {
    return (
      <span className="text-blue-600 text-sm">
        (cached {getCacheAgeString(cachedAt)})
      </span>
    );
  }

  return null;
}
