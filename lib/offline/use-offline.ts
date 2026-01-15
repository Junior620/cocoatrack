// CocoaTrack V2 - Offline React Hook
// Provides offline state and sync functionality
// Requirements: 8.4, REQ-OBS-002

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

import { getSyncEngine, type SyncResult } from './sync-engine';
import {
  getPendingOperationsCount,
  getConflictOperations,
  getAllSyncMetadata,
  type QueuedOperation,
  type SyncMetadata,
} from './indexed-db';
import {
  recordSyncCompletion,
  logSyncError,
  logNetworkError,
} from './diagnostics-service';

// ============================================================================
// TYPES
// ============================================================================

export interface OfflineState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  conflictCount: number;
  lastSyncAt: Date | null;
  lastSyncResult: SyncResult | null;
  syncMetadata: SyncMetadata[];
}

export interface UseOfflineReturn extends OfflineState {
  sync: () => Promise<SyncResult>;
  getConflicts: () => Promise<QueuedOperation[]>;
  resolveConflict: (
    operationId: string,
    resolution: 'local' | 'remote' | 'merge',
    mergedData?: Record<string, unknown>
  ) => Promise<boolean>;
  retryOperation: (operationId: string) => Promise<boolean>;
  cancelOperation: (operationId: string) => Promise<boolean>;
  refreshState: () => Promise<void>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * React hook for managing offline state and sync operations
 */
export function useOffline(): UseOfflineReturn {
  const [state, setState] = useState<OfflineState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    conflictCount: 0,
    lastSyncAt: null,
    lastSyncResult: null,
    syncMetadata: [],
  });

  const syncEngineRef = useRef(getSyncEngine());
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Refresh state from IndexedDB
  const refreshState = useCallback(async () => {
    try {
      const [pendingCount, conflicts, metadata] = await Promise.all([
        getPendingOperationsCount(),
        getConflictOperations(),
        getAllSyncMetadata(),
      ]);

      setState((prev) => ({
        ...prev,
        pendingCount,
        conflictCount: conflicts.length,
        syncMetadata: metadata,
      }));
    } catch (error) {
      console.error('Failed to refresh offline state:', error);
    }
  }, []);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOnline: true }));
      // Auto-sync when coming back online
      const startTime = Date.now();
      syncEngineRef.current.sync().then((result) => {
        const durationMs = Date.now() - startTime;
        recordSyncCompletion(result, durationMs);
        setState((prev) => ({
          ...prev,
          lastSyncAt: new Date(),
          lastSyncResult: result,
        }));
        refreshState();
      }).catch((error) => {
        logNetworkError(
          'AUTO_SYNC_FAILED',
          error instanceof Error ? error.message : 'Auto-sync failed on reconnect',
          { trigger: 'online_event' }
        );
      });
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial state refresh
    refreshState();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshState]);

  // Listen for service worker sync events
  useEffect(() => {
    const handleSyncTriggered = () => {
      if (state.isOnline && !state.isSyncing) {
        const startTime = Date.now();
        syncEngineRef.current.sync().then((result) => {
          const durationMs = Date.now() - startTime;
          recordSyncCompletion(result, durationMs);
          setState((prev) => ({
            ...prev,
            lastSyncAt: new Date(),
            lastSyncResult: result,
          }));
          refreshState();
        }).catch((error) => {
          logSyncError(
            'SW_SYNC_FAILED',
            error instanceof Error ? error.message : 'Service worker sync failed',
            { trigger: 'sw_sync_event' }
          );
        });
      }
    };

    window.addEventListener('sw-sync-triggered', handleSyncTriggered);

    return () => {
      window.removeEventListener('sw-sync-triggered', handleSyncTriggered);
    };
  }, [state.isOnline, state.isSyncing, refreshState]);

  // Periodic sync when online (every 30 seconds)
  useEffect(() => {
    if (state.isOnline && state.pendingCount > 0) {
      syncIntervalRef.current = setInterval(() => {
        if (!state.isSyncing) {
          const startTime = Date.now();
          syncEngineRef.current.sync().then((result) => {
            const durationMs = Date.now() - startTime;
            recordSyncCompletion(result, durationMs);
            setState((prev) => ({
              ...prev,
              lastSyncAt: new Date(),
              lastSyncResult: result,
            }));
            refreshState();
          }).catch((error) => {
            logSyncError(
              'PERIODIC_SYNC_FAILED',
              error instanceof Error ? error.message : 'Periodic sync failed',
              { trigger: 'interval' }
            );
          });
        }
      }, 30000);
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [state.isOnline, state.pendingCount, state.isSyncing, refreshState]);

  // Manual sync function
  const sync = useCallback(async (): Promise<SyncResult> => {
    if (state.isSyncing) {
      return {
        success: false,
        synced: 0,
        failed: 0,
        conflicts: 0,
        errors: [
          {
            operationId: '',
            code: 'SYNC_IN_PROGRESS',
            message: 'Sync is already running',
          },
        ],
      };
    }

    setState((prev) => ({ ...prev, isSyncing: true }));
    const startTime = Date.now();

    try {
      const result = await syncEngineRef.current.sync();
      const durationMs = Date.now() - startTime;
      
      // Record sync completion for diagnostics (REQ-OBS-002)
      recordSyncCompletion(result, durationMs);
      
      setState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: new Date(),
        lastSyncResult: result,
      }));
      await refreshState();
      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      // Log sync error (REQ-OBS-002)
      await logSyncError(
        'SYNC_EXCEPTION',
        error instanceof Error ? error.message : 'Unknown sync error',
        { duration_ms: durationMs }
      );
      
      setState((prev) => ({ ...prev, isSyncing: false }));
      throw error;
    }
  }, [state.isSyncing, refreshState]);

  // Get conflicts
  const getConflicts = useCallback(async (): Promise<QueuedOperation[]> => {
    return getConflictOperations();
  }, []);

  // Resolve conflict
  const resolveConflict = useCallback(
    async (
      operationId: string,
      resolution: 'local' | 'remote' | 'merge',
      mergedData?: Record<string, unknown>
    ): Promise<boolean> => {
      const result = await syncEngineRef.current.resolveConflict(
        operationId,
        resolution,
        mergedData
      );
      await refreshState();
      return result;
    },
    [refreshState]
  );

  // Retry operation
  const retryOperation = useCallback(
    async (operationId: string): Promise<boolean> => {
      const result = await syncEngineRef.current.retryOperation(operationId);
      await refreshState();
      return result;
    },
    [refreshState]
  );

  // Cancel operation
  const cancelOperation = useCallback(
    async (operationId: string): Promise<boolean> => {
      const result = await syncEngineRef.current.cancelOperation(operationId);
      await refreshState();
      return result;
    },
    [refreshState]
  );

  return {
    ...state,
    sync,
    getConflicts,
    resolveConflict,
    retryOperation,
    cancelOperation,
    refreshState,
  };
}

// ============================================================================
// ONLINE STATUS HOOK
// ============================================================================

/**
 * Simple hook for just tracking online/offline status
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
