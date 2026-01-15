'use client';

// CocoaTrack V2 - Synthèse Planteur Page
// Displays aggregated delivery stats by planteur with filters and charts

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { 
  Users, 
  Package, 
  TrendingDown,
  Calendar,
  Search,
  AlertTriangle,
  Eye,
  BarChart3,
  FileDown,
  FileSpreadsheet,
} from 'lucide-react';

import { analyticsApi, type PlanteurSummaryItem, type PlanteurSummaryResponse } from '@/lib/api/analytics';
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

export default function SynthesePlanteurPage() {
  const [data, setData] = useState<PlanteurSummaryResponse | null>(null);
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
      const result = await analyticsApi.getSummaryPlanteur({
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
    item.planter_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.planter_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.cooperative && item.cooperative.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Calculate chart data (top 10)
  const chartData = filteredItems.slice(0, 10);

  // Export functions
  const handleExportPDF = () => {
    if (!filteredItems.length) return;
    setExporting(true);
    
    try {
      exportToPDF({
        title: 'Synthèse Planteur',
        subtitle: 'Statistiques agrégées des livraisons par planteur',
        filename: `synthese-planteur-${new Date().toISOString().split('T')[0]}`,
        columns: [
          { header: 'Planteur', key: 'planter_name', width: 25 },
          { header: 'Code', key: 'planter_code', width: 15 },
          { header: 'Coopérative', key: 'cooperative', width: 20 },
          { header: 'Total (kg)', key: 'total_kg', width: 15, format: (v) => formatWeight(v) },
          { header: 'Livraisons', key: 'nombre_livraisons', width: 12 },
        ],
        data: filteredItems,
        filters: {
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          search: searchQuery || undefined,
        },
        totals: {
          'Total': formatWeight(data?.total_general || 0),
          'Planteurs': filteredItems.length.toString(),
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
        title: 'Synthèse Planteur',
        filename: `synthese-planteur-${new Date().toISOString().split('T')[0]}`,
        columns: [
          { header: 'Planteur', key: 'planter_name', width: 25 },
          { header: 'Code', key: 'planter_code', width: 15 },
          { header: 'Coopérative', key: 'cooperative', width: 20 },
          { header: 'Total (kg)', key: 'total_kg', width: 15 },
          { header: 'Livraisons', key: 'nombre_livraisons', width: 12 },
        ],
        data: filteredItems,
        filters: {
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          search: searchQuery || undefined,
        },
        totals: {
          'Total (kg)': data?.total_general || 0,
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
            Synthèse Planteur
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Statistiques agrégées des livraisons par planteur
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
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {loading ? '...' : formatWeight(data?.total_general)}
                </p>
                <p className="text-xs text-gray-500">Total déchargé</p>
              </div>
            </div>
          </div>
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
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {loading ? '...' : data?.total_planteurs || 0}
                </p>
                <p className="text-xs text-gray-500">Planteurs actifs</p>
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

      {/* Chart - Simple bar visualization */}
      {!loading && chartData.length > 0 && (
        <AnimatedSection animation="fadeUp" delay={0.15}>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-4">Top 10 Planteurs par quantité</h3>
            <div className="space-y-3">
              {chartData.map((item, index) => {
                const maxKg = chartData[0]?.total_kg || 1;
                const percentage = (item.total_kg / maxKg) * 100;
                return (
                  <div key={item.planter_id} className="flex items-center gap-3">
                    <span className="w-6 text-sm font-medium text-gray-500">{index + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                          {item.planter_name}
                        </span>
                        <span className="text-sm font-bold text-gray-900">
                          {formatWeight(item.total_kg)}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary-500 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </AnimatedSection>
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
                      Planteur
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Coopérative
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
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <div className="p-3 bg-gray-100 rounded-full mb-3">
                            <Users className="h-6 w-6 text-gray-400" />
                          </div>
                          <p className="text-sm font-medium text-gray-900">Aucun planteur trouvé</p>
                          <p className="text-sm text-gray-500 mt-1">
                            {searchQuery ? 'Essayez de modifier votre recherche' : 'Aucune livraison pour cette période'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const lossLevel = getLossLevel(item.pct_pertes);
                      const hasHighLoss = item.pct_pertes > 10;
                      
                      return (
                        <tr 
                          key={item.planter_id} 
                          className={`hover:bg-gray-50 transition-colors ${hasHighLoss ? 'bg-red-50/30' : ''}`}
                        >
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex items-center gap-2">
                              {hasHighLoss && (
                                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                              )}
                              <div>
                                <div className="font-medium text-gray-900">{item.planter_name}</div>
                                <div className="text-xs text-gray-500">{item.planter_code}</div>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                            {item.cooperative || '-'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 text-right">
                            {formatWeight(item.total_loaded_kg)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 text-right">
                            {formatWeight(item.total_kg)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${lossLevel.bgColor} ${lossLevel.color}`}>
                              {item.pct_pertes.toFixed(1)}%
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 text-right">
                            {item.nombre_livraisons}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium">
                            <Link
                              href={`/planteurs/${item.planter_id}`}
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
