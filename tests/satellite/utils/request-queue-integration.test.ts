/**
 * Tests for Request Queue Integration Utilities
 * 
 * Tests the integration utilities for queuing failed requests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  queuedFetch,
  queuedGet,
  queuedPost,
  queuedPut,
  queuedDelete,
  isQueued,
  hasData,
  hasError,
  unwrapData,
} from '@/lib/satellite/utils/request-queue-integration';
import * as offlineDetection from '@/lib/satellite/utils/offline-detection';
import * as requestQueueService from '@/lib/satellite/services/request-queue.service';

// Mock dependencies
vi.mock('@/lib/satellite/utils/offline-detection', () => ({
  isOffline: vi.fn(),
}));

vi.mock('@/lib/satellite/services/request-queue.service', () => ({
  getRequestQueue: vi.fn(),
}));

describe('queuedFetch', () => {
  let mockQueue: any;

  beforeEach(() => {
    mockQueue = {
      enqueue: vi.fn().mockResolvedValue('queue-id-123'),
    };

    (requestQueueService.getRequestQueue as any).mockResolvedValue(mockQueue);
    (offlineDetection.isOffline as any).mockReturnValue(false);
    
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return data when request succeeds', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'success' }),
    });

    const result = await queuedFetch('/api/test');

    expect(result.data).toEqual({ result: 'success' });
    expect(result.queued).toBe(false);
    expect(mockQueue.enqueue).not.toHaveBeenCalled();
  });

  it('should queue request when offline and request fails', async () => {
    (offlineDetection.isOffline as any).mockReturnValue(true);
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const result = await queuedFetch('/api/test', {
      method: 'POST',
      body: JSON.stringify({ data: 'test' }),
      queueMetadata: {
        parcelleId: '123',
        operation: 'test-operation',
      },
    });

    expect(result.queued).toBe(true);
    expect(result.queueId).toBe('queue-id-123');
    expect(result.data).toBeNull();
    expect(mockQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/test',
        method: 'POST',
        body: JSON.stringify({ data: 'test' }),
        metadata: {
          parcelleId: '123',
          operation: 'test-operation',
        },
      })
    );
  });

  it('should not queue when autoQueue is false', async () => {
    (offlineDetection.isOffline as any).mockReturnValue(true);
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const result = await queuedFetch('/api/test', {
      autoQueue: false,
    });

    expect(result.queued).toBe(false);
    expect(result.error).toBeTruthy();
    expect(mockQueue.enqueue).not.toHaveBeenCalled();
  });

  it('should return error when online and request fails', async () => {
    (offlineDetection.isOffline as any).mockReturnValue(false);
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await queuedFetch('/api/test');

    expect(result.queued).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it('should handle queue failure', async () => {
    (offlineDetection.isOffline as any).mockReturnValue(true);
    (global.fetch as any).mockRejectedValue(new Error('Network error'));
    mockQueue.enqueue.mockRejectedValue(new Error('Queue error'));

    const result = await queuedFetch('/api/test');

    expect(result.queued).toBe(false);
    expect(result.error?.message).toBe('Queue error');
  });
});

describe('convenience wrappers', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'success' }),
    });

    (offlineDetection.isOffline as any).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('queuedGet should make GET request', async () => {
    await queuedGet('/api/test');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('queuedPost should make POST request with JSON body', async () => {
    await queuedPost('/api/test', { data: 'test' });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ data: 'test' }),
      })
    );
  });

  it('queuedPut should make PUT request with JSON body', async () => {
    await queuedPut('/api/test', { data: 'test' });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ data: 'test' }),
      })
    );
  });

  it('queuedDelete should make DELETE request', async () => {
    await queuedDelete('/api/test');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});

describe('utility functions', () => {
  it('isQueued should return true for queued result', () => {
    const result = { data: null, queued: true, queueId: '123' };
    expect(isQueued(result)).toBe(true);
  });

  it('isQueued should return false for non-queued result', () => {
    const result = { data: { test: 'data' }, queued: false };
    expect(isQueued(result)).toBe(false);
  });

  it('hasData should return true when data exists', () => {
    const result = { data: { test: 'data' }, queued: false };
    expect(hasData(result)).toBe(true);
  });

  it('hasData should return false when data is null', () => {
    const result = { data: null, queued: true };
    expect(hasData(result)).toBe(false);
  });

  it('hasError should return true when error exists', () => {
    const result = { data: null, queued: false, error: new Error('Test') };
    expect(hasError(result)).toBe(true);
  });

  it('hasError should return false when no error', () => {
    const result = { data: { test: 'data' }, queued: false };
    expect(hasError(result)).toBe(false);
  });

  it('unwrapData should return data when available', () => {
    const result = { data: { test: 'data' }, queued: false };
    expect(unwrapData(result)).toEqual({ test: 'data' });
  });

  it('unwrapData should throw when queued', () => {
    const result = { data: null, queued: true };
    expect(() => unwrapData(result)).toThrow('Request was queued for later retry');
  });

  it('unwrapData should throw when error exists', () => {
    const result = { data: null, queued: false, error: new Error('Test error') };
    expect(() => unwrapData(result)).toThrow('Test error');
  });

  it('unwrapData should throw when no data', () => {
    const result = { data: null, queued: false };
    expect(() => unwrapData(result)).toThrow('No data available');
  });
});
