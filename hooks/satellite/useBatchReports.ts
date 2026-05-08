/**
 * Custom hook for batch certification report generation
 * 
 * Provides state management and progress tracking for generating
 * certification reports for multiple parcelles.
 */

import { useState, useCallback } from 'react';
import type { ReportOptions } from '@/lib/satellite/types';

interface UseBatchReportsOptions {
  onSuccess?: (zipUrl: string, reportCount: number) => void;
  onError?: (error: Error) => void;
}

interface UseBatchReportsReturn {
  generateBatchReports: (
    parcelleIds: string[],
    options: ReportOptions
  ) => Promise<void>;
  loading: boolean;
  error: Error | null;
  progress: {
    current: number;
    total: number;
    percentage: number;
  } | null;
  zipUrl: string | null;
  reportCount: number | null;
  reset: () => void;
}

export function useBatchReports(
  options?: UseBatchReportsOptions
): UseBatchReportsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    percentage: number;
  } | null>(null);
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [reportCount, setReportCount] = useState<number | null>(null);

  const generateBatchReports = useCallback(
    async (parcelleIds: string[], reportOptions: ReportOptions) => {
      setLoading(true);
      setError(null);
      setProgress({
        current: 0,
        total: parcelleIds.length,
        percentage: 0,
      });
      setZipUrl(null);
      setReportCount(null);

      try {
        // Make API request
        const response = await fetch('/api/satellite/reports/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            parcelleIds,
            options: {
              ...reportOptions,
              baselineDate: reportOptions.baselineDate.toISOString(),
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate batch reports');
        }

        const data = await response.json();

        // Update state with results
        setZipUrl(data.zipUrl);
        setReportCount(data.reportCount);
        setProgress({
          current: data.reportCount,
          total: data.reportCount,
          percentage: 100,
        });

        // Call success callback
        if (options?.onSuccess) {
          options.onSuccess(data.zipUrl, data.reportCount);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);

        // Call error callback
        if (options?.onError) {
          options.onError(error);
        }
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setProgress(null);
    setZipUrl(null);
    setReportCount(null);
  }, []);

  return {
    generateBatchReports,
    loading,
    error,
    progress,
    zipUrl,
    reportCount,
    reset,
  };
}
