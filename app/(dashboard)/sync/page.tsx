// CocoaTrack V2 - Enhanced Sync Page
// Shows sync status, progress bar, pending operations, and conflict resolution UI
// Requirements: REQ-SYNC-001, REQ-SYNC-002, REQ-SYNC-003, REQ-SYNC-004

'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Trash2, 
  RotateCcw,
  Package,
  Users,
  UserCheck,
  ChevronDown,
  ChevronUp,
  X,
  Check,
} from 'lucide-react';

import { useOffline } from '@/lib/offline/use-offline';
import {
  getAllQueuedOperations,
  dequeueOperation,
  type QueuedOperation,
} from '@/lib/offline/indexed-db';
import {
  getConflictDetails,
  formatConflictForDisplay,
  type FormattedConflictWithStrategy,
} from '@/lib/offline/conflict-resolver';
import { createClient } from '@/lib/supabase/client';
import { ConflictResolutionModal, DegradedModeInlineBanner } from '@/components/offline';
import { SyncStatusIndicator, getSyncStatusState, getSyncStatusConfig } from '@/components/offline/SyncStatusIndicator';
import { useDegradedMode } from '@/lib/offline/use-degraded-mode';

// ============================================================================
// TYPES
// ============================================================================

interface SyncProgress {
  current: number;
  total: number;
  currentOperation: QueuedOperation | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gets the icon for an operation type
 */
function getOperationTypeIcon(table: string) {
  switch (table) {
    case 'deliveries':
      return <Package className="h-4 w-4" />;
    case 'planteurs':
      return <Users className="h-4 w-4" />;
    case 'chef_planteurs':
      return <UserCheck className="h-4 w-4" />;
    default:
      return <Package className="h-4 w-4" />;
  }
}

/**
 * Gets the label for an operation type
 */
function getOperationTypeLabel(type: string): string {
  switch (type) {
    case 'CREATE':
      return 'Création';
    case 'UPDATE':
      return 'Modification';
    case 'DELETE':
      return 'Suppression';
    default:
      return type;
  }
}

/**
 * Gets the label for a table
 */
function getTableLabel(table: string): string {
  switch (table) {
    case 'deliveries':
      return 'Livraison';
    case 'planteurs':
      return 'Planteur';
    case 'chef_planteurs':
      return 'Chef Planteur';
    default:
      return table;
  }
}

/**
 * Gets the color for an operation status
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-700';
    case 'syncing':
      return 'bg-blue-100 text-blue-700';
    case 'failed':
      return 'bg-red-100 text-red-700';
    case 'needs_review':
      return 'bg-purple-100 text-purple-700';
    case 'pending_auth':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

/**
 * Gets the label for an operation status
 */
function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'En attente';
    case 'syncing':
      return 'Synchronisation...';
    case 'failed':
      return 'Échoué';
    case 'needs_review':
      return 'À résoudre';
    case 'pending_auth':
      return 'Auth requise';
    default:
      return status;
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SyncPage() {
  const {
    isOnline,
    isSyncing,
    pendingCount,
    conflictCount,
    lastSyncAt,
    lastSyncResult,
    sync,
    resolveConflict,
    retryOperation,
    cancelOperation,
    refreshState,
  } = useOffline();

  const { state: degradedState, isDegraded } = useDegradedMode();

  const [operations, setOperations] = useState<QueuedOperation[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<QueuedOperation | null>(null);
  const [conflictDetails, setConflictDetails] = useState<FormattedConflictWithStrategy[]>([]);
  const [remoteState, setRemoteState] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['conflicts', 'pending', 'failed']));
  
  // Sync progress state
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

  // Load operations
  useEffect(() => {
    loadOperations();
  }, [pendingCount, conflictCount]);

  const loadOperations = async () => {
    setIsLoading(true);
    try {
      const ops = await getAllQueuedOperations();
      setOperations(ops);
    } catch (error) {
      console.error('Failed to load operations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sync button click with progress tracking
  const handleSync = async () => {
    // Get total operations count for progress
    const totalOps = operations.filter(op => 
      op.status === 'pending' || op.status === 'failed'
    ).length;
    
    if (totalOps > 0) {
      setSyncProgress({ current: 0, total: totalOps, currentOperation: null });
    }
    
    await sync();
    setSyncProgress(null);
    await loadOperations();
  };

  // Handle conflict selection
  const handleSelectConflict = async (op: QueuedOperation) => {
    setSelectedConflict(op);

    // Fetch remote state to show conflict details
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: fetchedRemoteState } = await supabase
        .from(op.table as any)
        .select('*')
        .eq('id', op.record_id)
        .single();

      if (fetchedRemoteState && op.base_snapshot) {
        setRemoteState(fetchedRemoteState);
        const details = getConflictDetails(op, fetchedRemoteState);
        const formatted = formatConflictForDisplay(op.table, details);
        setConflictDetails(formatted);
      }
    } catch (error) {
      console.error('Failed to fetch conflict details:', error);
    }
  };

  // Handle conflict resolution (supports merge)
  const handleResolveConflict = async (
    resolution: 'local' | 'server' | 'merge',
    mergedData?: Record<string, unknown>
  ) => {
    if (!selectedConflict) return;

    if (resolution === 'merge' && mergedData) {
      await resolveConflict(selectedConflict.id, 'merge', mergedData);
    } else if (resolution === 'local') {
      await resolveConflict(selectedConflict.id, 'local');
    } else {
      await resolveConflict(selectedConflict.id, 'remote');
    }
    
    setSelectedConflict(null);
    setConflictDetails([]);
    setRemoteState({});
    await loadOperations();
  };

  // Handle close modal
  const handleCloseModal = () => {
    setSelectedConflict(null);
    setConflictDetails([]);
    setRemoteState({});
  };

  // Handle retry
  const handleRetry = async (operationId: string) => {
    await retryOperation(operationId);
    await loadOperations();
  };

  // Handle cancel
  const handleCancel = async (operationId: string) => {
    if (confirm('Êtes-vous sûr de vouloir annuler cette opération ?')) {
      await cancelOperation(operationId);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(operationId);
        return next;
      });
      await loadOperations();
    }
  };

  // Toggle selection
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all in a category
  const selectAll = (ops: QueuedOperation[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      ops.forEach(op => next.add(op.id));
      return next;
    });
  };

  // Deselect all in a category
  const deselectAll = (ops: QueuedOperation[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      ops.forEach(op => next.delete(op.id));
      return next;
    });
  };

  // Cancel all selected operations
  const handleCancelSelected = async () => {
    if (selectedIds.size === 0) return;
    
    if (confirm(`Êtes-vous sûr de vouloir annuler ${selectedIds.size} opération(s) ?`)) {
      for (const id of selectedIds) {
        await dequeueOperation(id);
      }
      setSelectedIds(new Set());
      await loadOperations();
      await refreshState();
    }
  };

  // Retry all selected failed operations
  const handleRetrySelected = async () => {
    const failedSelected = operations.filter(
      op => selectedIds.has(op.id) && op.status === 'failed'
    );
    
    if (failedSelected.length === 0) return;
    
    for (const op of failedSelected) {
      await retryOperation(op.id);
    }
    setSelectedIds(new Set());
    await loadOperations();
  };

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Group operations by status
  const pendingOps = operations.filter((op) => op.status === 'pending');
  const syncingOps = operations.filter((op) => op.status === 'syncing');
  const failedOps = operations.filter((op) => op.status === 'failed');
  const conflictOps = operations.filter((op) => op.status === 'needs_review');

  // Calculate sync status
  const errorCount = conflictCount;
  const syncState = getSyncStatusState(pendingCount, errorCount);
  const syncConfig = getSyncStatusConfig(syncState);

  return (
    <div className="space-y-6">
      {/* Degraded Mode Inline Banner - REQ-OFF-011 */}
      {isDegraded && (
        <DegradedModeInlineBanner />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Synchronisation</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérez les opérations hors ligne et résolvez les conflits
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Batch actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {selectedIds.size} sélectionné(s)
              </span>
              <button
                onClick={handleRetrySelected}
                className="inline-flex items-center rounded-md bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-200"
                title="Réessayer les opérations échouées sélectionnées"
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Réessayer
              </button>
              <button
                onClick={handleCancelSelected}
                className="inline-flex items-center rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200"
                title="Annuler toutes les opérations sélectionnées"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Annuler
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="inline-flex items-center rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                <X className="mr-1.5 h-4 w-4" />
                Désélectionner
              </button>
            </div>
          )}
          
          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={isSyncing || !isOnline}
            className="inline-flex items-center rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="-ml-1 mr-2 h-4 w-4 animate-spin" />
                Synchronisation...
              </>
            ) : (
              <>
                <RefreshCw className="-ml-1 mr-2 h-4 w-4" />
                Synchroniser
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sync Progress Bar - REQ-SYNC-002 */}
      {isSyncing && syncProgress && syncProgress.total > 0 && (
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Synchronisation en cours...
            </span>
            <span className="text-sm text-gray-500">
              {syncProgress.current}/{syncProgress.total} opérations
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-amber-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
            />
          </div>
          {syncProgress.currentOperation && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
              {getOperationTypeIcon(syncProgress.currentOperation.table)}
              <span>
                {getOperationTypeLabel(syncProgress.currentOperation.type)} - {getTableLabel(syncProgress.currentOperation.table)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Sync Status */}
        <div className={`rounded-lg p-4 shadow ${syncConfig.bgColor}`}>
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${syncConfig.color}`} />
            <span className={`text-sm font-medium ${syncConfig.textColor}`}>
              {syncConfig.labelFr}
            </span>
          </div>
          <div className={`mt-1 text-xs ${syncConfig.textColor} opacity-75`}>
            {syncState === 'synced' && 'Tout est synchronisé'}
            {syncState === 'pending' && `${pendingCount} opération(s) en attente`}
            {syncState === 'error' && `${errorCount} erreur(s) à corriger`}
          </div>
        </div>

        {/* Online Status */}
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="flex items-center">
            <div
              className={`h-3 w-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className="ml-2 text-sm font-medium text-gray-900">
              {isOnline ? 'En ligne' : 'Hors ligne'}
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {isOnline ? 'Connexion active' : 'Mode hors ligne'}
          </div>
        </div>

        {/* Pending Count */}
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
          <div className="text-sm text-gray-500">Opérations en attente</div>
        </div>

        {/* Conflict Count */}
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="text-2xl font-bold text-red-600">{conflictCount}</div>
          <div className="text-sm text-gray-500">Conflits à résoudre</div>
        </div>
      </div>

      {/* Last Sync Result */}
      {lastSyncResult && (
        <div
          className={`rounded-lg p-4 ${
            lastSyncResult.success
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {lastSyncResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="ml-2">
                {lastSyncResult.synced} synchronisé(s), {lastSyncResult.failed}{' '}
                échoué(s), {lastSyncResult.conflicts} conflit(s)
              </span>
            </div>
            {lastSyncAt && (
              <span className="text-sm opacity-75">
                {lastSyncAt.toLocaleString('fr-FR')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Conflicts Section */}
      {conflictOps.length > 0 && (
        <OperationSection
          title="Conflits à résoudre"
          icon={<AlertCircle className="h-5 w-5 text-purple-500" />}
          operations={conflictOps}
          isExpanded={expandedSections.has('conflicts')}
          onToggle={() => toggleSection('conflicts')}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
          onSelectAll={() => selectAll(conflictOps)}
          onDeselectAll={() => deselectAll(conflictOps)}
          renderActions={(op) => (
            <button
              onClick={() => handleSelectConflict(op)}
              className="rounded-md bg-purple-100 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-200"
            >
              Résoudre
            </button>
          )}
        />
      )}

      {/* Conflict Resolution Modal */}
      {selectedConflict && (
        <ConflictResolutionModal
          operation={selectedConflict}
          conflictDetails={conflictDetails}
          remoteState={remoteState}
          onResolve={handleResolveConflict}
          onClose={handleCloseModal}
          isOpen={!!selectedConflict}
        />
      )}

      {/* Pending Operations */}
      {pendingOps.length > 0 && (
        <OperationSection
          title="Opérations en attente"
          icon={<Clock className="h-5 w-5 text-amber-500" />}
          operations={pendingOps}
          isExpanded={expandedSections.has('pending')}
          onToggle={() => toggleSection('pending')}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
          onSelectAll={() => selectAll(pendingOps)}
          onDeselectAll={() => deselectAll(pendingOps)}
          renderActions={(op) => (
            <button
              onClick={() => handleCancel(op.id)}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Annuler
            </button>
          )}
        />
      )}

      {/* Failed Operations */}
      {failedOps.length > 0 && (
        <OperationSection
          title="Opérations échouées"
          icon={<AlertCircle className="h-5 w-5 text-red-500" />}
          operations={failedOps}
          isExpanded={expandedSections.has('failed')}
          onToggle={() => toggleSection('failed')}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
          onSelectAll={() => selectAll(failedOps)}
          onDeselectAll={() => deselectAll(failedOps)}
          renderActions={(op) => (
            <div className="flex gap-2">
              <button
                onClick={() => handleRetry(op.id)}
                className="text-sm text-amber-600 hover:text-amber-800"
              >
                Réessayer
              </button>
              <button
                onClick={() => handleCancel(op.id)}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Annuler
              </button>
            </div>
          )}
          showError
        />
      )}

      {/* Empty State */}
      {!isLoading && operations.length === 0 && (
        <div className="rounded-lg bg-white p-8 text-center shadow">
          <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            Tout est synchronisé
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Aucune opération en attente de synchronisation.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// OPERATION SECTION COMPONENT
// ============================================================================

interface OperationSectionProps {
  title: string;
  icon: React.ReactNode;
  operations: QueuedOperation[];
  isExpanded: boolean;
  onToggle: () => void;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  renderActions: (op: QueuedOperation) => React.ReactNode;
  showError?: boolean;
}

function OperationSection({
  title,
  icon,
  operations,
  isExpanded,
  onToggle,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
  renderActions,
  showError = false,
}: OperationSectionProps) {
  const allSelected = operations.every(op => selectedIds.has(op.id));
  const someSelected = operations.some(op => selectedIds.has(op.id));

  return (
    <div className="rounded-lg bg-white shadow">
      {/* Section Header */}
      <div 
        className="flex items-center justify-between border-b border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-medium text-gray-900">{title}</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {operations.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Select all checkbox */}
          {isExpanded && operations.length > 0 && (
            <div 
              className="flex items-center gap-2 mr-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={allSelected ? onDeselectAll : onSelectAll}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            </div>
          )}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Operations List */}
      {isExpanded && (
        <div className="divide-y divide-gray-200">
          {operations.map((op) => (
            <div
              key={op.id}
              className={`flex items-center justify-between p-4 ${
                selectedIds.has(op.id) ? 'bg-amber-50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedIds.has(op.id)}
                  onChange={() => onToggleSelection(op.id)}
                  className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                
                {/* Operation Type Icon */}
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                  {getOperationTypeIcon(op.table)}
                </div>
                
                {/* Operation Details */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {getOperationTypeLabel(op.type)}
                    </span>
                    <span className="text-gray-500">-</span>
                    <span className="text-gray-700">
                      {getTableLabel(op.table)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(op.status)}`}>
                      {getStatusLabel(op.status)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Créé le {new Date(op.created_at).toLocaleString('fr-FR')}
                    {op.retry_count > 0 && (
                      <span className="ml-2">• Tentatives: {op.retry_count}</span>
                    )}
                  </div>
                  {showError && op.error && (
                    <div className="mt-1 text-sm text-red-600">{op.error}</div>
                  )}
                </div>
              </div>
              
              {/* Actions */}
              <div>{renderActions(op)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
