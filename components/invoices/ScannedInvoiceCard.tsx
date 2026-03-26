'use client';

import { useState } from 'react';
import { Download, Trash2, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import {
  formatFileSize,
  isPDF,
  isImage,
  type ScannedInvoiceWithUser,
} from '@/types/scanned-invoices';

// =============================================================================
// Types
// =============================================================================

interface ScannedInvoiceCardProps {
  /** Scanned invoice data */
  scan: ScannedInvoiceWithUser;
  
  /** Whether the current user can delete this scan (admin only) */
  canDelete: boolean;
  
  /** Callback when download is requested */
  onDownload: (scanId: string) => void;
  
  /** Callback when delete is requested */
  onDelete?: (scanId: string) => void;
  
  /** Whether this card is selected (for bulk operations) */
  isSelected?: boolean;
  
  /** Callback when selection changes */
  onSelectionChange?: (scanId: string, selected: boolean) => void;
  
  /** Optional className for styling */
  className?: string;
}

// =============================================================================
// ScannedInvoiceCard Component
// =============================================================================

/**
 * ScannedInvoiceCard Component
 * 
 * Displays a single scanned invoice file with:
 * - File preview (thumbnail for images, PDF icon for PDFs)
 * - Metadata (filename, size, upload date, uploader name)
 * - Actions (download, delete)
 * - Optional selection checkbox for bulk operations
 * 
 * @see Requirements 3.3, 4.2, 8.8
 */
export function ScannedInvoiceCard({
  scan,
  canDelete,
  onDownload,
  onDelete,
  isSelected = false,
  onSelectionChange,
  className = '',
}: ScannedInvoiceCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [imageError, setImageError] = useState(false);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownload(scan.id);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(scan.id);
    }
  };

  const handleSelectionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSelectionChange) {
      onSelectionChange(scan.id, e.target.checked);
    }
  };

  // =============================================================================
  // Render Helpers
  // =============================================================================

  /**
   * Get file icon or preview based on MIME type
   */
  const renderPreview = () => {
    if (isPDF(scan.mime_type)) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-red-50">
          <FileText className="w-12 h-12 text-red-500" />
        </div>
      );
    }
    
    if (isImage(scan.mime_type) && !imageError) {
      // For images, we could show a thumbnail if available
      // For now, just show the image icon
      return (
        <div className="flex items-center justify-center w-full h-full bg-blue-50">
          <ImageIcon className="w-12 h-12 text-blue-500" />
        </div>
      );
    }
    
    // Fallback
    return (
      <div className="flex items-center justify-center w-full h-full bg-gray-50">
        <FileText className="w-12 h-12 text-gray-400" />
      </div>
    );
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div
      className={`
        relative border rounded-lg overflow-hidden
        transition-all duration-200
        ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200 hover:border-gray-300'}
        ${className}
      `}
    >
      {/* Selection checkbox (if enabled) */}
      {onSelectionChange && (
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleSelectionChange}
            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </div>
      )}

      {/* File preview */}
      <div className="aspect-[4/3] bg-gray-100">
        {renderPreview()}
      </div>

      {/* File metadata */}
      <div className="p-4 space-y-3">
        {/* Filename */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 truncate" title={scan.original_filename}>
            {scan.original_filename}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {formatFileSize(scan.file_size_bytes)}
          </p>
        </div>

        {/* Upload info */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>
            Uploadé le {formatDate(scan.created_at)}
          </p>
          <p>
            Par {scan.created_by_name}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="
              flex-1 flex items-center justify-center gap-2 px-3 py-2
              text-sm font-medium text-blue-700 bg-blue-50
              rounded-md hover:bg-blue-100
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            "
            title="Télécharger"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Téléchargement...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Télécharger</span>
              </>
            )}
          </button>

          {/* Delete button (admin only) */}
          {canDelete && onDelete && (
            <button
              onClick={handleDelete}
              className="
                p-2 text-red-600 bg-red-50
                rounded-md hover:bg-red-100
                transition-colors
              "
              title="Supprimer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
