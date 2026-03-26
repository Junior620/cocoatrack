'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Camera, FileText, Image as ImageIcon } from 'lucide-react';
import {
  ALLOWED_MIME_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  formatFileSize,
  isPDF,
  isImage,
  type ScannedInvoice,
  SCANNED_INVOICE_ERROR_MESSAGES,
} from '@/types/scanned-invoices';
import { validateScannedInvoiceFile } from '@/lib/validations/scanned-invoice';

// =============================================================================
// Types
// =============================================================================

interface FileUploaderProps {
  /** Invoice ID to attach the scanned file to */
  invoiceId: string;
  
  /** Current number of scanned files for this invoice */
  currentScanCount: number;
  
  /** Callback when upload completes successfully */
  onUploadComplete: (scan: ScannedInvoice) => void;
  
  /** Callback when an error occurs */
  onError: (error: string) => void;
  
  /** Optional className for styling */
  className?: string;
}

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// =============================================================================
// FileUploader Component
// =============================================================================

/**
 * FileUploader Component
 * 
 * Features:
 * - Drag & drop file upload
 * - Click to select file
 * - Mobile camera capture
 * - Client-side validation (MIME type, file size, attachment limit)
 * - Upload progress bar
 * - Error display
 * 
 * @see Requirements 1.1, 1.2, 1.5, 8.3, 8.4, 8.5, 8.6, 9.1, 9.2, 9.3
 */
export function FileUploader({
  invoiceId,
  currentScanCount,
  onUploadComplete,
  onError,
  className = '',
}: FileUploaderProps) {
  // State
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // =============================================================================
  // Validation
  // =============================================================================

  /**
   * Validate file before upload
   * Checks MIME type, file size, and attachment limit
   */
  const validateFile = useCallback((file: File): boolean => {
    setValidationError(null);
    
    const result = validateScannedInvoiceFile(file, currentScanCount);
    
    if (!result.valid) {
      setValidationError(result.error || 'Validation failed');
      onError(result.error || 'Validation failed');
      return false;
    }
    
    return true;
  }, [currentScanCount, onError]);

  // =============================================================================
  // File Upload
  // =============================================================================

  /**
   * Upload file to server
   * Uses XMLHttpRequest for progress tracking
   */
  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadProgress({ loaded: 0, total: file.size, percentage: 0 });
    setValidationError(null);

    return new Promise<ScannedInvoice>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          setUploadProgress({
            loaded: event.loaded,
            total: event.total,
            percentage,
          });
        }
      });
      
      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.message || 'Upload failed'));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      });
      
      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error(SCANNED_INVOICE_ERROR_MESSAGES.NETWORK_ERROR));
      });
      
      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });
      
      // Prepare and send request
      const formData = new FormData();
      formData.append('file', file);
      
      xhr.open('POST', `/api/invoices/${invoiceId}/scans`);
      xhr.send(formData);
    });
  }, [invoiceId]);

  /**
   * Handle file upload process
   */
  const handleUpload = useCallback(async (file: File) => {
    // Validate file
    if (!validateFile(file)) {
      return;
    }
    
    setSelectedFile(file);
    
    try {
      const result = await uploadFile(file);
      onUploadComplete(result);
      
      // Reset state
      setSelectedFile(null);
      setIsUploading(false);
      setUploadProgress(null);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : SCANNED_INVOICE_ERROR_MESSAGES.UPLOAD_FAILED;
      
      setValidationError(errorMessage);
      onError(errorMessage);
      setIsUploading(false);
      setUploadProgress(null);
      setSelectedFile(null);
    }
  }, [validateFile, uploadFile, onUploadComplete, onError]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  /**
   * Handle file input change
   */
  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  }, [handleUpload]);

  /**
   * Handle click on upload area
   */
  const handleClick = useCallback(() => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  }, [isUploading]);

  /**
   * Handle drag enter
   */
  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  /**
   * Handle drag leave
   */
  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    // Only set dragging to false if leaving the drop zone itself
    if (event.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  }, []);

  /**
   * Handle drop
   */
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    
    if (isUploading) return;
    
    const file = event.dataTransfer.files[0];
    if (file) {
      handleUpload(file);
    }
  }, [isUploading, handleUpload]);

  /**
   * Handle cancel upload
   */
  const handleCancel = useCallback(() => {
    setSelectedFile(null);
    setIsUploading(false);
    setUploadProgress(null);
    setValidationError(null);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // =============================================================================
  // Render Helpers
  // =============================================================================

  /**
   * Get file icon based on MIME type
   */
  const getFileIcon = (file: File) => {
    if (isPDF(file.type)) {
      return <FileText className="w-8 h-8 text-red-500" />;
    }
    if (isImage(file.type)) {
      return <ImageIcon className="w-8 h-8 text-blue-500" />;
    }
    return <FileText className="w-8 h-8 text-gray-500" />;
  };

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_FILE_EXTENSIONS.join(',')}
        capture="environment" // Mobile camera capture
        onChange={handleFileInputChange}
        className="hidden"
        disabled={isUploading}
      />
      
      {/* Drop zone */}
      <div
        ref={dropZoneRef}
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8
          transition-all duration-200 cursor-pointer
          ${isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 bg-white'
          }
          ${isUploading ? 'cursor-not-allowed opacity-60' : ''}
        `}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          {/* Icon */}
          {!selectedFile && (
            <>
              <div className="p-4 bg-gray-100 rounded-full">
                <Upload className="w-8 h-8 text-gray-600" />
              </div>
              
              {/* Text */}
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900">
                  Glissez un fichier ici ou cliquez pour sélectionner
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  PDF, JPEG, PNG, WEBP • Max 10MB
                </p>
                
                {/* Mobile camera hint */}
                <div className="mt-3 flex items-center justify-center space-x-2 text-sm text-gray-500">
                  <Camera className="w-4 h-4" />
                  <span>Ou prenez une photo sur mobile</span>
                </div>
              </div>
            </>
          )}
          
          {/* Selected file preview */}
          {selectedFile && !isUploading && (
            <div className="flex items-center space-x-4">
              {getFileIcon(selectedFile)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-gray-500">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>
          )}
          
          {/* Upload progress */}
          {isUploading && uploadProgress && selectedFile && (
            <div className="w-full space-y-3">
              <div className="flex items-center space-x-4">
                {getFileIcon(selectedFile)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(uploadProgress.loaded)} / {formatFileSize(uploadProgress.total)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancel();
                  }}
                  className="p-1 hover:bg-gray-100 rounded"
                  title="Annuler"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress.percentage}%` }}
                />
              </div>
              
              <p className="text-sm text-center text-gray-600">
                Upload en cours... {uploadProgress.percentage}%
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Validation error */}
      {validationError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{validationError}</p>
        </div>
      )}
      
      {/* Info message */}
      {!validationError && !isUploading && (
        <div className="text-sm text-gray-500">
          <p>
            Vous pouvez uploader jusqu'à {10 - currentScanCount} fichier(s) supplémentaire(s) pour cette facture.
          </p>
        </div>
      )}
    </div>
  );
}
