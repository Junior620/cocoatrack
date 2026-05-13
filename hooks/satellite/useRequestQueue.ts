/**
 * React Hook for Request Queue
 * 
 * Provides access to the request queue state and operations in React components.
 * Automatically updates when queue state changes.
 * 
 * Requirements: Task 6.3.4
 * - Access queue state in React components
 * - Get pending request count
 * - Manually trigger retry
 * - Listen for queue events
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getRequestQueue,
  type QueueStatistics,
  type QueuedRequest,
  type QueueEventType,
} from '@/lib/satellite/services/request-queue.service';

// ============================================================================
// Types
// ============================================================================

/**
 * Request queue state
 */
export interface RequestQueueState {
  statistics: QueueStatistics | null;
  isRetrying: boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Request queue operations
 */
export interface RequestQueueOperations {
  retryAll: () => Promise<void>;
  clear: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook return value
 */
export interface UseRequestQueueReturn {
  state: RequestQueueState;
  operations: RequestQueueOperations;
  pendingCount: number;
  requests: QueuedRequest[];
}

// ============================================================================
// Hook
// ============================================================================

/**
 * React hook for accessing request queue
 * 
 * Provides real-time access to queue state and operations. Automatically
 * updates when queue events occur.
 * 
 * @returns Request queue state and operations
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { state, operations, pendingCount } = useRequestQueue();
 * 
 *   return (
 *     <div>
 *       <p>Pending requests: {pendingCount}</p>
 *       {state.isRetrying && <p>Retrying...</p>}
 *       <button onClick={operations.retryAll}>Retry All</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useRequestQueue(): UseRequestQueueReturn {
  const [state, setState] = useState<RequestQueueState>({
    statistics: null,
    isRetrying: false,
    isLoading: true,
    error: null,
  });

  const [requests, setRequests] = useState<QueuedRequest[]>([]);

  /**
   * Load queue statistics and requests
   */
  const loadQueueData = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const queue = await getRequestQueue();
      const [statistics, allRequests] = await Promise.all([
        queue.getStatistics(),
        queue.getAll(),
      ]);

      setState((prev) => ({
        ...prev,
        statistics,
        isLoading: false,
      }));

      setRequests(allRequests);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Failed to load queue data'),
        isLoading: false,
      }));
    }
  }, []);

  /**
   * Retry all queued requests
   */
  const retryAll = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isRetrying: true, error: null }));

      const queue = await getRequestQueue();
      await queue.retryAll();

      // Reload queue data after retry
      await loadQueueData();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Failed to retry requests'),
      }));
    } finally {
      setState((prev) => ({ ...prev, isRetrying: false }));
    }
  }, [loadQueueData]);

  /**
   * Clear all queued requests
   */
  const clear = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, error: null }));

      const queue = await getRequestQueue();
      await queue.clear();

      // Reload queue data after clear
      await loadQueueData();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Failed to clear queue'),
      }));
    }
  }, [loadQueueData]);

  /**
   * Remove a specific request from the queue
   */
  const remove = useCallback(
    async (id: string) => {
      try {
        setState((prev) => ({ ...prev, error: null }));

        const queue = await getRequestQueue();
        await queue.remove(id);

        // Reload queue data after removal
        await loadQueueData();
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error : new Error('Failed to remove request'),
        }));
      }
    },
    [loadQueueData]
  );

  /**
   * Refresh queue data
   */
  const refresh = useCallback(async () => {
    await loadQueueData();
  }, [loadQueueData]);

  /**
   * Set up queue event listeners
   */
  useEffect(() => {
    let mounted = true;
    const cleanupFunctions: (() => void)[] = [];

    const setupListeners = async () => {
      try {
        const queue = await getRequestQueue();

        // Listen for queue events and reload data
        const eventTypes: QueueEventType[] = [
          'request-added',
          'request-completed',
          'request-failed',
          'request-removed',
          'queue-cleared',
        ];

        eventTypes.forEach((eventType) => {
          const cleanup = queue.on(eventType, () => {
            if (mounted) {
              loadQueueData();
            }
          });
          cleanupFunctions.push(cleanup);
        });

        // Listen for retry events
        const retryStartedCleanup = queue.on('retry-started', () => {
          if (mounted) {
            setState((prev) => ({ ...prev, isRetrying: true }));
          }
        });
        cleanupFunctions.push(retryStartedCleanup);

        const retryCompletedCleanup = queue.on('retry-completed', () => {
          if (mounted) {
            setState((prev) => ({ ...prev, isRetrying: false }));
          }
        });
        cleanupFunctions.push(retryCompletedCleanup);
      } catch (error) {
        if (mounted) {
          setState((prev) => ({
            ...prev,
            error: error instanceof Error ? error : new Error('Failed to setup listeners'),
            isLoading: false,
          }));
        }
      }
    };

    setupListeners();

    // Initial load
    loadQueueData();

    return () => {
      mounted = false;
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [loadQueueData]);

  const pendingCount = state.statistics?.pendingRequests || 0;

  return {
    state,
    operations: {
      retryAll,
      clear,
      remove,
      refresh,
    },
    pendingCount,
    requests,
  };
}

/**
 * Hook for getting only the pending request count
 * 
 * Lightweight version that only tracks the pending count without loading
 * full queue data. Useful for displaying a simple indicator.
 * 
 * @returns Pending request count
 * 
 * @example
 * ```typescript
 * function RequestBadge() {
 *   const count = usePendingRequestCount();
 *   
 *   if (count === 0) return null;
 *   
 *   return <Badge>{count}</Badge>;
 * }
 * ```
 */
export function usePendingRequestCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const cleanupFunctions: (() => void)[] = [];

    const updateCount = async () => {
      try {
        const queue = await getRequestQueue();
        const pendingCount = await queue.getPendingCount();
        
        if (mounted) {
          setCount(pendingCount);
        }
      } catch (error) {
        console.error('Failed to get pending count:', error);
      }
    };

    const setupListeners = async () => {
      try {
        const queue = await getRequestQueue();

        // Listen for queue events that affect count
        const eventTypes: QueueEventType[] = [
          'request-added',
          'request-completed',
          'request-removed',
          'queue-cleared',
        ];

        eventTypes.forEach((eventType) => {
          const cleanup = queue.on(eventType, () => {
            if (mounted) {
              updateCount();
            }
          });
          cleanupFunctions.push(cleanup);
        });
      } catch (error) {
        console.error('Failed to setup listeners:', error);
      }
    };

    setupListeners();
    updateCount();

    return () => {
      mounted = false;
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, []);

  return count;
}
