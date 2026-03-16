'use client';

// CocoaTrack V2 - Preview Step Component
// Step 2 of import wizard: Preview and validate CSV data
// Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7

import React, { useMemo, useCallback } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  Loader2,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  ParseResult,
  ParsedRow,
  RowAction,
  DuplicateAction,
} from '@/types/planteur-import';

// =============================================================================
// Types
// =============================================================================

export interface PreviewStepProps {
  /** Parsed CSV data with validation results */
  parseResult: ParseResult;
  /** Current row actions */
  rowActions: RowAction[];
  /** Callback when row action changes */
  onRowActionChange: (action: RowAction) => void;
  /** Callback to execute import */
  onExecuteImport: () => void;
  /** Callback to go back to upload step */
  onBack: () => void;
  /** Whether import is currently processing */
  isProcessing: boolean;
}

type RowStatus = 'valid' | 'invalid' | 'duplicate';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get row status based on validation errors and duplicates
 * Requirements: 4.2, 4.3, 4.4, 4.5
 */
function getRowStatus(row: ParsedRow): RowStatus {
  if (row.validation_errors.length > 0) {
    return 'invalid';
  }
  if (row.duplicate_info !== null) {
    return 'duplicate';
  }
  return 'valid';
}

/**
 * Get row background color based on status
 * Requirements: 4.2, 4.3, 4.4
 */
function getRowColorClass(status: RowStatus): string {
  switch (status) {
    case 'valid':
      return 'bg-green-50 hover:bg-green-100';
    case 'invalid':
      return 'bg-red-50 hover:bg-red-100';
    case 'duplicate':
      return 'bg-orange-50 hover:bg-orange-100';
  }
}

/**
 * Get status icon based on row status
 */
function getStatusIcon(status: RowStatus) {
  switch (status) {
    case 'valid':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'invalid':
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    case 'duplicate':
      return <AlertTriangle className="h-4 w-4 text-orange-600" />;
  }
}

/**
 * Get action label in French
 */
function getActionLabel(action: DuplicateAction): string {
  switch (action) {
    case 'ignore':
      return 'Ignorer';
    case 'update':
      return 'Mettre à jour';
    case 'create':
      return 'Créer quand même';
    case 'pending':
      return 'En attente';
  }
}

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Summary counts display
 * Requirements: 4.7
 */
function SummaryCounts({ parseResult }: { parseResult: ParseResult }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-xs text-gray-500 mb-1">Total</p>
        <p className="text-2xl font-semibold text-gray-900">
          {parseResult.total_rows}
        </p>
      </div>
      <div className="bg-green-50 rounded-lg p-3">
        <p className="text-xs text-green-700 mb-1">Valides</p>
        <p className="text-2xl font-semibold text-green-900">
          {parseResult.valid_rows}
        </p>
      </div>
      <div className="bg-red-50 rounded-lg p-3">
        <p className="text-xs text-red-700 mb-1">Invalides</p>
        <p className="text-2xl font-semibold text-red-900">
          {parseResult.invalid_rows}
        </p>
      </div>
      <div className="bg-orange-50 rounded-lg p-3">
        <p className="text-xs text-orange-700 mb-1">Doublons</p>
        <p className="text-2xl font-semibold text-orange-900">
          {parseResult.duplicate_rows}
        </p>
      </div>
    </div>
  );
}

/**
 * Individual row component
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
function PreviewRow({
  row,
  rowAction,
  onActionChange,
}: {
  row: ParsedRow;
  rowAction: RowAction | undefined;
  onActionChange: (action: RowAction) => void;
}) {
  const status = getRowStatus(row);
  const colorClass = getRowColorClass(status);

  // Handle action change for duplicates
  const handleActionChange = useCallback(
    (newAction: DuplicateAction) => {
      if (row.duplicate_info) {
        onActionChange({
          row_number: row.row_number,
          action: newAction === 'pending' ? 'ignore' : newAction,
          planteur_id:
            newAction === 'update' ? row.duplicate_info.existing_planteur_id : undefined,
        });
      }
    },
    [row, onActionChange]
  );

  return (
    <tr className={cn('transition-colors', colorClass)}>
      {/* Row Number */}
      <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">
        {row.row_number}
      </td>

      {/* Status Icon */}
      <td className="px-4 py-3 whitespace-nowrap">{getStatusIcon(status)}</td>

      {/* Nom */}
      <td className="px-4 py-3 text-sm text-gray-900">
        {row.data.nom || <span className="text-gray-400 italic">Vide</span>}
      </td>

      {/* Prénoms */}
      <td className="px-4 py-3 text-sm text-gray-600">
        {row.data.prénoms || <span className="text-gray-400">-</span>}
      </td>

      {/* CNI */}
      <td className="px-4 py-3 text-sm text-gray-600">
        {row.data.CNI || <span className="text-gray-400">-</span>}
      </td>

      {/* Téléphone */}
      <td className="px-4 py-3 text-sm text-gray-600">
        {row.data.téléphone || <span className="text-gray-400">-</span>}
      </td>

      {/* Superficie */}
      <td className="px-4 py-3 text-sm text-gray-600 text-right">
        {row.data.superficie !== undefined ? (
          `${row.data.superficie} ha`
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>

      {/* Âge */}
      <td className="px-4 py-3 text-sm text-gray-600 text-right">
        {row.data.age !== undefined ? (
          `${row.data.age} ans`
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>

      {/* Genre */}
      <td className="px-4 py-3 text-sm text-gray-600 text-center">
        {row.data.genre ? (
          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
            row.data.genre === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
          )}>
            {row.data.genre === 'F' ? 'Féminin' : 'Masculin'}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>

      {/* Actions (for duplicates only) */}
      <td className="px-4 py-3 whitespace-nowrap">
        {row.duplicate_info && (
          <select
            value={rowAction?.action || 'ignore'}
            onChange={(e) => handleActionChange(e.target.value as DuplicateAction)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="ignore">Ignorer</option>
            <option value="update">Mettre à jour</option>
            <option value="create">Créer quand même</option>
          </select>
        )}
      </td>
    </tr>
  );
}

/**
 * Row details (validation errors or duplicate info)
 * Requirements: 4.3, 4.4
 */
function RowDetails({ row }: { row: ParsedRow }) {
  const status = getRowStatus(row);

  if (status === 'valid') return null;

  return (
    <tr>
      <td colSpan={10} className="px-4 py-2 bg-white">
        {/* Validation Errors */}
        {row.validation_errors.length > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-900 mb-1">Erreurs de validation :</p>
              <ul className="list-disc list-inside space-y-0.5 text-red-700">
                {row.validation_errors.map((error, idx) => (
                  <li key={idx}>
                    <span className="font-medium">{error.field}</span> : {error.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Duplicate Warning */}
        {row.duplicate_info && row.validation_errors.length === 0 && (
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-orange-900 mb-1">Doublon potentiel détecté :</p>
              <p className="text-orange-700">
                Un planteur avec un nom similaire existe déjà :{' '}
                <span className="font-medium">
                  {row.duplicate_info.existing_planteur_name}
                </span>{' '}
                (Code: {row.duplicate_info.existing_planteur_code})
              </p>
              <p className="text-orange-600 text-xs mt-1">
                Choisissez une action : Ignorer (ne pas importer), Mettre à jour (modifier le
                planteur existant), ou Créer quand même (créer un nouveau planteur).
              </p>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * PreviewStep Component
 * 
 * Displays parsed CSV data in a table with:
 * - Color-coded rows (green=valid, red=invalid, orange=duplicate)
 * - Validation errors displayed inline
 * - Duplicate warnings with action dropdown
 * - Summary counts
 * - Execute import button (disabled if validation errors exist)
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */
export function PreviewStep({
  parseResult,
  rowActions,
  onRowActionChange,
  onExecuteImport,
  onBack,
  isProcessing,
}: PreviewStepProps) {
  // Check if import can be executed
  const canExecute = useMemo(() => {
    // Cannot execute if there are validation errors
    if (parseResult.invalid_rows > 0) {
      return false;
    }

    // Cannot execute if there are duplicates without actions
    const duplicateRows = parseResult.rows.filter((row) => row.duplicate_info !== null);
    const hasUnresolvedDuplicates = duplicateRows.some((row) => {
      const action = rowActions.find((a) => a.row_number === row.row_number);
      return !action;
    });

    return !hasUnresolvedDuplicates;
  }, [parseResult, rowActions]);

  // Get execute button tooltip
  const executeTooltip = useMemo(() => {
    if (parseResult.invalid_rows > 0) {
      return 'Corrigez les erreurs de validation avant d\'importer';
    }
    if (!canExecute) {
      return 'Choisissez une action pour tous les doublons';
    }
    return '';
  }, [parseResult.invalid_rows, canExecute]);

  return (
    <div className="flex flex-col h-full">
      {/* Summary Section */}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Résumé de l'analyse</h3>
        <SummaryCounts parseResult={parseResult} />

        {/* Warning if validation errors exist */}
        {parseResult.invalid_rows > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {parseResult.invalid_rows} ligne{parseResult.invalid_rows > 1 ? 's' : ''}{' '}
              contien{parseResult.invalid_rows > 1 ? 'nent' : 't'} des erreurs. Corrigez le
              fichier CSV et réessayez.
            </p>
          </div>
        )}

        {/* Info if duplicates exist */}
        {parseResult.duplicate_rows > 0 && parseResult.invalid_rows === 0 && (
          <div className="mt-4 p-3 rounded-lg bg-orange-50 border border-orange-200">
            <p className="text-sm text-orange-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {parseResult.duplicate_rows} doublon{parseResult.duplicate_rows > 1 ? 's' : ''}{' '}
              détecté{parseResult.duplicate_rows > 1 ? 's' : ''}. Choisissez une action pour
              chaque doublon.
            </p>
          </div>
        )}
      </div>

      {/* Table Section */}
      <div className="flex-1 overflow-auto p-6">
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Ligne
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Prénoms
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  CNI
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Téléphone
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Superficie
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Âge
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Genre
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {parseResult.rows.map((row) => {
                const rowAction = rowActions.find((a) => a.row_number === row.row_number);
                return (
                  <React.Fragment key={row.row_number}>
                    <PreviewRow
                      row={row}
                      rowAction={rowAction}
                      onActionChange={onRowActionChange}
                    />
                    <RowDetails row={row} />
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Retour
          </button>

          <div className="flex items-center gap-3">
            {executeTooltip && (
              <p className="text-sm text-gray-500 italic">{executeTooltip}</p>
            )}
            <button
              onClick={onExecuteImport}
              disabled={!canExecute || isProcessing}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors',
                canExecute && !isProcessing
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
              title={executeTooltip}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Exécuter l'import
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PreviewStep;
