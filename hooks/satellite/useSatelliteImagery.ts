/**
 * useSatelliteImagery Hook
 * 
 * Manages satellite imagery fetching state for a single parcelle.
 * Provides loading, error, and data states with cache management.
 * Supports offline mode by falling back to IndexedDB cache.
 * 
 * Requirements: Task 2.5.2, Task 6.3.2
 */

import { useState, useEffect, useCallback } from 'react';
import type { ImageryData } from '@/lib/satellite/types';
import { getIndexedDBCache } from '@/lib/satellite/cache/indexeddb-cache';
import { isOnline, isOffline, onNetworkStatusChange, isCacheStale } from '@/lib/satellite/utils/offline-detection';

// ============================================================================
// Types
// ============================================================================

/**
 * Hook options
 */
export interface UseSatelliteImageryOptions {
  /** Parcelle ID to fetch imagery for */
  parcelleId: string;
  /** Optional date for imagery retrieval (defaults to most recent) */
  date?: Date;
  /** Maximum acceptable cloud cover percentage (0-100, defaults to 20) */
  cloudCoverThreshold?: number;
  /** Number of days to offset from current date when no date is specified */
  daysOffset?: number;
  /** Whether to automatically fetch imagery on mount and when dependencies change */
  autoFetch?: boolean;
}

/**
 * Hook return value
 */
export interface UseSatelliteImageryReturn {
  /** Satellite imagery data (null if not yet fetched) */
  imagery: ImageryData | null;
  /** Whether imagery fetching is in progress */
  loading: boolean;
  /** Error message (null if no error) */
  error: string | null;
  /** Manually trigger imagery fetch */
  refetch: () => Promise<void>;
  /** Cloud cover percentage of the retrieved imagery */
  cloudCover: number | null;
  /** Acquisition date of the retrieved imagery */
  acquisitionDate: Date | null;
  /** Whether the result was served from cache */
  cached: boolean;
  /** Age of cached data in milliseconds (null if not cached) */
  cacheAge: number | null;
  /** Whether currently offline */
  offline: boolean;
  /** Whether cached data is stale (>30 days old) */
  isStale: boolean;
  /** Date when data was cached (null if not cached) */
  cachedAt: Date | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * useSatelliteImagery Hook
 * 
 * Fetches satellite imagery for a parcelle with automatic or manual triggering.
 * Includes cache management and cloud cover filtering.
 * 
 * @example
 * ```tsx
 * // Automatic fetch on mount
 * const { imagery, loading, cloudCover } = useSatelliteImagery({
 *   parcelleId: 'abc-123',
 *   autoFetch: true,
 * });
 * 
 * // Manual fetch with custom cloud cover threshold
 * const { imagery, loading, refetch } = useSatelliteImagery({
 *   parcelleId: 'abc-123',
 *   cloudCoverThreshold: 15,
 *   autoFetch: false,
 * });
 * 
 * // Trigger fetch manually
 * await refetch();
 * 
 * // Fetch imagery for specific date
 * const { imagery, loading } = useSatelliteImagery({
 *   parcelleId: 'abc-123',
 *   date: new Date('2024-01-15'),
 *   autoFetch: true,
 * });
 * ```
 */
export function useSatelliteImagery({
  parcelleId,
  date,
  cloudCoverThreshold = 20,
  daysOffset = 30,
  autoFetch = false,
}: UseSatelliteImageryOptions): UseSatelliteImageryReturn {
  // State management
  const [imagery, setImagery] = useState<ImageryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [offline, setOffline] = useState(isOffline());
  const [cachedAt, setCachedAt] = useState<Date | null>(null);

  /**
   * Monitor online/offline status
   */
  useEffect(() => {
    // Set initial status
    setOffline(isOffline());

    // Listen for status changes
    const cleanup = onNetworkStatusChange((status) => {
      setOffline(status === 'offline');
    });

    return cleanup;
  }, []);

  /**
   * Try to load imagery from IndexedDB cache
   */
  const loadFromCache = useCallback(async (): Promise<ImageryData | null> => {
    if (!parcelleId || !date) {
      return null;
    }

    try {
      const cache = await getIndexedDBCache();
      const cachedImagery = await cache.getImagery(parcelleId, date);

      if (cachedImagery) {
        console.log(`[useSatelliteImagery] Loaded imagery from IndexedDB cache for parcelle ${parcelleId}`);
        return cachedImagery;
      }

      return null;
    } catch (err) {
      console.error('[useSatelliteImagery] Failed to load from cache:', err);
      return null;
    }
  }, [parcelleId, date]);

  /**
   * Store imagery in IndexedDB cache
   */
  const storeInCache = useCallback(async (imageryData: ImageryData): Promise<void> => {
    try {
      const cache = await getIndexedDBCache();
      await cache.storeImagery(imageryData);
      console.log(`[useSatelliteImagery] Stored imagery in IndexedDB cache for parcelle ${imageryData.parcelleId}`);
    } catch (err) {
      console.error('[useSatelliteImagery] Failed to store in cache:', err);
      // Don't throw - caching failure shouldn't break the flow
    }
  }, []);

  /**
   * Fetch satellite imagery by calling the API endpoint
   */
  const refetch = useCallback(async () => {
    // Validate parcelleId
    if (!parcelleId) {
      setError('Parcelle ID is required');
      return;
    }

    setLoading(true);
    setError(null);

    // If offline, try to load from IndexedDB cache
    if (offline) {
      console.log('[useSatelliteImagery] Offline mode - loading from cache');
      
      const cachedImagery = await loadFromCache();
      
      if (cachedImagery) {
        setImagery(cachedImagery);
        setCached(true);
        setCachedAt(cachedImagery.createdAt);
        
        // Calculate cache age
        const now = new Date();
        const age = now.getTime() - cachedImagery.createdAt.getTime();
        setCacheAge(age);
        
        setError(null);
      } else {
        setError('No cached imagery available. Please connect to the internet to load satellite data.');
        setImagery(null);
        setCached(false);
        setCacheAge(null);
        setCachedAt(null);
      }
      
      setLoading(false);
      return;
    }

    // Online mode - fetch from API
    try {
      // Build query parameters
      const params = new URLSearchParams({
        parcelleId,
        cloudCoverThreshold: cloudCoverThreshold.toString(),
        daysOffset: daysOffset.toString(),
      });

      // Add date if provided
      if (date) {
        params.append('date', date.toISOString());
      }

      // Call satellite imagery API
      const response = await fetch(`/api/satellite/imagery?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.message || `Failed to fetch satellite imagery: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      // Parse response
      const result = await response.json();

      if (!result.imagery) {
        throw new Error('Invalid response format from imagery API');
      }

      // Extract data from response
      const { imagery: imageryResult, cached: isCached, cacheAge: age } = result;

      // Convert date strings to Date objects
      const processedImagery: ImageryData = {
        ...imageryResult,
        acquisitionDate: new Date(imageryResult.acquisitionDate),
        createdAt: new Date(imageryResult.createdAt),
      };

      // Update state
      setImagery(processedImagery);
      setCached(isCached || false);
      setCacheAge(age || null);
      setCachedAt(processedImagery.createdAt);
      setError(null);

      // Store in IndexedDB cache for offline access
      await storeInCache(processedImagery);
    } catch (err) {
      // Handle errors
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      
      // Try to load from cache as fallback
      console.log('[useSatelliteImagery] API error - trying cache fallback');
      const cachedImagery = await loadFromCache();
      
      if (cachedImagery) {
        setImagery(cachedImagery);
        setCached(true);
        setCachedAt(cachedImagery.createdAt);
        
        // Calculate cache age
        const now = new Date();
        const age = now.getTime() - cachedImagery.createdAt.getTime();
        setCacheAge(age);
        
        // Show warning that we're using cached data due to error
        setError(`Using cached data due to error: ${errorMessage}`);
      } else {
        setError(errorMessage);
        setImagery(null);
        setCached(false);
        setCacheAge(null);
        setCachedAt(null);
      }

      // Log error for debugging
      console.error('Error fetching satellite imagery:', err);
    } finally {
      setLoading(false);
    }
  }, [parcelleId, date, cloudCoverThreshold, daysOffset, offline, loadFromCache, storeInCache]);

  /**
   * Auto-fetch imagery when autoFetch is enabled
   */
  useEffect(() => {
    if (autoFetch && parcelleId) {
      refetch();
    }
  }, [autoFetch, refetch, parcelleId]);

  /**
   * Derive cloud cover and acquisition date from imagery result
   */
  const cloudCover: number | null = imagery?.cloudCoverPercent ?? null;
  const acquisitionDate: Date | null = imagery?.acquisitionDate ?? null;

  /**
   * Check if cached data is stale (>30 days old)
   */
  const isStale = cachedAt ? isCacheStale(cachedAt, 30) : false;

  return {
    imagery,
    loading,
    error,
    refetch,
    cloudCover,
    acquisitionDate,
    cached,
    cacheAge,
    offline,
    isStale,
    cachedAt,
  };
}
