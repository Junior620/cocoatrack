/**
 * useTemporalAnalysis Hook
 * 
 * Manages temporal NDVI analysis state for a single parcelle over a date range.
 * Provides loading, error, and data states with date selection and change calculation.
 * 
 * Requirements: Task 3.5.1
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { TemporalDataPoint, NDVITrend } from '@/lib/satellite/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Hook options
 */
interface UseTemporalAnalysisOptions {
  /** Parcelle ID to analyze */
  parcelleId: string;
  /** Start date of the analysis period */
  startDate: Date;
  /** End date of the analysis period */
  endDate: Date;
  /** Time interval for data points (daily, weekly, or monthly) */
  interval: 'daily' | 'weekly' | 'monthly';
  /** Whether to automatically fetch temporal data on mount and when dependencies change */
  autoFetch?: boolean;
}

/**
 * Temporal analysis summary data
 */
interface TemporalAnalysisSummary {
  timeline: TemporalDataPoint[];
  trend: NDVITrend;
  significantChanges: number;
  averageNDVI: number;
  averageCloudCover: number;
}

/**
 * Hook return value
 */
interface UseTemporalAnalysisReturn {
  /** Timeline of NDVI data points */
  timeline: TemporalDataPoint[];
  /** Whether temporal data fetching is in progress */
  loading: boolean;
  /** Error message (null if no error) */
  error: string | null;
  /** Currently selected date in the timeline */
  selectedDate: Date | null;
  /** Set the selected date */
  setSelectedDate: (date: Date) => void;
  /** NDVI change from baseline (percentage) */
  ndviChange: number;
  /** Overall trend analysis */
  trend: NDVITrend | null;
  /** Number of significant changes detected */
  significantChanges: number;
  /** Average NDVI over the period */
  averageNDVI: number;
  /** Average cloud cover over the period */
  averageCloudCover: number;
  /** Manually trigger temporal data fetch */
  refetch: () => Promise<void>;
  /** Whether the result was served from cache */
  cached: boolean;
  /** Timestamp when data was cached (null if not cached) */
  cachedAt: Date | null;
  /** Selected data point details (null if no date selected) */
  selectedDataPoint: TemporalDataPoint | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * useTemporalAnalysis Hook
 * 
 * Fetches and manages temporal NDVI analysis for a parcelle with date selection
 * and change calculation capabilities.
 * 
 * @example
 * ```tsx
 * // Automatic fetch on mount with monthly intervals
 * const {
 *   timeline,
 *   loading,
 *   selectedDate,
 *   setSelectedDate,
 *   ndviChange,
 *   trend
 * } = useTemporalAnalysis({
 *   parcelleId: 'abc-123',
 *   startDate: new Date('2024-01-01'),
 *   endDate: new Date('2024-12-31'),
 *   interval: 'monthly',
 *   autoFetch: true,
 * });
 * 
 * // Manual fetch with weekly intervals
 * const { timeline, loading, refetch } = useTemporalAnalysis({
 *   parcelleId: 'abc-123',
 *   startDate: new Date('2024-06-01'),
 *   endDate: new Date('2024-08-31'),
 *   interval: 'weekly',
 *   autoFetch: false,
 * });
 * 
 * // Trigger fetch manually
 * await refetch();
 * 
 * // Select a date to view details
 * setSelectedDate(new Date('2024-06-15'));
 * ```
 */
export function useTemporalAnalysis({
  parcelleId,
  startDate,
  endDate,
  interval,
  autoFetch = false,
}: UseTemporalAnalysisOptions): UseTemporalAnalysisReturn {
  // State management
  const [summary, setSummary] = useState<TemporalAnalysisSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [cached, setCached] = useState(false);
  const [cachedAt, setCachedAt] = useState<Date | null>(null);

  /**
   * Fetch temporal analysis data by calling the API endpoint
   */
  const refetch = useCallback(async () => {
    // Validate required parameters
    if (!parcelleId) {
      setError('Parcelle ID is required');
      return;
    }

    if (!startDate || !endDate) {
      setError('Start date and end date are required');
      return;
    }

    // Validate date range
    if (startDate > endDate) {
      setError('Start date must be before or equal to end date');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams({
        parcelleId,
        startDate: startDate.toISOString().split('T')[0], // YYYY-MM-DD format
        endDate: endDate.toISOString().split('T')[0],
        interval,
      });

      // Call temporal analysis API
      const response = await fetch(`/api/satellite/temporal?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error || `Failed to fetch temporal data: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      // Parse response
      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error('Invalid response format from temporal API');
      }

      // Extract data from response
      const { data: responseData, cached: isCached, cachedAt: cacheTimestamp } = result;
      const summaryData = responseData.summary;

      // Convert date strings to Date objects in timeline
      const processedTimeline: TemporalDataPoint[] = summaryData.timeline.map(
        (point: {
          date: string;
          ndvi: number;
          cloudCover: number;
          healthStatus: string;
          hasSignificantChange: boolean;
        }) => ({
          date: new Date(point.date),
          ndvi: point.ndvi,
          cloudCover: point.cloudCover,
          healthStatus: point.healthStatus as TemporalDataPoint['healthStatus'],
          hasSignificantChange: point.hasSignificantChange,
        })
      );

      // Convert date strings to Date objects in trend
      const processedTrend: NDVITrend = {
        trend: summaryData.trend.trend,
        changeRate: summaryData.trend.changeRate,
        dataPoints: summaryData.trend.dataPoints,
        startDate: new Date(summaryData.trend.startDate),
        endDate: new Date(summaryData.trend.endDate),
        startNDVI: summaryData.trend.startNDVI,
        endNDVI: summaryData.trend.endNDVI,
      };

      // Build processed summary
      const processedSummary: TemporalAnalysisSummary = {
        timeline: processedTimeline,
        trend: processedTrend,
        significantChanges: summaryData.significantChanges,
        averageNDVI: summaryData.averageNDVI,
        averageCloudCover: summaryData.averageCloudCover,
      };

      // Update state
      setSummary(processedSummary);
      setCached(isCached || false);
      setCachedAt(cacheTimestamp ? new Date(cacheTimestamp) : null);
      setError(null);

      // Auto-select the most recent date if no date is selected
      if (!selectedDate && processedTimeline.length > 0) {
        setSelectedDate(processedTimeline[processedTimeline.length - 1].date);
      }
    } catch (err) {
      // Handle errors
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setSummary(null);
      setCached(false);
      setCachedAt(null);

      // Log error for debugging
      console.error('Error fetching temporal analysis data:', err);
    } finally {
      setLoading(false);
    }
  }, [parcelleId, startDate, endDate, interval, selectedDate]);

  /**
   * Auto-fetch temporal data when autoFetch is enabled
   */
  useEffect(() => {
    if (autoFetch && parcelleId && startDate && endDate) {
      refetch();
    }
  }, [autoFetch, refetch, parcelleId, startDate, endDate]);

  /**
   * Calculate NDVI change from baseline (first data point) to selected date
   * Returns percentage change
   */
  const ndviChange = useMemo(() => {
    if (!summary || !selectedDate || summary.timeline.length === 0) {
      return 0;
    }

    // Find the baseline (first data point)
    const baseline = summary.timeline[0];

    // Find the selected data point
    const selectedPoint = summary.timeline.find(
      point => point.date.getTime() === selectedDate.getTime()
    );

    if (!selectedPoint || baseline.ndvi === 0) {
      return 0;
    }

    // Calculate percentage change: ((current - baseline) / baseline) * 100
    const change = ((selectedPoint.ndvi - baseline.ndvi) / Math.abs(baseline.ndvi)) * 100;

    return change;
  }, [summary, selectedDate]);

  /**
   * Get the selected data point details
   */
  const selectedDataPoint = useMemo(() => {
    if (!summary || !selectedDate) {
      return null;
    }

    return (
      summary.timeline.find(point => point.date.getTime() === selectedDate.getTime()) || null
    );
  }, [summary, selectedDate]);

  /**
   * Extract timeline, trend, and statistics from summary
   */
  const timeline = summary?.timeline || [];
  const trend = summary?.trend || null;
  const significantChanges = summary?.significantChanges || 0;
  const averageNDVI = summary?.averageNDVI || 0;
  const averageCloudCover = summary?.averageCloudCover || 0;

  return {
    timeline,
    loading,
    error,
    selectedDate,
    setSelectedDate,
    ndviChange,
    trend,
    significantChanges,
    averageNDVI,
    averageCloudCover,
    refetch,
    cached,
    cachedAt,
    selectedDataPoint,
  };
}
