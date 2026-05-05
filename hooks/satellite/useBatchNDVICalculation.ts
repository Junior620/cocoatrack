/**
 * useBatchNDVICalculation Hook
 * 
 * Manages batch NDVI calculation for multiple parcelles.
 * Provides progress tracking and error handling.
 */

import { useState, useCallback } from 'react';

/**
 * Result for a single parcelle in the batch
 */
interface BatchParcelleResult {
  parcelleId: string;
  success: boolean;
  healthStatus?: string;
  meanNDVI?: number;
  error?: string;
  cached?: boolean;
}

/**
 * Batch calculation result
 */
interface BatchCalculationResult {
  totalRequested: number;
  successful: number;
  failed: number;
  results: BatchParcelleResult[];
}

/**
 * Hook return value
 */
interface UseBatchNDVICalculationReturn {
  /** Whether calculation is in progress */
  calculating: boolean;
  /** Progress percentage (0-100) */
  progress: number;
  /** Number of parcelles processed */
  processed: number;
  /** Total number of parcelles to process */
  total: number;
  /** Error message if calculation failed */
  error: string | null;
  /** Calculation result */
  result: BatchCalculationResult | null;
  /** Start batch calculation */
  calculate: (parcelleIds: string[], forceRecalculate?: boolean) => Promise<void>;
  /** Reset state */
  reset: () => void;
}

/**
 * useBatchNDVICalculation Hook
 * 
 * Calculates NDVI for multiple parcelles in batch.
 * 
 * @example
 * ```tsx
 * const { calculating, progress, calculate, result } = useBatchNDVICalculation();
 * 
 * const handleCalculate = async () => {
 *   const parcelleIds = parcelles.map(p => p.id);
 *   await calculate(parcelleIds);
 * };
 * 
 * return (
 *   <div>
 *     <button onClick={handleCalculate} disabled={calculating}>
 *       Calculer la santé
 *     </button>
 *     {calculating && <div>Progression: {progress}%</div>}
 *     {result && <div>Succès: {result.successful}/{result.totalRequested}</div>}
 *   </div>
 * );
 * ```
 */
export function useBatchNDVICalculation(): UseBatchNDVICalculationReturn {
  const [calculating, setCalculating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchCalculationResult | null>(null);

  /**
   * Calculate NDVI for multiple parcelles
   */
  const calculate = useCallback(
    async (parcelleIds: string[], forceRecalculate: boolean = false) => {
      if (parcelleIds.length === 0) {
        setError('Aucune parcelle à traiter');
        return;
      }

      setCalculating(true);
      setProgress(0);
      setProcessed(0);
      setTotal(parcelleIds.length);
      setError(null);
      setResult(null);

      try {
        // Split into batches of 100 (API limit)
        const BATCH_SIZE = 100;
        const batches: string[][] = [];
        
        for (let i = 0; i < parcelleIds.length; i += BATCH_SIZE) {
          batches.push(parcelleIds.slice(i, i + BATCH_SIZE));
        }

        const allResults: BatchParcelleResult[] = [];
        let totalProcessed = 0;

        // Process each batch sequentially
        for (const batch of batches) {
          const response = await fetch('/api/satellite/ndvi/batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              parcelleIds: batch,
              forceRecalculate,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({
              error: 'Unknown error',
              message: response.statusText,
            }));
            throw new Error(errorData.error || 'Failed to calculate NDVI');
          }

          const data = await response.json();
          
          if (!data.success || !data.data) {
            throw new Error('Invalid response format');
          }

          allResults.push(...data.data.results);
          totalProcessed += batch.length;

          // Update progress
          setProcessed(totalProcessed);
          setProgress(Math.round((totalProcessed / parcelleIds.length) * 100));
        }

        // Calculate final statistics
        const successful = allResults.filter((r) => r.success).length;
        const failed = allResults.filter((r) => !r.success).length;

        const finalResult: BatchCalculationResult = {
          totalRequested: parcelleIds.length,
          successful,
          failed,
          results: allResults,
        };

        setResult(finalResult);
        setProgress(100);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
        setError(errorMessage);
        console.error('Batch NDVI calculation error:', err);
      } finally {
        setCalculating(false);
      }
    },
    []
  );

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setCalculating(false);
    setProgress(0);
    setProcessed(0);
    setTotal(0);
    setError(null);
    setResult(null);
  }, []);

  return {
    calculating,
    progress,
    processed,
    total,
    error,
    result,
    calculate,
    reset,
  };
}
