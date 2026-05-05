/**
 * useParcelleHealthStatus Hook
 * 
 * Fetches health status data for multiple parcelles efficiently.
 * Used in the parcelle list view to display health status badges.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Health status type
 */
export type HealthStatus = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

/**
 * Health status data for a single parcelle
 */
export interface ParcelleHealthStatusData {
  parcelleId: string;
  healthStatus: HealthStatus | null;
  meanNDVI: number | null;
  trend: 'improving' | 'stable' | 'declining' | null;
  loading: boolean;
  error: string | null;
}

/**
 * Map of parcelle IDs to their health status data
 */
export type HealthStatusMap = Record<string, ParcelleHealthStatusData>;

/**
 * Hook options
 */
interface UseParcelleHealthStatusOptions {
  /** Array of parcelle IDs to fetch health status for */
  parcelleIds: string[];
  /** Whether to automatically fetch on mount and when parcelleIds change */
  autoFetch?: boolean;
}

/**
 * Hook return value
 */
interface UseParcelleHealthStatusReturn {
  /** Map of parcelle IDs to health status data */
  healthStatusMap: HealthStatusMap;
  /** Whether any requests are currently loading */
  loading: boolean;
  /** Global error message (if any) */
  error: string | null;
  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
}

/**
 * useParcelleHealthStatus Hook
 * 
 * Fetches health status data for multiple parcelles.
 * 
 * @example
 * ```tsx
 * const { healthStatusMap, loading } = useParcelleHealthStatus({
 *   parcelleIds: parcelles.map(p => p.id),
 *   autoFetch: true,
 * });
 * 
 * // Access health status for a specific parcelle
 * const status = healthStatusMap[parcelleId]?.healthStatus;
 * ```
 */
export function useParcelleHealthStatus({
  parcelleIds,
  autoFetch = true,
}: UseParcelleHealthStatusOptions): UseParcelleHealthStatusReturn {
  const [healthStatusMap, setHealthStatusMap] = useState<HealthStatusMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use ref to track the last fetched IDs to prevent unnecessary refetches
  const lastFetchedIdsRef = useRef<string>('');

  /**
   * Fetch health status for a single parcelle
   */
  const fetchHealthStatus = useCallback(async (parcelleId: string) => {
    try {
      const response = await fetch(`/api/satellite/health-status/${parcelleId}`);
      
      if (!response.ok) {
        // If 404, it means no NDVI data exists yet
        if (response.status === 404) {
          return {
            parcelleId,
            healthStatus: null,
            meanNDVI: null,
            trend: null,
            loading: false,
            error: null,
          };
        }
        
        throw new Error(`Failed to fetch health status: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error('Invalid response format');
      }

      return {
        parcelleId,
        healthStatus: result.data.healthStatus,
        meanNDVI: result.data.meanNDVI,
        trend: result.data.trend?.direction || null,
        loading: false,
        error: null,
      };
    } catch (err) {
      return {
        parcelleId,
        healthStatus: null,
        meanNDVI: null,
        trend: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }, []);

  /**
   * Fetch health status for all parcelles
   */
  const fetchAll = useCallback(async () => {
    if (parcelleIds.length === 0) {
      setHealthStatusMap({});
      return;
    }

    setLoading(true);
    setError(null);

    // Initialize map with loading state
    const initialMap: HealthStatusMap = {};
    parcelleIds.forEach((id) => {
      initialMap[id] = {
        parcelleId: id,
        healthStatus: null,
        meanNDVI: null,
        trend: null,
        loading: true,
        error: null,
      };
    });
    setHealthStatusMap(initialMap);

    try {
      // Fetch all health statuses in parallel
      const results = await Promise.all(
        parcelleIds.map((id) => fetchHealthStatus(id))
      );

      // Build the final map
      const finalMap: HealthStatusMap = {};
      results.forEach((result) => {
        finalMap[result.parcelleId] = result;
      });

      setHealthStatusMap(finalMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health status data');
    } finally {
      setLoading(false);
    }
  }, [parcelleIds, fetchHealthStatus]);

  // Auto-fetch on mount and when parcelleIds change
  useEffect(() => {
    if (!autoFetch) return;
    
    // Create a stable string representation of the IDs
    const idsString = JSON.stringify([...parcelleIds].sort());
    
    // Only fetch if the IDs have actually changed
    if (idsString === lastFetchedIdsRef.current) {
      return;
    }
    
    lastFetchedIdsRef.current = idsString;
    fetchAll();
  }, [autoFetch, parcelleIds, fetchAll]);

  return {
    healthStatusMap,
    loading,
    error,
    refetch: fetchAll,
  };
}
