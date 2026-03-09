'use client';

// CocoaTrack V2 - Bulk Assignment Dialog Component
// Modal dialog for assigning multiple planteurs to chef planteur and/or cooperative
// Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.1, 7.4, 7.5, 8.2
//
// Error Handling (Requirements 7.1, 7.4, 7.5):
// - Network errors: Gracefully handled with user-friendly messages
// - Timeout errors: 30-second timeout with specific error message
// - Database errors: Detected and reported with retry option
// - Selection state: Preserved on error to allow retry without re-selection

import { useState, useEffect } from 'react';
import { X, Users, Loader2, AlertCircle } from 'lucide-react';
import { chefPlanteursApi } from '@/lib/api/chef-planteurs';
import { cooperativesApi } from '@/lib/api/cooperatives';
import { showSuccessToast, showWarningToast, showErrorToast } from '@/lib/offline/offline-toast';
import type { BulkAssignmentDialogProps, BulkAssignmentFormData } from '@/types/planteur-bulk';
import type { Database } from '@/types/database.gen';

type ChefPlanteur = Database['public']['Tables']['chef_planteurs']['Row'];
type Cooperative = { id: string; name: string; code: string | null };

/**
 * BulkAssignmentDialog Component
 * 
 * Modal dialog for bulk assignment of planteurs to chef planteur and/or cooperative.
 * Loads available options from API on mount and handles form submission with validation.
 * 
 * Requirements:
 * - 2.2: Display assignment dialog when bulk assign button is clicked
 * - 2.3: Provide dropdown to select chef planteur (optional)
 * - 2.4: Provide dropdown to select cooperative (optional)
 * - 2.5: Allow selecting both chef planteur and cooperative simultaneously
 * - 2.6: Allow clearing existing assignments by selecting "None"
 * - 2.7: Load available chef planteurs and cooperatives on mount
 */
export function BulkAssignmentDialog({
  isOpen,
  selectedPlanteurIds,
  onClose,
  onSuccess,
}: BulkAssignmentDialogProps) {
  // Form state
  const [formData, setFormData] = useState<BulkAssignmentFormData>({
    chefPlanteurId: null,
    cooperativeId: null,
  });

  // Options state
  const [chefPlanteurs, setChefPlanteurs] = useState<ChefPlanteur[]>([]);
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]);

  // UI state
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Load options when dialog opens (Requirement 2.7)
  useEffect(() => {
    if (isOpen) {
      loadOptions();
    } else {
      // Reset form when dialog closes
      setFormData({
        chefPlanteurId: null,
        cooperativeId: null,
      });
      setError(null);
      setShowConfirmation(false);
    }
  }, [isOpen]);

  /**
   * Load chef planteurs and cooperatives from API
   * Handles network errors gracefully (Requirement 7.1)
   */
  const loadOptions = async () => {
    setIsLoadingOptions(true);
    setError(null);

    try {
      // Load chef planteurs (first 100, active only)
      const chefPlanteursResult = await chefPlanteursApi.list({
        page: 1,
        pageSize: 100,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      // Load cooperatives
      const cooperativesResult = await cooperativesApi.listWithStats();

      setChefPlanteurs(chefPlanteursResult.data as unknown as ChefPlanteur[]);
      setCooperatives(cooperativesResult.map(c => ({
        id: c.id,
        name: c.name,
        code: c.code,
      })));
    } catch (err) {
      // Handle network errors gracefully (Requirement 7.1)
      let errorMessage = 'Erreur lors du chargement des options';
      
      if (err instanceof Error) {
        if (err.message.includes('fetch') || err.message.includes('network')) {
          errorMessage = 'Erreur de connexion. Vérifiez votre connexion internet.';
        } else if (err.message.includes('timeout')) {
          errorMessage = 'Délai d\'attente dépassé. Veuillez réessayer.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoadingOptions(false);
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that at least one field is specified (Requirement 9.2)
    if (formData.chefPlanteurId === null && formData.cooperativeId === null) {
      setError('Veuillez sélectionner au moins un champ à assigner');
      return;
    }

    // Show confirmation dialog
    setShowConfirmation(true);
  };

  /**
   * Handle confirmed assignment
   * Handles network errors and timeouts gracefully (Requirements 7.1, 7.4, 7.5)
   */
  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);

    // Show progress indicator for large operations (Requirement 8.2)
    if (selectedPlanteurIds.length > 100) {
      setShowProgress(true);
    }

    try {
      // Create abort controller for timeout handling (Requirement 7.4)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      // Call API endpoint
      const response = await fetch('/api/planteurs/bulk-assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planteurIds: selectedPlanteurIds,
          chefPlanteurId: formData.chefPlanteurId,
          cooperativeId: formData.cooperativeId,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de l\'assignation');
      }

      const result = await response.json();

      // Show appropriate feedback based on results (Requirements 5.1, 5.2, 5.3)
      if (result.failureCount === 0) {
        // Complete success - auto-dismiss after 5 seconds (Requirement 5.4)
        showSuccessToast(
          `${result.successCount} planteur(s) assigné(s) avec succès`,
          5000
        );
      } else if (result.successCount > 0) {
        // Partial success - manual dismiss (Requirement 5.5)
        showWarningToast(
          `${result.successCount} planteur(s) assigné(s), ${result.failureCount} échec(s)`,
          0 // 0 duration means manual dismiss
        );
      } else {
        // Complete failure - manual dismiss (Requirement 5.5)
        showErrorToast(
          'Échec de l\'assignation. Vérifiez vos permissions.',
          0 // 0 duration means manual dismiss
        );
      }

      // Close dialog and notify success
      onSuccess();
      onClose();
    } catch (err) {
      // Handle network errors gracefully (Requirements 7.1, 7.4, 7.5)
      let errorMessage = 'Erreur lors de l\'assignation';
      
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          // Timeout error (Requirement 7.4)
          errorMessage = 'Délai d\'attente dépassé. L\'opération a pris trop de temps. Veuillez réessayer avec moins de planteurs.';
        } else if (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed to fetch')) {
          // Network error (Requirement 7.1)
          errorMessage = 'Erreur de connexion. Vérifiez votre connexion internet et réessayez.';
        } else if (err.message.includes('database') || err.message.includes('PGRST')) {
          // Database error (Requirement 7.1)
          errorMessage = 'Erreur de base de données. Veuillez réessayer dans quelques instants.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      setShowConfirmation(false);
      // Selection state is preserved (Requirement 7.5) - we don't clear it on error
    } finally {
      setIsSubmitting(false);
      setShowProgress(false);
    }
  };

  /**
   * Handle cancel confirmation
   */
  const handleCancelConfirm = () => {
    setShowConfirmation(false);
  };

  /**
   * Handle close dialog
   */
  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  // Get selected chef planteur and cooperative names for confirmation
  const selectedChefPlanteur = chefPlanteurs.find(cp => cp.id === formData.chefPlanteurId);
  const selectedCooperative = cooperatives.find(c => c.id === formData.cooperativeId);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-assignment-dialog-title"
      aria-describedby="bulk-assignment-dialog-description"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary-600" aria-hidden="true" />
            <h2 id="bulk-assignment-dialog-title" className="text-base sm:text-lg font-semibold text-gray-900">
              Assignation en masse
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1 text-gray-400 hover:text-gray-600 rounded disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Fermer la boîte de dialogue"
            type="button"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Selection count */}
          <div 
            id="bulk-assignment-dialog-description" 
            className="mb-4 p-3 bg-primary-50 border border-primary-200 rounded-lg"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm text-primary-900">
              <span className="font-semibold">{selectedPlanteurIds.length}</span> planteur(s) sélectionné(s)
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert" aria-live="assertive">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1">
                  <p className="text-sm text-red-600">{error}</p>
                  {/* Show retry button if loading options failed */}
                  {!isLoadingOptions && chefPlanteurs.length === 0 && cooperatives.length === 0 && (
                    <button
                      onClick={loadOptions}
                      className="mt-2 text-sm font-medium text-red-700 hover:text-red-800 underline"
                    >
                      Réessayer le chargement
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoadingOptions ? (
            <div className="space-y-4" role="status" aria-live="polite" aria-label="Chargement des options">
              {/* Loading skeleton for better UX */}
              <div className="animate-pulse space-y-4">
                <div>
                  <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
                  <div className="h-10 w-full bg-gray-200 rounded"></div>
                </div>
                <div>
                  <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
                  <div className="h-10 w-full bg-gray-200 rounded"></div>
                </div>
              </div>
              <p className="text-center text-sm text-gray-500 mt-4">Chargement des options...</p>
            </div>
          ) : showProgress ? (
            /* Progress indicator for large operations (Requirement 8.2) */
            <div className="py-8 text-center" role="status" aria-live="polite" aria-label="Assignation en cours">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary-600" aria-hidden="true" />
              <p className="mt-2 text-sm text-gray-700 font-medium">
                Assignation en cours...
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Traitement de {selectedPlanteurIds.length} planteur(s)
              </p>
            </div>
          ) : showConfirmation ? (
            /* Confirmation view */
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                Voulez-vous vraiment assigner <span className="font-semibold">{selectedPlanteurIds.length}</span> planteur(s) ?
              </p>

              {selectedChefPlanteur && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Chef Planteur</p>
                  <p className="text-sm font-medium text-gray-900">{selectedChefPlanteur.name}</p>
                </div>
              )}

              {selectedCooperative && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Coopérative</p>
                  <p className="text-sm font-medium text-gray-900">{selectedCooperative.name}</p>
                </div>
              )}

              {!selectedChefPlanteur && !selectedCooperative && (
                <p className="text-sm text-gray-500 italic">Aucune assignation sélectionnée</p>
              )}
            </div>
          ) : (
            /* Form view */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Chef Planteur dropdown (Requirement 2.3) */}
              <div>
                <label htmlFor="chefPlanteur" className="block text-sm font-medium text-gray-700 mb-1">
                  Chef Planteur (optionnel)
                </label>
                <select
                  id="chefPlanteur"
                  name="chefPlanteur"
                  value={formData.chefPlanteurId || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    chefPlanteurId: e.target.value || null,
                  }))}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-describedby="chefPlanteur-help"
                >
                  <option value="">-- Aucun / Effacer --</option>
                  {chefPlanteurs.map((cp) => (
                    <option key={cp.id} value={cp.id}>
                      {cp.name} {cp.code ? `(${cp.code})` : ''}
                    </option>
                  ))}
                </select>
                <p id="chefPlanteur-help" className="mt-1 text-xs text-gray-500">
                  Sélectionnez "Aucun" pour effacer l'assignation existante
                </p>
              </div>

              {/* Cooperative dropdown (Requirement 2.4) */}
              <div>
                <label htmlFor="cooperative" className="block text-sm font-medium text-gray-700 mb-1">
                  Coopérative (optionnel)
                </label>
                <select
                  id="cooperative"
                  name="cooperative"
                  value={formData.cooperativeId || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    cooperativeId: e.target.value || null,
                  }))}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-describedby="cooperative-help"
                >
                  <option value="">-- Aucune / Effacer --</option>
                  {cooperatives.map((coop) => (
                    <option key={coop.id} value={coop.id}>
                      {coop.name} {coop.code ? `(${coop.code})` : ''}
                    </option>
                  ))}
                </select>
                <p id="cooperative-help" className="mt-1 text-xs text-gray-500">
                  Sélectionnez "Aucune" pour effacer l'assignation existante
                </p>
              </div>

              <p className="text-xs text-gray-500 italic">
                Vous pouvez sélectionner les deux champs simultanément
              </p>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 bg-gray-50 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
          {showConfirmation ? (
            <>
              <button
                onClick={handleCancelConfirm}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                type="button"
                aria-label="Annuler la confirmation"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                type="button"
                aria-label={isSubmitting ? 'Assignation en cours' : 'Confirmer l\'assignation'}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Assignation...</span>
                  </>
                ) : (
                  'Confirmer'
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                type="button"
                aria-label="Annuler et fermer"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || isLoadingOptions}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                type="button"
                aria-label="Continuer vers la confirmation"
              >
                Continuer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default BulkAssignmentDialog;
