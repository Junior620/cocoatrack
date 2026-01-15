// CocoaTrack V2 - Offline Fetch React Hook
// Provides offline-aware fetch with toast notifications
// Requirements: REQ-OFF-006

'use client';

import { useCallback, useMemo } from 'react';

import { useAuth } from '@/lib/auth';
import {
  offlineFetch,
  createOfflineFetch,
  wasQueuedOffline,
  type OfflineFetchConfig,
  type OfflineQueuedOperation,
} from './offline-fetch';
import { showOfflineQueuedToast } from './offline-toast';

// ============================================================================
// TYPES
// ============================================================================

export interface UseOfflineFetchOptions {
  /** Whether to show toast on offline queue (default: true) */
  showToast?: boolean;
  /** Custom callback when operation is queued */
  onOfflineQueue?: (operation: OfflineQueuedOperation) => void;
  /** Custom callback on fetch error */
  onFetchError?: (error: Error) => void;
}

export interface UseOfflineFetchReturn {
  /** Offline-aware fetch function */
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /** Check if a response was queued offline */
  wasQueuedOffline: (response: Response) => boolean;
  /** Whether the user is authenticated (required for offline ops) */
  isAuthenticated: boolean;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * React hook that provides an offline-aware fetch function
 * 
 * Usage:
 * ```tsx
 * const { fetch } = useOfflineFetch();
 * 
 * const response = await fetch('/api/deliveries', {
 *   method: 'POST',
 *   body: JSON.stringify(data),
 * });
 * 
 * if (wasQueuedOffline(response)) {
 *   // Operation was queued for later sync
 * }
 * ```
 */
export function useOfflineFetch(options: UseOfflineFetchOptions = {}): UseOfflineFetchReturn {
  const { showToast = true, onOfflineQueue, onFetchError } = options;
  const { user, profile } = useAuth();

  const isAuthenticated = !!user && !!profile;

  // Create the offline fetch configuration
  const config: OfflineFetchConfig | undefined = useMemo(() => {
    if (!user || !profile?.cooperative_id) {
      return undefined;
    }

    return {
      userId: user.id,
      cooperativeId: profile.cooperative_id,
      onOfflineQueue: (operation) => {
        // Show toast notification
        if (showToast) {
          showOfflineQueuedToast();
        }
        // Call custom callback
        if (onOfflineQueue) {
          onOfflineQueue(operation);
        }
      },
      onFetchError,
    };
  }, [user, profile, showToast, onOfflineQueue, onFetchError]);

  // Create the fetch function
  const offlineAwareFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      return offlineFetch(input, init, config);
    },
    [config]
  );

  return {
    fetch: offlineAwareFetch,
    wasQueuedOffline,
    isAuthenticated,
  };
}

/**
 * Creates a standalone offline fetch function (for use outside React)
 * 
 * @param userId - User ID for operation ownership
 * @param cooperativeId - Cooperative ID for data isolation
 * @param options - Additional options
 */
export function createOfflineAwareFetch(
  userId: string,
  cooperativeId: string,
  options: Omit<UseOfflineFetchOptions, 'showToast'> & { showToast?: boolean } = {}
) {
  const { showToast = true, onOfflineQueue, onFetchError } = options;

  const config: OfflineFetchConfig = {
    userId,
    cooperativeId,
    onOfflineQueue: (operation) => {
      if (showToast) {
        showOfflineQueuedToast();
      }
      if (onOfflineQueue) {
        onOfflineQueue(operation);
      }
    },
    onFetchError,
  };

  return createOfflineFetch(config);
}

export default useOfflineFetch;
