// CocoaTrack V2 - Diagnostics Screen
// Displays app metrics, cache sizes, IndexedDB sizes, and error logs
// Requirements: REQ-OBS-001

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Download,
  Trash2,
  HardDrive,
  Database,
  Wifi,
  WifiOff,
  Smartphone,
  Monitor,
  AlertCircle,
  CheckCircle,
  Clock,
  Server,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';

import {
  getDiagnosticsService,
  formatBytes,
  type DiagnosticsData,
  type ErrorLog,
} from '@/lib/offline/diagnostics-service';

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: 'green' | 'amber' | 'red' | 'blue' | 'gray';
}

function MetricCard({ title, value, subtitle, icon, color = 'gray' }: MetricCardProps) {
  const colorClasses = {
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    gray: 'bg-gray-50 text-gray-700',
  };

  return (
    <div className={`rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && <div className="text-xs opacity-75 mt-1">{subtitle}</div>}
    </div>
  );
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

function Section({ title, icon, children, defaultExpanded = true }: SectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-lg bg-white shadow">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-200 hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-medium text-gray-900">{title}</h2>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>
      {isExpanded && <div className="p-4">{children}</div>}
    </div>
  );
}

interface StorageBarProps {
  label: string;
  size: number;
  total?: number;
  color?: string;
}

function StorageBar({ label, size, total, color = 'bg-amber-500' }: StorageBarProps) {
  const percentage = total && total > 0 ? Math.min((size / total) * 100, 100) : 0;

  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-900 font-medium">{formatBytes(size)}</span>
      </div>
      {total && total > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`${color} h-2 rounded-full transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ERROR LOG COMPONENT
// ============================================================================

interface ErrorLogItemProps {
  error: ErrorLog;
}

function ErrorLogItem({ error }: ErrorLogItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const typeColors: Record<string, string> = {
    sync: 'bg-blue-100 text-blue-700',
    storage: 'bg-amber-100 text-amber-700',
    network: 'bg-red-100 text-red-700',
    validation: 'bg-purple-100 text-purple-700',
    general: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left px-3 py-2 hover:bg-gray-50"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[error.type] || typeColors.general}`}>
              {error.type}
            </span>
            <span className="text-sm text-gray-900 truncate max-w-xs">
              {error.message}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {new Date(error.timestamp).toLocaleString('fr-FR')}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 text-sm">
          <div className="bg-gray-50 rounded p-3 space-y-2">
            <div>
              <span className="text-gray-500">Code:</span>{' '}
              <span className="font-mono text-gray-900">{error.code}</span>
            </div>
            <div>
              <span className="text-gray-500">Message:</span>{' '}
              <span className="text-gray-900">{error.message}</span>
            </div>
            {Object.keys(error.context).length > 0 && (
              <div>
                <span className="text-gray-500">Context:</span>
                <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                  {JSON.stringify(error.context, null, 2)}
                </pre>
              </div>
            )}
            {error.stack && (
              <div>
                <span className="text-gray-500">Stack:</span>
                <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                  {error.stack}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DiagnosticsPage() {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const service = getDiagnosticsService();
      const diagnosticsData = await service.getData();
      setData(diagnosticsData);
    } catch (error) {
      console.error('Failed to load diagnostics:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
  };

  const handleExport = async () => {
    try {
      const service = getDiagnosticsService();
      const json = await service.exportLogs();
      
      // Create and download file
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cocoatrack-diagnostics-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer tous les logs d\'erreurs ?')) {
      return;
    }

    try {
      const service = getDiagnosticsService();
      await service.clearLogs();
      await loadData();
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      const service = getDiagnosticsService();
      const json = await service.exportLogs();
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-gray-600">Impossible de charger les diagnostics</p>
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Diagnostics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Informations techniques et logs de l'application
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyToClipboard}
            className="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            title="Copier dans le presse-papiers"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            <Download className="-ml-0.5 mr-1.5 h-4 w-4" />
            Exporter JSON
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            <RefreshCw className={`-ml-0.5 mr-1.5 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Version App"
          value={data.app_version}
          icon={<Smartphone className="h-4 w-4" />}
          color="blue"
        />
        <MetricCard
          title="Version SW"
          value={data.sw_version || 'N/A'}
          icon={<Server className="h-4 w-4" />}
          color="blue"
        />
        <MetricCard
          title="Connexion"
          value={data.is_online ? 'En ligne' : 'Hors ligne'}
          icon={data.is_online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          color={data.is_online ? 'green' : 'red'}
        />
        <MetricCard
          title="Mode"
          value={data.is_standalone ? 'Installée' : 'Navigateur'}
          icon={data.is_standalone ? <Smartphone className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
          color={data.is_standalone ? 'green' : 'gray'}
        />
      </div>

      {/* Sync Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Opérations en attente"
          value={data.ops_queue_count}
          icon={<Clock className="h-4 w-4" />}
          color={data.ops_queue_count > 0 ? 'amber' : 'green'}
        />
        <MetricCard
          title="Dernière sync"
          value={data.last_sync.timestamp 
            ? new Date(data.last_sync.timestamp).toLocaleString('fr-FR')
            : 'Jamais'
          }
          subtitle={data.last_sync.duration_ms ? `Durée: ${data.last_sync.duration_ms}ms` : undefined}
          icon={data.last_sync.result?.success ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          color={data.last_sync.result?.success ? 'green' : data.last_sync.timestamp ? 'red' : 'gray'}
        />
        <MetricCard
          title="Mode dégradé"
          value={data.degraded_mode === 'normal' ? 'Non' : data.degraded_mode}
          icon={<AlertCircle className="h-4 w-4" />}
          color={data.degraded_mode === 'normal' ? 'green' : 'amber'}
        />
      </div>

      {/* Storage Section */}
      <Section
        title="Stockage"
        icon={<HardDrive className="h-5 w-5 text-amber-500" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quota Overview */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Quota global</h3>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Utilisé</span>
                <span className="text-gray-900 font-medium">
                  {formatBytes(data.storage_metrics.quota_used)} / {formatBytes(data.storage_metrics.quota_total)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${
                    data.storage_metrics.quota_percent >= 90
                      ? 'bg-red-500'
                      : data.storage_metrics.quota_percent >= 80
                      ? 'bg-amber-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${data.storage_metrics.quota_percent}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {data.storage_metrics.quota_percent}% utilisé
                {data.storage_metrics.is_estimate && ' (estimation)'}
              </div>
            </div>

            <h3 className="text-sm font-medium text-gray-700 mb-3">Par tier</h3>
            <StorageBar
              label="Tier 1 (critique)"
              size={data.storage_metrics.tier1_size}
              total={data.storage_metrics.quota_total}
              color="bg-green-500"
            />
            <StorageBar
              label="Tier 2 (utile)"
              size={data.storage_metrics.tier2_size}
              total={data.storage_metrics.quota_total}
              color="bg-amber-500"
            />
            <StorageBar
              label="Tier 3 (confort)"
              size={data.storage_metrics.tier3_size}
              total={data.storage_metrics.quota_total}
              color="bg-blue-500"
            />
          </div>

          {/* Cache & IDB Details */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Cache ({formatBytes(data.cache_sizes.total)})
            </h3>
            {Object.entries(data.cache_sizes.byCategory).map(([category, size]) => (
              <StorageBar
                key={category}
                label={category}
                size={size}
                total={data.cache_sizes.total}
                color="bg-blue-400"
              />
            ))}
            {Object.keys(data.cache_sizes.byCategory).length === 0 && (
              <p className="text-sm text-gray-500">Aucun cache</p>
            )}

            <h3 className="text-sm font-medium text-gray-700 mb-3 mt-4">
              IndexedDB ({formatBytes(data.idb_sizes.total)})
            </h3>
            {Object.entries(data.idb_sizes.byStore).map(([store, size]) => (
              <StorageBar
                key={store}
                label={store}
                size={size}
                total={data.idb_sizes.total}
                color="bg-purple-400"
              />
            ))}
          </div>
        </div>
      </Section>

      {/* Error Logs Section */}
      <Section
        title={`Erreurs récentes (${data.recent_errors.length})`}
        icon={<AlertCircle className="h-5 w-5 text-red-500" />}
        defaultExpanded={data.recent_errors.length > 0}
      >
        {data.recent_errors.length > 0 ? (
          <>
            <div className="flex justify-end mb-3">
              <button
                onClick={handleClearLogs}
                className="inline-flex items-center text-sm text-red-600 hover:text-red-800"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Effacer les logs
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
              {data.recent_errors.map((error) => (
                <ErrorLogItem key={error.id} error={error} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-2" />
            <p className="text-gray-600">Aucune erreur récente</p>
          </div>
        )}
      </Section>

      {/* System Info Section */}
      <Section
        title="Informations système"
        icon={<Database className="h-5 w-5 text-gray-500" />}
        defaultExpanded={false}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Plateforme:</span>{' '}
            <span className="text-gray-900">{data.platform}</span>
          </div>
          <div>
            <span className="text-gray-500">Collecté le:</span>{' '}
            <span className="text-gray-900">
              {new Date(data.collected_at).toLocaleString('fr-FR')}
            </span>
          </div>
          <div className="md:col-span-2">
            <span className="text-gray-500">User Agent:</span>
            <div className="text-gray-900 text-xs font-mono bg-gray-50 p-2 rounded mt-1 break-all">
              {data.user_agent}
            </div>
          </div>
          {data.last_sync.sync_run_id && (
            <div className="md:col-span-2">
              <span className="text-gray-500">Dernier sync_run_id:</span>
              <div className="text-gray-900 text-xs font-mono bg-gray-50 p-2 rounded mt-1">
                {data.last_sync.sync_run_id}
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
