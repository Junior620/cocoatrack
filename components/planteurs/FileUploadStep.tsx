'use client';

// CocoaTrack V2 - File Upload Step Component
// Step 1 of import wizard: Upload CSV file
// Requirements: 1.1, 8.1, 9.5

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, Loader2, AlertCircle, Download, X, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlanteurImportFile, ParseResult } from '@/types/planteur-import';
import { 
  formatPlanteurImportError, 
  isNetworkError 
} from '@/lib/utils/error-messages';

// =============================================================================
// Constants
// =============================================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = ['.csv', 'text/csv', 'application/csv'];

// =============================================================================
// Types
// =============================================================================

export interface FileUploadStepProps {
  /** Callback when upload and parsing complete */
  onUploadComplete: (file: PlanteurImportFile, parseResult: ParseResult) => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validate file before upload
 */
function validateFile(file: File): string | null {
  // Check file type
  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.csv')) {
    return 'Format de fichier invalide. Seuls les fichiers CSV sont acceptés';
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return `Le fichier est trop volumineux. Taille maximale : ${formatFileSize(MAX_FILE_SIZE)}`;
  }

  // Check if file is empty
  if (file.size === 0) {
    return 'Le fichier est vide';
  }

  return null;
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * FileUploadStep Component
 * 
 * Allows users to:
 * - Select CSV file via file input or drag-and-drop
 * - Validate file type and size
 * - Upload file to server
 * - Automatically parse and validate CSV
 * - Download CSV template
 * 
 * Requirements: 1.1, 8.1, 9.5
 */
export function FileUploadStep({ onUploadComplete }: FileUploadStepProps) {
  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [canRetry, setCanRetry] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    setError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  }, []);

  // Handle file input change
  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  // Handle file upload and parsing with retry logic
  // Requirements: 8.5 - Retry logic for network errors
  const handleUpload = useCallback(async (isRetry = false) => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    setCanRetry(false);

    // Exponential backoff: 1s, 2s, 4s
    const currentRetry = isRetry ? retryCount + 1 : 0;
    if (isRetry && currentRetry > 0) {
      const delay = Math.pow(2, currentRetry - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      // Step 1: Upload file
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadResponse = await fetch('/api/planteurs/import/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        const errorMessage = formatPlanteurImportError(errorData);
        throw new Error(errorMessage);
      }

      const importFile: PlanteurImportFile = await uploadResponse.json();
      setUploadProgress(50);

      // Step 2: Parse and validate CSV
      const parseResponse = await fetch(`/api/planteurs/import/${importFile.id}/parse`, {
        method: 'POST',
      });

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json();
        const errorMessage = formatPlanteurImportError(errorData);
        throw new Error(errorMessage);
      }

      const parseResult: ParseResult = await parseResponse.json();
      setUploadProgress(100);

      // Reset retry count on success
      setRetryCount(0);

      // Notify parent component
      onUploadComplete(importFile, parseResult);
    } catch (err) {
      console.error('Upload failed:', err);
      
      // Check if it's a network error and we can retry
      const isNetwork = isNetworkError(err);
      const canRetryNow = isNetwork && currentRetry < 3;
      
      setCanRetry(canRetryNow);
      setRetryCount(currentRetry);
      
      let errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue lors du téléchargement';
      
      // Add retry information to error message
      if (isNetwork) {
        if (canRetryNow) {
          errorMessage += ` (Tentative ${currentRetry + 1}/3)`;
        } else if (currentRetry >= 3) {
          errorMessage = 'Erreur réseau. Veuillez vérifier votre connexion et réessayer';
        }
      }
      
      setError(errorMessage);
      
      // Auto-retry for network errors
      if (canRetryNow) {
        setTimeout(() => {
          handleUpload(true);
        }, 2000);
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [selectedFile, onUploadComplete, retryCount]);

  // Handle template download
  const handleDownloadTemplate = useCallback(async () => {
    try {
      const response = await fetch('/api/planteurs/import/template');
      
      if (!response.ok) {
        throw new Error('Erreur lors du téléchargement du modèle');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'modele_import_planteurs.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Template download failed:', err);
      alert('Erreur lors du téléchargement du modèle');
    }
  }, []);

  // Handle clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">
          Instructions
        </h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Préparez un fichier CSV avec les colonnes : nom, prénoms, CNI, téléphone, superficie</li>
          <li>Le fichier doit contenir une ligne d'en-tête</li>
          <li>Taille maximale : {formatFileSize(MAX_FILE_SIZE)}</li>
          <li>Formats acceptés : virgule (,) ou point-virgule (;) comme séparateur</li>
        </ul>
        <button
          onClick={handleDownloadTemplate}
          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800 transition-colors"
        >
          <Download className="h-4 w-4" />
          Télécharger le modèle CSV
        </button>
      </div>

      {/* File Upload Area */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Fichier CSV <span className="text-red-500">*</span>
        </label>

        {/* Drag and Drop Zone */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => !selectedFile && fileInputRef.current?.click()}
          className={cn(
            'relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
            isDragging
              ? 'border-primary-500 bg-primary-50'
              : selectedFile
              ? 'border-green-300 bg-green-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          )}
        >
          {selectedFile ? (
            // Selected File Display
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearSelection();
                }}
                className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white transition-colors"
                aria-label="Supprimer le fichier"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            // Upload Prompt
            <>
              <div className="mx-auto w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-3">
                <Upload className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">
                Cliquez pour sélectionner ou glissez-déposez un fichier
              </p>
              <p className="text-xs text-gray-500">
                CSV uniquement, max {formatFileSize(MAX_FILE_SIZE)}
              </p>
            </>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES.join(',')}
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-700 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
              {canRetry && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpload(true);
                  }}
                  disabled={isUploading}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-800 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="h-3 w-3" />
                  Réessayer maintenant
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700">
              {uploadProgress < 50 ? 'Téléchargement...' : 'Analyse du fichier...'}
            </span>
            <span className="text-gray-500">{uploadProgress}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload Button */}
      <div className="flex items-center justify-end pt-4">
        <button
          onClick={() => handleUpload(false)}
          disabled={!selectedFile || isUploading}
          className={cn(
            'inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors',
            selectedFile && !isUploading
              ? 'bg-primary-600 text-white hover:bg-primary-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Traitement...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Télécharger et analyser
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default FileUploadStep;
