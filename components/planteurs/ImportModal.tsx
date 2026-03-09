'use client';

// CocoaTrack V2 - Planteurs CSV Import Modal
// Modal with 3-step wizard: Upload → Preview → Summary
// Requirements: 10.2, 10.4

import { useState, useCallback, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  PlanteurImportFile,
  ParseResult,
  ImportSummary,
  RowAction,
} from '@/types/planteur-import';
import { 
  formatPlanteurImportError, 
  isNetworkError 
} from '@/lib/utils/error-messages';

// Import step components (to be created in subsequent tasks)
import { FileUploadStep } from './FileUploadStep';
import { PreviewStep } from './PreviewStep';
import { SummaryStep } from './SummaryStep';

// =============================================================================
// Types
// =============================================================================

export interface ImportModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback when import is complete */
  onImportComplete?: () => void;
}

type ImportStep = 'upload' | 'preview' | 'summary';

// =============================================================================
// Main Component
// =============================================================================

/**
 * ImportModal Component
 * 
 * 3-step wizard for importing planteurs via CSV:
 * 1. Upload: Select and upload CSV file
 * 2. Preview: Review parsed data, validation errors, and duplicates
 * 3. Summary: View import results
 * 
 * Requirements: 10.2, 10.4
 */
export function ImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: ImportModalProps) {
  // State management
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [importFile, setImportFile] = useState<PlanteurImportFile | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [rowActions, setRowActions] = useState<RowAction[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('upload');
      setImportFile(null);
      setParseResult(null);
      setRowActions([]);
      setImportSummary(null);
      setIsProcessing(false);
      setExecutionError(null);
      setRetryCount(0);
    }
  }, [isOpen]);

  // Handle close with confirmation if import in progress
  const handleClose = useCallback(() => {
    if (isProcessing) {
      const confirmed = window.confirm(
        'Un import est en cours. Êtes-vous sûr de vouloir fermer cette fenêtre ?'
      );
      if (!confirmed) return;
    }

    onClose();
  }, [isProcessing, onClose]);

  // Handle file upload complete
  const handleUploadComplete = useCallback(
    (file: PlanteurImportFile, result: ParseResult) => {
      setImportFile(file);
      setParseResult(result);
      
      // Initialize row actions for ALL valid rows
      const initialActions: RowAction[] = result.rows
        .filter((row) => row.validation_errors.length === 0) // Only valid rows
        .map((row) => ({
          row_number: row.row_number,
          // If duplicate exists, default to 'ignore', otherwise 'create'
          action: row.duplicate_info !== null ? ('ignore' as const) : ('create' as const),
          planteur_id: row.duplicate_info?.existing_planteur_id,
        }));
      
      setRowActions(initialActions);
      setCurrentStep('preview');
    },
    []
  );

  // Handle row action change
  const handleRowActionChange = useCallback((action: RowAction) => {
    setRowActions((prev) => {
      const existing = prev.find((a) => a.row_number === action.row_number);
      if (existing) {
        return prev.map((a) =>
          a.row_number === action.row_number ? action : a
        );
      }
      return [...prev, action];
    });
  }, []);

  // Handle import execution with retry logic
  // Requirements: 8.5 - Retry logic for network errors
  const handleExecuteImport = useCallback(async (isRetry = false) => {
    if (!importFile || !parseResult) return;

    setIsProcessing(true);
    setExecutionError(null);

    // Exponential backoff: 1s, 2s, 4s
    const currentRetry = isRetry ? retryCount + 1 : 0;
    if (isRetry && currentRetry > 0) {
      const delay = Math.pow(2, currentRetry - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      // Debug: Log row actions being sent
      console.log('[ImportModal] Executing import with row actions:', rowActions);
      console.log('[ImportModal] Row actions count:', rowActions.length);
      console.log('[ImportModal] Actions breakdown:', {
        create: rowActions.filter(a => a.action === 'create').length,
        update: rowActions.filter(a => a.action === 'update').length,
        ignore: rowActions.filter(a => a.action === 'ignore').length,
      });
      
      const response = await fetch(`/api/planteurs/import/${importFile.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          import_id: importFile.id,
          row_actions: rowActions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = formatPlanteurImportError(errorData);
        throw new Error(errorMessage);
      }

      const summary: ImportSummary = await response.json();
      setImportSummary(summary);
      setCurrentStep('summary');
      setRetryCount(0);

      // Notify parent component
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      console.error('Import execution failed:', error);
      
      // Check if it's a network error and we can retry
      const isNetwork = isNetworkError(error);
      const canRetryNow = isNetwork && currentRetry < 3;
      
      setRetryCount(currentRetry);
      
      let errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue lors de l\'import';
      
      // Add retry information to error message
      if (isNetwork) {
        if (canRetryNow) {
          errorMessage += ` (Tentative ${currentRetry + 1}/3)`;
        } else if (currentRetry >= 3) {
          errorMessage = 'Erreur réseau. Veuillez vérifier votre connexion et réessayer';
        }
      }
      
      setExecutionError(errorMessage);
      
      // Auto-retry for network errors
      if (canRetryNow) {
        setTimeout(() => {
          handleExecuteImport(true);
        }, 2000);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [importFile, parseResult, rowActions, onImportComplete, retryCount]);

  // Handle back to upload
  const handleBackToUpload = useCallback(() => {
    setCurrentStep('upload');
    setImportFile(null);
    setParseResult(null);
    setRowActions([]);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Importer des planteurs
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {currentStep === 'upload' && 'Étape 1/3 : Télécharger le fichier CSV'}
              {currentStep === 'preview' && 'Étape 2/3 : Vérifier et valider les données'}
              {currentStep === 'summary' && 'Étape 3/3 : Résumé de l\'import'}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {/* Step 1 */}
            <div className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors',
                  currentStep === 'upload'
                    ? 'bg-primary-600 text-white'
                    : 'bg-primary-100 text-primary-700'
                )}
              >
                1
              </div>
              <span
                className={cn(
                  'text-sm font-medium',
                  currentStep === 'upload' ? 'text-gray-900' : 'text-gray-500'
                )}
              >
                Télécharger
              </span>
            </div>

            {/* Connector */}
            <div className="flex-1 h-0.5 bg-gray-200 mx-2" />

            {/* Step 2 */}
            <div className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors',
                  currentStep === 'preview'
                    ? 'bg-primary-600 text-white'
                    : currentStep === 'summary'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-200 text-gray-500'
                )}
              >
                2
              </div>
              <span
                className={cn(
                  'text-sm font-medium',
                  currentStep === 'preview' ? 'text-gray-900' : 'text-gray-500'
                )}
              >
                Vérifier
              </span>
            </div>

            {/* Connector */}
            <div className="flex-1 h-0.5 bg-gray-200 mx-2" />

            {/* Step 3 */}
            <div className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors',
                  currentStep === 'summary'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                )}
              >
                3
              </div>
              <span
                className={cn(
                  'text-sm font-medium',
                  currentStep === 'summary' ? 'text-gray-900' : 'text-gray-500'
                )}
              >
                Résumé
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {currentStep === 'upload' && (
            <FileUploadStep onUploadComplete={handleUploadComplete} />
          )}

          {currentStep === 'preview' && parseResult && (
            <>
              <PreviewStep
                parseResult={parseResult}
                rowActions={rowActions}
                onRowActionChange={handleRowActionChange}
                onExecuteImport={() => handleExecuteImport(false)}
                onBack={handleBackToUpload}
                isProcessing={isProcessing}
              />
              
              {/* Execution Error Display */}
              {executionError && (
                <div className="px-6 pb-4">
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-700 mt-0.5" />
                      <p className="text-sm text-red-700">{executionError}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Processing Overlay */}
              {isProcessing && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-900">
                      Import en cours...
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Veuillez patienter, cela peut prendre quelques instants
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {currentStep === 'summary' && importSummary && (
            <SummaryStep summary={importSummary} onClose={handleClose} />
          )}
        </div>
      </div>
    </div>
  );
}

export default ImportModal;
