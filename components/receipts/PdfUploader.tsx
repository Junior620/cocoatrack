'use client';

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X, Loader2 } from 'lucide-react';
import { useBackgroundUpload } from '@/lib/hooks/useBackgroundUpload';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_SIZE_MB_DEFAULT = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB_DEFAULT * 1024 * 1024;

// ============================================================================
// TYPES
// ============================================================================

export interface UploadCompleteResult {
  pdfUrl: string;
  storagePath: string;
  fileSize: number;
  fileName: string;
}

export interface PdfUploaderProps {
  /** Called when upload completes successfully */
  onUploadComplete: (result: UploadCompleteResult) => void;
  /**
   * Called immediately after file validation passes (before upload finishes).
   * Allows the wizard to advance to the next step while upload runs in background.
   * Requirements: 18.1
   */
  onFileValidated?: (file: File) => void;
  /** Called when the background upload fails */
  onUploadError?: (error: string) => void;
  /** Cooperative ID required for storage path generation */
  cooperativeId: string;
  /** Receipt number used in storage path (can be a temp placeholder) */
  receiptNumber?: string;
  /** Max file size in MB (default: 10) */
  maxSizeMB?: number;
  className?: string;
}

type UploadState = 'idle' | 'compressing' | 'uploading' | 'success' | 'error';

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * PdfUploader component
 *
 * Provides drag & drop and file input for PDF upload.
 * Validates file type (.pdf / application/pdf) and size (max 10MB).
 * Uploads in the background (Req 18.1) with optional compression (Req 18.2).
 * Shows upload progress and handles errors.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 18.1, 18.2
 */
export function PdfUploader({
  onUploadComplete,
  onFileValidated,
  onUploadError,
  cooperativeId,
  receiptNumber = 'temp',
  maxSizeMB = MAX_SIZE_MB_DEFAULT,
  className = '',
}: PdfUploaderProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  // Background upload hook (Req 18.1, 18.2)
  const { uploadState: bgUpload, startUpload, reset: resetUpload } = useBackgroundUpload({
    cooperativeId,
    receiptNumber,
    onComplete: onUploadComplete,
    onError: (err) => {
      setValidationError(err);
      onUploadError?.(err);
    },
  });

  // Derive display state from background upload status
  const uploadState: UploadState = validationError && bgUpload.status === 'idle'
    ? 'error'
    : bgUpload.status === 'idle'
    ? 'idle'
    : bgUpload.status === 'compressing'
    ? 'compressing'
    : bgUpload.status === 'uploading'
    ? 'uploading'
    : bgUpload.status === 'success'
    ? 'success'
    : 'error';

  const progress = bgUpload.progress;
  const errorMessage = validationError ?? bgUpload.error;

  // ── Validation ────────────────────────────────────────────────────────────

  const validateFile = useCallback(
    (file: File): string | null => {
      const hasValidExtension = file.name.toLowerCase().endsWith('.pdf');
      const hasValidMime = file.type === 'application/pdf';

      if (!hasValidExtension || !hasValidMime) {
        return 'Format non supporté. Seuls les fichiers PDF sont acceptés';
      }

      if (file.size > maxSizeBytes) {
        return `Fichier trop volumineux. Taille maximale: ${maxSizeMB}MB`;
      }

      if (file.size === 0) {
        return 'Le fichier est vide';
      }

      return null;
    },
    [maxSizeBytes, maxSizeMB]
  );

  // ── File selection handler ────────────────────────────────────────────────

  const handleFile = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        setValidationError(error);
        setSelectedFile(null);
        return;
      }

      setValidationError(null);
      setSelectedFile(file);

      // Notify wizard immediately so it can advance (Req 18.1)
      onFileValidated?.(file);

      // Start background upload (non-blocking)
      startUpload(file);
    },
    [validateFile, onFileValidated, startUpload]
  );

  // ── Input change ──────────────────────────────────────────────────────────

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so the same file can be re-selected after an error
      e.target.value = '';
    },
    [handleFile]
  );

  // ── Drag & drop ───────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    resetUpload();
    setValidationError(null);
    setSelectedFile(null);
  }, [resetUpload]);

  // ── Render ────────────────────────────────────────────────────────────────

  const isUploading = uploadState === 'uploading' || uploadState === 'compressing';

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Zone de dépôt de fichier PDF"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
            inputRef.current?.click();
          }
        }}
        className={[
          'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer',
          isUploading ? 'cursor-not-allowed opacity-70' : '',
          isDragOver
            ? 'border-blue-500 bg-blue-50'
            : uploadState === 'success'
            ? 'border-green-400 bg-green-50'
            : uploadState === 'error'
            ? 'border-red-400 bg-red-50'
            : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50',
        ].join(' ')}
      >
        {/* Icon */}
        {uploadState === 'success' ? (
          <CheckCircle className="w-10 h-10 text-green-500" />
        ) : uploadState === 'error' ? (
          <AlertCircle className="w-10 h-10 text-red-500" />
        ) : selectedFile ? (
          <FileText className="w-10 h-10 text-blue-500" />
        ) : (
          <Upload className="w-10 h-10 text-gray-400" />
        )}

        {/* Label */}
        {uploadState === 'idle' && (
          <>
            <p className="text-sm font-medium text-gray-700">
              Glissez-déposez un fichier PDF ici
            </p>
            <p className="text-xs text-gray-500">
              ou cliquez pour sélectionner — max {maxSizeMB}MB
            </p>
          </>
        )}

        {uploadState === 'compressing' && (
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            <p className="text-sm font-medium text-blue-700">Compression en cours…</p>
          </div>
        )}

        {uploadState === 'uploading' && (
          <p className="text-sm font-medium text-blue-700">
            Upload en cours…
          </p>
        )}

        {uploadState === 'success' && selectedFile && (
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-green-700 truncate max-w-xs">
              {selectedFile.name}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
              className="p-1 rounded-full hover:bg-green-200 transition-colors"
              aria-label="Supprimer le fichier"
            >
              <X className="w-4 h-4 text-green-700" />
            </button>
          </div>
        )}

        {uploadState === 'error' && (
          <p className="text-sm font-medium text-red-700">
            Cliquez pour réessayer
          </p>
        )}

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="sr-only"
          onChange={handleInputChange}
          disabled={isUploading}
          aria-hidden="true"
        />
      </div>

      {/* Progress bar */}
      {(uploadState === 'compressing' || uploadState === 'uploading') && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{uploadState === 'compressing' ? 'Compression…' : 'Upload en cours…'}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-200"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {uploadState === 'error' && errorMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="p-1 rounded hover:bg-red-100 transition-colors flex-shrink-0"
            aria-label="Fermer l'erreur"
          >
            <X className="w-3 h-3 text-red-600" />
          </button>
        </div>
      )}
    </div>
  );
}
