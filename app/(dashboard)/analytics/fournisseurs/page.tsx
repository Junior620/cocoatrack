'use client';

// CocoaTrack V2 - Synthèse Fournisseur Page
// Displays aggregated delivery stats by fournisseur (chef planteur) with filters and charts

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { 
  UsersRound, 
  Package, 
  TrendingDown,
  Calendar,
  Search,
  AlertTriangle,
  Eye,
  BarChart3,
  Gauge,
  FileDown,
  FileSpreadsheet,
} from 'lucide-react';

import { analyticsApi, type FournisseurSummaryItem, type FournisseurSummaryResponse } from '@/lib/api/analytics';
import { exportToPDF, exportToExcel } from '@/lib/services/export-service';
import { PageTransition, AnimatedSection } from '@/components/dashboard';

// Format weight with locale
function formatWeight(kg: number | null | undefined): string {
  if (kg === null || kg === undefined) return '-';
  return `${kg.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg`;
}

// Get loss level color
function getLossLevel(percentage: number): { color: string; bgColor: string } {
  if (percentage <= 5) {
    return { color: 'text-green-700', bgColor: 'bg-green-100' };
  } else if (percentage <= 10) {
    return { color: 'text-orange-700', bgColor: 'bg-orange-100' };
  } else {
    return { color: 'text-red-700', bgColor: 'bg-red-100' };
  }
}

// Get utilization level color
function getUtilizationLevel(percentage: number): { color: string; bgColor: string; barColor: string } {
  if (percentage <= 70) {
    return { color: 'text-green-700', bgColor: 'bg-green-100', barColor: 'bg-green-500' };
  } else if (percentage <= 90) {
    return { color: 'text-orange-700', bgColor: 'bg-orange-100', barColor: 'bg-orange-500' };
  } else {
    return { color: 'text-red-700', bgColor: 'bg-red-100', barColor: 'bg-red-500' };
  }
}

export default function SyntheseFournisseurPage() {
  const [data, setData] = useState<FournisseurSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyticsApi.getSummaryFournisseur({
        from: dateFrom || undefined,
        to: dateTo || undefined,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du chargement');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter items by search
  const filteredItems = (data?.items || []).filter((item) =>
    item.fournisseur_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.fournisseur_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.cooperative && item.cooperative.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Export functions
  const handleExportPDF = () => {
    if (!filteredItems.length) return;
    setExporting(true);
    
    try {
      exportToPDF({
        title: 'Synthèse Fournisseur',
        subtitle: 'Statistiques agrégées des livraisons par fournisseur',
        filename: `synthese-fournisseur-${new Date().toISOString().split('T')[0]}`,
        columns: [
          { header: 'Fournisseur', key: 'fournisseur_name', width: 25 },
          { header: 'Code', key: 'fournisseur_code', width: 12 },
          { header: 'Total (kg)', key: 'total_loaded_kg', width: 15, format: (v) => formatWeight(v) },
          { header: 'Max (kg)', key: 'quantite_max_kg', width: 15, format: (v) => formatWeight(v) },
          { header: 'Utilisation', key: 'pct_utilisation', width: 12, format: (v) => `${v?.toFixed(1) || 0}%` },
          { header: 'Livraisons', key: 'nombre_livraisons', width: 10 },
          { header: 'Planteurs', key: 'nombre_planteurs', width: 10 },
        ],
        data: filteredItems,
        filters: {
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          search: searchQuery || undefined,
        },
        totals: {
          'Total': formatWeight(data?.total_loaded || 0),
          'Utilisation': `${data?.pct_utilisation_global?.toFixed(1) || 0}%`,
        },
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = () => {
    if (!filteredItems.length) return;
    setExporting(true);
    
    try {
      exportToExcel({
        title: 'Synthèse Fournisseur',
        filename: `synthese-fournisseur-${new Date().toISOString().split('T')[0]}`,
        columns: [
          { header: 'Fournisseur', key: 'fournisseur_name', width: 25 },
          { header: 'Code', key: 'fournisseur_code', width: 12 },
          { header: 'Coopérative', key: 'cooperative', width: 20 },
          { header: 'Total (kg)', key: 'total_loaded_kg', width: 15 },
          { header: 'Max (kg)', key: 'quantite_max_kg', width: 15 },
          { header: 'Utilisation (%)', key: 'pct_utilisation', width: 12 },
          { header: 'Livraisons', key: 'nombre_livraisons', width: 10 },
          { header: 'Planteurs', key: 'nombre_planteurs', width: 10 },
        ],
        data: filteredItems,
        filters: {
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          search: searchQuery || undefined,
        },
        totals: {
          'Total (kg)': data?.total_loaded || 0,
        },
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary-600" />
            Synthèse Fournisseur
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Statistiques agrégées des livraisons par fournisseur (chef planteur)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            disabled={loading || exporting || !filteredItems.length}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FileDown className="h-4 w-4" />
            PDF
          </button>
          <button
            onClick={handleExportExcel}
            disabled={loading || exporting || !filteredItems.length}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <AnimatedSection animation="fadeUp" delay={0.05}>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="inline h-4 w-4 mr-1" />
                Date début
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="inline h-4 w-4 mr-1" />
                Date fin
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Search className="inline h-4 w-4 mr-1" />
                Rechercher
              </label>
              <input
                type="text"
                placeholder="Nom, code ou coopérative..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* KPI Cards */}
      <AnimatedSection animation="fadeUp" delay={0.1}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {loading ? '...' : formatWeight(data?.total_loaded)}
                </p>
                <p className="text-xs text-gray-500">Total chargé</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {loading ? '...' : formatWeight(data?.total_unloaded)}
                </p>
                <p className="text-xs text-gray-500">Total déchargé</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {loading ? '...' : `${data?.pct_pertes_global?.toFixed(1) || 0}%`}
                </p>
                <p className="text-xs text-gray-500">Pertes globales</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Gauge className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {loading ? '...' : `${data?.pct_utilisation_global?.toFixed(1) || 0}%`}
                </p>
                <p className="text-xs text-gray-500">Utilisation globale</p>
              </div>
            </div>
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
                      Fournisseur
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Chargé (kg)
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Déchargé (kg)
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Pertes
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Max (kg)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Utilisation
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Livraisons
                    </th>
                    <th className="relative px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <div className="p-3 bg-gray-100 rounded-full mb-3">
                            <UsersRound className="h-6 w-6 text-gray-400" />
                          </div>
                          <p className="text-sm font-medium text-gray-900">Aucun fournisseur trouvé</p>
                          <p className="text-sm text-gray-500 mt-1">
                            {searchQuery ? 'Essayez de modifier votre recherche' : 'Aucune livraison pour cette période'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const lossLevel = getLossLevel(item.pct_pertes);
                      const utilizationLevel = getUtilizationLevel(item.pct_utilisation);
                      const hasHighLoss = item.pct_pertes > 10;
                      const hasHighUtilization = item.pct_utilisation > 90;
                      
                      return (
                        <tr 
                          key={item.fournisseur_id} 
                          className={`hover:bg-gray-50 transition-colors ${hasHighLoss || hasHighUtilization ? 'bg-red-50/30' : ''}`}
                        >
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex items-center gap-2">
                              {(hasHighLoss || hasHighUtilization) && (
                                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                              )}
                              <div>
                                <div className="font-medium text-gray-900">{item.fournisseur_name}</div>
                                <div className="text-xs text-gray-500">
                                  {item.fournisseur_code} • {item.nombre_planteurs} planteur{item.nombre_planteurs > 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 text-right">
                            {formatWeight(item.total_loaded_kg)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 text-right">
                            {formatWeight(item.total_unloaded_kg)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${lossLevel.bgColor} ${lossLevel.color}`}>
                              {item.pct_pertes.toFixed(1)}%
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 text-right">
                            {formatWeight(item.quantite_max_kg)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 min-w-[120px]">
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${utilizationLevel.barColor} rounded-full transition-all duration-500`}
                                  style={{ width: `${Math.min(item.pct_utilisation, 100)}%` }}
                                />
                              </div>
                              <span className={`text-xs font-semibold ${utilizationLevel.color} min-w-[45px] text-right`}>
                                {item.pct_utilisation.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 text-right">
                            {item.nombre_livraisons}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium">
                            <Link
                              href={`/chef-planteurs/${item.fournisseur_id}`}
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
