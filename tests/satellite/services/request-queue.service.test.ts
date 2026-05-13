/**
 * Tests for Request Queue Service
 * 
 * Tests the request queue service functionality including:
 * - Queue initialization
 * - Request enqueueing and dequeuing
 * - Retry logic with exponential backoff
 * - Event emission
 * - Statistics tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RequestQueueService,
  getRequestQueue,
  resetRequestQueue,
  type QueuedRequest,
} from '@/lib/satellite/services/request-queue.service';

// Mock IndexedDB
const mockIndexedDB = () => {
  const stores = new Map<string, Map<string, unknown>>();

  const mockObjectStore = (storeName: string, mode: IDBTransactionMode) => {
    if (!stores.has(storeName)) {
      stores.set(storeName, new Map());
    }

    const store = stores.get(storeName)!;

    return {
      add: (value: unknown) => {
        const request = {
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
          error: null,
        };

        setTimeout(() => {
          const key = (value as { id: string }).id;
          store.set(key, value);
          request.onsuccess?.();
        }, 0);

        return request;
      },
      put: (value: unknown) => {
        const request = {
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
          error: null,
        };

        setTimeout(() => {
          const key = (value as { id: string }).id;
          store.set(key, value);
          request.onsuccess?.();
        }, 0);

        return request;
      },
      get: (key: string) => {
        const request = {
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
          result: store.get(key),
          error: null,
        };

        setTimeout(() => {
          request.onsuccess?.();
        }, 0);

        return request;
      },
      getAll: () => {
        const request = {
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
          result: Array.from(store.values()),
          error: null,
        };

        setTimeout(() => {
          request.onsuccess?.();
        }, 0);

        return request;
      },
      delete: (key: string) => {
        const request = {
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
          error: null,
        };

        setTimeout(() => {
          store.delete(key);
          request.onsuccess?.();
        }, 0);

        return request;
      },
      clear: () => {
        const request = {
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
          error: null,
        };

        setTimeout(() => {
          store.clear();
          request.onsuccess?.();
        }, 0);

        return request;
      },
      createIndex: () => {},
      index: () => ({
        get: () => ({
          onsuccess: null,
          onerror: null,
          result: undefined,
        }),
      }),
    };
  };

  const mockTransaction = (storeNames: string[], mode: IDBTransactionMode) => {
    return {
      objectStore: (name: string) => mockObjectStore(name, mode),
    };
  };

  const mockDB = {
    transaction: mockTransaction,
    objectStoreNames: {
      contains: () => false,
    },
    createObjectStore: (name: string) => {
      stores.set(name, new Map());
      return mockObjectStore(name, 'readwrite');
    },
    close: () => {},
  };

  global.indexedDB = {
    open: (name: string, version: number) => {
      const request = {
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onupgradeneeded: null as ((event: { target: { result: typeof mockDB } }) => void) | null,
        result: mockDB,
        error: null,
      };

      setTimeout(() => {
        request.onupgradeneeded?.({ target: { result: mockDB } });
        request.onsuccess?.();
      }, 0);

      return request;
    },
  } as unknown as IDBFactory;

  return { stores, mockDB };
};

describe('RequestQueueService', () => {
  let service: RequestQueueService;
  let mockDB: ReturnType<typeof mockIndexedDB>;

  beforeEach(async () => {
    mockDB = mockIndexedDB();
    service = new RequestQueueService();
    await service.initialize();
  });

  afterEach(() => {
    service.close();
    resetRequestQueue();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      expect(service.isSupported()).toBe(true);
    });

    it('should be idempotent', async () => {
      await service.initialize();
      await service.initialize();
      // Should not throw
    });
  });

  describe('enqueue', () => {
    it('should enqueue a request', async () => {
      const id = await service.enqueue({
        url: '/api/test',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(id).toBeTruthy();
      expect(id).toMatch(/^req_/);
    });

    it('should enqueue a POST request with body', async () => {
      const id = await service.enqueue({
        url: '/api/test',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' }),
        metadata: {
          parcelleId: '123',
          operation: 'test-operation',
        },
      });

      const request = await service.get(id);
      expect(request).toBeTruthy();
      expect(request?.method).toBe('POST');
      expect(request?.body).toBe(JSON.stringify({ data: 'test' }));
      expect(request?.metadata?.parcelleId).toBe('123');
    });

    it('should not create duplicate requests', async () => {
      const id1 = await service.enqueue({
        url: '/api/test',
        method: 'GET',
      });

      const id2 = await service.enqueue({
        url: '/api/test',
        method: 'GET',
      });

      expect(id1).toBe(id2);

      const requests = await service.getAll();
      expect(requests.length).toBe(1);
    });

    it('should emit request-added event', async () => {
      const callback = vi.fn();
      service.on('request-added', callback);

      await service.enqueue({
        url: '/api/test',
        method: 'GET',
      });

      // Wait for event
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'request-added',
          request: expect.objectContaining({
            url: '/api/test',
            method: 'GET',
          }),
        })
      );
    });
  });

  describe('getAll', () => {
    it('should return empty array when no requests', async () => {
      const requests = await service.getAll();
      expect(requests).toEqual([]);
    });

    it('should return all queued requests', async () => {
      await service.enqueue({ url: '/api/test1', method: 'GET' });
      await service.enqueue({ url: '/api/test2', method: 'POST' });

      const requests = await service.getAll();
      expect(requests.length).toBe(2);
    });
  });

  describe('get', () => {
    it('should return null for non-existent request', async () => {
      const request = await service.get('non-existent');
      expect(request).toBeNull();
    });

    it('should return request by ID', async () => {
      const id = await service.enqueue({
        url: '/api/test',
        method: 'GET',
      });

      const request = await service.get(id);
      expect(request).toBeTruthy();
      expect(request?.id).toBe(id);
      expect(request?.url).toBe('/api/test');
    });
  });

  describe('remove', () => {
    it('should remove a request', async () => {
      const id = await service.enqueue({
        url: '/api/test',
        method: 'GET',
      });

      await service.remove(id);

      const request = await service.get(id);
      expect(request).toBeNull();
    });

    it('should emit request-removed event', async () => {
      const callback = vi.fn();
      service.on('request-removed', callback);

      const id = await service.enqueue({
        url: '/api/test',
        method: 'GET',
      });

      await service.remove(id);

      // Wait for event
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'request-removed',
        })
      );
    });
  });

  describe('clear', () => {
    it('should clear all requests', async () => {
      await service.enqueue({ url: '/api/test1', method: 'GET' });
      await service.enqueue({ url: '/api/test2', method: 'POST' });

      await service.clear();

      const requests = await service.getAll();
      expect(requests.length).toBe(0);
    });

    it('should emit queue-cleared event', async () => {
      const callback = vi.fn();
      service.on('queue-cleared', callback);

      await service.clear();

      // Wait for event
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'queue-cleared',
        })
      );
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', async () => {
      await service.enqueue({ url: '/api/test1', method: 'GET' });
      await service.enqueue({ url: '/api/test2', method: 'POST' });

      const stats = await service.getStatistics();

      expect(stats.totalRequests).toBe(2);
      expect(stats.pendingRequests).toBe(2);
      expect(stats.failedRequests).toBe(0);
      expect(stats.oldestRequest).toBeInstanceOf(Date);
      expect(stats.newestRequest).toBeInstanceOf(Date);
    });

    it('should count failed requests correctly', async () => {
      const id = await service.enqueue({ url: '/api/test', method: 'GET' });
      
      // Manually update request to exceed max retries
      const request = await service.get(id);
      if (request) {
        request.retryCount = request.maxRetries;
        await (service as any).update(request);
      }

      const stats = await service.getStatistics();
      expect(stats.failedRequests).toBe(1);
      expect(stats.pendingRequests).toBe(0);
    });
  });

  describe('getPendingCount', () => {
    it('should return pending count', async () => {
      await service.enqueue({ url: '/api/test1', method: 'GET' });
      await service.enqueue({ url: '/api/test2', method: 'POST' });

      const count = await service.getPendingCount();
      expect(count).toBe(2);
    });
  });

  describe('retryAll', () => {
    beforeEach(() => {
      // Mock fetch
      global.fetch = vi.fn();
    });

    it('should retry all pending requests', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
      });

      await service.enqueue({ url: '/api/test1', method: 'GET' });
      await service.enqueue({ url: '/api/test2', method: 'POST' });

      const result = await service.retryAll();

      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);

      const requests = await service.getAll();
      expect(requests.length).toBe(0);
    });

    it('should handle failed retries', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await service.enqueue({ url: '/api/test', method: 'GET' });

      const result = await service.retryAll();

      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);

      const requests = await service.getAll();
      expect(requests.length).toBe(1);
      expect(requests[0].retryCount).toBe(1);
    });

    it('should skip requests not ready for retry', async () => {
      const id = await service.enqueue({ url: '/api/test', method: 'GET' });
      
      // Set next retry time to future
      const request = await service.get(id);
      if (request) {
        request.nextRetryAt = new Date(Date.now() + 10000).toISOString();
        await (service as any).update(request);
      }

      const result = await service.retryAll();

      expect(result.skipped).toBe(1);
    });

    it('should emit retry events', async () => {
      const startCallback = vi.fn();
      const completedCallback = vi.fn();

      service.on('retry-started', startCallback);
      service.on('retry-completed', completedCallback);

      (global.fetch as any).mockResolvedValue({ ok: true });

      await service.enqueue({ url: '/api/test', method: 'GET' });
      await service.retryAll();

      // Wait for events
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(startCallback).toHaveBeenCalled();
      expect(completedCallback).toHaveBeenCalled();
    });
  });

  describe('event listeners', () => {
    it('should register and call event listeners', async () => {
      const callback = vi.fn();
      const cleanup = service.on('request-added', callback);

      await service.enqueue({ url: '/api/test', method: 'GET' });

      // Wait for event
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).toHaveBeenCalled();

      // Cleanup should remove listener
      cleanup();
      callback.mockClear();

      await service.enqueue({ url: '/api/test2', method: 'GET' });
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(callback).not.toHaveBeenCalled();
    });
  });
});

describe('getRequestQueue singleton', () => {
  beforeEach(() => {
    mockIndexedDB();
    resetRequestQueue();
  });

  it('should return the same instance', async () => {
    const queue1 = await getRequestQueue();
    const queue2 = await getRequestQueue();

    expect(queue1).toBe(queue2);
  });

  it('should initialize on first access', async () => {
    const queue = await getRequestQueue();
    expect(queue.isSupported()).toBe(true);
  });
});
