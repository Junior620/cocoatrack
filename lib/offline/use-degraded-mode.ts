// CocoaTrack V2 - Degraded Mode React Hook
// Provides degraded mode state and utilities to React components
// Requirements: REQ-OFF-011

'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';

import {
  getDegradedModeManager,
  INITIAL_DEGRADED_MODE_STATE,
  isActionDisabled as checkActionDisabled,
  getDisabledTooltip as getTooltip,
  type DegradedMode,
  type DegradedModeState,
  type DisabledAction,
} from './degraded-mode-manager';

// ============================================================================
// TYPES
// ============================================================================

export interface UseDegradedModeReturn {
  /** Current degraded mode state */
  state: DegradedModeState;
  /** Current degraded mode */
  mode: DegradedMode;
  /** Whether creation/write operations are blocked */
  isBlocked: boolean;
  /** Whether the app is in any degraded mode */
  isDegraded: boolean;
  /** Whether the app is in read-only mode */
  isReadOnly: boolean;
  /** Check if a specific action is disabled */
  isActionDisabled: (action: DisabledAction | string) => boolean;
  /** Get tooltip text for disabled buttons */
  getDisabledTooltip: () => string;
  /** Refresh the degraded mode state */
  refresh: () => Promise<void>;
  /** Set session expiration state (called by auth context) */
  setSessionExpired: (expired: boolean) => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * React hook for managing degraded mode state
 * 
 * Provides:
 * - Current degraded mode state
 * - Utilities for checking if actions are disabled
 * - Automatic state updates when conditions change
 * 
 * @example
 * ```tsx
 * function CreateDeliveryButton() {
 *   const { isBlocked, isActionDisabled, getDisabledTooltip } = useDegradedMode();
 *   
 *   const disabled = isActionDisabled('create_delivery');
 *   
 *   return (
 *     <button
 *       disabled={disabled}
 *       title={disabled ? getDisabledTooltip() : undefined}
 *     >
 *       Créer une livraison
 *     </button>
 *   );
 * }
 * ```
 */
export function useDegradedMode(): UseDegradedModeReturn {
  const [state, setState] = useState<DegradedModeState>(INITIAL_DEGRADED_MODE_STATE);

  // Get the manager instance
  const manager = useMemo(() => getDegradedModeManager(), []);

  // Refresh state from manager
  const refresh = useCallback(async () => {
    try {
      const newState = await manager.getState();
      setState(newState);
    } catch (error) {
      console.error('Failed to refresh degraded mode state:', error);
    }
  }, [manager]);

  // Set session expiration state
  const setSessionExpired = useCallback((expired: boolean) => {
    manager.setSessionExpired(expired);
    // Refresh state after setting session expiration
    refresh();
  }, [manager, refresh]);

  // Subscribe to state changes
  useEffect(() => {
    // Initial fetch
    refresh();

    // Subscribe to changes
    const unsubscribe = manager.subscribe((newState) => {
      setState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, [manager, refresh]);

  // Listen for online/offline events to refresh state
  useEffect(() => {
    const handleOnline = () => refresh();
    const handleOffline = () => refresh();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refresh]);

  // Memoized check for action disabled
  const isActionDisabled = useCallback(
    (action: DisabledAction | string): boolean => {
      return checkActionDisabled(state.mode, action);
    },
    [state.mode]
  );

  // Memoized tooltip getter
  const getDisabledTooltip = useCallback((): string => {
    return getTooltip(state.mode);
  }, [state.mode]);

  // Derived state
  const isDegraded = state.mode !== 'normal';
  const isReadOnly = state.mode === 'read_only_storage' || state.mode === 'read_only_auth';

  return {
    state,
    mode: state.mode,
    isBlocked: state.blocksCreation,
    isDegraded,
    isReadOnly,
    isActionDisabled,
    getDisabledTooltip,
    refresh,
    setSessionExpired,
  };
}

// ============================================================================
// CONTEXT INTEGRATION HOOK
// ============================================================================

/**
 * Hook to sync auth state with degraded mode manager
 * Should be used in the auth provider to update session expiration state
 * 
 * @example
 * ```tsx
 * function AuthProvider({ children }) {
 *   const { isAuthenticated } = useAuthState();
 *   useSyncAuthWithDegradedMode(!isAuthenticated);
 *   return <>{children}</>;
 * }
 * ```
 */
export function useSyncAuthWithDegradedMode(isSessionExpired: boolean): void {
  const manager = useMemo(() => getDegradedModeManager(), []);

  useEffect(() => {
    manager.setSessionExpired(isSessionExpired);
  }, [manager, isSessionExpired]);
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Simple hook to check if a specific action is disabled
 * 
 * @param action - The action to check
 * @returns Whether the action is disabled
 */
export function useIsActionDisabled(action: DisabledAction | string): boolean {
  const { isActionDisabled } = useDegradedMode();
  return isActionDisabled(action);
}

/**
 * Hook to get the current degraded mode
 * 
 * @returns The current degraded mode
 */
export function useDegradedModeType(): DegradedMode {
  const { mode } = useDegradedMode();
  return mode;
}

/**
 * Hook to check if the app is in read-only mode
 * 
 * @returns Whether the app is in read-only mode
 */
export function useIsReadOnly(): boolean {
  const { isReadOnly } = useDegradedMode();
  return isReadOnly;
}
