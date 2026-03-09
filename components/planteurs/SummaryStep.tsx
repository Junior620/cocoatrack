'use client';

// CocoaTrack V2 - Summary Step Component
// Step 3 of import wizard: Display import results
// Requirements: 5.5

import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImportSummary } from '@/types/planteur-import';

// =============================================================================
// Types
// =============================================================================

export interface SummaryStepProps {
  /** Import summary with results */
  summary: ImportSummary;
  /** Callback to close the modal */
  onClose: () => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if import was successful (no failures)
 */
function isImportSuccessful(summary: ImportSummary): boolean {
  return summary.failed_count === 0;
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Success message display
 */
function SuccessMessage({ summary }: { summary: ImportSummary }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
      <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h3 className="text-base font-semibold text-green-900 mb-1">
          Import réussi !
        </h3>
        <p className="text-sm text-green-700">
          {summary.total_processed} ligne{summary.total_processed > 1 ? 's' : ''} traitée
          {summary.total_processed > 1 ? 's' : ''} avec succès.
        </p>
      </div>
    </div>
  );
}

/**
 * Partial success message display
 */
function PartialSuccessMessage({ summary }: { summary: ImportSummary }) {
  const successCount = summary.created_count + summary.updated_count;
  
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-orange-50 border border-orange-200">
      <AlertCircle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h3 className="text-base font-semibold text-orange-900 mb-1">
          Import partiellement réussi
        </h3>
        <p className="text-sm text-orange-700">
          {successCount} ligne{successCount > 1 ? 's' : ''} importée
          {successCount > 1 ? 's' : ''} avec succès, mais {summary.failed_count} ligne
          {summary.failed_count > 1 ? 's ont' : ' a'} échoué.
        </p>
      </div>
    </div>
  );
}

/**
 * Statistics cards display
 */
function StatisticsCards({ summary }: { summary: ImportSummary }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Created */}
      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-green-700 uppercase tracking-wide">
            Créés
          </p>
          <CheckCircle className="h-4 w-4 text-green-600" />
        </div>
        <p className="text-3xl font-bold text-green-900">{summary.created_count}</p>
      </div>

      {/* Updated */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">
            Mis à jour
          </p>
          <CheckCircle className="h-4 w-4 text-blue-600" />
        </div>
        <p className="text-3xl font-bold text-blue-900">{summary.updated_count}</p>
      </div>

      {/* Skipped */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">
            Ignorés
          </p>
          <X className="h-4 w-4 text-gray-600" />
        </div>
        <p className="text-3xl font-bold text-gray-900">{summary.skipped_count}</p>
      </div>

      {/* Failed */}
      <div className="bg-red-50 rounded-lg p-4 border border-red-200">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-red-700 uppercase tracking-wide">
            Échoués
          </p>
          <XCircle className="h-4 w-4 text-red-600" />
        </div>
        <p className="text-3xl font-bold text-red-900">{summary.failed_count}</p>
      </div>
    </div>
  );
}

/**
 * Error list display
 */
function ErrorList({ summary }: { summary: ImportSummary }) {
  if (summary.errors.length === 0) return null;

  return (
    <div className="border border-red-200 rounded-lg overflow-hidden">
      <div className="bg-red-50 px-4 py-3 border-b border-red-200">
        <h3 className="text-sm font-semibold text-red-900 flex items-center gap-2">
          <XCircle className="h-4 w-4" />
          Erreurs détectées ({summary.errors.length})
        </h3>
      </div>
      <div className="bg-white max-h-64 overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Ligne
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Erreur
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {summary.errors.map((error, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                  {error.row_number}
                </td>
                <td className="px-4 py-3 text-sm text-red-700">
                  {error.error_message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * SummaryStep Component
 * 
 * Displays import results including:
 * - Success/partial success message
 * - Statistics (created, updated, skipped, failed counts)
 * - List of errors with row numbers
 * - Close button to return to planteurs page
 * 
 * Requirements: 5.5
 */
export function SummaryStep({ summary, onClose }: SummaryStepProps) {
  const isSuccess = isImportSuccessful(summary);

  return (
    <div className="p-6 space-y-6">
      {/* Success/Partial Success Message */}
      {isSuccess ? (
        <SuccessMessage summary={summary} />
      ) : (
        <PartialSuccessMessage summary={summary} />
      )}

      {/* Statistics Cards */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-3">Résultats détaillés</h3>
        <StatisticsCards summary={summary} />
      </div>

      {/* Error List */}
      {summary.errors.length > 0 && (
        <div>
          <ErrorList summary={summary} />
        </div>
      )}

      {/* Additional Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <span className="font-medium">Note :</span> Les planteurs importés sont maintenant
          disponibles dans la liste des planteurs. Vous pouvez les consulter et les modifier
          si nécessaire.
        </p>
      </div>

      {/* Close Button */}
      <div className="flex items-center justify-end pt-4">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <CheckCircle className="h-4 w-4" />
          Fermer
        </button>
      </div>
    </div>
  );
}

export default SummaryStep;
