/**
 * NDVI Worker Manager
 * 
 * Manages Web Worker lifecycle and provides a clean API for NDVI calculations.
 * Implements batching and queueing for optimal performance.
 * 
 * Features:
 * - Automatic worker creation and cleanup
 * - Request batching for improved throughput
 * - Promise-based API for easy integration
 * - Fallback to synchronous calculation if Web Workers unavailable
 * 
 * Task 6.4.2: Optimize NDVI calculation
 */

// ============================================================================
// Types
// ============================================================================

interface NDVICalculationRequest {
  id: string;
  redBand: number[][];
  nirBand: number[][];
}

interface NDVICalculationResult {
  id: string;
  ndviValues: number[];
  statistics: {
    mean: number;
    min: number;
    max: number;
    stdDev: number;
    validPixelCount: number;
  };
  error?: string;
}

interface PendingRequest {
  request: NDVICalculationRequest;
  resolve: (result: NDVICalculationResult) => void;
  reject: (error: Error) => void;
}

// ============================================================================
// Configuration
// ============================================================================

const BATCH_SIZE = 5; // Maximum number of calculations per batch
const BATCH_DELAY_MS = 50; // Delay before processing batch (allows accumulation)
const WORKER_TIMEOUT_MS = 30000; // 30 seconds timeout for worker operations

// ============================================================================
// NDVIWorkerManager Class
// ============================================================================

/**
 * Manager for NDVI calculation Web Workers
 */
export class NDVIWorkerManager {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestQueue: PendingRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private workerSupported = false;

  constructor() {
    this.workerSupported = this.checkWorkerSupport();
    
    if (this.workerSupported) {
      this.initializeWorker();
    } else {
      console.warn('[NDVI Worker Manager] Web Workers not supported, using fallback');
    }
  }

  /**
   * Check if Web Workers are supported in the current environment
   */
  private checkWorkerSupport(): boolean {
    return typeof Worker !== 'undefined' && typeof window !== 'undefined';
  }

  /**
   * Initialize the Web Worker
   */
  private initializeWorker(): void {
    try {
      // Create worker from the worker file
      this.worker = new Worker(
        new URL('./ndvi-calculator.worker.ts', import.meta.url),
        { type: 'module' }
      );

      // Set up message handler
      this.worker.onmessage = this.handleWorkerMessage.bind(this);

      // Set up error handler
      this.worker.onerror = this.handleWorkerError.bind(this);

      console.log('[NDVI Worker Manager] Worker initialized successfully');
    } catch (error) {
      console.error('[NDVI Worker Manager] Failed to initialize worker:', error);
      this.workerSupported = false;
    }
  }

  /**
   * Handle messages from the worker
   */
  private handleWorkerMessage(event: MessageEvent): void {
    const message = event.data;

    if (message.type === 'single') {
      // Single calculation result
      const result = message.result as NDVICalculationResult;
      this.resolveRequest(result);
    } else if (message.type === 'batch') {
      // Batch calculation results
      const results = message.results as NDVICalculationResult[];
      results.forEach(result => this.resolveRequest(result));
    } else if (message.type === 'error') {
      // Worker error
      console.error('[NDVI Worker Manager] Worker error:', message.error);
      this.rejectAllPending(new Error(message.error));
    }

    this.isProcessing = false;
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error('[NDVI Worker Manager] Worker error event:', error);
    this.rejectAllPending(new Error(error.message));
    this.isProcessing = false;
  }

  /**
   * Resolve a pending request
   */
  private resolveRequest(result: NDVICalculationResult): void {
    const pending = this.pendingRequests.get(result.id);
    
    if (pending) {
      if (result.error) {
        pending.reject(new Error(result.error));
      } else {
        pending.resolve(result);
      }
      this.pendingRequests.delete(result.id);
    }
  }

  /**
   * Reject all pending requests
   */
  private rejectAllPending(error: Error): void {
    this.pendingRequests.forEach(pending => {
      pending.reject(error);
    });
    this.pendingRequests.clear();
    this.requestQueue = [];
  }

  /**
   * Calculate NDVI using the Web Worker
   * 
   * This method queues the calculation request and processes it in a batch
   * for optimal performance. Multiple concurrent requests are automatically
   * batched together.
   * 
   * @param redBand - Red band pixel values (2D array)
   * @param nirBand - NIR band pixel values (2D array)
   * @returns Promise resolving to NDVI calculation result
   */
  async calculateNDVI(
    redBand: number[][],
    nirBand: number[][]
  ): Promise<NDVICalculationResult> {
    // If workers not supported, use fallback
    if (!this.workerSupported || !this.worker) {
      return this.calculateNDVIFallback(redBand, nirBand);
    }

    // Generate unique request ID
    const requestId = `ndvi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create request object
    const request: NDVICalculationRequest = {
      id: requestId,
      redBand,
      nirBand,
    };

    // Create promise for this request
    return new Promise<NDVICalculationResult>((resolve, reject) => {
      const pending: PendingRequest = {
        request,
        resolve,
        reject,
      };

      // Add to pending requests map
      this.pendingRequests.set(requestId, pending);

      // Add to queue
      this.requestQueue.push(pending);

      // Set timeout for this request
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('NDVI calculation timeout'));
        }
      }, WORKER_TIMEOUT_MS);

      // Schedule batch processing
      this.scheduleBatchProcessing();
    });
  }

  /**
   * Schedule batch processing
   * 
   * Uses a timer to accumulate requests before processing them as a batch.
   * This improves throughput by reducing worker communication overhead.
   */
  private scheduleBatchProcessing(): void {
    // Clear existing timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    // If queue is full, process immediately
    if (this.requestQueue.length >= BATCH_SIZE) {
      this.processBatch();
      return;
    }

    // Otherwise, wait for more requests to accumulate
    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, BATCH_DELAY_MS);
  }

  /**
   * Process the current batch of requests
   */
  private processBatch(): void {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    // Take up to BATCH_SIZE requests from the queue
    const batch = this.requestQueue.splice(0, BATCH_SIZE);
    const requests = batch.map(p => p.request);

    // Send batch to worker
    if (this.worker) {
      if (requests.length === 1) {
        // Single request - use single mode
        this.worker.postMessage({
          type: 'single',
          calculation: requests[0],
        });
      } else {
        // Multiple requests - use batch mode
        this.worker.postMessage({
          type: 'batch',
          calculations: requests,
        });
      }
    }

    // If there are more requests in the queue, schedule next batch
    if (this.requestQueue.length > 0) {
      setTimeout(() => {
        this.isProcessing = false;
        this.scheduleBatchProcessing();
      }, 10); // Small delay between batches
    }
  }

  /**
   * Fallback NDVI calculation (synchronous, on main thread)
   * 
   * Used when Web Workers are not available.
   */
  private async calculateNDVIFallback(
    redBand: number[][],
    nirBand: number[][]
  ): Promise<NDVICalculationResult> {
    const requestId = `ndvi-fallback-${Date.now()}`;

    try {
      // Import the synchronous calculation functions
      const { calculatePixelWiseNDVI, calculateStatistics } = await import(
        './ndvi-calculator-sync'
      );

      // Validate input dimensions
      if (redBand.length !== nirBand.length) {
        throw new Error('Red and NIR band dimensions do not match');
      }

      // Calculate NDVI values
      const ndviValues = calculatePixelWiseNDVI(redBand, nirBand);

      // Validate we have sufficient data
      const validPixelCount = ndviValues.filter(v => !isNaN(v)).length;
      if (validPixelCount < 10) {
        throw new Error(
          `Insufficient valid pixels for NDVI calculation. Required: 10, Available: ${validPixelCount}`
        );
      }

      // Calculate statistics
      const statistics = calculateStatistics(ndviValues);

      return {
        id: requestId,
        ndviValues,
        statistics,
      };
    } catch (error) {
      throw error; // Re-throw error instead of returning error object
    }
  }

  /**
   * Terminate the worker and clean up resources
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    this.rejectAllPending(new Error('Worker manager terminated'));
    
    console.log('[NDVI Worker Manager] Worker terminated');
  }

  /**
   * Get the number of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Get the number of queued requests
   */
  getQueuedCount(): number {
    return this.requestQueue.length;
  }

  /**
   * Check if the worker is currently processing
   */
  isWorkerProcessing(): boolean {
    return this.isProcessing;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of NDVIWorkerManager
 * 
 * Use this instance throughout the application for consistent worker management.
 */
export const ndviWorkerManager = new NDVIWorkerManager();

// Clean up worker on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    ndviWorkerManager.terminate();
  });
}
