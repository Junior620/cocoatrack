'use client';

/**
 * useReceiptErrorHandler
 *
 * Centralized error handling hook for the receipt import feature.
 *
 * Features:
 * - User-friendly French error message mapping
 * - Retry logic with exponential backoff for network errors
 * - OCR fallback trigger
 * - Error logging with user/file/error context
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import { useState, useCallback, useRef } from 'react';
import {
  ReceiptImportError,
  getReceiptErrorMessage,
  isRetryableError,
  isOcrError,
  RECEIPT_ERROR_CODES,
} from '@/lib/errors/receipt-errors';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Initial delay for exponential backoff (ms) */
const INITIAL_RETRY_DELAY_MS = 1000;

/** Maximum number of automatic retries for network errors */
const MAX_AUTO_RETRIES = 3;

// ============================================================================
// TYPES
// ============================================================================

export interface ErrorState {
  /** The current error, or null if none */
  error: ReceiptImportError | null;
  /** User-friendly message in French */
  message: string | null;
  /** Whether the error is retryable */
  canRetry: boolean;
  /** Whether the error should trigger OCR fallback */
  shouldFallbackToManual: boolean;
  /** Number of retry attempts made */
  retryCount: number;
  /** Whether a retry is in progress */
  isRetrying: boolean;
}

export interface UseReceiptErrorHandlerOptions {
  /** Context for logging (user ID, file name, etc.) */
  logContext?: {
    userId?: string;
    fileName?: string;
    cooperativeId?: string;
  };
  /** Called when OCR fallback should be triggered */
  onOcrFallback?: () => void;
  /** Maximum retries before giving up */
  maxRetries?: number;
}

export interface UseReceiptErrorHandlerReturn {
  errorState: ErrorState;
  /** Handle an error, maps it to a user-friendly message and decides retry/fallback */
  handleError: (err: unknown) => void;
  /** Clear the current error */
  clearError: () => void;
  /**
   * Execute an async operation with automatic retry on network errors.
   * Returns the result or throws after exhausting retries.
   */
  withRetry: <T>(fn: () => Promise<T>) => Promise<T>;
}

// ============================================================================
// HELPERS
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateBackoff(attempt: number, initialDelay: number): number {
  return initialDelay * Math.pow(2, attempt);
}

function logErrorDetails(
  error: ReceiptImportError,
  context?: UseReceiptErrorHandlerOptions['logContext']
): void {
  // Requirements: 10.6, log all errors with user, file, error details
  console.error('[receipt-error-handler]', {
    code: error.code,
    message: error.message,
    field: error.field,
    details: error.details,
    user: context?.userId ?? 'unknown',
    file: context?.fileName ?? 'unknown',
    cooperative: context?.cooperativeId ?? 'unknown',
    timestamp: new Date().toISOString(),
  });
}

// ============================================================================
// HOOK
// ============================================================================

export function useReceiptErrorHandler(
  options: UseReceiptErrorHandlerOptions = {}
): UseReceiptErrorHandlerReturn {
  const { logContext, onOcrFallback, maxRetries = MAX_AUTO_RETRIES } = options;

  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    message: null,
    canRetry: false,
    shouldFallbackToManual: false,
    retryCount: 0,
    isRetrying: false,
  });

  const retryCountRef = useRef(0);

  const handleError = useCallback(
    (err: unknown) => {
      const receiptError = ReceiptImportError.from(err);

      logErrorDetails(receiptError, logContext);

      const canRetry = isRetryableError(receiptError.code);
      const shouldFallbackToManual = isOcrError(receiptError.code);

      setErrorState((prev) => ({
        error: receiptError,
        message: receiptError.message,
        canRetry,
        shouldFallbackToManual,
        retryCount: prev.retryCount,
        isRetrying: false,
      }));

      // Trigger OCR fallback automatically
      if (shouldFallbackToManual && onOcrFallback) {
        onOcrFallback();
      }
    },
    [logContext, onOcrFallback]
  );

  const clearError = useCallback(() => {
    retryCountRef.current = 0;
    setErrorState({
      error: null,
      message: null,
      canRetry: false,
      shouldFallbackToManual: false,
      retryCount: 0,
      isRetrying: false,
    });
  }, []);

  /**
   * Execute an async operation with exponential backoff retry for network errors.
   * Requirements: 10.3
   */
  const withRetry = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      retryCountRef.current = 0;
      clearError();

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            setErrorState((prev) => ({ ...prev, isRetrying: true, retryCount: attempt }));
          }

          const result = await fn();

          // Success, clear any previous error
          if (attempt > 0) {
            clearError();
          }

          return result;
        } catch (err) {
          const receiptError = ReceiptImportError.from(err);
          const canRetry = isRetryableError(receiptError.code);

          logErrorDetails(receiptError, logContext);

          // Don't retry on last attempt or non-retryable errors
          if (attempt === maxRetries || !canRetry) {
            const shouldFallbackToManual = isOcrError(receiptError.code);

            setErrorState({
              error: receiptError,
              message: receiptError.message,
              canRetry: canRetry && attempt < maxRetries,
              shouldFallbackToManual,
              retryCount: attempt,
              isRetrying: false,
            });

            if (shouldFallbackToManual && onOcrFallback) {
              onOcrFallback();
            }

            throw receiptError;
          }

          // Calculate backoff delay and wait
          const delay = calculateBackoff(attempt, INITIAL_RETRY_DELAY_MS);

          setErrorState({
            error: receiptError,
            message: `${RECEIPT_ERROR_CODES.NETWORK_ERROR === receiptError.code ? 'Erreur réseau. Veuillez réessayer' : receiptError.message} (tentative ${attempt + 1}/${maxRetries})`,
            canRetry: true,
            shouldFallbackToManual: false,
            retryCount: attempt + 1,
            isRetrying: true,
          });

          await sleep(delay);
        }
      }

      // Should never reach here
      throw new ReceiptImportError('UNKNOWN_ERROR');
    },
    [maxRetries, logContext, onOcrFallback, clearError]
  );

  return { errorState, handleError, clearError, withRetry };
}

// ============================================================================
// RE-EXPORTS for convenience
// ============================================================================

export { getReceiptErrorMessage, isRetryableError, isOcrError };
