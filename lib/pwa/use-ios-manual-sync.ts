// CocoaTrack V2 - iOS Manual Sync Hook
// Provides manual sync fallback for iOS where Background Sync is unavailable
// Requirements: REQ-IOS-003

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

import { detectIOS, hasBackgroundSync, recordActivity } from './ios-manager';
import { getSyncEngine, type SyncResult } from '@/lib/offline/sync-engine';
import { getPendingOperationsCount } from '@/lib/offline/indexed-db';

// ============================================================================
// TYPES
// ============================================================================

export interface UseIOSManualSyncState {
  /** Whether the device needs manual sync (iOS without Background Sync) */
  needsManualSync: boolean;
  /** Whether sync is currently in progress */
  isSyncing: boolean;
  /** Number of pending operations */
  pendingCount: number;
  /** Last sync result */
  lastSyncResult: SyncResult | null;
  /** Last sync timestamp */
  lastSyncAt: Date | null;
  /** Error message if sync failed */
  error: string | null;
  /** Whether the app just returned to foreground */
  justReturnedToForeground: boolean;
}

export interface UseIOSManualSyncReturn extends UseIOSManualSyncState {
  /** Trigger manual sync */
  sync: () => Promise<SyncResult>;
  /** Refresh pending count */
  refreshPendingCount: () => Promise<void>;
  /** Clear the foreground flag */
  clearForegroundFlag: () => void;
}

export interface UseIOSManualSyncOptions {
  /** Whether to auto-sync on foreground (default: true) */
  autoSyncOnForeground?: boolean;
  /** Minimum interval between auto-syncs in ms (default: 30000 = 30s) */
  minSyncInterval?: number;
  /** Callback when sync completes */
  onSyncComplete?: (result: SyncResult) => void;
  /** Callback when sync fails */
  onSyncError?: (error: Error) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default minimum interval between auto-syncs (30 seconds)
 */
export const DEFAULT_MIN_SYNC_INTERVAL = 30000;

/**
 * Storage key for last sync timestamp
 */
export const LAST_SYNC_KEY = 'ios_last_manual_sync';

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * React hook for iOS manual sync fallback
 * REQ-IOS-003: Manual sync when Background Sync unavailable
 * 
 * Features:
 * - Detects when manual sync is needed (iOS without Background Sync)
 * - Triggers sync on visibilitychange (app returns to foreground)
 * - Provides manual sync button state
 * - Tracks pending operations count
 * 
 * @param options - Hook options
 * @returns Hook state and actions
 */
export function useIOSManualSync(
  options: UseIOSManualSyncOptions = {}
): UseIOSManualSyncReturn {
  const {
    autoSyncOnForeground = true,
    minSyncInterval = DEFAULT_MIN_SYNC_INTERVAL,
    onSyncComplete,
    onSyncError,
  } = options;

  const [state, setState] = useState<UseIOSManualSyncState>({
    needsManualSync: false,
    isSyncing: false,
    pendingCount: 0,
    lastSyncResult: null,
    lastSyncAt: null,
    error: null,
    justReturnedToForeground: false,
  });

  const syncEngineRef = useRef(getSyncEngine());
  const lastSyncTimeRef = useRef<number>(0);
  const onSyncCompleteRef = useRef(onSyncComplete);
  const onSyncErrorRef = useRef(onSyncError);

  // Keep callback refs updated
  useEffect(() => {
    onSyncCompleteRef.current = onSyncComplete;
    onSyncErrorRef.current = onSyncError;
  }, [onSyncComplete, onSyncError]);

  // Check if manual sync is needed on mount
  useEffect(() => {
    const detection = detectIOS();
    const needsManual = detection.isIOS && !hasBackgroundSync();
    
    setState(prev => ({ ...prev, needsManualSync: needsManual }));

    // Load last sync time from storage
    try {
      const stored = localStorage.getItem(LAST_SYNC_KEY);
      if (stored) {
        lastSyncTimeRef.current = parseInt(stored, 10);
        setState(prev => ({ 
          ...prev, 
          lastSyncAt: new Date(lastSyncTimeRef.current) 
        }));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Refresh pending count
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingOperationsCount();
      setState(prev => ({ ...prev, pendingCount: count }));
    } catch (error) {
      console.error('[useIOSManualSync] Failed to get pending count:', error);
    }
  }, []);

  // Initial pending count fetch
  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  // Manual sync function
  const sync = useCallback(async (): Promise<SyncResult> => {
    if (state.isSyncing) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        conflicts: 0,
        errors: [{ operationId: '', code: 'SYNC_IN_PROGRESS', message: 'Sync already in progress' }],
      };
    }

    setState(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      const result = await syncEngineRef.current.sync();
      
      // Update last sync time
      const now = Date.now();
      lastSyncTimeRef.current = now;
      try {
        localStorage.setItem(LAST_SYNC_KEY, now.toString());
      } catch {
        // Ignore storage errors
      }

      // Record activity
      recordActivity();

      setState(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncResult: result,
        lastSyncAt: new Date(now),
        error: null,
      }));

      // Refresh pending count
      await refreshPendingCount();

      // Call callback
      if (onSyncCompleteRef.current) {
        onSyncCompleteRef.current(result);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setState(prev => ({
        ...prev,
        isSyncing: false,
        error: errorMessage,
      }));

      // Call error callback
      if (onSyncErrorRef.current) {
        onSyncErrorRef.current(error instanceof Error ? error : new Error(errorMessage));
      }

      throw error;
    }
  }, [state.isSyncing, refreshPendingCount]);

  // Clear foreground flag
  const clearForegroundFlag = useCallback(() => {
    setState(prev => ({ ...prev, justReturnedToForeground: false }));
  }, []);

  // Set up visibility change listener for auto-sync on foreground
  useEffect(() => {
    if (!state.needsManualSync || !autoSyncOnForeground) {
      return;
    }

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      // Check if enough time has passed since last sync
      const now = Date.now();
      const timeSinceLastSync = now - lastSyncTimeRef.current;
      
      if (timeSinceLastSync < minSyncInterval) {
        console.log('[useIOSManualSync] Skipping auto-sync, too soon since last sync');
        return;
      }

      // Check if there are pending operations
      const pendingCount = await getPendingOperationsCount();
      if (pendingCount === 0) {
        console.log('[useIOSManualSync] No pending operations, skipping auto-sync');
        return;
      }

      // Set foreground flag
      setState(prev => ({ ...prev, justReturnedToForeground: true }));

      console.log('[useIOSManualSync] App returned to foreground, triggering sync');
      
      try {
        await sync();
      } catch (error) {
        console.error('[useIOSManualSync] Auto-sync on foreground failed:', error);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.needsManualSync, autoSyncOnForeground, minSyncInterval, sync]);

  // Periodic pending count refresh
  useEffect(() => {
    const interval = setInterval(refreshPendingCount, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  return {
    ...state,
    sync,
    refreshPendingCount,
    clearForegroundFlag,
  };
}

export default useIOSManualSync;
