/**
 * Request Queue Service for Offline Support
 * 
 * This service manages a queue of failed API requests when offline and automatically
 * retries them when the browser comes back online. Requests are persisted in IndexedDB
 * to survive page reloads.
 * 
 * Requirements: Task 6.3.4
 * - Queue API requests when offline
 * - Retry queued requests when back online
 * - Persist queue in IndexedDB
 * - Exponential backoff for retry failures
 * - Show pending request count in UI
 * 
 * Features:
 * - Automatic retry on network status change
 * - Manual retry trigger
 * - Request deduplication
 * - Exponential backoff with max attempts
 * - Event emitter for queue state changes
 */

import { isOffline, onNetworkStatusChange } from '../utils/offline-detection';

// ============================================================================
// Constants
// ============================================================================

/**
 * IndexedDB database name for request queue
 */
const QUEUE_DB_NAME = 'CocoaTrackRequestQueue';

/**
 * Current database version
 */
const QUEUE_DB_VERSION = 1;

/**
 * Object store name
 */
const QUEUE_STORE_NAME = 'requests';

/**
 * Maximum retry attempts per request
 */
const MAX_RETRY_ATTEMPTS = 5;

/**
 * Initial retry delay in milliseconds
 */
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Maximum retry delay in milliseconds
 */
const MAX_RETRY_DELAY_MS = 30000;

/**
 * Request timeout in milliseconds
 */
const REQUEST_TIMEOUT_MS = 30000;

// ============================================================================
// Types
// ============================================================================

/**
 * Queued request entry
 */
export interface QueuedRequest {
  id: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers: Record<string, string>;
  body?: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string; // ISO string
  createdAt: string; // ISO string
  lastAttemptAt: string | null; // ISO string
  error: string | null;
  metadata?: {
    parcelleId?: string;
    operation?: string;
    description?: string;
  };
}

/**
 * Queue statistics
 */
export interface QueueStatistics {
  totalRequests: number;
  pendingRequests: number;
  failedRequests: number;
  oldestRequest: Date | null;
  newestRequest: Date | null;
}

/**
 * Queue event types
 */
export type QueueEventType =
  | 'request-added'
  | 'request-completed'
  | 'request-failed'
  | 'request-removed'
  | 'retry-started'
  | 'retry-completed'
  | 'queue-cleared';

/**
 * Queue event callback
 */
export type QueueEventCallback = (event: {
  type: QueueEventType;
  request?: QueuedRequest;
  error?: Error;
}) => void;

// ============================================================================
// RequestQueueService Class
// ============================================================================

/**
 * Service for managing offline request queue
 * 
 * Provides automatic queuing of failed requests when offline and retry logic
 * when the browser comes back online.
 * 
 * @example
 * ```typescript
 * const queue = new RequestQueueService();
 * await queue.initialize();
 * 
 * // Queue a request
 * await queue.enqueue({
 *   url: '/api/satellite/ndvi',
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ parcelleId: '123' }),
 *   metadata: { parcelleId: '123', operation: 'ndvi-calculation' }
 * });
 * 
 * // Listen for queue events
 * queue.on('request-completed', (event) => {
 *   console.log('Request completed:', event.request);
 * });
 * 
 * // Get queue statistics
 * const stats = await queue.getStatistics();
 * console.log(`${stats.pendingRequests} requests pending`);
 * ```
 */
export class RequestQueueService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private networkCleanup: (() => void) | null = null;
  private retryInProgress = false;
  private eventListeners: Map<QueueEventType, Set<QueueEventCallback>> = new Map();

  /**
   * Initialize the request queue service
   * 
   * Creates the IndexedDB database and sets up network status listeners.
   * 
   * @returns Promise that resolves when initialization is complete
   * @throws {Error} If IndexedDB is not supported or initialization fails
   */
  async initialize(): Promise<void> {
    // Return existing initialization promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.db) {
      return Promise.resolve();
    }

    // Check if IndexedDB is supported
    if (!this.isSupported()) {
      throw new Error('IndexedDB is not supported in this browser');
    }

    // Create initialization promise
    this.initPromise = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(QUEUE_DB_NAME, QUEUE_DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open request queue database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.initPromise = null;
        
        // Set up network status listener
        this.setupNetworkListener();
        
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStores(db);
      };
    });

    return this.initPromise;
  }

  /**
   * Check if IndexedDB is supported
   */
  isSupported(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  /**
   * Create object stores during database upgrade
   */
  private createObjectStores(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains(QUEUE_STORE_NAME)) {
      const store = db.createObjectStore(QUEUE_STORE_NAME, {
        keyPath: 'id',
      });

      // Create indexes for efficient querying
      store.createIndex('nextRetryAt', 'nextRetryAt', { unique: false });
      store.createIndex('createdAt', 'createdAt', { unique: false });
      store.createIndex('retryCount', 'retryCount', { unique: false });
    }
  }

  /**
   * Set up network status listener for automatic retry
   */
  private setupNetworkListener(): void {
    this.networkCleanup = onNetworkStatusChange(async (status) => {
      if (status === 'online' && !this.retryInProgress) {
        // Network came back online, retry queued requests
        await this.retryAll();
      }
    });
  }

  /**
   * Ensure database is initialized
   */
  private ensureInitialized(): void {
    if (!this.db) {
      throw new Error('Request queue is not initialized. Call initialize() first.');
    }
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Enqueue a request
   * 
   * Adds a request to the queue for later retry. Automatically deduplicates
   * requests with the same URL and method.
   * 
   * @param request - Request details
   * @returns Promise that resolves with the queued request ID
   */
  async enqueue(request: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: string;
    metadata?: QueuedRequest['metadata'];
  }): Promise<string> {
    this.ensureInitialized();

    // Check for duplicate request
    const existing = await this.findDuplicate(request.url, request.method);
    if (existing) {
      // Return existing request ID instead of creating duplicate
      return existing.id;
    }

    const now = new Date().toISOString();
    const queuedRequest: QueuedRequest = {
      id: this.generateRequestId(),
      url: request.url,
      method: request.method,
      headers: request.headers || {},
      body: request.body,
      retryCount: 0,
      maxRetries: MAX_RETRY_ATTEMPTS,
      nextRetryAt: now,
      createdAt: now,
      lastAttemptAt: null,
      error: null,
      metadata: request.metadata,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE_NAME);
      const addRequest = store.add(queuedRequest);

      addRequest.onsuccess = () => {
        this.emit('request-added', { type: 'request-added', request: queuedRequest });
        resolve(queuedRequest.id);
      };

      addRequest.onerror = () => {
        reject(new Error(`Failed to enqueue request: ${addRequest.error?.message}`));
      };
    });
  }

  /**
   * Find duplicate request in queue
   */
  private async findDuplicate(url: string, method: string): Promise<QueuedRequest | null> {
    const allRequests = await this.getAll();
    return allRequests.find((req) => req.url === url && req.method === method) || null;
  }

  /**
   * Get all queued requests
   */
  async getAll(): Promise<QueuedRequest[]> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE_NAME], 'readonly');
      const store = transaction.objectStore(QUEUE_STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result as QueuedRequest[]);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get all requests: ${request.error?.message}`));
      };
    });
  }

  /**
   * Get a specific queued request by ID
   */
  async get(id: string): Promise<QueuedRequest | null> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE_NAME], 'readonly');
      const store = transaction.objectStore(QUEUE_STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result as QueuedRequest | undefined || null);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get request: ${request.error?.message}`));
      };
    });
  }

  /**
   * Update a queued request
   */
  private async update(request: QueuedRequest): Promise<void> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE_NAME);
      const updateRequest = store.put(request);

      updateRequest.onsuccess = () => resolve();
      updateRequest.onerror = () => {
        reject(new Error(`Failed to update request: ${updateRequest.error?.message}`));
      };
    });
  }

  /**
   * Remove a request from the queue
   */
  async remove(id: string): Promise<void> {
    this.ensureInitialized();

    const request = await this.get(id);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE_NAME);
      const deleteRequest = store.delete(id);

      deleteRequest.onsuccess = () => {
        if (request) {
          this.emit('request-removed', { type: 'request-removed', request });
        }
        resolve();
      };

      deleteRequest.onerror = () => {
        reject(new Error(`Failed to remove request: ${deleteRequest.error?.message}`));
      };
    });
  }

  /**
   * Clear all queued requests
   */
  async clear(): Promise<void> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        this.emit('queue-cleared', { type: 'queue-cleared' });
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to clear queue: ${request.error?.message}`));
      };
    });
  }

  /**
   * Retry all queued requests
   * 
   * Attempts to execute all queued requests. Requests that succeed are removed
   * from the queue. Requests that fail are updated with retry information.
   * 
   * @returns Promise that resolves with retry results
   */
  async retryAll(): Promise<{ succeeded: number; failed: number; skipped: number }> {
    if (this.retryInProgress) {
      return { succeeded: 0, failed: 0, skipped: 0 };
    }

    this.retryInProgress = true;
    this.emit('retry-started', { type: 'retry-started' });

    try {
      const requests = await this.getAll();
      const now = new Date();

      let succeeded = 0;
      let failed = 0;
      let skipped = 0;

      for (const request of requests) {
        // Check if request is ready for retry
        const nextRetryAt = new Date(request.nextRetryAt);
        if (nextRetryAt > now) {
          skipped++;
          continue;
        }

        // Check if max retries exceeded
        if (request.retryCount >= request.maxRetries) {
          skipped++;
          continue;
        }

        // Attempt to execute request
        const success = await this.executeRequest(request);

        if (success) {
          // Remove from queue
          await this.remove(request.id);
          succeeded++;
          this.emit('request-completed', { type: 'request-completed', request });
        } else {
          // Update retry information
          request.retryCount++;
          request.lastAttemptAt = new Date().toISOString();
          
          // Calculate next retry time with exponential backoff
          const delayMs = Math.min(
            INITIAL_RETRY_DELAY_MS * Math.pow(2, request.retryCount),
            MAX_RETRY_DELAY_MS
          );
          request.nextRetryAt = new Date(Date.now() + delayMs).toISOString();

          await this.update(request);
          failed++;
          this.emit('request-failed', { type: 'request-failed', request });
        }
      }

      this.emit('retry-completed', { type: 'retry-completed' });

      return { succeeded, failed, skipped };
    } finally {
      this.retryInProgress = false;
    }
  }

  /**
   * Execute a queued request
   * 
   * @param request - Queued request to execute
   * @returns Promise that resolves to true if successful, false otherwise
   */
  private async executeRequest(request: QueuedRequest): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Consider 2xx and 3xx status codes as success
      return response.ok || (response.status >= 200 && response.status < 400);
    } catch (error) {
      // Network error or timeout
      request.error = error instanceof Error ? error.message : 'Unknown error';
      return false;
    }
  }

  /**
   * Get queue statistics
   */
  async getStatistics(): Promise<QueueStatistics> {
    const requests = await this.getAll();
    const now = new Date();

    const pendingRequests = requests.filter(
      (req) => req.retryCount < req.maxRetries
    ).length;

    const failedRequests = requests.filter(
      (req) => req.retryCount >= req.maxRetries
    ).length;

    const createdDates = requests.map((req) => new Date(req.createdAt));
    const oldestRequest = createdDates.length > 0
      ? new Date(Math.min(...createdDates.map((d) => d.getTime())))
      : null;
    const newestRequest = createdDates.length > 0
      ? new Date(Math.max(...createdDates.map((d) => d.getTime())))
      : null;

    return {
      totalRequests: requests.length,
      pendingRequests,
      failedRequests,
      oldestRequest,
      newestRequest,
    };
  }

  /**
   * Get pending request count
   */
  async getPendingCount(): Promise<number> {
    const stats = await this.getStatistics();
    return stats.pendingRequests;
  }

  /**
   * Register an event listener
   */
  on(eventType: QueueEventType, callback: QueueEventCallback): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }

    this.eventListeners.get(eventType)!.add(callback);

    // Return cleanup function
    return () => {
      this.eventListeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Emit an event to all registered listeners
   */
  private emit(
    eventType: QueueEventType,
    event: { type: QueueEventType; request?: QueuedRequest; error?: Error }
  ): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in queue event listener:', error);
        }
      });
    }
  }

  /**
   * Close the database connection and cleanup
   */
  close(): void {
    if (this.networkCleanup) {
      this.networkCleanup();
      this.networkCleanup = null;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.eventListeners.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of RequestQueueService
 */
let queueInstance: RequestQueueService | null = null;

/**
 * Get the singleton RequestQueueService instance
 * 
 * Automatically initializes the service on first access.
 * 
 * @returns RequestQueueService instance
 * 
 * @example
 * ```typescript
 * const queue = await getRequestQueue();
 * await queue.enqueue({ url: '/api/data', method: 'GET' });
 * ```
 */
export async function getRequestQueue(): Promise<RequestQueueService> {
  if (!queueInstance) {
    queueInstance = new RequestQueueService();
    await queueInstance.initialize();
  }
  return queueInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetRequestQueue(): void {
  if (queueInstance) {
    queueInstance.close();
    queueInstance = null;
  }
}
