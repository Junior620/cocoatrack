// CocoaTrack V2 - iOS Data Integrity Hook
// React hook for checking iOS data integrity on app start
// Requirements: REQ-IOS-002

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

import {
  checkDataIntegrity,
  checkIntegrityIfNeeded,
  getLastIntegrityCheckResult,
  clearIntegrityCheckResult,
  type DetailedIntegrityResult,
  type UseIOSDataIntegrityState,
  type UseIOSDataIntegrityReturn,
} from './ios-data-integrity';
import { detectIOS, recordActivity } from './ios-manager';

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * React hook for iOS data integrity checking
 * REQ-IOS-002: Check IndexedDB on app start after 7 days inactivity
 * 
 * @param options - Hook options
 * @returns Hook state and actions
 */
export function useIOSDataIntegrity(options: {
  /** Whether to check automatically on mount */
  autoCheck?: boolean;
  /** Callback when data is detected as purged */
  onDataPurged?: (result: DetailedIntegrityResult) => void;
} = {}): UseIOSDataIntegrityReturn {
  const { autoCheck = true, onDataPurged } = options;

  const [state, setState] = useState<UseIOSDataIntegrityState>({
    isChecking: false,
    result: null,
    needsRedownload: false,
    error: null,
  });

  const hasCheckedRef = useRef(false);
  const onDataPurgedRef = useRef(onDataPurged);

  // Keep callback ref updated
  useEffect(() => {
    onDataPurgedRef.current = onDataPurged;
  }, [onDataPurged]);

  // Check integrity on mount (if on iOS and auto-check enabled)
  useEffect(() => {
    if (!autoCheck || hasCheckedRef.current) {
      return;
    }

    const detection = detectIOS();
    if (!detection.isIOS) {
      // Not on iOS, just record activity
      recordActivity();
      return;
    }

    hasCheckedRef.current = true;

    // Check if we have a recent result
    const lastResult = getLastIntegrityCheckResult();
    if (lastResult) {
      setState({
        isChecking: false,
        result: lastResult,
        needsRedownload: !lastResult.isIntact,
        error: null,
      });

      // If data was purged, call callback
      if (!lastResult.isIntact && onDataPurgedRef.current) {
        onDataPurgedRef.current(lastResult);
      }
      return;
    }

    // Perform check
    setState(prev => ({ ...prev, isChecking: true }));

    checkIntegrityIfNeeded((result) => {
      if (onDataPurgedRef.current) {
        onDataPurgedRef.current(result);
      }
    })
      .then((result) => {
        if (result) {
          setState({
            isChecking: false,
            result,
            needsRedownload: !result.isIntact,
            error: null,
          });
        } else {
          // Check was not needed
          setState(prev => ({ ...prev, isChecking: false }));
        }
      })
      .catch((error) => {
        setState({
          isChecking: false,
          result: null,
          needsRedownload: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
  }, [autoCheck]);

  // Manual check function
  const checkNow = useCallback(async (): Promise<DetailedIntegrityResult> => {
    setState(prev => ({ ...prev, isChecking: true, error: null }));

    try {
      const result = await checkDataIntegrity();
      
      setState({
        isChecking: false,
        result,
        needsRedownload: !result.isIntact,
        error: null,
      });

      if (!result.isIntact && onDataPurgedRef.current) {
        onDataPurgedRef.current(result);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isChecking: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  // Dismiss warning (clear the needs redownload state)
  const dismissWarning = useCallback(() => {
    setState(prev => ({ ...prev, needsRedownload: false }));
    clearIntegrityCheckResult();
  }, []);

  return {
    ...state,
    checkNow,
    dismissWarning,
  };
}

export default useIOSDataIntegrity;
