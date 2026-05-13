/**
 * Request Queue Integration Utilities
 * 
 * Provides utilities for integrating the request queue with existing API calls.
 * Automatically queues failed requests when offline.
 * 
 * Requirements: Task 6.3.4
 * - Integrate with existing API calls
 * - Automatically queue failed requests when offline
 * - Provide wrapper functions for common patterns
 */

import { getRequestQueue } from '../services/request-queue.service';
import { isOffline } from './offline-detection';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for queued fetch
 */
export interface QueuedFetchOptions extends RequestInit {
  /**
   * Whether to automatically queue the request if it fails while offline
   * @default true
   */
  autoQueue?: boolean;

  /**
   * Metadata to attach to queued request
   */
  queueMetadata?: {
    parcelleId?: string;
    operation?: string;
    description?: string;
  };
}

/**
 * Result of a queued fetch
 */
export interface QueuedFetchResult<T> {
  /**
   * Response data (null if queued)
   */
  data: T | null;

  /**
   * Whether the request was queued
   */
  queued: boolean;

  /**
   * Queue ID if request was queued
   */
  queueId?: string;

  /**
   * Error if request failed
   */
  error?: Error;
}

// ============================================================================
// Queued Fetch
// ============================================================================

/**
 * Fetch wrapper that automatically queues failed requests when offline
 * 
 * This function wraps the standard fetch API and automatically queues requests
 * that fail while offline. When the browser comes back online, queued requests
 * are automatically retried.
 * 
 * @param url - Request URL
 * @param options - Fetch options with queue configuration
 * @returns Promise that resolves with the result
 * 
 * @example
 * ```typescript
 * const result = await queuedFetch<NDVIResult>('/api/satellite/ndvi', {
 *   method: 'POST',
 *   body: JSON.stringify({ parcelleId: '123' }),
 *   queueMetadata: {
 *     parcelleId: '123',
 *     operation: 'ndvi-calculation',
 *     description: 'Calculate NDVI for parcelle 123'
 *   }
 * });
 * 
 * if (result.queued) {
 *   console.log('Request queued for later retry');
 * } else if (result.data) {
 *   console.log('Request succeeded:', result.data);
 * }
 * ```
 */
export async function queuedFetch<T = unknown>(
  url: string,
  options: QueuedFetchOptions = {}
): Promise<QueuedFetchResult<T>> {
  const {
    autoQueue = true,
    queueMetadata,
    ...fetchOptions
  } = options;

  try {
    // Attempt the request
    const response = await fetch(url, fetchOptions);

    // If successful, return the data
    if (response.ok) {
      const data = await response.json();
      return {
        data: data as T,
        queued: false,
      };
    }

    // If failed and offline, queue the request
    if (autoQueue && isOffline()) {
      const queueId = await queueRequest(url, fetchOptions, queueMetadata);
      return {
        data: null,
        queued: true,
        queueId,
      };
    }

    // If failed but online, throw error
    throw new Error(`Request failed with status ${response.status}`);
  } catch (error) {
    // If network error and offline, queue the request
    if (autoQueue && isOffline()) {
      try {
        const queueId = await queueRequest(url, fetchOptions, queueMetadata);
        return {
          data: null,
          queued: true,
          queueId,
        };
      } catch (queueError) {
        // Failed to queue, return error
        return {
          data: null,
          queued: false,
          error: queueError instanceof Error ? queueError : new Error('Failed to queue request'),
        };
      }
    }

    // If online or auto-queue disabled, return error
    return {
      data: null,
      queued: false,
      error: error instanceof Error ? error : new Error('Request failed'),
    };
  }
}

/**
 * Queue a request for later retry
 * 
 * @param url - Request URL
 * @param options - Fetch options
 * @param metadata - Queue metadata
 * @returns Promise that resolves with the queue ID
 */
async function queueRequest(
  url: string,
  options: RequestInit,
  metadata?: QueuedFetchOptions['queueMetadata']
): Promise<string> {
  const queue = await getRequestQueue();

  // Extract method and headers
  const method = (options.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  const headers: Record<string, string> = {};

  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      Object.entries(options.headers).forEach(([key, value]) => {
        if (value !== undefined) {
          headers[key] = String(value);
        }
      });
    }
  }

  // Extract body
  let body: string | undefined;
  if (options.body) {
    if (typeof options.body === 'string') {
      body = options.body;
    } else if (options.body instanceof FormData) {
      // Convert FormData to JSON (simplified)
      const formDataObj: Record<string, unknown> = {};
      options.body.forEach((value, key) => {
        formDataObj[key] = value;
      });
      body = JSON.stringify(formDataObj);
    } else {
      body = JSON.stringify(options.body);
    }
  }

  // Enqueue the request
  return queue.enqueue({
    url,
    method,
    headers,
    body,
    metadata,
  });
}

// ============================================================================
// Convenience Wrappers
// ============================================================================

/**
 * Queued GET request
 * 
 * @param url - Request URL
 * @param options - Fetch options
 * @returns Promise that resolves with the result
 * 
 * @example
 * ```typescript
 * const result = await queuedGet<ImageryData>('/api/satellite/imagery/123');
 * ```
 */
export async function queuedGet<T = unknown>(
  url: string,
  options: Omit<QueuedFetchOptions, 'method'> = {}
): Promise<QueuedFetchResult<T>> {
  return queuedFetch<T>(url, { ...options, method: 'GET' });
}

/**
 * Queued POST request
 * 
 * @param url - Request URL
 * @param data - Request body data
 * @param options - Fetch options
 * @returns Promise that resolves with the result
 * 
 * @example
 * ```typescript
 * const result = await queuedPost<NDVIResult>('/api/satellite/ndvi', {
 *   parcelleId: '123',
 *   date: new Date()
 * }, {
 *   queueMetadata: {
 *     parcelleId: '123',
 *     operation: 'ndvi-calculation'
 *   }
 * });
 * ```
 */
export async function queuedPost<T = unknown>(
  url: string,
  data: unknown,
  options: Omit<QueuedFetchOptions, 'method' | 'body'> = {}
): Promise<QueuedFetchResult<T>> {
  return queuedFetch<T>(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(data),
  });
}

/**
 * Queued PUT request
 * 
 * @param url - Request URL
 * @param data - Request body data
 * @param options - Fetch options
 * @returns Promise that resolves with the result
 */
export async function queuedPut<T = unknown>(
  url: string,
  data: unknown,
  options: Omit<QueuedFetchOptions, 'method' | 'body'> = {}
): Promise<QueuedFetchResult<T>> {
  return queuedFetch<T>(url, {
    ...options,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(data),
  });
}

/**
 * Queued DELETE request
 * 
 * @param url - Request URL
 * @param options - Fetch options
 * @returns Promise that resolves with the result
 */
export async function queuedDelete<T = unknown>(
  url: string,
  options: Omit<QueuedFetchOptions, 'method'> = {}
): Promise<QueuedFetchResult<T>> {
  return queuedFetch<T>(url, { ...options, method: 'DELETE' });
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Check if a fetch result was queued
 * 
 * @param result - Fetch result
 * @returns True if the request was queued
 */
export function isQueued<T>(result: QueuedFetchResult<T>): boolean {
  return result.queued;
}

/**
 * Check if a fetch result has data
 * 
 * @param result - Fetch result
 * @returns True if the result has data
 */
export function hasData<T>(result: QueuedFetchResult<T>): result is QueuedFetchResult<T> & { data: T } {
  return result.data !== null;
}

/**
 * Check if a fetch result has an error
 * 
 * @param result - Fetch result
 * @returns True if the result has an error
 */
export function hasError<T>(result: QueuedFetchResult<T>): result is QueuedFetchResult<T> & { error: Error } {
  return result.error !== undefined;
}

/**
 * Get data from fetch result or throw error
 * 
 * @param result - Fetch result
 * @returns Data from the result
 * @throws {Error} If result was queued or has an error
 */
export function unwrapData<T>(result: QueuedFetchResult<T>): T {
  if (result.queued) {
    throw new Error('Request was queued for later retry');
  }

  if (result.error) {
    throw result.error;
  }

  if (result.data === null) {
    throw new Error('No data available');
  }

  return result.data;
}
