/**
 * Offline Detection Utility
 * 
 * Provides utilities for detecting online/offline status and managing
 * offline behavior in the satellite imagery feature.
 * 
 * Requirements: Task 6.3.1, Task 6.3.2
 * - Detect online/offline status
 * - Provide event listeners for status changes
 * - Check network connectivity
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Network status
 */
export type NetworkStatus = 'online' | 'offline' | 'unknown';

/**
 * Callback for network status changes
 */
export type NetworkStatusCallback = (status: NetworkStatus) => void;

// ============================================================================
// Offline Detection
// ============================================================================

/**
 * Check if the browser is currently online
 * 
 * Uses navigator.onLine API which provides basic online/offline detection.
 * Note: This API can have false positives (reports online when there's no
 * actual internet connectivity, only local network).
 * 
 * @returns True if browser reports online status
 * 
 * @example
 * ```typescript
 * if (isOnline()) {
 *   // Fetch fresh data from API
 * } else {
 *   // Use cached data
 * }
 * ```
 */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.onLine === 'undefined') {
    // Server-side or browser doesn't support navigator.onLine
    return true; // Assume online
  }

  return navigator.onLine;
}

/**
 * Check if the browser is currently offline
 * 
 * @returns True if browser reports offline status
 */
export function isOffline(): boolean {
  return !isOnline();
}

/**
 * Get current network status
 * 
 * @returns Current network status
 */
export function getNetworkStatus(): NetworkStatus {
  if (typeof navigator === 'undefined' || typeof navigator.onLine === 'undefined') {
    return 'unknown';
  }

  return navigator.onLine ? 'online' : 'offline';
}

/**
 * Add event listener for online status changes
 * 
 * Registers callbacks that will be invoked when the browser's online status
 * changes. Returns a cleanup function to remove the listeners.
 * 
 * @param callback - Function to call when status changes
 * @returns Cleanup function to remove listeners
 * 
 * @example
 * ```typescript
 * const cleanup = onNetworkStatusChange((status) => {
 *   console.log('Network status changed:', status);
 *   if (status === 'online') {
 *     // Sync queued requests
 *   }
 * });
 * 
 * // Later, remove listeners
 * cleanup();
 * ```
 */
export function onNetworkStatusChange(callback: NetworkStatusCallback): () => void {
  if (typeof window === 'undefined') {
    // Server-side, return no-op cleanup
    return () => {};
  }

  const handleOnline = () => callback('online');
  const handleOffline = () => callback('offline');

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Attempt to verify actual internet connectivity
 * 
 * navigator.onLine can report false positives (online when only connected to
 * local network). This function attempts to verify actual internet connectivity
 * by making a lightweight request to a reliable endpoint.
 * 
 * @param timeoutMs - Request timeout in milliseconds (default 5000)
 * @returns Promise that resolves to true if internet is accessible
 * 
 * @example
 * ```typescript
 * const hasInternet = await verifyInternetConnectivity();
 * if (hasInternet) {
 *   // Proceed with API calls
 * } else {
 *   // Use offline mode
 * }
 * ```
 */
export async function verifyInternetConnectivity(timeoutMs: number = 5000): Promise<boolean> {
  if (typeof fetch === 'undefined') {
    // Fetch not available (server-side or old browser)
    return isOnline();
  }

  try {
    // Use a lightweight endpoint to check connectivity
    // We'll use a HEAD request to minimize data transfer
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch('/api/health', {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-cache',
    });

    clearTimeout(timeoutId);

    return response.ok;
  } catch (error) {
    // Network error or timeout
    return false;
  }
}

/**
 * Wait for online status
 * 
 * Returns a promise that resolves when the browser reports online status.
 * Useful for waiting to retry failed requests.
 * 
 * @param timeoutMs - Maximum time to wait in milliseconds (0 = no timeout)
 * @returns Promise that resolves when online or rejects on timeout
 * 
 * @example
 * ```typescript
 * try {
 *   await waitForOnline(30000); // Wait up to 30 seconds
 *   // Now online, retry request
 *   await fetchData();
 * } catch (error) {
 *   // Timeout - still offline
 *   console.error('Still offline after 30 seconds');
 * }
 * ```
 */
export function waitForOnline(timeoutMs: number = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    // If already online, resolve immediately
    if (isOnline()) {
      resolve();
      return;
    }

    let timeoutId: NodeJS.Timeout | null = null;
    let cleanup: (() => void) | null = null;

    // Set up timeout if specified
    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        if (cleanup) cleanup();
        reject(new Error('Timeout waiting for online status'));
      }, timeoutMs);
    }

    // Listen for online event
    cleanup = onNetworkStatusChange((status) => {
      if (status === 'online') {
        if (timeoutId) clearTimeout(timeoutId);
        if (cleanup) cleanup();
        resolve();
      }
    });
  });
}

// ============================================================================
// Cache Age Utilities
// ============================================================================

/**
 * Check if cached data is stale (older than 30 days)
 * 
 * @param cacheDate - Date when data was cached
 * @param staleDays - Number of days after which data is considered stale (default 30)
 * @returns True if data is stale
 * 
 * @example
 * ```typescript
 * const cachedAt = new Date('2024-01-01');
 * if (isCacheStale(cachedAt)) {
 *   // Show warning about stale data
 * }
 * ```
 */
export function isCacheStale(cacheDate: Date, staleDays: number = 30): boolean {
  const now = new Date();
  const ageMs = now.getTime() - cacheDate.getTime();
  const staleDaysMs = staleDays * 24 * 60 * 60 * 1000;

  return ageMs > staleDaysMs;
}

/**
 * Get human-readable cache age string
 * 
 * Converts cache age to a user-friendly string like "2 days ago" or "3 weeks ago".
 * 
 * @param cacheDate - Date when data was cached
 * @returns Human-readable age string
 * 
 * @example
 * ```typescript
 * const cachedAt = new Date('2024-01-15');
 * const ageStr = getCacheAgeString(cachedAt);
 * // Returns: "5 days ago" (if current date is 2024-01-20)
 * ```
 */
export function getCacheAgeString(cacheDate: Date): string {
  const now = new Date();
  const ageMs = now.getTime() - cacheDate.getTime();

  const seconds = Math.floor(ageMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) {
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }

  if (weeks > 0) {
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }

  if (days > 0) {
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }

  if (hours > 0) {
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }

  if (minutes > 0) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }

  return 'just now';
}

/**
 * Format cache date for display
 * 
 * @param cacheDate - Date when data was cached
 * @returns Formatted date string
 * 
 * @example
 * ```typescript
 * const cachedAt = new Date('2024-01-15T10:30:00Z');
 * const formatted = formatCacheDate(cachedAt);
 * // Returns: "Jan 15, 2024 at 10:30 AM"
 * ```
 */
export function formatCacheDate(cacheDate: Date): string {
  return cacheDate.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
