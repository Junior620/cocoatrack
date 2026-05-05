/**
 * useNDVI Hook
 * 
 * Manages NDVI calculation state for a single parcelle.
 * Provides loading, error, and data states with manual and automatic calculation options.
 * 
 * Requirements: Task 2.5.1
 */

import { useState, useEffect, useCallback } from 'react';
import type { NDVIResult, HealthStatus } from '@/lib/satellite/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Hook options
 */
interface UseNDVIOptions {
  /** Parcelle ID to calculate NDVI for */
  parcelleId: string;
  /** Optional date for NDVI calculation (defaults to current date) */
  date?: Date;
  /** Whether to automatically calculate NDVI on mount and when dependencies change */
  autoCalculate?: boolean;
  /** Force recalculation even if cached result exists */
  forceRecalculate?: boolean;
}

/**
 * Hook return value
 */
interface UseNDVIReturn {
  /** NDVI result data (null if not yet calculated) */
  ndvi: NDVIResult | null;
  /** Whether NDVI calculation is in progress */
  loading: boolean;
  /** Error message (null if no error) */
  error: string | null;
  /** Manually trigger NDVI calculation */
  calculate: () => Promise<void>;
  /** Health status derived from NDVI (null if not yet calculated) */
  healthStatus: HealthStatus | null;
  /** Whether the result was served from cache */
  cached: boolean;
  /** Recommendation based on health status (null if not yet calculated) */
  recommendation: string | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * useNDVI Hook
 * 
 * Fetches and calculates NDVI for a parcelle with automatic or manual triggering.
 * 
 * @example
 * ```tsx
 * // Automatic calculation on mount
 * const { ndvi, loading, healthStatus } = useNDVI({
 *   parcelleId: 'abc-123',
 *   autoCalculate: true,
 * });
 * 
 * // Manual calculation
 * const { ndvi, loading, calculate } = useNDVI({
 *   parcelleId: 'abc-123',
 *   autoCalculate: false,
 * });
 * 
 * // Trigger calculation manually
 * await calculate();
 * ```
 */
export function useNDVI({
  parcelleId,
  date,
  autoCalculate = false,
  forceRecalculate = false,
}: UseNDVIOptions): UseNDVIReturn {
  // State management
  const [ndvi, setNdvi] = useState<NDVIResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [recommendation, setRecommendation] = useState<string | null>(null);

  /**
   * Calculate NDVI by calling the API endpoint
   */
  const calculate = useCallback(async () => {
    // Validate parcelleId
    if (!parcelleId) {
      setError('Parcelle ID is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prepare request body
      const requestBody: {
        parcelleId: string;
        date?: string;
        forceRecalculate?: boolean;
      } = {
        parcelleId,
        forceRecalculate,
      };

      // Add date if provided
      if (date) {
        requestBody.date = date.toISOString();
      }

      // Call NDVI calculation API
      const response = await fetch('/api/satellite/ndvi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error || `Failed to calculate NDVI: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      // Parse response
      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error('Invalid response format from NDVI API');
      }

      // Extract data from response
      const { ndvi: ndviResult, cached: isCached, recommendation: rec } = result.data;

      // Convert date strings to Date objects
      const processedNdvi: NDVIResult = {
        ...ndviResult,
        calculationDate: new Date(ndviResult.calculationDate),
        createdAt: new Date(ndviResult.createdAt),
      };

      // Update state
      setNdvi(processedNdvi);
      setCached(isCached);
      setRecommendation(rec || null);
      setError(null);
    } catch (err) {
      // Handle errors
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setNdvi(null);
      setCached(false);
      setRecommendation(null);

      // Log error for debugging
      console.error('Error calculating NDVI:', err);
    } finally {
      setLoading(false);
    }
  }, [parcelleId, date, forceRecalculate]);

  /**
   * Auto-calculate NDVI when autoCalculate is enabled
   */
  useEffect(() => {
    if (autoCalculate && parcelleId) {
      calculate();
    }
  }, [autoCalculate, calculate, parcelleId]);

  /**
   * Derive health status from NDVI result
   */
  const healthStatus: HealthStatus | null = ndvi?.healthStatus || null;

  return {
    ndvi,
    loading,
    error,
    calculate,
    healthStatus,
    cached,
    recommendation,
  };
}
