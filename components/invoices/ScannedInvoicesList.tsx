'use client';

import { useState, useCallback, useEffect } from 'react';
import { Trash2, AlertCircle, Loader2, FileX } from 'lucide-react';
import { ScannedInvoiceCard } from './ScannedInvoiceCard';
import {
  type ScannedInvoiceWithUser,
  SCANNED_INVOICE_ERROR_MESSAGES,
} from '@/types/scanned-invoices';

// =============================================================================
// Types
// =============================================================================

interface ScannedInvoicesListProps {
  /** Invoice ID to fetch scans for */
  invoiceId: string;
  
  /** Whether the current user can delete scans (admin only) */
  canDelete: boolean;
  
  /** Optional className for styling */
  className?: string;
}

interface DeleteConfirmationState {
  isOpen: boolean;
  scanIds: string[];
  isSingle: boolean;
}

// =============================================================================
// ScannedInvoicesList Component
// =============================================================================

/**
 * ScannedInvoicesList Component
 * 
 * Features:
 * - Display list of scanned invoices as cards
 * - Multiple selection for bulk operations
 * - Bulk deletion with confirmation
 * - Empty state when no scans attached
 * - Auto-refresh after operations
 * - Error handling and user feedback
 * 
 * @see Requirements 3.1, 3.4, 6.2, 6.6, 8.7
 */
export function ScannedInvoicesList({
  invoiceId,
  canDelete,
  className = '',
}: ScannedInvoicesListProps) {
  // State
  const [scans, setScans] = useState<ScannedInvoiceWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmationState>({
    isOpen: false,
    scanIds: [],
    isSingle: false,
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // =============================================================================
  // Data Fetching
  // =============================================================================

  /**
   * Fetch scanned invoices from API
   */
  const fetchScans = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/scans`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch scanned invoices');
      }

      const data = await response.json();
      setScans(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId]);

  // Fetch on mount and when invoiceId changes
  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  // =============================================================================
  // Selection Management
  // =============================================================================

  /**
   * Handle individual scan selection
   */
  const handleSelectionChange = useCallback((scanId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(scanId);
      } else {
        next.delete(scanId);
      }
      return next;
    });
  }, []);

  /**
   * Select all scans
   */
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === scans.length) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all
      setSelectedIds(new Set(scans.map((scan) => scan.id)));
    }
  }, [scans, selectedIds.size]);

  /**
   * Clear selection
   */
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // =============================================================================
  // Download
  // =============================================================================

  /**
   * Handle download request
   */
  const handleDownload = useCallback(async (scanId: string) => {
    try {
      const response = await fetch(`/api/invoices/scans/${scanId}/download`);
      
      if (!response.ok) {
        throw new Error(SCANNED_INVOICE_ERROR_MESSAGES.DOWNLOAD_FAILED);
      }

      const data = await response.json();
      
      // Open the signed URL in a new tab to trigger download
      window.open(data.url, '_blank');
    } catch (err) {
      alert(err instanceof Error ? err.message : SCANNED_INVOICE_ERROR_MESSAGES.DOWNLOAD_FAILED);
    }
  }, []);

  // =============================================================================
  // Deletion
  // =============================================================================

  /**
   * Show delete confirmation dialog
   */
  const showDeleteConfirmation = useCallback((scanIds: string[], isSingle: boolean) => {
    setDeleteConfirmation({
      isOpen: true,
      scanIds,
      isSingle,
    });
  }, []);

  /**
   * Handle delete request for a single scan
   */
  const handleDeleteSingle = useCallback((scanId: string) => {
    showDeleteConfirmation([scanId], true);
  }, [showDeleteConfirmation]);

  /**
   * Handle bulk delete request
   */
  const handleDeleteBulk = useCallback(() => {
    if (selectedIds.size === 0) return;
    showDeleteConfirmation(Array.from(selectedIds), false);
  }, [selectedIds, showDeleteConfirmation]);

  /**
   * Confirm and execute deletion
   */
  const confirmDelete = useCallback(async () => {
    const { scanIds, isSingle } = deleteConfirmation;
    
    setIsDeleting(true);
    setError(null);

    try {
      if (isSingle) {
        // Single deletion
        const response = await fetch(`/api/invoices/scans/${scanIds[0]}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error(SCANNED_INVOICE_ERROR_MESSAGES.DELETE_FAILED);
        }
      } else {
        // Bulk deletion
        const response = await fetch('/api/invoices/scans/bulk', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ scan_ids: scanIds }),
        });

        if (!response.ok) {
          throw new Error(SCANNED_INVOICE_ERROR_MESSAGES.DELETE_FAILED);
        }

        const result = await response.json();
        
        // Show errors if any deletions failed
        if (result.failed && result.failed.length > 0) {
          const errorMsg = `${result.deleted} fichier(s) supprimé(s), ${result.failed.length} échec(s)`;
          setError(errorMsg);
        }
      }

      // Refresh the list
      await fetchScans();
      
      // Clear selection
      clearSelection();
      
      // Close confirmation dialog
      setDeleteConfirmation({ isOpen: false, scanIds: [], isSingle: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : SCANNED_INVOICE_ERROR_MESSAGES.DELETE_FAILED);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirmation, fetchScans, clearSelection]);

  /**
   * Cancel deletion
   */
  const cancelDelete = useCallback(() => {
    setDeleteConfirmation({ isOpen: false, scanIds: [], isSingle: false });
  }, []);

  // =============================================================================
  // Render Helpers
  // =============================================================================

  /**
   * Render loading state
   */
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  /**
   * Render empty state
   */
  if (scans.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <FileX className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-lg">Aucune facture scannée</p>
        <p className="text-gray-400 text-sm mt-2">
          Les fichiers uploadés apparaîtront ici
        </p>
      </div>
    );
  }

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800"
          >
            ×
          </button>
        </div>
      )}

      {/* Bulk actions toolbar */}
      {canDelete && scans.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedIds.size === scans.length && scans.length > 0}
              onChange={handleSelectAll}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              {selectedIds.size > 0
                ? `${selectedIds.size} fichier(s) sélectionné(s)`
                : 'Tout sélectionner'}
            </span>
          </div>

          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteBulk}
              className="
                flex items-center gap-2 px-4 py-2
                text-sm font-medium text-red-700 bg-red-50
                rounded-md hover:bg-red-100
                transition-colors
              "
            >
              <Trash2 className="w-4 h-4" />
              <span>Supprimer ({selectedIds.size})</span>
            </button>
          )}
        </div>
      )}

      {/* Scans grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {scans.map((scan) => (
          <ScannedInvoiceCard
            key={scan.id}
            scan={scan}
            canDelete={canDelete}
            onDownload={handleDownload}
            onDelete={canDelete ? handleDeleteSingle : undefined}
            isSelected={selectedIds.has(scan.id)}
            onSelectionChange={canDelete ? handleSelectionChange : undefined}
          />
        ))}
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Confirmer la suppression
            </h3>
            <p className="text-gray-600 mb-6">
              {deleteConfirmation.isSingle
                ? 'Êtes-vous sûr de vouloir supprimer ce fichier ? Cette action est irréversible.'
                : `Êtes-vous sûr de vouloir supprimer ${deleteConfirmation.scanIds.length} fichier(s) ? Cette action est irréversible.`}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={cancelDelete}
                disabled={isDeleting}
                className="
                  px-4 py-2 text-sm font-medium text-gray-700
                  bg-gray-100 rounded-md hover:bg-gray-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                "
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="
                  flex items-center gap-2 px-4 py-2
                  text-sm font-medium text-white bg-red-600
                  rounded-md hover:bg-red-700
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                "
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Suppression...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Supprimer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
