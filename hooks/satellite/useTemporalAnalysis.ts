/**
 * useTemporalAnalysis Hook
 * 
 * Manages temporal NDVI analysis state for a single parcelle over a date range.
 * Provides loading, error, and data states with date selection and change calculation.
 * 
 * Requirements: Task 3.5.1
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { TemporalDataPoint, NDVITrend, EVITrend, NDMITrend, NDWITrend } from '@/lib/satellite/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Hook options
 */
export interface UseTemporalAnalysisOptions {
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
  trend: NDVITrend | null;
  eviTrend: EVITrend | null;
  ndmiTrend: NDMITrend | null;
  ndwiTrend: NDWITrend | null;
  significantChanges: number;
  averageNDVI: number;
  averageEVI: number | null;
  averageNDMI: number | null;
  averageNDWI: number | null;
  averageSAVI: number | null;
  averageCloudCover: number;
}

/**
 * Hook return value
 */
export interface UseTemporalAnalysisReturn {
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
  /** Overall NDVI trend analysis */
  trend: NDVITrend | null;
  /** Overall EVI trend analysis */
  eviTrend: EVITrend | null;
  /** Overall NDMI trend analysis */
  ndmiTrend: NDMITrend | null;
  /** Overall NDWI trend analysis */
  ndwiTrend: NDWITrend | null;
  /** Number of significant changes detected */
  significantChanges: number;
  /** Average NDVI over the period */
  averageNDVI: number;
  /** Average EVI over the period (null if unavailable) */
  averageEVI: number | null;
  /** Average NDMI over the period (null if unavailable) */
  averageNDMI: number | null;
  /** Average NDWI over the period (null if unavailable) */
  averageNDWI: number | null;
  /** Average SAVI over the period (null if unavailable) */
  averageSAVI: number | null;
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
          evi?: number | null;
          ndmi?: number | null;
          ndwi?: number | null;
          savi?: number | null;
          ndre?: number | null;
          cloudCover: number;
          imageryQuality?: TemporalDataPoint['imageryQuality'];
          healthStatus: string;
          hasSignificantChange: boolean;
          isAcquisitionDate?: boolean;
        }) => ({
          date: new Date(point.date),
          ndvi: point.ndvi,
          evi: point.evi ?? null,
          ndmi: point.ndmi ?? null,
          ndwi: point.ndwi ?? null,
          savi: point.savi ?? null,
          ndre: point.ndre ?? null,
          cloudCover: point.cloudCover,
          imageryQuality: point.imageryQuality ?? null,
          healthStatus: point.healthStatus as TemporalDataPoint['healthStatus'],
          hasSignificantChange: point.hasSignificantChange,
          isAcquisitionDate: point.isAcquisitionDate,
        })
      );

      // Convert date strings to Date objects in trend
      const processedTrend: NDVITrend | null = summaryData.trend
        ? {
            trend: summaryData.trend.trend,
            changeRate: summaryData.trend.changeRate,
            dataPoints: summaryData.trend.dataPoints,
            startDate: new Date(summaryData.trend.startDate),
            endDate: new Date(summaryData.trend.endDate),
            startNDVI: summaryData.trend.startNDVI,
            endNDVI: summaryData.trend.endNDVI,
          }
        : null;

      const processedEviTrend: EVITrend | null = summaryData.eviTrend
        ? {
            trend: summaryData.eviTrend.trend,
            changeRate: summaryData.eviTrend.changeRate,
            dataPoints: summaryData.eviTrend.dataPoints,
            startDate: new Date(summaryData.eviTrend.startDate),
            endDate: new Date(summaryData.eviTrend.endDate),
            startEVI: summaryData.eviTrend.startEVI,
            endEVI: summaryData.eviTrend.endEVI,
          }
        : null;

      const processedNdmiTrend: NDMITrend | null = summaryData.ndmiTrend
        ? {
            trend: summaryData.ndmiTrend.trend,
            changeRate: summaryData.ndmiTrend.changeRate,
            dataPoints: summaryData.ndmiTrend.dataPoints,
            startDate: new Date(summaryData.ndmiTrend.startDate),
            endDate: new Date(summaryData.ndmiTrend.endDate),
            startNDMI: summaryData.ndmiTrend.startNDMI,
            endNDMI: summaryData.ndmiTrend.endNDMI,
          }
        : null;

      const processedNdwiTrend: NDWITrend | null = summaryData.ndwiTrend
        ? {
            trend: summaryData.ndwiTrend.trend,
            changeRate: summaryData.ndwiTrend.changeRate,
            dataPoints: summaryData.ndwiTrend.dataPoints,
            startDate: new Date(summaryData.ndwiTrend.startDate),
            endDate: new Date(summaryData.ndwiTrend.endDate),
            startNDWI: summaryData.ndwiTrend.startNDWI,
            endNDWI: summaryData.ndwiTrend.endNDWI,
          }
        : null;

      // Build processed summary
      const processedSummary: TemporalAnalysisSummary = {
        timeline: processedTimeline,
        trend: processedTrend,
        eviTrend: processedEviTrend,
        ndmiTrend: processedNdmiTrend,
        ndwiTrend: processedNdwiTrend,
        significantChanges: summaryData.significantChanges,
        averageNDVI: summaryData.averageNDVI,
        averageEVI: summaryData.averageEVI ?? null,
        averageNDMI: summaryData.averageNDMI ?? null,
        averageNDWI: summaryData.averageNDWI ?? null,
        averageSAVI: summaryData.averageSAVI ?? null,
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
  const eviTrend = summary?.eviTrend || null;
  const ndmiTrend = summary?.ndmiTrend || null;
  const ndwiTrend = summary?.ndwiTrend || null;
  const significantChanges = summary?.significantChanges || 0;
  const averageNDVI = summary?.averageNDVI || 0;
  const averageEVI = summary?.averageEVI ?? null;
  const averageNDMI = summary?.averageNDMI ?? null;
  const averageNDWI = summary?.averageNDWI ?? null;
  const averageSAVI = summary?.averageSAVI ?? null;
  const averageCloudCover = summary?.averageCloudCover || 0;

  return {
    timeline,
    loading,
    error,
    selectedDate,
    setSelectedDate,
    ndviChange,
    trend,
    eviTrend,
    ndmiTrend,
    ndwiTrend,
    significantChanges,
    averageNDVI,
    averageEVI,
    averageNDMI,
    averageNDWI,
    averageSAVI,
    averageCloudCover,
    refetch,
    cached,
    cachedAt,
    selectedDataPoint,
  };
}
