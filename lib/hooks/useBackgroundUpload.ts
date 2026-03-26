'use client';

/**
 * useBackgroundUpload hook
 *
 * Manages PDF upload state without blocking the UI.
 * The wizard can advance to the next step immediately after file validation
 * while the upload continues in the background.
 *
 * Requirements: 18.1, 18.2
 */

import { useState, useCallback, useRef } from 'react';
import { compressPdfIfNeeded } from '@/lib/utils/pdf-compression';

// ============================================================================
// TYPES
// ============================================================================

export type BackgroundUploadStatus = 'idle' | 'compressing' | 'uploading' | 'success' | 'error';

export interface BackgroundUploadState {
  status: BackgroundUploadStatus;
  progress: number; // 0-100
  url: string | null;
  storagePath: string | null;
  fileSize: number | null;
  fileName: string | null;
  error: string | null;
}

export interface BackgroundUploadResult {
  pdfUrl: string;
  storagePath: string;
  fileSize: number;
  fileName: string;
}

export interface UseBackgroundUploadOptions {
  cooperativeId: string;
  receiptNumber?: string;
  /** Called when upload completes successfully */
  onComplete?: (result: BackgroundUploadResult) => void;
  /** Called when upload fails */
  onError?: (error: string) => void;
}

const INITIAL_STATE: BackgroundUploadState = {
  status: 'idle',
  progress: 0,
  url: null,
  storagePath: null,
  fileSize: null,
  fileName: null,
  error: null,
};

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for background PDF upload with optional compression.
 *
 * Usage:
 * ```tsx
 * const { uploadState, startUpload, reset } = useBackgroundUpload({
 *   cooperativeId,
 *   onComplete: (result) => setState(prev => ({ ...prev, uploadResult: result })),
 * });
 *
 * // Start upload without awaiting — UI is not blocked
 * startUpload(file);
 * // Immediately advance to next wizard step
 * goToNextStep();
 * ```
 */
export function useBackgroundUpload({
  cooperativeId,
  receiptNumber = 'temp',
  onComplete,
  onError,
}: UseBackgroundUploadOptions) {
  const [uploadState, setUploadState] = useState<BackgroundUploadState>(INITIAL_STATE);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startUpload = useCallback(
    async (file: File) => {
      // Cancel any in-flight upload
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setUploadState({
        status: 'compressing',
        progress: 0,
        url: null,
        storagePath: null,
        fileSize: null,
        fileName: file.name,
        error: null,
      });

      try {
        // Step 1: Compress if needed (Req 18.2)
        const fileToUpload = await compressPdfIfNeeded(file);

        if (controller.signal.aborted) return;

        setUploadState((prev) => ({ ...prev, status: 'uploading', progress: 5 }));

        // Step 2: Simulate progress while request is in flight
        const progressInterval = setInterval(() => {
          setUploadState((prev) => {
            if (prev.status !== 'uploading') {
              clearInterval(progressInterval);
              return prev;
            }
            return { ...prev, progress: Math.min(prev.progress + 5, 85) };
          });
        }, 300);

        // Step 3: Upload via API route
        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('cooperativeId', cooperativeId);
        formData.append('receiptNumber', receiptNumber);

        const response = await fetch('/api/receipts/upload', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        clearInterval(progressInterval);

        if (controller.signal.aborted) return;

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(
            body?.error?.message || `Erreur ${response.status}: échec de l'upload`
          );
        }

        const result = await response.json();

        const uploadResult: BackgroundUploadResult = {
          pdfUrl: result.pdfUrl,
          storagePath: result.storagePath,
          fileSize: result.fileSize ?? fileToUpload.size,
          fileName: result.fileName ?? file.name,
        };

        setUploadState({
          status: 'success',
          progress: 100,
          url: uploadResult.pdfUrl,
          storagePath: uploadResult.storagePath,
          fileSize: uploadResult.fileSize,
          fileName: uploadResult.fileName,
          error: null,
        });

        onComplete?.(uploadResult);
      } catch (err) {
        if (controller.signal.aborted) return;

        const message =
          err instanceof Error ? err.message : 'Erreur réseau. Veuillez réessayer';

        setUploadState((prev) => ({
          ...prev,
          status: 'error',
          progress: 0,
          error: message,
        }));

        onError?.(message);
      }
    },
    [cooperativeId, receiptNumber, onComplete, onError]
  );

  const cancelUpload = useCallback(() => {
    abortControllerRef.current?.abort();
    setUploadState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    setUploadState(INITIAL_STATE);
  }, []);

  return { uploadState, startUpload, cancelUpload, reset };
}
