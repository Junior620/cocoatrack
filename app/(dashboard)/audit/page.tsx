'use client';

/**
 * Audit Log Viewer Page
 * Displays audit logs with filters and export functionality
 * Requirements: 12.4, 12.5
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth, hasPermission, isAdmin } from '@/lib/auth';
import {
  getAuditLogs,
  getAuditActors,
  getAuditedTables,
  exportAuditLogsToCSV,
  getTableLabel,
  getActionLabel,
  getActionColor,
  formatChanges,
  type AuditLogEntry,
  type AuditLogFilters,
  type AuditAction,
} from '@/lib/api/audit';
import { exportAuditLogsToExcel } from '@/lib/utils/excel-export';
import { exportAuditLogsToPdf } from '@/lib/utils/pdf-export';

export default function AuditPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [actors, setActors] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  // Check permissions
  const canViewAudit = user && hasPermission(user.role, 'audit:read');
  const canExport = user && isAdmin(user.role);

  // Load actors for filter dropdown
  useEffect(() => {
    async function loadActors() {
      try {
        const actorList = await getAuditActors();
        setActors(actorList);
      } catch (err) {
        console.error('Failed to load actors:', err);
      }
    }
    if (canViewAudit) {
      loadActors();
    }
  }, [canViewAudit]);

  // Load audit logs
  const loadLogs = useCallback(async () => {
    if (!canViewAudit) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getAuditLogs(filters, page, 20);
      setLogs(result.data);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [canViewAudit, filters, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Handle filter changes
  const handleFilterChange = (key: keyof AuditLogFilters, value: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
    setPage(1); // Reset to first page when filters change
  };

  // Handle CSV export
  const handleExport = async () => {
    if (!canExport) return;

    setExporting(true);
    try {
      const csv = await exportAuditLogsToCSV(filters);
      
      // Create and download file
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export audit logs');
    } finally {
      setExporting(false);
    }
  };

  // Handle Excel export
  const handleExportExcel = async () => {
    if (!canExport) return;

    setExportingExcel(true);
    try {
      const result = await getAuditLogs(filters, 1, 10000);
      exportAuditLogsToExcel(result.data, formatChanges);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export audit logs');
    } finally {
      setExportingExcel(false);
    }
  };

  // Handle PDF export
  const handleExportPdf = async () => {
    if (!canExport) return;

    setExportingPdf(true);
    try {
      const result = await getAuditLogs(filters, 1, 10000);
      await exportAuditLogsToPdf(result.data, formatChanges, {
        title: 'Journal d\'audit',
        subtitle: `${result.total} entrées - Exporté le ${new Date().toLocaleDateString('fr-FR')}`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export audit logs');
    } finally {
      setExportingPdf(false);
    }
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  if (!canViewAudit) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Accès refusé</h2>
          <p className="mt-2 text-gray-600">
            Vous n&apos;avez pas les permissions nécessaires pour voir les logs d&apos;audit.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal d&apos;audit</h1>
          <p className="mt-1 text-sm text-gray-500">
            Historique de toutes les modifications dans le système
          </p>
        </div>
        {canExport && (
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <LoadingSpinner />
                  Export...
                </>
              ) : (
                <>
                  <DownloadIcon />
                  CSV
                </>
              )}
            </button>
            <button
              onClick={handleExportExcel}
              disabled={exportingExcel}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {exportingExcel ? (
                <>
                  <LoadingSpinner />
                  Export...
                </>
              ) : (
                <>
                  <ExcelIcon />
                  Excel
                </>
              )}
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {exportingPdf ? (
                <>
                  <LoadingSpinner />
                  Export...
                </>
              ) : (
                <>
                  <PdfIcon />
                  PDF
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Table filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Table</label>
            <select
              value={filters.table_name || ''}
              onChange={(e) => handleFilterChange('table_name', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="">Toutes les tables</option>
              {getAuditedTables().map((table) => (
                <option key={table} value={table}>
                  {getTableLabel(table)}
                </option>
              ))}
            </select>
          </div>

          {/* Action filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Action</label>
            <select
              value={filters.action || ''}
              onChange={(e) => handleFilterChange('action', e.target.value as AuditAction)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="">Toutes les actions</option>
              <option value="INSERT">Création</option>
              <option value="UPDATE">Modification</option>
              <option value="DELETE">Suppression</option>
            </select>
          </div>

          {/* Actor filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Utilisateur</label>
            <select
              value={filters.actor_id || ''}
              onChange={(e) => handleFilterChange('actor_id', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="">Tous les utilisateurs</option>
              {actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Date début</label>
            <input
              type="date"
              value={filters.start_date?.split('T')[0] || ''}
              onChange={(e) =>
                handleFilterChange(
                  'start_date',
                  e.target.value ? `${e.target.value}T00:00:00Z` : undefined
                )
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Date fin</label>
            <input
              type="date"
              value={filters.end_date?.split('T')[0] || ''}
              onChange={(e) =>
                handleFilterChange(
                  'end_date',
                  e.target.value ? `${e.target.value}T23:59:59Z` : undefined
                )
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            />
          </div>
        </div>

        {/* Clear filters button */}
        {Object.values(filters).some((v) => v) && (
          <div className="mt-4">
            <button
              onClick={clearFilters}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Effacer les filtres
            </button>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-gray-500">
        {total} entrée{total !== 1 ? 's' : ''} trouvée{total !== 1 ? 's' : ''}
      </div>

      {/* Audit log table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Date/Heure
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Utilisateur
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Table
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Action
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Modifications
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                IP
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <LoadingSpinner />
                  <p className="mt-2 text-sm text-gray-500">Chargement...</p>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  Aucune entrée trouvée
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelectedLog(log)}
                >
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="font-medium text-gray-900">{log.actor_name}</div>
                    {log.actor_email && (
                      <div className="text-gray-500">{log.actor_email}</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {getTableLabel(log.table_name)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getActionColor(log.action)}`}
                    >
                      {getActionLabel(log.action)}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-6 py-4 text-sm text-gray-500">
                    {formatChanges(log.action, log.old_data, log.new_data)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {log.ip_address || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Précédent
          </button>
          <span className="text-sm text-gray-700">
            Page {page} sur {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      )}

      {/* Detail modal */}
      {selectedLog && (
        <AuditDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}

// Detail modal component
function AuditDetailModal({
  log,
  onClose,
}: {
  log: AuditLogEntry;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

        {/* Modal */}
        <div className="relative w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Détails de l&apos;audit</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <XIcon />
            </button>
          </div>

          <div className="space-y-4">
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-500">Date/Heure:</span>
                <span className="ml-2 text-gray-900">{formatDateTime(log.created_at)}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">Utilisateur:</span>
                <span className="ml-2 text-gray-900">{log.actor_name}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">Table:</span>
                <span className="ml-2 text-gray-900">{getTableLabel(log.table_name)}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">Action:</span>
                <span className={`ml-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getActionColor(log.action)}`}>
                  {getActionLabel(log.action)}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-500">ID Enregistrement:</span>
                <span className="ml-2 text-gray-900 font-mono text-xs">{log.row_id}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">Adresse IP:</span>
                <span className="ml-2 text-gray-900">{log.ip_address || '-'}</span>
              </div>
            </div>

            {/* Data comparison */}
            {log.action === 'UPDATE' && log.old_data && log.new_data && (
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-2">Modifications</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-sm font-medium text-gray-500 mb-2">Avant</h5>
                    <pre className="rounded bg-red-50 p-3 text-xs overflow-auto max-h-64">
                      {JSON.stringify(log.old_data, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-gray-500 mb-2">Après</h5>
                    <pre className="rounded bg-green-50 p-3 text-xs overflow-auto max-h-64">
                      {JSON.stringify(log.new_data, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {log.action === 'INSERT' && log.new_data && (
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-2">Données créées</h4>
                <pre className="rounded bg-green-50 p-3 text-xs overflow-auto max-h-64">
                  {JSON.stringify(log.new_data, null, 2)}
                </pre>
              </div>
            )}

            {log.action === 'DELETE' && log.old_data && (
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-2">Données supprimées</h4>
                <pre className="rounded bg-red-50 p-3 text-xs overflow-auto max-h-64">
                  {JSON.stringify(log.old_data, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Icons
function LoadingSpinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-primary-600"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ExcelIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13.5l1.5 2.5-1.5 2.5h1.5l.75-1.5.75 1.5h1.5l-1.5-2.5 1.5-2.5h-1.5l-.75 1.5-.75-1.5H8.5z"/>
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM10.5 11c-.83 0-1.5.67-1.5 1.5v5c0 .28.22.5.5.5s.5-.22.5-.5V16h1c.83 0 1.5-.67 1.5-1.5v-2c0-.83-.67-1.5-1.5-1.5h-1.5zm0 1h1c.28 0 .5.22.5.5v2c0 .28-.22.5-.5.5h-1v-3z"/>
    </svg>
  );
}
