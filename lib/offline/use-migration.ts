/**
 * CocoaTrack V2 - Migration Hook
 * 
 * React hook for managing IndexedDB migrations with UI feedback.
 * Provides the "Réinitialiser les données" option to users.
 * 
 * Requirements: REQ-IDB-001, REQ-IDB-002
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MigrationStatus,
  MigrationResult,
  RollbackResult,
  ResetResult,
  getMigrationStatus,
  isMigrationNeeded,
  performMigration,
  performRollback,
  resetDatabase,
  isRollbackAvailable,
  getLastMigrationError,
  getMigrationDiagnostics,
} from './migration-manager';

// ============================================================================
// TYPES
// ============================================================================

export interface UseMigrationState {
  status: MigrationStatus['status'];
  currentVersion: number;
  targetVersion: number;
  error: string | null;
  isLoading: boolean;
  migrationNeeded: boolean;
  rollbackAvailable: boolean;
  opsQueueBackupCount: number;
}

export interface UseMigrationActions {
  checkMigration: () => Promise<boolean>;
  runMigration: () => Promise<MigrationResult>;
  runRollback: () => Promise<RollbackResult>;
  resetData: () => Promise<ResetResult>;
  dismissError: () => void;
}

export type UseMigrationReturn = UseMigrationState & UseMigrationActions;

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for managing IndexedDB migrations
 * 
 * @example
 * ```tsx
 * function MigrationBanner() {
 *   const {
 *     status,
 *     error,
 *     migrationNeeded,
 *     rollbackAvailable,
 *     runMigration,
 *     runRollback,
 *     resetData,
 *   } = useMigration();
 * 
 *   if (status === 'failed') {
 *     return (
 *       <div>
 *         <p>Migration failed: {error}</p>
 *         {rollbackAvailable && (
 *           <button onClick={runRollback}>Retry</button>
 *         )}
 *         <button onClick={resetData}>Réinitialiser les données</button>
 *       </div>
 *     );
 *   }
 * 
 *   return null;
 * }
 * ```
 */
export function useMigration(): UseMigrationReturn {
  const [state, setState] = useState<UseMigrationState>({
    status: 'idle',
    currentVersion: 0,
    targetVersion: 0,
    error: null,
    isLoading: true,
    migrationNeeded: false,
    rollbackAvailable: false,
    opsQueueBackupCount: 0,
  });

  // Initialize state from stored status
  useEffect(() => {
    async function init() {
      try {
        const diagnostics = await getMigrationDiagnostics();
        
        setState({
          status: diagnostics.status.status,
          currentVersion: diagnostics.currentVersion,
          targetVersion: diagnostics.targetVersion,
          error: diagnostics.lastError?.message || null,
          isLoading: false,
          migrationNeeded: diagnostics.migrationNeeded,
          rollbackAvailable: diagnostics.backupAvailable,
          opsQueueBackupCount: diagnostics.backupCount,
        });
      } catch (error) {
        console.error('[useMigration] Failed to initialize:', error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to initialize',
        }));
      }
    }
    
    init();
  }, []);

  // Check if migration is needed
  const checkMigration = useCallback(async (): Promise<boolean> => {
    try {
      const needed = await isMigrationNeeded();
      setState(prev => ({ ...prev, migrationNeeded: needed }));
      return needed;
    } catch (error) {
      console.error('[useMigration] Failed to check migration:', error);
      return false;
    }
  }, []);

  // Run the migration
  const runMigration = useCallback(async (): Promise<MigrationResult> => {
    setState(prev => ({ ...prev, status: 'migrating', isLoading: true, error: null }));
    
    try {
      const result = await performMigration();
      
      setState(prev => ({
        ...prev,
        status: result.success ? 'success' : 'failed',
        currentVersion: result.toVersion,
        error: result.error || null,
        isLoading: false,
        migrationNeeded: false,
        rollbackAvailable: result.rollbackAvailable,
        opsQueueBackupCount: result.opsQueueCount,
      }));
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: errorMessage,
        isLoading: false,
        rollbackAvailable: true,
      }));
      
      return {
        success: false,
        fromVersion: state.currentVersion,
        toVersion: state.targetVersion,
        opsQueuePreserved: true,
        opsQueueCount: state.opsQueueBackupCount,
        error: errorMessage,
        rollbackAvailable: true,
      };
    }
  }, [state.currentVersion, state.targetVersion, state.opsQueueBackupCount]);

  // Run rollback
  const runRollback = useCallback(async (): Promise<RollbackResult> => {
    setState(prev => ({ ...prev, status: 'migrating', isLoading: true, error: null }));
    
    try {
      const result = await performRollback();
      
      setState(prev => ({
        ...prev,
        status: result.success ? 'success' : 'failed',
        error: result.error || null,
        isLoading: false,
        rollbackAvailable: !result.success,
        opsQueueBackupCount: result.opsQueueCount,
      }));
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: errorMessage,
        isLoading: false,
      }));
      
      return {
        success: false,
        opsQueueRestored: false,
        opsQueueCount: 0,
        error: errorMessage,
      };
    }
  }, []);

  // Reset database (Réinitialiser les données)
  const resetData = useCallback(async (): Promise<ResetResult> => {
    setState(prev => ({ ...prev, status: 'migrating', isLoading: true, error: null }));
    
    try {
      const result = await resetDatabase();
      
      setState(prev => ({
        ...prev,
        status: result.success ? 'success' : 'failed',
        error: result.error || null,
        isLoading: false,
        migrationNeeded: false,
        rollbackAvailable: false,
        opsQueueBackupCount: result.opsQueueCount,
      }));
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: errorMessage,
        isLoading: false,
      }));
      
      return {
        success: false,
        opsQueuePreserved: false,
        opsQueueCount: 0,
        error: errorMessage,
      };
    }
  }, []);

  // Dismiss error
  const dismissError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    checkMigration,
    runMigration,
    runRollback,
    resetData,
    dismissError,
  };
}

export default useMigration;
