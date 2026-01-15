// CocoaTrack V2 - Sync Status Indicator
// Simplified 3-state sync status indicator
// Requirements: REQ-SYNC-001

'use client';

import Link from 'next/link';
import { CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { useOffline } from '@/lib/offline/use-offline';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Sync status states as defined in Property 8
 * - synced: All operations synchronized (green)
 * - pending: Operations waiting to sync (orange)
 * - error: Operations with errors (red)
 */
export type SyncStatusState = 'synced' | 'pending' | 'error';

export interface SyncStatusIndicatorProps {
  /** Additional CSS classes */
  className?: string;
  /** Show detailed count */
  showCount?: boolean;
  /** Compact mode for mobile */
  compact?: boolean;
}

// ============================================================================
// PURE FUNCTIONS FOR SYNC STATUS
// ============================================================================

/**
 * Determines the sync status state based on pending and error counts
 * 
 * Property 8: Sync Status Display
 * - If pending_count == 0 AND error_count == 0: display 'synced' (green)
 * - If pending_count > 0 AND error_count == 0: display 'pending' (orange)
 * - If error_count > 0: display 'error' (red)
 * 
 * @param pendingCount - Number of pending operations
 * @param errorCount - Number of error/conflict operations
 * @returns The sync status state
 */
export function getSyncStatusState(pendingCount: number, errorCount: number): SyncStatusState {
  if (errorCount > 0) {
    return 'error';
  }
  if (pendingCount > 0) {
    return 'pending';
  }
  return 'synced';
}

/**
 * Gets the display configuration for a sync status state
 */
export function getSyncStatusConfig(state: SyncStatusState): {
  color: string;
  bgColor: string;
  textColor: string;
  label: string;
  labelFr: string;
} {
  switch (state) {
    case 'synced':
      return {
        color: 'bg-green-500',
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
        label: 'Synced',
        labelFr: 'Synchronisé',
      };
    case 'pending':
      return {
        color: 'bg-amber-500',
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
        label: 'Pending',
        labelFr: 'En attente',
      };
    case 'error':
      return {
        color: 'bg-red-500',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        label: 'Error',
        labelFr: 'Erreur',
      };
  }
}

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Simplified sync status indicator with 3 states
 * REQ-SYNC-001: Sync Status Simplifié (3 États)
 * 
 * - ✅ "Tout est synchronisé" (vert)
 * - ⚠️ "X opérations en attente" (orange)
 * - 🔴 "X erreurs à corriger" (rouge)
 * 
 * Tap opens the sync page for detailed view
 */
export function SyncStatusIndicator({
  className = '',
  showCount = true,
  compact = false,
}: SyncStatusIndicatorProps) {
  const { pendingCount, conflictCount, isSyncing } = useOffline();
  
  // conflictCount represents error operations (needs_review status)
  const errorCount = conflictCount;
  const totalPending = pendingCount;
  
  const state = getSyncStatusState(totalPending, errorCount);
  const config = getSyncStatusConfig(state);

  // Syncing state overrides display
  if (isSyncing) {
    return (
      <Link
        href="/sync"
        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-gray-100 ${className}`}
        title="Synchronisation en cours..."
      >
        <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
        {!compact && (
          <span className="font-medium text-amber-700">Sync...</span>
        )}
      </Link>
    );
  }

  // Compact mode (icon only with badge)
  if (compact) {
    return (
      <Link
        href="/sync"
        className={`relative flex items-center justify-center rounded-full p-2 transition-colors hover:bg-gray-100 ${className}`}
        title={getTooltipText(state, totalPending, errorCount)}
      >
        {state === 'synced' && (
          <CheckCircle className="h-5 w-5 text-green-500" />
        )}
        {state === 'pending' && (
          <Clock className="h-5 w-5 text-amber-500" />
        )}
        {state === 'error' && (
          <AlertCircle className="h-5 w-5 text-red-500" />
        )}
        
        {/* Badge for count */}
        {(totalPending > 0 || errorCount > 0) && (
          <span
            className={`absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ${
              errorCount > 0 ? 'bg-red-500' : 'bg-amber-500'
            }`}
          >
            {(errorCount > 0 ? errorCount : totalPending) > 9 
              ? '9+' 
              : (errorCount > 0 ? errorCount : totalPending)}
          </span>
        )}
      </Link>
    );
  }

  // Full mode with text
  return (
    <Link
      href="/sync"
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-gray-100 ${className}`}
      title={getTooltipText(state, totalPending, errorCount)}
    >
      {/* Status indicator dot */}
      <span className="relative flex h-2.5 w-2.5">
        {state !== 'synced' && (
          <span 
            className={`absolute inline-flex h-full w-full animate-pulse rounded-full opacity-75 ${config.color}`} 
          />
        )}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${config.color}`} />
      </span>

      {/* Status text */}
      <span className={`font-medium ${config.textColor}`}>
        {getStatusText(state, totalPending, errorCount)}
      </span>

      {/* Count badge */}
      {showCount && (totalPending > 0 || errorCount > 0) && (
        <span
          className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${
            errorCount > 0
              ? 'bg-red-100 text-red-700'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {errorCount > 0 ? errorCount : totalPending}
        </span>
      )}
    </Link>
  );
}

/**
 * Gets the status text based on state and counts
 */
function getStatusText(state: SyncStatusState, pendingCount: number, errorCount: number): string {
  switch (state) {
    case 'synced':
      return 'Synchronisé';
    case 'pending':
      return pendingCount === 1 ? '1 en attente' : `${pendingCount} en attente`;
    case 'error':
      return errorCount === 1 ? '1 erreur' : `${errorCount} erreurs`;
  }
}

/**
 * Gets the tooltip text for accessibility
 */
function getTooltipText(state: SyncStatusState, pendingCount: number, errorCount: number): string {
  switch (state) {
    case 'synced':
      return 'Tout est synchronisé';
    case 'pending':
      return `${pendingCount} opération${pendingCount > 1 ? 's' : ''} en attente de synchronisation`;
    case 'error':
      return `${errorCount} erreur${errorCount > 1 ? 's' : ''} à corriger`;
  }
}

/**
 * Minimal badge-only version for tight spaces
 */
export function SyncStatusBadge({ className = '' }: { className?: string }) {
  const { pendingCount, conflictCount, isSyncing } = useOffline();
  
  const errorCount = conflictCount;
  const state = getSyncStatusState(pendingCount, errorCount);
  const config = getSyncStatusConfig(state);

  if (isSyncing) {
    return (
      <Link
        href="/sync"
        className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ${className}`}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        Sync...
      </Link>
    );
  }

  return (
    <Link
      href="/sync"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.bgColor} ${config.textColor} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.color}`} />
      {state === 'synced' && 'Synchronisé'}
      {state === 'pending' && `${pendingCount} en attente`}
      {state === 'error' && `${errorCount} erreur${errorCount > 1 ? 's' : ''}`}
    </Link>
  );
}

export default SyncStatusIndicator;
