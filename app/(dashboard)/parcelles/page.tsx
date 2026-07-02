'use client';

// CocoaTrack V2 - Parcelles List Page
// Displays parcelles with KPIs, filters, and table
// Supports two view modes: Liste (table) and Par Planteur (grouped accordion)

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Map, Download, FileSpreadsheet, List, Users } from 'lucide-react';

import { ProtectedRoute } from '@/components/auth';
import { useAuth, hasPermission } from '@/lib/auth';
import { parcellesApi, getParcelleKPIs, getDistinctVillages, getImportFileOptions, type ParcelleKPIStats, type ImportFileOption } from '@/lib/api/parcelles';
import { parcellesGroupedApi, type ParcellesByPlanteurResponse } from '@/lib/api/parcelles-grouped';
import type { ParcelleWithPlanteur, ParcelleFilters, ConformityStatus, Certification, ParcelleSource, ParcelleStats, HealthStatus } from '@/types/parcelles';
import { CONFORMITY_STATUS_VALUES, CONFORMITY_STATUS_LABELS, CERTIFICATIONS_WHITELIST, CERTIFICATION_LABELS, PARCELLE_SOURCE_VALUES, PARCELLE_SOURCE_LABELS, HEALTH_STATUS_VALUES, HEALTH_STATUS_LABELS } from '@/types/parcelles';
import type { PaginatedResult } from '@/types';
import { PageTransition, AnimatedSection } from '@/components/dashboard';
import { ParcelleKPIs } from '@/components/parcelles/ParcelleKPIs';
import { ParcelleTable, type SortConfig } from '@/components/parcelles/ParcelleTable';
import { ParcellesByPlanteur } from '@/components/parcelles/ParcellesByPlanteur';
import { ParcelleStatsCards } from '@/components/parcelles/ParcelleStatsCards';
import { AssignParcellesModal, type AssignResult } from '@/components/parcelles/AssignParcellesModal';
import { KMLExportButton } from '@/components/satellite/KMLExportButton';
import RiskExportButton from '@/components/satellite/RiskExportButton';
import { useBatchNDVICalculation } from '@/hooks/satellite/useBatchNDVICalculation';
import { Activity, CheckCircle, XCircle } from 'lucide-react';

// View mode type
type ViewMode = 'list' | 'by-planteur';

export default function ParcellesPage() {
  return (
    <ProtectedRoute requiredPermission="parcelles:read">
      <ParcellesContent />
    </ProtectedRoute>
  );
}

function ParcellesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [data, setData] = useState<PaginatedResult<ParcelleWithPlanteur> | null>(null);
  const [kpiStats, setKpiStats] = useState<ParcelleKPIStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  
  // Key to force re-render of ParcelleTable after batch calculation
  const [tableKey, setTableKey] = useState(0);
  
  // View mode state (list or by-planteur)
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get('view') as ViewMode) || 'list'
  );
  
  // Grouped view state
  const [groupedData, setGroupedData] = useState<ParcellesByPlanteurResponse | null>(null);
  const [groupedLoading, setGroupedLoading] = useState(false);
  
  // Assignment modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [parcellesToAssign, setParcellesToAssign] = useState<ParcelleWithPlanteur[]>([]);
  
  // Batch NDVI calculation
  const { calculating, progress, processed, total, result, calculate, reset } = useBatchNDVICalculation();
  
  // Filter options state
  const [villages, setVillages] = useState<string[]>([]);
  const [importFiles, setImportFiles] = useState<ImportFileOption[]>([]);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(true);

  // Parse filters from URL
  const filters: ParcelleFilters = {
    page: parseInt(searchParams.get('page') || '1'),
    pageSize: parseInt(searchParams.get('pageSize') || '25'),
    search: searchParams.get('search') || undefined,
    conformity_status: (searchParams.get('conformity_status') as ConformityStatus) || undefined,
    certification: (searchParams.get('certification') as Certification) || undefined,
    village: searchParams.get('village') || undefined,
    source: (searchParams.get('source') as ParcelleSource) || undefined,
    import_file_id: searchParams.get('import_file_id') || undefined,
    health_status: (searchParams.get('health_status') as HealthStatus) || undefined,
    is_active: searchParams.get('is_active') === 'false' ? false : true,
  };

  // Parse sort from URL
  // Default sort: planteur name ascending (shows parcelles with planteurs first)
  const sortConfig: SortConfig = {
    column: (searchParams.get('sortBy') as SortConfig['column']) || 'planteur',
    direction: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc',
  };

  const canCreate = user && hasPermission(user.role, 'planteurs:create');

  // Fetch parcelles
  const fetchParcelles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await parcellesApi.list({
        ...filters,
        sortBy: sortConfig.column,
        sortOrder: sortConfig.direction,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du chargement des parcelles');
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.pageSize, filters.search, filters.conformity_status, filters.certification, filters.village, filters.source, filters.import_file_id, filters.health_status, filters.is_active, sortConfig.column, sortConfig.direction]);

  // Fetch KPIs
  const fetchKPIs = useCallback(async () => {
    setKpiLoading(true);
    try {
      const stats = await getParcelleKPIs();
      setKpiStats(stats);
    } catch (err) {
      console.error('Failed to fetch KPIs:', err);
    } finally {
      setKpiLoading(false);
    }
  }, []);

  // Fetch filter options (villages and import files)
  const fetchFilterOptions = useCallback(async () => {
    setFilterOptionsLoading(true);
    try {
      const [villageList, importFileList] = await Promise.all([
        getDistinctVillages(),
        getImportFileOptions(),
      ]);
      setVillages(villageList);
      setImportFiles(importFileList);
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
    } finally {
      setFilterOptionsLoading(false);
    }
  }, []);

  // Fetch grouped data (for by-planteur view)
  const fetchGroupedData = useCallback(async () => {
    setGroupedLoading(true);
    setError(null);
    try {
      const result = await parcellesGroupedApi.getParcellesByPlanteur({
        page: 1,
        pageSize: 50,
        include_orphans: true,
      });
      setGroupedData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du chargement des données groupées');
    } finally {
      setGroupedLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKPIs();
    fetchFilterOptions();
    
    // Fetch data based on view mode
    if (viewMode === 'list') {
      fetchParcelles();
    } else {
      fetchGroupedData();
    }
  }, [fetchParcelles, fetchKPIs, fetchFilterOptions, fetchGroupedData, viewMode]);

  // Update URL with new filters
  const updateFilters = (newFilters: Partial<ParcelleFilters & { sortBy?: string; sortOrder?: string; view?: ViewMode }>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== '' && value !== null) {
        params.set(key, String(value));
      } else {
        params.delete(key);
      }
    });
    router.push(`/parcelles?${params.toString()}`);
  };

  // Handle view mode change
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    updateFilters({ view: mode, page: 1 });
  };

  // Handle assignment request for orphan parcelles
  const handleAssignRequest = useCallback(async (parcelleIds: string[]) => {
    // Fetch the parcelles to assign
    try {
      const parcelles = await parcellesGroupedApi.getOrphanParcelles();
      const selectedParcelles = parcelles.filter(p => parcelleIds.includes(p.id));
      setParcellesToAssign(selectedParcelles as ParcelleWithPlanteur[]);
      setAssignModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch parcelles for assignment:', err);
      setError('Échec du chargement des parcelles');
    }
  }, []);

  // Handle assignment completion
  const handleAssignComplete = useCallback((result: AssignResult) => {
    // Refresh the grouped data after assignment
    fetchGroupedData();
    fetchKPIs();
    
    // Show success message (could use a toast notification)
    console.log(`${result.updated_count} parcelle(s) assignée(s) à ${result.planteur_name}`);
  }, [fetchGroupedData, fetchKPIs]);

  // Handle search
  const handleSearch = (query: string) => {
    updateFilters({ search: query, page: 1 });
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    updateFilters({ page });
  };

  // Handle page size change
  const handlePageSizeChange = (pageSize: number) => {
    updateFilters({ pageSize, page: 1 });
  };

  // Handle sort change
  const handleSortChange = (config: SortConfig) => {
    updateFilters({ sortBy: config.column, sortOrder: config.direction, page: 1 });
  };

  // Handle export
  const handleExport = async (format: 'xlsx' | 'csv') => {
    setExporting(true);
    try {
      const blob = await parcellesApi.export(filters, format);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `parcelles_export_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l\'export');
    } finally {
      setExporting(false);
    }
  };

  // Handle batch NDVI calculation
  const handleBatchCalculate = async () => {
    if (!data?.data || data.data.length === 0) {
      setError('Aucune parcelle à traiter');
      return;
    }

    const parcelleIds = data.data.map(p => p.id);
    await calculate(parcelleIds, false);
  };

  // Auto-refresh after successful batch calculation
  useEffect(() => {
    if (result && result.successful > 0 && !calculating) {
      // Force refresh of the page to reload health status
      fetchParcelles();
      // Force re-render of ParcelleTable to refresh health status
      setTableKey(prev => prev + 1);
    }
  }, [result, calculating, fetchParcelles]);

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parcelles</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérez les parcelles agricoles et leur conformité
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => handleViewModeChange('list')}
              className={`inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <List className="mr-1.5 h-4 w-4" />
              Vue Liste
            </button>
            <button
              onClick={() => handleViewModeChange('by-planteur')}
              className={`inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === 'by-planteur'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Users className="mr-1.5 h-4 w-4" />
              Vue par Planteur
            </button>
          </div>
          
          <Link
            href="/parcelles/map"
            className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
          >
            <Map className="mr-2 h-4 w-4" />
            Visualiser sur carte
          </Link>
          {canCreate && (
            <Link
              href="/parcelles/new"
              className="inline-flex items-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 shadow-sm transition-colors"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle Parcelle
            </Link>
          )}
        </div>
      </div>

      {/* KPIs - Show different cards based on view mode */}
      <AnimatedSection animation="fadeUp" delay={0.1}>
        {viewMode === 'by-planteur' ? (
          <ParcelleStatsCards stats={groupedData?.stats ?? null} loading={groupedLoading} />
        ) : (
          <ParcelleKPIs stats={kpiStats} loading={kpiLoading} />
        )}
      </AnimatedSection>

      {/* Filters - Only show in list view */}
      {viewMode === 'list' && (
        <AnimatedSection animation="fadeUp" delay={0.2}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:flex-wrap bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par code ou planteur..."
                defaultValue={filters.search}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>

            {/* Conformity Status Filter */}
            <select
              value={filters.conformity_status || ''}
              onChange={(e) => updateFilters({ 
                conformity_status: e.target.value as ConformityStatus || undefined,
                page: 1 
              })}
              className="rounded-lg border border-gray-200 py-2.5 pl-3 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Tous les statuts</option>
              {CONFORMITY_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {CONFORMITY_STATUS_LABELS[status]}
                </option>
              ))}
            </select>

            {/* Certification Filter */}
            <select
              value={filters.certification || ''}
              onChange={(e) => updateFilters({ 
                certification: e.target.value as Certification || undefined,
                page: 1 
              })}
              className="rounded-lg border border-gray-200 py-2.5 pl-3 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Toutes les certifications</option>
              {CERTIFICATIONS_WHITELIST.map((cert) => (
                <option key={cert} value={cert}>
                  {CERTIFICATION_LABELS[cert]}
                </option>
              ))}
            </select>

            {/* Source Filter */}
            <select
              value={filters.source || ''}
              onChange={(e) => updateFilters({ 
                source: e.target.value as ParcelleSource || undefined,
                page: 1 
              })}
              className="rounded-lg border border-gray-200 py-2.5 pl-3 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Toutes les sources</option>
              {PARCELLE_SOURCE_VALUES.map((source) => (
                <option key={source} value={source}>
                  {PARCELLE_SOURCE_LABELS[source]}
                </option>
              ))}
            </select>

            {/* Village Filter */}
            <select
              value={filters.village || ''}
              onChange={(e) => updateFilters({ 
                village: e.target.value || undefined,
                page: 1 
              })}
              disabled={filterOptionsLoading}
              className="rounded-lg border border-gray-200 py-2.5 pl-3 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
            >
              <option value="">Tous les villages</option>
              {villages.map((village) => (
                <option key={village} value={village}>
                  {village}
                </option>
              ))}
            </select>

            {/* Health Status Filter */}
            <select
              value={filters.health_status || ''}
              onChange={(e) => updateFilters({ 
                health_status: e.target.value as HealthStatus || undefined,
                page: 1 
              })}
              className="rounded-lg border border-gray-200 py-2.5 pl-3 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Tous les statuts de santé</option>
              {HEALTH_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {HEALTH_STATUS_LABELS[status]}
                </option>
              ))}
            </select>

            {/* Import File Filter */}
            {importFiles.length > 0 && (
              <select
                value={filters.import_file_id || ''}
                onChange={(e) => updateFilters({ 
                  import_file_id: e.target.value || undefined,
                  page: 1 
                })}
                disabled={filterOptionsLoading}
                className="rounded-lg border border-gray-200 py-2.5 pl-3 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 max-w-[200px]"
              >
                <option value="">Tous les imports</option>
                {importFiles.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.filename} ({file.nb_applied})
                  </option>
                ))}
              </select>
            )}

            {/* Export Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('csv')}
                disabled={exporting}
                className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="mr-1.5 h-4 w-4" />
                CSV
              </button>
              <button
                onClick={() => handleExport('xlsx')}
                disabled={exporting}
                className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                Excel
              </button>
              
              {/* Batch KML Export Button */}
              {data?.data && data.data.length > 0 && (
                <KMLExportButton
                  parcelleIds={data.data.map(p => p.id)}
                  parcelleCodes={data.data.map(p => p.code).filter((code): code is string => code !== null)}
                  variant="outline"
                  size="sm"
                  showText={true}
                  className="text-sm"
                />
              )}
              
              {/* Batch NDVI Calculation Button */}
              <button
                onClick={handleBatchCalculate}
                disabled={calculating || loading || !data?.data || data.data.length === 0}
                className="inline-flex items-center rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Calculer la santé pour toutes les parcelles affichées"
              >
                <Activity className="mr-1.5 h-4 w-4" />
                {calculating ? 'Calcul en cours...' : 'Calculer la santé'}
              </button>
            </div>
          </div>
        </AnimatedSection>
      )}

      {/* Risk Export Section - Outside filters, prominently displayed */}
      {viewMode === 'list' && (
        <AnimatedSection animation="fadeUp" delay={0.25}>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl shadow-sm border border-blue-100">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                Export par Catégorie de Risque
              </h3>
              <p className="text-sm text-gray-600">
                Exportez les parcelles à risque ou en bonne santé avec leurs analyses complètes
              </p>
            </div>
            <RiskExportButton
              regions={villages}
              showQuickActions={true}
              className="w-full"
            />
          </div>
        </AnimatedSection>
      )}

      {/* Batch Calculation Progress */}
      {calculating && (
        <AnimatedSection animation="fadeUp" delay={0.1}>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary-600 animate-pulse" />
                <span className="text-sm font-medium text-gray-900">
                  Calcul NDVI en cours...
                </span>
              </div>
              <span className="text-sm text-gray-600">
                {processed} / {total} parcelles
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {progress}% complété
            </p>
          </div>
        </AnimatedSection>
      )}

      {/* Batch Calculation Result */}
      {result && !calculating && (
        <AnimatedSection animation="fadeUp" delay={0.1}>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-900">
                    Calcul terminé
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Total:</span>
                    <span className="ml-2 font-medium text-gray-900">{result.totalRequested}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Réussis:</span>
                    <span className="ml-2 font-medium text-green-600">{result.successful}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Échecs:</span>
                    <span className="ml-2 font-medium text-red-600">{result.failed}</span>
                  </div>
                </div>
                {result.failed > 0 && (
                  <details className="mt-3">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                      Voir les erreurs ({result.failed})
                    </summary>
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {result.results
                        .filter(r => !r.success)
                        .map(r => (
                          <div key={r.parcelleId} className="text-xs text-red-600 flex items-start gap-2">
                            <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span className="flex-1">
                              {r.parcelleId}: {r.error}
                            </span>
                          </div>
                        ))}
                    </div>
                  </details>
                )}
              </div>
              <button
                onClick={reset}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </AnimatedSection>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Content - Table or Grouped View based on viewMode */}
      <AnimatedSection animation="fadeUp" delay={0.3}>
        {viewMode === 'list' ? (
          <ParcelleTable
            key={tableKey}
            parcelles={data?.data || []}
            loading={loading}
            sortConfig={sortConfig}
            onSortChange={handleSortChange}
            pagination={data ? {
              page: data.page,
              pageSize: data.pageSize,
              total: data.total,
              totalPages: data.totalPages,
            } : undefined}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        ) : (
          <ParcellesByPlanteur
            groups={groupedData?.groups || []}
            orphans={groupedData?.orphans || null}
            stats={groupedData?.stats || {
              total_parcelles: 0,
              assigned_parcelles: 0,
              orphan_parcelles: 0,
              total_surface_ha: 0,
              assigned_surface_ha: 0,
              orphan_surface_ha: 0,
            }}
            loading={groupedLoading}
            onAssignRequest={handleAssignRequest}
          />
        )}
      </AnimatedSection>

      {/* Assignment Modal */}
      <AssignParcellesModal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setParcellesToAssign([]);
        }}
        parcelles={parcellesToAssign}
        onAssignComplete={handleAssignComplete}
      />
    </PageTransition>
  );
}
