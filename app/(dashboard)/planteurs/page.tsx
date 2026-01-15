'use client';

// CocoaTrack V2 - Planteurs List Page (Enhanced with V1 features)
// Displays planteurs with stats, alerts, and progress bars

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, AlertTriangle, TrendingDown, Scale, MapPin } from 'lucide-react';

import { useAuth, hasPermission } from '@/lib/auth';
import { planteursApi } from '@/lib/api/planteurs';
import type { PlanteurWithRelations, PlanteurFilters } from '@/lib/validations/planteur';
import type { PaginatedResult } from '@/types';
import { ProgressBarCompact, AlertBadge } from '@/components/ui/ProgressBar';
import { PageTransition, AnimatedSection } from '@/components/dashboard';

// Format weight with locale
function formatWeight(kg: number | null | undefined): string {
  if (kg === null || kg === undefined) return '-';
  return `${kg.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg`;
}

// Get alert level based on percentage
function getUsageLevel(percentage: number | null | undefined): 'success' | 'warning' | 'danger' {
  if (percentage === null || percentage === undefined) return 'success';
  if (percentage >= 90) return 'danger';
  if (percentage >= 70) return 'warning';
  return 'success';
}

function getLossLevel(percentage: number | null | undefined): 'success' | 'warning' | 'danger' {
  if (percentage === null || percentage === undefined) return 'success';
  if (percentage > 10) return 'danger';
  if (percentage > 5) return 'warning';
  return 'success';
}

export default function PlanteursPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [data, setData] = useState<PaginatedResult<PlanteurWithRelations> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Parse filters from URL
  const filters: PlanteurFilters = {
    page: parseInt(searchParams.get('page') || '1'),
    pageSize: parseInt(searchParams.get('pageSize') || '20'),
    search: searchParams.get('search') || undefined,
    chef_planteur_id: searchParams.get('chef_planteur_id') || undefined,
    is_active: searchParams.get('is_active') === 'true' ? true : 
               searchParams.get('is_active') === 'false' ? false : undefined,
    sortBy: searchParams.get('sortBy') || 'created_at',
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
  };

  const canCreate = user && hasPermission(user.role, 'planteurs:create');

  // Fetch planteurs with stats
  const fetchPlanteurs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await planteursApi.listWithStats(filters);
      setData(result);
    } catch (err) {
      // Fallback to regular list if view doesn't exist yet
      try {
        const result = await planteursApi.list(filters);
        setData(result);
      } catch (fallbackErr) {
        setError(fallbackErr instanceof Error ? fallbackErr.message : 'Failed to fetch planteurs');
      }
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchPlanteurs();
  }, [fetchPlanteurs]);

  // Update URL with new filters
  const updateFilters = (newFilters: Partial<PlanteurFilters>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.set(key, String(value));
      } else {
        params.delete(key);
      }
    });
    router.push(`/planteurs?${params.toString()}`);
  };

  // Handle search
  const handleSearch = (query: string) => {
    updateFilters({ search: query, page: 1 });
  };

  // Handle delete
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le planteur "${name}" ?`)) {
      return;
    }
    
    setDeleting(id);
    try {
      await planteursApi.softDelete(id);
      // Refresh the list
      fetchPlanteurs();
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

  // Count alerts
  const alertCount = data?.data.filter(p => {
    const usage = p.pourcentage_utilise;
    const losses = p.pourcentage_pertes;
    return (usage !== null && usage !== undefined && usage >= 70) || 
           (losses !== null && losses !== undefined && losses > 5);
  }).length || 0;

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planteurs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérez les planteurs et suivez leur production
          </p>
        </div>
        <div className="flex items-center gap-3">
          {alertCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium text-orange-700">
                {alertCount} alerte{alertCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
          {canCreate && (
            <Link
              href="/planteurs/new"
              className="inline-flex items-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 shadow-sm transition-colors"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouveau planteur
            </Link>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <AnimatedSection animation="fadeUp" delay={0.1}>
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
            value={filters.is_active === undefined ? '' : String(filters.is_active)}
            onChange={(e) => updateFilters({ 
              is_active: e.target.value === '' ? undefined : e.target.value === 'true',
              page: 1 
            })}
            className="rounded-lg border border-gray-200 py-2.5 pl-3 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">Tous les statuts</option>
            <option value="true">Actifs</option>
            <option value="false">Inactifs</option>
          </select>
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
                      Planteur
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Fournisseur
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      <div className="flex items-center gap-1">
                        <Scale className="h-3.5 w-3.5" />
                        Superficie
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Limite
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Livré
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      <div className="flex items-center gap-1">
                        <TrendingDown className="h-3.5 w-3.5" />
                        Pertes
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Utilisation
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Statut
                    </th>
                    <th className="relative px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {data.data.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <div className="p-3 bg-gray-100 rounded-full mb-3">
                            <Search className="h-6 w-6 text-gray-400" />
                          </div>
                          <p className="text-sm font-medium text-gray-900">Aucun planteur trouvé</p>
                          <p className="text-sm text-gray-500 mt-1">
                            Essayez de modifier vos filtres ou créez un nouveau planteur
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.data.map((planteur) => {
                      const usageLevel = getUsageLevel(planteur.pourcentage_utilise);
                      const lossLevel = getLossLevel(planteur.pourcentage_pertes);
                      const hasAlert = usageLevel !== 'success' || lossLevel !== 'success';
                      
                      return (
                        <tr 
                          key={planteur.id} 
                          className={`hover:bg-gray-50 transition-colors ${hasAlert ? 'bg-orange-50/30' : ''}`}
                        >
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex items-center gap-3">
                              {hasAlert && (
                                <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                              )}
                              <div>
                                <div className="font-medium text-gray-900">{planteur.name}</div>
                                <div className="text-xs text-gray-500">{planteur.code}</div>
                                {planteur.localite && (
                                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                                    <MapPin className="h-3 w-3" />
                                    {planteur.localite}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                            {planteur.chef_planteur?.name || '-'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                            {planteur.superficie_hectares 
                              ? `${planteur.superficie_hectares.toLocaleString('fr-FR')} ha`
                              : '-'
                            }
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                            {formatWeight(planteur.limite_production_kg)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">
                            <div>
                              <span className="font-medium text-gray-900">
                                {formatWeight(planteur.total_decharge_kg)}
                              </span>
                              {planteur.total_charge_kg !== planteur.total_decharge_kg && (
                                <div className="text-xs text-gray-500">
                                  Chargé: {formatWeight(planteur.total_charge_kg)}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {planteur.pertes_kg !== null && planteur.pertes_kg !== undefined && planteur.pertes_kg > 0 ? (
                              <div className="flex items-center gap-2">
                                <AlertBadge level={lossLevel}>
                                  {planteur.pourcentage_pertes?.toFixed(1)}%
                                </AlertBadge>
                                <span className="text-xs text-gray-500">
                                  ({formatWeight(planteur.pertes_kg)})
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 min-w-[140px]">
                            {planteur.limite_production_kg && planteur.limite_production_kg > 0 ? (
                              <ProgressBarCompact
                                value={planteur.total_decharge_kg || 0}
                                max={planteur.limite_production_kg}
                              />
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                planteur.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {planteur.is_active ? 'Actif' : 'Inactif'}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/planteurs/${planteur.id}`}
                                className="text-primary-600 hover:text-primary-900 font-medium"
                              >
                                Voir
                              </Link>
                              {canCreate && (
                                <>
                                  <span className="text-gray-300">|</span>
                                  <Link
                                    href={`/planteurs/${planteur.id}/edit`}
                                    className="text-blue-600 hover:text-blue-900 font-medium"
                                  >
                                    Modifier
                                  </Link>
                                  <span className="text-gray-300">|</span>
                                  <button
                                    onClick={() => handleDelete(planteur.id, planteur.name)}
                                    disabled={deleting === planteur.id}
                                    className="text-red-600 hover:text-red-900 font-medium disabled:opacity-50"
                                  >
                                    {deleting === planteur.id ? 'Suppression...' : 'Supprimer'}
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
        {total} planteur{total > 1 ? 's' : ''} au total
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
