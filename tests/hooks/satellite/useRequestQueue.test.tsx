/**
 * Tests for useRequestQueue Hook
 * 
 * Tests the React hook for accessing request queue state and operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRequestQueue, usePendingRequestCount } from '@/hooks/satellite/useRequestQueue';
import {
  getRequestQueue,
  resetRequestQueue,
  type RequestQueueService,
} from '@/lib/satellite/services/request-queue.service';

// Mock the request queue service
vi.mock('@/lib/satellite/services/request-queue.service', () => {
  const mockQueue = {
    getStatistics: vi.fn(),
    getAll: vi.fn(),
    getPendingCount: vi.fn(),
    retryAll: vi.fn(),
    clear: vi.fn(),
    remove: vi.fn(),
    on: vi.fn(),
  };

  return {
    getRequestQueue: vi.fn(() => Promise.resolve(mockQueue)),
    resetRequestQueue: vi.fn(),
    RequestQueueService: vi.fn(),
  };
});

describe('useRequestQueue', () => {
  let mockQueue: any;

  beforeEach(() => {
    mockQueue = {
      getStatistics: vi.fn().mockResolvedValue({
        totalRequests: 2,
        pendingRequests: 2,
        failedRequests: 0,
        oldestRequest: new Date(),
        newestRequest: new Date(),
      }),
      getAll: vi.fn().mockResolvedValue([
        {
          id: 'req1',
          url: '/api/test1',
          method: 'GET',
          retryCount: 0,
          maxRetries: 5,
        },
        {
          id: 'req2',
          url: '/api/test2',
          method: 'POST',
          retryCount: 1,
          maxRetries: 5,
        },
      ]),
      getPendingCount: vi.fn().mockResolvedValue(2),
      retryAll: vi.fn().mockResolvedValue({ succeeded: 2, failed: 0, skipped: 0 }),
      clear: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      on: vi.fn().mockReturnValue(() => {}),
    };

    (getRequestQueue as any).mockResolvedValue(mockQueue);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should load queue data on mount', async () => {
    const { result } = renderHook(() => useRequestQueue());

    await waitFor(() => {
      expect(result.current.state.isLoading).toBe(false);
    });

    expect(result.current.state.statistics).toBeTruthy();
    expect(result.current.pendingCount).toBe(2);
    expect(result.current.requests.length).toBe(2);
  });

  it('should provide retry operation', async () => {
    const { result } = renderHook(() => useRequestQueue());

    await waitFor(() => {
      expect(result.current.state.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.operations.retryAll();
    });

    expect(mockQueue.retryAll).toHaveBeenCalled();
  });

  it('should provide clear operation', async () => {
    const { result } = renderHook(() => useRequestQueue());

    await waitFor(() => {
      expect(result.current.state.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.operations.clear();
    });

    expect(mockQueue.clear).toHaveBeenCalled();
  });

  it('should provide remove operation', async () => {
    const { result } = renderHook(() => useRequestQueue());

    await waitFor(() => {
      expect(result.current.state.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.operations.remove('req1');
    });

    expect(mockQueue.remove).toHaveBeenCalledWith('req1');
  });

  it('should handle errors', async () => {
    mockQueue.getStatistics.mockRejectedValue(new Error('Test error'));

    const { result } = renderHook(() => useRequestQueue());

    await waitFor(() => {
      expect(result.current.state.error).toBeTruthy();
    });

    expect(result.current.state.error?.message).toBe('Test error');
  });

  it('should set isRetrying during retry', async () => {
    const { result } = renderHook(() => useRequestQueue());

    await waitFor(() => {
      expect(result.current.state.isLoading).toBe(false);
    });

    // Start retry
    await act(async () => {
      const promise = result.current.operations.retryAll();
      // Wait a bit for state to update
      await new Promise((resolve) => setTimeout(resolve, 0));
      await promise;
    });

    // Should finish retrying
    await waitFor(() => {
      expect(result.current.state.isRetrying).toBe(false);
    });
  });
});

describe('usePendingRequestCount', () => {
  let mockQueue: any;

  beforeEach(() => {
    mockQueue = {
      getPendingCount: vi.fn().mockResolvedValue(3),
      on: vi.fn().mockReturnValue(() => {}),
    };

    (getRequestQueue as any).mockResolvedValue(mockQueue);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return pending count', async () => {
    const { result } = renderHook(() => usePendingRequestCount());

    // Initial value is 0
    expect(result.current).toBe(0);

    await waitFor(() => {
      expect(result.current).toBe(3);
    }, { timeout: 2000 });
  });

  it('should update count when queue events occur', async () => {
    let eventCallback: any;
    mockQueue.on.mockImplementation((eventType: string, callback: any) => {
      if (eventType === 'request-added') {
        eventCallback = callback;
      }
      return () => {};
    });

    const { result } = renderHook(() => usePendingRequestCount());

    await waitFor(() => {
      expect(result.current).toBe(3);
    }, { timeout: 2000 });

    // Simulate request added event
    mockQueue.getPendingCount.mockResolvedValue(4);
    
    await act(async () => {
      eventCallback?.();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    await waitFor(() => {
      expect(result.current).toBe(4);
    }, { timeout: 2000 });
  });
});
