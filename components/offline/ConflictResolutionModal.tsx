// CocoaTrack V2 - Conflict Resolution Modal
// Diff view component for resolving sync conflicts
// Requirements: REQ-SYNC-003

'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  X,
  AlertTriangle,
  Check,
  Server,
  Smartphone,
  GitMerge,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';

import {
  type FormattedConflictWithStrategy,
  type ResolutionStrategy,
  isCriticalField,
  getFieldLabel,
  CRITICAL_FIELDS,
  MERGEABLE_FIELDS,
} from '@/lib/offline/conflict-resolver';
import type { QueuedOperation } from '@/lib/offline/indexed-db';

// ============================================================================
// TYPES
// ============================================================================

export interface ConflictResolutionModalProps {
  /** The operation with conflict */
  operation: QueuedOperation;
  /** Formatted conflict details */
  conflictDetails: FormattedConflictWithStrategy[];
  /** Remote state from server */
  remoteState: Record<string, unknown>;
  /** Callback when conflict is resolved */
  onResolve: (
    resolution: 'local' | 'server' | 'merge',
    mergedData?: Record<string, unknown>
  ) => void;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Whether the modal is open */
  isOpen: boolean;
}

export type FieldChoice = 'local' | 'server';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Formats a value for display
 */
function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '(vide)';
  }
  if (typeof value === 'number') {
    return value.toLocaleString('fr-FR');
  }
  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

/**
 * Gets the table display name in French
 */
function getTableDisplayName(table: string): string {
  const tableNames: Record<string, string> = {
    deliveries: 'Livraison',
    planteurs: 'Planteur',
    chef_planteurs: 'Chef Planteur',
  };
  return tableNames[table] || table;
}

/**
 * Gets the operation type display name in French
 */
function getOperationTypeDisplayName(type: string): string {
  const typeNames: Record<string, string> = {
    CREATE: 'Création',
    UPDATE: 'Modification',
    DELETE: 'Suppression',
  };
  return typeNames[type] || type;
}

// ============================================================================
// FIELD DIFF ROW COMPONENT
// ============================================================================

interface FieldDiffRowProps {
  detail: FormattedConflictWithStrategy;
  choice: FieldChoice | null;
  onChoiceChange: (field: string, choice: FieldChoice) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function FieldDiffRow({
  detail,
  choice,
  onChoiceChange,
  isExpanded,
  onToggleExpand,
}: FieldDiffRowProps) {
  const isLongValue =
    detail.localValue.length > 50 || detail.remoteValue.length > 50;

  return (
    <div
      className={`border-b border-gray-100 last:border-b-0 ${
        detail.isCritical ? 'bg-red-50/50' : ''
      }`}
    >
      {/* Main row */}
      <div className="grid grid-cols-12 gap-2 p-3 items-center">
        {/* Field name */}
        <div className="col-span-3 flex items-center gap-2">
          <span className="font-medium text-gray-900 text-sm">
            {detail.fieldLabel}
          </span>
          {detail.isCritical && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
              Critique
            </span>
          )}
          {detail.resolutionStrategy === 'auto_merge' && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
              Auto
            </span>
          )}
        </div>

        {/* Local value */}
        <div className="col-span-3">
          <button
            onClick={() => onChoiceChange(detail.field, 'local')}
            className={`w-full text-left p-2 rounded-md border-2 transition-all text-sm ${
              choice === 'local'
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
            }`}
          >
            <div className="flex items-center gap-1 mb-1">
              <Smartphone className="h-3 w-3 text-blue-600" />
              <span className="text-xs text-blue-600 font-medium">Local</span>
            </div>
            <span
              className={`block truncate ${
                choice === 'local' ? 'text-blue-900' : 'text-gray-700'
              }`}
            >
              {isLongValue && !isExpanded
                ? `${detail.localValue.substring(0, 30)}...`
                : detail.localValue}
            </span>
          </button>
        </div>

        {/* Server value */}
        <div className="col-span-3">
          <button
            onClick={() => onChoiceChange(detail.field, 'server')}
            className={`w-full text-left p-2 rounded-md border-2 transition-all text-sm ${
              choice === 'server'
                ? 'border-green-500 bg-green-50 ring-1 ring-green-200'
                : 'border-gray-200 hover:border-green-300 hover:bg-green-50/50'
            }`}
          >
            <div className="flex items-center gap-1 mb-1">
              <Server className="h-3 w-3 text-green-600" />
              <span className="text-xs text-green-600 font-medium">Serveur</span>
            </div>
            <span
              className={`block truncate ${
                choice === 'server' ? 'text-green-900' : 'text-gray-700'
              }`}
            >
              {isLongValue && !isExpanded
                ? `${detail.remoteValue.substring(0, 30)}...`
                : detail.remoteValue}
            </span>
          </button>
        </div>

        {/* Base value */}
        <div className="col-span-2 text-sm text-gray-500 p-2">
          <div className="text-xs text-gray-400 mb-1">Original</div>
          <span className="truncate block">
            {isLongValue && !isExpanded
              ? `${detail.baseValue.substring(0, 20)}...`
              : detail.baseValue}
          </span>
        </div>

        {/* Expand button for long values */}
        <div className="col-span-1 flex justify-center">
          {isLongValue && (
            <button
              onClick={onToggleExpand}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              title={isExpanded ? 'Réduire' : 'Développer'}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded view for long values */}
      {isExpanded && isLongValue && (
        <div className="px-3 pb-3 grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-3 rounded-md">
            <div className="text-xs font-medium text-blue-700 mb-1">
              Valeur locale complète
            </div>
            <pre className="text-xs text-blue-900 whitespace-pre-wrap break-words">
              {detail.localValue}
            </pre>
          </div>
          <div className="bg-green-50 p-3 rounded-md">
            <div className="text-xs font-medium text-green-700 mb-1">
              Valeur serveur complète
            </div>
            <pre className="text-xs text-green-900 whitespace-pre-wrap break-words">
              {detail.remoteValue}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ConflictResolutionModal({
  operation,
  conflictDetails,
  remoteState,
  onResolve,
  onClose,
  isOpen,
}: ConflictResolutionModalProps) {
  // Track user choices for each field
  const [fieldChoices, setFieldChoices] = useState<Record<string, FieldChoice>>(
    {}
  );
  // Track expanded fields
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  // Separate critical and non-critical fields
  const { criticalFields, nonCriticalFields } = useMemo(() => {
    const critical: FormattedConflictWithStrategy[] = [];
    const nonCritical: FormattedConflictWithStrategy[] = [];

    for (const detail of conflictDetails) {
      if (detail.isCritical) {
        critical.push(detail);
      } else {
        nonCritical.push(detail);
      }
    }

    return { criticalFields: critical, nonCriticalFields: nonCritical };
  }, [conflictDetails]);

  // Check if all critical fields have been resolved
  const allCriticalResolved = useMemo(() => {
    return criticalFields.every((field) => fieldChoices[field.field] != null);
  }, [criticalFields, fieldChoices]);

  // Handle field choice change
  const handleChoiceChange = useCallback((field: string, choice: FieldChoice) => {
    setFieldChoices((prev) => ({ ...prev, [field]: choice }));
  }, []);

  // Handle expand toggle
  const handleToggleExpand = useCallback((field: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  }, []);

  // Handle "Keep Local" - use all local values
  const handleKeepLocal = useCallback(() => {
    onResolve('local');
  }, [onResolve]);

  // Handle "Keep Server" - use all server values
  const handleKeepServer = useCallback(() => {
    onResolve('server');
  }, [onResolve]);

  // Handle "Merge" - use selected values for critical fields, auto-merge for others
  const handleMerge = useCallback(() => {
    // Build merged data
    const mergedData: Record<string, unknown> = { ...remoteState };

    // Apply user choices for critical fields
    for (const detail of criticalFields) {
      const choice = fieldChoices[detail.field];
      if (choice === 'local') {
        mergedData[detail.field] = operation.data[detail.field];
      }
      // If 'server', keep the remote value (already in mergedData)
    }

    // For non-critical fields, apply local changes (last-write-wins)
    for (const detail of nonCriticalFields) {
      const choice = fieldChoices[detail.field];
      if (choice === 'local' || choice == null) {
        // Default to local for non-critical
        mergedData[detail.field] = operation.data[detail.field];
      }
    }

    onResolve('merge', mergedData);
  }, [
    remoteState,
    criticalFields,
    nonCriticalFields,
    fieldChoices,
    operation.data,
    onResolve,
  ]);

  // Select all local
  const handleSelectAllLocal = useCallback(() => {
    const newChoices: Record<string, FieldChoice> = {};
    for (const detail of conflictDetails) {
      newChoices[detail.field] = 'local';
    }
    setFieldChoices(newChoices);
  }, [conflictDetails]);

  // Select all server
  const handleSelectAllServer = useCallback(() => {
    const newChoices: Record<string, FieldChoice> = {};
    for (const detail of conflictDetails) {
      newChoices[detail.field] = 'server';
    }
    setFieldChoices(newChoices);
  }, [conflictDetails]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Résolution de conflit
              </h2>
              <p className="text-sm text-gray-500">
                {getTableDisplayName(operation.table)} •{' '}
                {getOperationTypeDisplayName(operation.type)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Info banner */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-800">
              Les données ont été modifiées sur le serveur depuis votre dernière
              synchronisation. Choisissez quelle version conserver pour chaque
              champ en conflit.
              {criticalFields.length > 0 && (
                <span className="font-medium">
                  {' '}
                  Les champs critiques (en rouge) nécessitent votre choix.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Quick actions */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500">
              {conflictDetails.length} champ(s) en conflit
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleSelectAllLocal}
                className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                Tout sélectionner local
              </button>
              <button
                onClick={handleSelectAllServer}
                className="text-xs px-2 py-1 text-green-600 hover:bg-green-50 rounded transition-colors"
              >
                Tout sélectionner serveur
              </button>
            </div>
          </div>

          {/* Critical fields section */}
          {criticalFields.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-semibold text-red-700">
                  Champs critiques ({criticalFields.length})
                </h3>
              </div>
              <div className="border border-red-200 rounded-lg overflow-hidden bg-white">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-red-50 border-b border-red-200 text-xs font-medium text-red-700">
                  <div className="col-span-3">Champ</div>
                  <div className="col-span-3">Valeur locale</div>
                  <div className="col-span-3">Valeur serveur</div>
                  <div className="col-span-2">Original</div>
                  <div className="col-span-1"></div>
                </div>
                {/* Rows */}
                {criticalFields.map((detail) => (
                  <FieldDiffRow
                    key={detail.field}
                    detail={detail}
                    choice={fieldChoices[detail.field] || null}
                    onChoiceChange={handleChoiceChange}
                    isExpanded={expandedFields.has(detail.field)}
                    onToggleExpand={() => handleToggleExpand(detail.field)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Non-critical fields section */}
          {nonCriticalFields.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <GitMerge className="h-4 w-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-700">
                  Autres champs ({nonCriticalFields.length})
                </h3>
                <span className="text-xs text-gray-400">
                  (fusion automatique possible)
                </span>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
                  <div className="col-span-3">Champ</div>
                  <div className="col-span-3">Valeur locale</div>
                  <div className="col-span-3">Valeur serveur</div>
                  <div className="col-span-2">Original</div>
                  <div className="col-span-1"></div>
                </div>
                {/* Rows */}
                {nonCriticalFields.map((detail) => (
                  <FieldDiffRow
                    key={detail.field}
                    detail={detail}
                    choice={fieldChoices[detail.field] || null}
                    onChoiceChange={handleChoiceChange}
                    isExpanded={expandedFields.has(detail.field)}
                    onToggleExpand={() => handleToggleExpand(detail.field)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer with actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          {/* Warning if critical fields not resolved */}
          {criticalFields.length > 0 && !allCriticalResolved && (
            <div className="mb-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              <span>
                Veuillez choisir une valeur pour tous les champs critiques avant
                de fusionner.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>

            <div className="flex gap-3">
              {/* Keep Server */}
              <button
                onClick={handleKeepServer}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
              >
                <Server className="h-4 w-4" />
                Garder serveur
              </button>

              {/* Keep Local */}
              <button
                onClick={handleKeepLocal}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
              >
                <Smartphone className="h-4 w-4" />
                Garder local
              </button>

              {/* Merge */}
              <button
                onClick={handleMerge}
                disabled={criticalFields.length > 0 && !allCriticalResolved}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <GitMerge className="h-4 w-4" />
                Fusionner
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConflictResolutionModal;
