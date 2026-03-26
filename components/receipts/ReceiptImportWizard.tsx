'use client';

import { useState, useCallback, useMemo } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { PdfUploader, type UploadCompleteResult } from './PdfUploader';
import { ExtractionMethodSelector, type ExtractionMethod } from './ExtractionMethodSelector';
import { ReceiptForm, type ReceiptFormData } from './ReceiptForm';
import { CooperativeSelector } from './CooperativeSelector';
import type { ParsedReceipt } from '@/types/receipts';
import { dashboardKeys } from '@/lib/hooks/useDashboard';
import { useReceiptFormCache } from '@/lib/hooks/useReceiptFormCache';
import { useReceiptErrorHandler } from '@/lib/hooks/useReceiptErrorHandler';

// ============================================================================
// TYPES
// ============================================================================

type WizardStep = 'cooperative' | 'upload' | 'method' | 'form' | 'confirm';

interface WizardState {
  step: WizardStep;
  selectedCooperativeId: string | null;
  uploadResult: UploadCompleteResult | null;
  uploadError: string | null;
  extractionMethod: ExtractionMethod;
  extractedData: ParsedReceipt | null;
  formData: ReceiptFormData | null;
  creationResult: { deliveryCount: number; collectionReceiptId: string } | null;
}

export interface ReceiptImportWizardProps {
  /** Optional cooperative ID - if not provided, user will select from available cooperatives or "none" */
  cooperativeId?: string | null;
  /** Called after a successful import */
  onImportComplete: (deliveryCount: number) => void;
  /** Called when the wizard is closed */
  onClose: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'cooperative', label: 'Coopérative' },
  { id: 'upload', label: 'Upload' },
  { id: 'method', label: 'Méthode' },
  { id: 'form', label: 'Formulaire' },
  { id: 'confirm', label: 'Confirmation' },
];

const STEP_INDEX: Record<WizardStep, number> = {
  cooperative: 0,
  upload: 1,
  method: 2,
  form: 3,
  confirm: 4,
};

// ============================================================================
// HELPERS
// ============================================================================

function parsedReceiptToFormData(parsed: ParsedReceipt): Partial<ReceiptFormData> {
  return {
    contractNumber: parsed.contractNumber ?? '',
    receiptNumber: parsed.receiptNumber ?? '',
    campaign: parsed.campaign ?? '',
    region: parsed.location?.region ?? '',
    department: parsed.location?.department ?? '',
    arrondissement: parsed.location?.arrondissement ?? '',
    village: parsed.location?.village ?? '',
    transactionDate: parsed.transactionDate ?? '',
    professionalCardNumber: parsed.professionalCard ?? '',
    productLines: parsed.productLines ?? [],
    paymentMode: parsed.payment?.mode ?? 'Espèces',
    amountPaid: parsed.payment?.amountPaid ?? 0,
  };
}

// ============================================================================
// PROGRESS BAR
// ============================================================================

function ProgressBar({ currentStep }: { currentStep: WizardStep }) {
  const currentIndex = STEP_INDEX[currentStep];

  return (
    <div className="flex items-center gap-0" role="progressbar" aria-label="Étapes de l'import">
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500',
                ].join(' ')}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? <CheckCircle className="w-4 h-4" /> : index + 1}
              </div>
              <span
                className={[
                  'text-xs mt-1 whitespace-nowrap',
                  isCurrent ? 'text-blue-600 font-medium' : 'text-gray-500',
                ].join(' ')}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {index < STEPS.length - 1 && (
              <div
                className={[
                  'flex-1 h-0.5 mx-2 mb-4 transition-colors',
                  index < currentIndex ? 'bg-green-400' : 'bg-gray-200',
                ].join(' ')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// CONFIRMATION SUMMARY
// ============================================================================

function ConfirmationSummary({
  formData,
  uploadResult,
  extractionMethod,
  isSubmitting,
  error,
  canRetry,
  isRetrying,
  onConfirm,
  onBack,
}: {
  formData: ReceiptFormData;
  uploadResult: UploadCompleteResult;
  extractionMethod: ExtractionMethod;
  isSubmitting: boolean;
  error: string | null;
  canRetry?: boolean;
  isRetrying?: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const totalAmount = formData.productLines.reduce((sum, l) => sum + l.amount, 0);
  const balance = totalAmount - formData.amountPaid;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Récapitulatif de l&apos;import
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {/* Contract */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p className="font-medium text-gray-700">Contrat</p>
            <p className="text-gray-600">N° reçu : <span className="font-medium">{formData.receiptNumber || '—'}</span></p>
            <p className="text-gray-600">Contrat : <span className="font-medium">{formData.contractNumber || '—'}</span></p>
            <p className="text-gray-600">Campagne : <span className="font-medium">{formData.campaign || '—'}</span></p>
            <p className="text-gray-600">Date : <span className="font-medium">{formData.transactionDate || '—'}</span></p>
          </div>

          {/* Products */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p className="font-medium text-gray-700">Produits</p>
            <p className="text-gray-600">
              Lignes : <span className="font-medium">{formData.productLines.length}</span>
            </p>
            <p className="text-gray-600">
              Total : <span className="font-medium">{totalAmount.toLocaleString('fr-FR')} XAF</span>
            </p>
            <p className="text-gray-600">
              Versé : <span className="font-medium">{formData.amountPaid.toLocaleString('fr-FR')} XAF</span>
            </p>
            <p className="text-gray-600">
              Solde : <span className="font-medium">{balance.toLocaleString('fr-FR')} XAF</span>
            </p>
          </div>

          {/* File */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p className="font-medium text-gray-700">Fichier</p>
            <p className="text-gray-600 truncate">{uploadResult.fileName}</p>
            <p className="text-gray-600">
              {(uploadResult.fileSize / 1024 / 1024).toFixed(2)} MB
            </p>
            <p className="text-gray-600">
              Méthode : <span className="font-medium capitalize">{extractionMethod === 'ocr' ? 'OCR' : 'Manuelle'}</span>
            </p>
          </div>

          {/* Location */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p className="font-medium text-gray-700">Localisation</p>
            {formData.region && <p className="text-gray-600">Région : <span className="font-medium">{formData.region}</span></p>}
            {formData.department && <p className="text-gray-600">Département : <span className="font-medium">{formData.department}</span></p>}
            {formData.village && <p className="text-gray-600">Village : <span className="font-medium">{formData.village}</span></p>}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
            {canRetry && !isRetrying && (
              <p className="text-xs text-red-500 mt-1">
                Cliquez sur &quot;Confirmer l&apos;import&quot; pour réessayer.
              </p>
            )}
            {isRetrying && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Nouvelle tentative en cours…
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Retour
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSubmitting ? 'Création en cours…' : 'Confirmer l\'import'}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// SUCCESS STEP
// ============================================================================

function SuccessStep({
  deliveryCount,
  onClose,
}: {
  deliveryCount: number;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
      <CheckCircle className="w-16 h-16 text-green-500" />
      <h3 className="text-lg font-semibold text-gray-900">Import réussi</h3>
      <p className="text-gray-600">
        {deliveryCount} livraison{deliveryCount > 1 ? 's' : ''} créée{deliveryCount > 1 ? 's' : ''} avec succès.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-4 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Voir les livraisons
      </button>
    </div>
  );
}

// ============================================================================
// MAIN WIZARD
// ============================================================================

/**
 * ReceiptImportWizard
 *
 * Multi-step wizard for importing collection receipts (RECU DE COLLECTE D'ACHAT).
 * Steps: Upload → Method → Form → Confirm
 *
 * Requirements: 11.1, 11.2, 11.3, 11.7
 */
export function ReceiptImportWizard({
  cooperativeId: initialCooperativeId,
  onImportComplete,
  onClose,
}: ReceiptImportWizardProps) {
  const queryClient = useQueryClient();

  const [state, setState] = useState<WizardState>({
    step: initialCooperativeId ? 'upload' : 'cooperative',
    selectedCooperativeId: initialCooperativeId ?? null,
    uploadResult: null,
    uploadError: null,
    extractionMethod: 'manual',
    extractedData: null,
    formData: null,
    creationResult: null,
  });

  // Pre-fetch and cache planteur/chef lists once cooperative is selected (Req 18.3, 18.4)
  const activeCooperativeId = state.selectedCooperativeId;
  // Only pre-fetch if cooperative is selected (not null)
  useReceiptFormCache(activeCooperativeId ?? '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Centralized error handler with retry logic (Requirements: 10.3, 10.6)
  const logContext = useMemo(
    () => ({ cooperativeId: activeCooperativeId ?? 'none' }),
    [activeCooperativeId]
  );
  const { errorState, handleError, clearError, withRetry } = useReceiptErrorHandler({ logContext });

  const hasUnsavedData = state.step !== 'cooperative' && state.step !== 'upload'
    || (state.step === 'upload' && (state.uploadResult !== null || state.formData !== null));

  const handleCloseRequest = useCallback(() => {
    if (state.creationResult) {
      // Import done — close directly
      onClose();
      return;
    }
    if (hasUnsavedData) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  }, [hasUnsavedData, state.creationResult, onClose]);

  // ── Step handlers ─────────────────────────────────────────────────────────

  // Called when cooperative is selected
  const handleCooperativeSelected = useCallback((cooperativeId: string) => {
    // "none" means no cooperative
    const coopId = cooperativeId === 'none' ? null : cooperativeId;
    setState((prev) => ({ 
      ...prev, 
      selectedCooperativeId: coopId,
      step: 'upload' 
    }));
  }, []);

  // Called immediately after file validation — advance to method step
  // while upload continues in background (Req 18.1)
  const handleFileValidated = useCallback(() => {
    setState((prev) => ({ ...prev, step: 'method' }));
  }, []);

  // Called when background upload finishes — store the result
  const handleUploadComplete = useCallback((result: UploadCompleteResult) => {
    setState((prev) => ({ ...prev, uploadResult: result, uploadError: null }));
  }, []);

  // Called when background upload fails
  const handleUploadError = useCallback((error: string) => {
    setState((prev) => ({ ...prev, uploadError: error }));
  }, []);

  const handleMethodSelected = useCallback((method: ExtractionMethod) => {
    setState((prev) => ({ ...prev, extractionMethod: method }));
  }, []);

  const handleDataExtracted = useCallback((data: ParsedReceipt) => {
    setState((prev) => ({ ...prev, extractedData: data }));
  }, []);

  const handleMethodNext = useCallback(() => {
    setState((prev) => ({ ...prev, step: 'form' }));
  }, []);

  const handleFormSubmit = useCallback((data: ReceiptFormData) => {
    setState((prev) => ({ ...prev, formData: data, step: 'confirm' }));
  }, []);

  const handleBack = useCallback(() => {
    setState((prev) => {
      const stepOrder: WizardStep[] = ['cooperative', 'upload', 'method', 'form', 'confirm'];
      const currentIndex = stepOrder.indexOf(prev.step);
      const prevStep = currentIndex > 0 ? stepOrder[currentIndex - 1] : prev.step;
      return { ...prev, step: prevStep };
    });
    clearError();
  }, [clearError]);

  const handleConfirm = useCallback(async () => {
    if (!state.formData || !state.uploadResult || state.selectedCooperativeId === undefined) {
      handleError({ code: 'NETWORK_ERROR', message: 'Upload du fichier en cours. Veuillez patienter…' });
      return;
    }

    setIsSubmitting(true);
    clearError();

    try {
      const payload = {
        pdfUrl: state.uploadResult.pdfUrl,
        pdfFileName: state.uploadResult.fileName,
        pdfFileSize: state.uploadResult.fileSize,
        cooperativeId: activeCooperativeId, // Can be null
        planteurId: state.formData.planteurId,
        chefPlanteurId: state.formData.chefPlanteurId,
        chefPlanteurName: state.formData.chefPlanteurName,
        contractNumber: state.formData.contractNumber,
        receiptNumber: state.formData.receiptNumber,
        campaign: state.formData.campaign,
        transactionDate: state.formData.transactionDate,
        location: {
          region: state.formData.region,
          department: state.formData.department,
          arrondissement: state.formData.arrondissement,
          village: state.formData.village,
        },
        professionalCardNumber: state.formData.professionalCardNumber,
        productLines: state.formData.productLines,
        payment: {
          mode: state.formData.paymentMode,
          amountPaid: state.formData.amountPaid,
        },
        extractionMethod: state.extractionMethod,
      };

      // Use withRetry for automatic exponential backoff on network errors (Req 10.3)
      const result = await withRetry(async () => {
        const response = await fetch('/api/receipts/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const errorCode = body?.error?.code ?? 'UNKNOWN_ERROR';
          const errorMessage = body?.error?.message ?? `Erreur ${response.status}: création échouée`;
          throw { code: errorCode, message: errorMessage };
        }

        return response.json();
      });

      setState((prev) => ({
        ...prev,
        creationResult: {
          deliveryCount: result.deliveryCount,
          collectionReceiptId: result.collectionReceiptId,
        },
      }));

      // Invalidate dashboard aggregates cache so fresh data is displayed (Req 18.6)
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });

      onImportComplete(result.deliveryCount);
    } catch (err) {
      // handleError is called inside withRetry, but catch here to ensure isSubmitting resets
      if (!errorState.error) {
        handleError(err);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [state.formData, state.uploadResult, state.extractionMethod, activeCooperativeId, onImportComplete, withRetry, handleError, clearError, errorState.error, queryClient]);

  // ── Render ────────────────────────────────────────────────────────────────

  const initialFormData = useMemo(
    () => state.extractedData ? parsedReceiptToFormData(state.extractedData) : undefined,
    [state.extractedData]
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        aria-hidden="true"
        onClick={handleCloseRequest}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Importer un reçu de collecte"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-900">
              Importer un reçu de collecte
            </h2>
            <button
              type="button"
              onClick={handleCloseRequest}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Progress bar */}
          {!state.creationResult && (
            <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <ProgressBar currentStep={state.step} />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* Success */}
            {state.creationResult && (
              <SuccessStep
                deliveryCount={state.creationResult.deliveryCount}
                onClose={onClose}
              />
            )}

            {/* Step: Cooperative Selection */}
            {!state.creationResult && state.step === 'cooperative' && (
              <CooperativeSelector
                onSelect={handleCooperativeSelected}
                onCancel={onClose}
              />
            )}

            {/* Step: Upload */}
            {!state.creationResult && state.step === 'upload' && state.selectedCooperativeId !== undefined && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Sélectionnez le fichier PDF du reçu de collecte à importer.
                </p>
                <PdfUploader
                  cooperativeId={activeCooperativeId ?? 'none'}
                  onUploadComplete={handleUploadComplete}
                  onFileValidated={handleFileValidated}
                  onUploadError={handleUploadError}
                />
              </div>
            )}

            {/* Step: Method */}
            {!state.creationResult && state.step === 'method' && (
              <div className="space-y-6">
                {/* Upload still in progress */}
                {!state.uploadResult && !state.uploadError && (
                  <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
                    <p className="text-sm text-blue-700">Upload du fichier en cours…</p>
                  </div>
                )}

                {/* Upload failed — let user retry from step 1 */}
                {!state.uploadResult && state.uploadError && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-700">Échec de l&apos;upload</p>
                      <p className="text-sm text-red-600 mt-1">{state.uploadError}</p>
                    </div>
                  </div>
                )}

                {/* Upload done — show extraction method selector */}
                {state.uploadResult && (
                  <ExtractionMethodSelector
                    pdfUrl={state.uploadResult.pdfUrl}
                    onMethodSelected={handleMethodSelected}
                    onDataExtracted={handleDataExtracted}
                  />
                )}

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Retour
                  </button>
                  <button
                    type="button"
                    onClick={handleMethodNext}
                    disabled={!state.uploadResult}
                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Continuer
                  </button>
                </div>
              </div>
            )}

            {/* Step: Form */}
            {!state.creationResult && state.step === 'form' && state.uploadResult && state.selectedCooperativeId !== undefined && (
              <div className="space-y-4">
                <div className="flex justify-start mb-2">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Retour
                  </button>
                </div>
                <ReceiptForm
                  key={state.extractionMethod}
                  initialData={initialFormData}
                  pdfUrl={state.uploadResult.pdfUrl}
                  cooperativeId={activeCooperativeId ?? 'none'}
                  onSubmit={handleFormSubmit}
                />
              </div>
            )}

            {/* Step: Confirm */}
            {!state.creationResult && state.step === 'confirm' && state.formData && state.uploadResult && (
              <ConfirmationSummary
                formData={state.formData}
                uploadResult={state.uploadResult}
                extractionMethod={state.extractionMethod}
                isSubmitting={isSubmitting}
                error={errorState.message}
                canRetry={errorState.canRetry}
                isRetrying={errorState.isRetrying}
                onConfirm={handleConfirm}
                onBack={handleBack}
              />
            )}
          </div>
        </div>
      </div>

      {/* Close confirmation dialog */}
      {showCloseConfirm && (
        <>
          <div className="fixed inset-0 bg-black/60" style={{ zIndex: 9998 }} aria-hidden="true" />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="close-confirm-title"
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 9999 }}
          >
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
              <h3 id="close-confirm-title" className="text-base font-semibold text-gray-900">
                Abandonner l&apos;import ?
              </h3>
              <p className="text-sm text-gray-600">
                Les données saisies seront perdues. Voulez-vous vraiment fermer ?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCloseConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCloseConfirm(false); onClose(); }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Fermer quand même
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
