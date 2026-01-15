'use client';

// CocoaTrack V2 - Chef Planteurs List Page (Enhanced with V1 features)
// Displays chef_planteurs with stats, validation workflow, and progress bars

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { 
  Plus, 
  Search, 
  AlertTriangle, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock,
  MapPin,
  Calendar,
  TrendingUp
} from 'lucide-react';

import { useAuth, hasPermission } from '@/lib/auth';
import { chefPlanteursApi } from '@/lib/api/chef-planteurs';
import type { ChefPlanteurWithRelations, ChefPlanteurFilters } from '@/lib/validations/chef-planteur';
import type { PaginatedResult } from '@/types';
import { ProgressBarCompact, AlertBadge } from '@/components/ui/ProgressBar';
import { PageTransition, AnimatedSection } from '@/components/dashboard';

// Format weight with locale
function formatWeight(kg: number | null | undefined): string {
  if (kg === null || kg === undefined) return '-';
  return `${kg.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} kg`;
}

// Format date
function formatDate(date: string | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('fr-FR');
}

const VALIDATION_STATUS_CONFIG: Record<string, { 
  label: string; 
  className: string;
  icon: React.ReactNode;
}> = {
  pending: { 
    label: 'En attente', 
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: <Clock className="h-3.5 w-3.5" />
  },
  validated: { 
    label: 'Validé', 
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: <CheckCircle className="h-3.5 w-3.5" />
  },
  rejected: { 
    label: 'Rejeté', 
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: <XCircle className="h-3.5 w-3.5" />
  },
};

// Get usage level based on percentage
function getUsageLevel(percentage: number | null | undefined): 'success' | 'warning' | 'danger' {
  if (percentage === null || percentage === undefined) return 'success';
  if (percentage >= 100) return 'danger';
  if (percentage >= 90) return 'danger';
  if (percentage >= 70) return 'warning';
  return 'success';
}

export default function ChefPlanteursPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [data, setData] = useState<PaginatedResult<ChefPlanteurWithRelations> | null>(null);
  const [regions, setRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Parse filters from URL
  const filters: ChefPlanteurFilters = {
    page: parseInt(searchParams.get('page') || '1'),
    pageSize: parseInt(searchParams.get('pageSize') || '20'),
    search: searchParams.get('search') || undefined,
    region: searchParams.get('region') || undefined,
    validation_status: (searchParams.get('validation_status') as 'pending' | 'validated' | 'rejected') || undefined,
    is_exploited: searchParams.get('is_exploited') === 'true' ? true : 
                  searchParams.get('is_exploited') === 'false' ? false : undefined,
    sortBy: searchParams.get('sortBy') || 'created_at',
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
  };

  const canCreate = user && hasPermission(user.role, 'chef_planteurs:create');
  const canValidate = user && hasPermission(user.role, 'chef_planteurs:validate');

  // Fetch chef_planteurs with stats
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, regionsList] = await Promise.all([
        chefPlanteursApi.listWithStats(filters),
        chefPlanteursApi.getDistinctRegions(),
      ]);
      setData(result);
      setRegions(regionsList);
    } catch (err) {
      // Fallback to regular list
      try {
        const [result, regionsList] = await Promise.all([
          chefPlanteursApi.list(filters),
          chefPlanteursApi.getDistinctRegions(),
        ]);
        setData(result);
        setRegions(regionsList);
      } catch (fallbackErr) {
        setError(fallbackErr instanceof Error ? fallbackErr.message : 'Failed to fetch chef_planteurs');
      }
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update URL with new filters
  const updateFilters = (newFilters: Partial<ChefPlanteurFilters>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.set(key, String(value));
      } else {
        params.delete(key);
      }
    });
    router.push(`/chef-planteurs?${params.toString()}`);
  };

  // Handle search
  const handleSearch = (query: string) => {
    updateFilters({ search: query, page: 1 });
  };

  // Handle delete
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le fournisseur "${name}" ?`)) {
      return;
    }
    
    setDeleting(id);
    try {
      await chefPlanteursApi.softDelete(id);
      // Refresh the list
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la suppression');
    } finally {
      setDeleting(null);
    }
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    updateFilters({ page });
  };

  // Count stats
  const stats = {
    total: data?.total || 0,
    validated: data?.data.filter(c => c.validation_status === 'validated').length || 0,
    pending: data?.data.filter(c => c.validation_status === 'pending').length || 0,
    exploited: data?.data.filter(c => (c as any).est_exploite).length || 0,
    alerts: data?.data.filter(c => {
      const usage = (c as any).pourcentage_utilise;
      return usage !== null && usage !== undefined && usage >= 70;
    }).length || 0,
  };

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chef Planteurs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérez les fournisseurs et leurs contrats
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats.pending > 0 && canValidate && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-700">
                {stats.pending} en attente
              </span>
            </div>
          )}
          {stats.alerts > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium text-orange-700">
                {stats.alerts} alerte{stats.alerts > 1 ? 's' : ''}
              </span>
            </div>
          )}
          {canCreate && (
            <Link
              href="/chef-planteurs/new"
              className="inline-flex items-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 shadow-sm transition-colors"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouveau fournisseur
            </Link>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <AnimatedSection animation="fadeUp" delay={0.1}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.validated}</p>
                <p className="text-xs text-gray-500">Validés</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.exploited}</p>
                <p className="text-xs text-gray-500">Exploités</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                <p className="text-xs text-gray-500">En attente</p>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* Search and Filters */}
      <AnimatedSection animation="fadeUp" delay={0.15}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, code ou téléphone..."
              defaultValue={filters.search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <select
            value={filters.validation_status || ''}
            onChange={(e) => updateFilters({ validation_status: e.target.value as any || undefined, page: 1 })}
            className="rounded-lg border border-gray-200 py-2.5 pl-3 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="validated">Validé</option>
            <option value="rejected">Rejeté</option>
          </select>
          <select
            value={filters.is_exploited === undefined ? '' : String(filters.is_exploited)}
            onChange={(e) => updateFilters({ 
              is_exploited: e.target.value === '' ? undefined : e.target.value === 'true',
              page: 1 
            })}
            className="rounded-lg border border-gray-200 py-2.5 pl-3 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">Tous</option>
            <option value="true">Exploités</option>
            <option value="false">Non exploités</option>
          </select>
          {regions.length > 0 && (
            <select
              value={filters.region || ''}
              onChange={(e) => updateFilters({ region: e.target.value || undefined, page: 1 })}
              className="rounded-lg border border-gray-200 py-2.5 pl-3 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Toutes les régions</option>
              {regions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          )}
        </div>
      </AnimatedSection>

      {/* Error state */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-white p-4 shadow-sm border border-gray-100">
              <div className="h-4 w-1/4 rounded bg-gray-200" />
              <div className="mt-2 h-3 w-1/2 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      )}

      {/* Data table */}
      {!loading && data && (
        <AnimatedSection animation="fadeUp" delay={0.2}>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Validation
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Fournisseur
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Quantité Max
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Livré
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Planteurs
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Utilisation
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Contrat
                    </th>
                    <th className="relative px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {data.data.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <div className="p-3 bg-gray-100 rounded-full mb-3">
                            <Search className="h-6 w-6 text-gray-400" />
                          </div>
                          <p className="text-sm font-medium text-gray-900">Aucun fournisseur trouvé</p>
                          <p className="text-sm text-gray-500 mt-1">
                            Essayez de modifier vos filtres
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.data.map((chef) => {
                      const statusConfig = VALIDATION_STATUS_CONFIG[chef.validation_status];
                      const chefWithStats = chef as any;
                      const usageLevel = getUsageLevel(chefWithStats.pourcentage_utilise);
                      const hasAlert = usageLevel !== 'success';
                      const isExploited = chefWithStats.est_exploite;
                      
                      return (
                        <tr 
                          key={chef.id} 
                          className={`hover:bg-gray-50 transition-colors ${hasAlert ? 'bg-orange-50/30' : ''}`}
                        >
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${statusConfig.className}`}
                            >
                              {statusConfig.icon}
                              {statusConfig.label}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex items-center gap-3">
                              {hasAlert && (
                                <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                              )}
                              <div>
                                <div className="font-medium text-gray-900">{chef.name}</div>
                                <div className="text-xs text-gray-500">{chef.code}</div>
                                {chef.localite && (
                                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                                    <MapPin className="h-3 w-3" />
                                    {chef.localite}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                            {formatWeight(chef.quantite_max_kg)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">
                            <div>
                              <span className="font-medium text-gray-900">
                                {formatWeight(chefWithStats.total_livre_kg)}
                              </span>
                              {chefWithStats.restant_kg !== null && chefWithStats.restant_kg !== undefined && (
                                <div className="text-xs text-gray-500">
                                  Restant: {formatWeight(chefWithStats.restant_kg)}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-900">
                                {chefWithStats.nombre_planteurs || 0}
                              </span>
                              {chefWithStats.total_limite_planteurs_kg > 0 && (
                                <span className="text-xs text-gray-500">
                                  ({formatWeight(chefWithStats.total_limite_planteurs_kg)})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 min-w-[140px]">
                            {chef.quantite_max_kg && chef.quantite_max_kg > 0 ? (
                              <div>
                                <ProgressBarCompact
                                  value={chefWithStats.total_livre_kg || 0}
                                  max={chef.quantite_max_kg}
                                />
                                {isExploited && (
                                  <span className="text-xs text-green-600 font-medium">Exploité</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                            {chef.contract_start || chef.contract_end ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                <span>
                                  {formatDate(chef.contract_start)} - {formatDate(chef.contract_end)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/chef-planteurs/${chef.id}`}
                                className="text-primary-600 hover:text-primary-900 font-medium"
                              >
                                Voir
                              </Link>
                              {canCreate && (
                                <>
                                  <span className="text-gray-300">|</span>
                                  <Link
                                    href={`/chef-planteurs/${chef.id}/edit`}
                                    className="text-blue-600 hover:text-blue-900 font-medium"
                                  >
                                    Modifier
                                  </Link>
                                  <span className="text-gray-300">|</span>
                                  <button
                                    onClick={() => handleDelete(chef.id, chef.name)}
                                    disabled={deleting === chef.id}
                                    className="text-red-600 hover:text-red-900 font-medium disabled:opacity-50"
                                  >
                                    {deleting === chef.id ? 'Suppression...' : 'Supprimer'}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="mt-4">
              <Pagination
                currentPage={data.page}
                totalPages={data.totalPages}
                total={data.total}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </AnimatedSection>
      )}
    </PageTransition>
  );
}

// Pagination component
function Pagination({
  currentPage,
  totalPages,
  total,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl shadow-sm border border-gray-100">
      <div className="text-sm text-gray-600">
        {total} fournisseur{total > 1 ? 's' : ''} au total
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          Précédent
        </button>
        <span className="text-sm text-gray-600 px-2">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
