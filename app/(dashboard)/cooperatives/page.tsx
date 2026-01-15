'use client';

// CocoaTrack V2 - Cooperatives List Page
// Displays cooperatives with aggregated stats from planteurs and fournisseurs

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { 
  Building2, 
  Users, 
  UsersRound, 
  Package, 
  Search,
  AlertTriangle,
  Eye,
} from 'lucide-react';

import { cooperativesApi, type CooperativeStats, type CooperativeGlobalStats } from '@/lib/api/cooperatives';
import { PageTransition, AnimatedSection } from '@/components/dashboard';

// Format weight with locale
function formatWeight(kg: number | null | undefined): string {
  if (kg === null || kg === undefined) return '-';
  return `${kg.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} kg`;
}

// Get loss level color
function getLossLevel(percentage: number): { color: string; bgColor: string; label: string } {
  if (percentage <= 5) {
    return { color: 'text-green-700', bgColor: 'bg-green-100', label: 'Faible' };
  } else if (percentage <= 10) {
    return { color: 'text-orange-700', bgColor: 'bg-orange-100', label: 'Moyen' };
  } else {
    return { color: 'text-red-700', bgColor: 'bg-red-100', label: 'Élevé' };
  }
}

export default function CooperativesPage() {
  const [cooperatives, setCooperatives] = useState<CooperativeStats[]>([]);
  const [globalStats, setGlobalStats] = useState<CooperativeGlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [coops, stats] = await Promise.all([
        cooperativesApi.listWithStats(),
        cooperativesApi.getGlobalStats(),
      ]);
      setCooperatives(coops);
      setGlobalStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du chargement des coopératives');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter cooperatives by search
  const filteredCooperatives = cooperatives.filter((coop) =>
    coop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (coop.code && coop.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coopératives</h1>
          <p className="mt-1 text-sm text-gray-500">
            Vue agrégée des coopératives et leurs statistiques
          </p>
        </div>
      </div>

      {/* Global Stats Cards */}
      <AnimatedSection animation="fadeUp" delay={0.1}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {loading ? '...' : globalStats?.total_cooperatives || 0}
                </p>
                <p className="text-sm text-gray-500">Coopératives</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {loading ? '...' : globalStats?.total_membres || 0}
                </p>
                <p className="text-sm text-gray-500">Membres Total</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-xl">
                <Package className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {loading ? '...' : formatWeight(globalStats?.total_production_kg)}
                </p>
                <p className="text-sm text-gray-500">Production</p>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* Search */}
      <AnimatedSection animation="fadeUp" delay={0.15}>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une coopérative..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
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
      {!loading && (
        <AnimatedSection animation="fadeUp" delay={0.2}>
          <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Nom
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Planteurs
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      <div className="flex items-center gap-2">
                        <UsersRound className="h-4 w-4" />
                        Fournisseurs
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Déchargé (kg)
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Pertes
                    </th>
                    <th className="relative px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredCooperatives.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <div className="p-3 bg-gray-100 rounded-full mb-3">
                            <Building2 className="h-6 w-6 text-gray-400" />
                          </div>
                          <p className="text-sm font-medium text-gray-900">Aucune coopérative trouvée</p>
                          <p className="text-sm text-gray-500 mt-1">
                            {searchQuery ? 'Essayez de modifier votre recherche' : 'Les coopératives apparaîtront ici'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCooperatives.map((coop) => {
                      const lossLevel = getLossLevel(coop.pourcentage_pertes);
                      const hasHighLoss = coop.pourcentage_pertes > 10;
                      
                      return (
                        <tr 
                          key={coop.id} 
                          className={`hover:bg-gray-50 transition-colors ${hasHighLoss ? 'bg-red-50/30' : ''}`}
                        >
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex items-center gap-3">
                              {hasHighLoss && (
                                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                              )}
                              <div>
                                <div className="font-medium text-gray-900">{coop.name}</div>
                                {coop.code && (
                                  <div className="text-xs text-gray-500">{coop.code}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                            {coop.nb_planteurs}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                            {coop.nb_fournisseurs}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-gray-900">
                            {coop.total_membres}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                            {formatWeight(coop.total_decharge_kg)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {coop.total_charge_kg > 0 ? (
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${lossLevel.bgColor} ${lossLevel.color}`}>
                                {coop.pourcentage_pertes.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium">
                            <Link
                              href={`/cooperatives/${coop.id}`}
                              className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-900 font-medium"
                            >
                              <Eye className="h-4 w-4" />
                              Voir
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </AnimatedSection>
      )}
    </PageTransition>
  );
}
