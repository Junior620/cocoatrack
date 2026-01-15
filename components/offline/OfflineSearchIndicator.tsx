/**
 * CocoaTrack V2 - Offline Search Indicator Component
 * 
 * Displays indicators when search results come from offline cache.
 * Requirements: REQ-OFF-005
 * 
 * Features:
 * - "Résultats depuis le cache local" indicator
 * - "Données partielles si non téléchargées" warning
 * - Search time display
 * - Truncation warning
 */

'use client';

import React from 'react';
import { AlertCircle, Database, Clock, AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface OfflineSearchIndicatorProps {
  /** Whether the search was performed offline */
  isOffline: boolean;
  /** Number of results returned */
  resultCount: number;
  /** Total number of matching results (before truncation) */
  totalCount?: number;
  /** Whether results were truncated */
  truncated?: boolean;
  /** Search time in milliseconds */
  searchTime?: number;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show detailed info */
  showDetails?: boolean;
  /** Custom message override */
  customMessage?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Displays offline search status indicators
 * REQ-OFF-005: Indicate "Résultats depuis le cache local"
 */
export function OfflineSearchIndicator({
  isOffline,
  resultCount,
  totalCount,
  truncated = false,
  searchTime,
  className,
  showDetails = true,
  customMessage,
}: OfflineSearchIndicatorProps) {
  if (!isOffline && !truncated) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-1 text-sm',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {/* Offline indicator */}
      {isOffline && (
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <Database className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>
            {customMessage || 'Résultats depuis le cache local'}
          </span>
        </div>
      )}

      {/* Partial data warning */}
      {isOffline && showDetails && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          <span>Données partielles si non téléchargées</span>
        </div>
      )}

      {/* Truncation warning */}
      {truncated && totalCount !== undefined && (
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          <span>
            Affichage limité à {resultCount} résultats sur {totalCount}
          </span>
        </div>
      )}

      {/* Search time (debug info) */}
      {showDetails && searchTime !== undefined && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Clock className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          <span>{searchTime.toFixed(0)}ms</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPACT VARIANT
// ============================================================================

export interface OfflineSearchBadgeProps {
  /** Whether the search was performed offline */
  isOffline: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Compact badge indicating offline search
 */
export function OfflineSearchBadge({
  isOffline,
  className,
}: OfflineSearchBadgeProps) {
  if (!isOffline) {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        'text-xs font-medium',
        className
      )}
    >
      <Database className="h-3 w-3" aria-hidden="true" />
      <span>Cache local</span>
    </span>
  );
}

// ============================================================================
// INLINE VARIANT
// ============================================================================

export interface OfflineSearchInlineProps {
  /** Whether the search was performed offline */
  isOffline: boolean;
  /** Number of results */
  resultCount: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Inline text indicating offline search status
 */
export function OfflineSearchInline({
  isOffline,
  resultCount,
  className,
}: OfflineSearchInlineProps) {
  return (
    <span className={cn('text-sm text-muted-foreground', className)}>
      {resultCount} résultat{resultCount !== 1 ? 's' : ''}
      {isOffline && (
        <span className="text-amber-600 dark:text-amber-400">
          {' '}(cache local)
        </span>
      )}
    </span>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

export interface OfflineSearchEmptyProps {
  /** Search query that returned no results */
  query: string;
  /** Whether the search was performed offline */
  isOffline: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Empty state for offline search with no results
 */
export function OfflineSearchEmpty({
  query,
  isOffline,
  className,
}: OfflineSearchEmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-8 text-center',
        className
      )}
    >
      <Database className="h-12 w-12 text-muted-foreground/50 mb-4" aria-hidden="true" />
      <p className="text-muted-foreground">
        Aucun résultat pour &quot;{query}&quot;
      </p>
      {isOffline && (
        <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
          Recherche effectuée dans le cache local.
          <br />
          Synchronisez pour accéder à toutes les données.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default OfflineSearchIndicator;
