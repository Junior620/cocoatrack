'use client';

// CocoaTrack V2 - Récap Clients Page
// Main dashboard showing client contract fulfillment by season

import { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Package, 
  TrendingUp, 
  Search,
  FileDown,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Building2,
  Globe,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { clientsApi, type ClientRecapItem, type ClientRecapResponse } from '@/lib/api/clients';
import { exportToPDF, exportToExcel } from '@/lib/services/export-service';

export default function ClientRecapPage() {
  const [data, setData] = useState<ClientRecapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [season, setSeason] = useState<string>('');
  const [seasons, setSeasons] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Load data
  useEffect(() => {
    loadData();
    loadSeasons();
  }, [season]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await clientsApi.getClientRecap(season || undefined);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const loadSeasons = async () => {
    try {
      const result = await clientsApi.getSeasons();
      setSeasons(result);
      // Auto-select current season if available
      if (result.length > 0 && !season) {
        setSeason(result[0]);
      }
    } catch (err) {
      console.error('Failed to load seasons:', err);
    }
  };

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!searchQuery) return data.items;
    
    const query = searchQuery.toLowerCase();
    return data.items.filter(
      (item) =>
        item.client_name.toLowerCase().includes(query) ||
        item.client_code.toLowerCase().includes(query) ||
        (item.country && item.country.toLowerCase().includes(query))
    );
  }, [data?.items, searchQuery]);

  // Export handlers
  const handleExportPDF = () => {
    if (!filteredItems.length) return;

    const columns = [
      { header: 'Client', key: 'client_name' },
      { header: 'Code', key: 'client_code' },
      { header: 'Pays', key: 'country' },
      { header: 'Contracté (kg)', key: 'total_contracted_kg' },
      { header: 'Livré (kg)', key: 'total_shipped_kg' },
      { header: 'Restant (kg)', key: 'remaining_kg' },
      { header: '% Complété', key: 'pct_completed' },
    ];

    const exportData = filteredItems.map((item) => ({
      client_name: item.client_name,
      client_code: item.client_code,
      country: item.country || '-',
      total_contracted_kg: item.total_contracted_kg.toLocaleString('fr-FR'),
      total_shipped_kg: item.total_shipped_kg.toLocaleString('fr-FR'),
      remaining_kg: item.remaining_kg.toLocaleString('fr-FR'),
      pct_completed: `${item.pct_completed}%`,
    }));

    exportToPDF({
      title: 'Récap Clients',
      subtitle: season ? `Saison ${season}` : undefined,
      filename: `recap-clients-${season || 'all'}-${new Date().toISOString().split('T')[0]}`,
      columns,
      data: exportData,
      filters: searchQuery ? { search: searchQuery } : undefined,
      totals: data ? {
        'Total Contracté': `${data.total_contracted.toLocaleString('fr-FR')} kg`,
        'Total Livré': `${data.total_shipped.toLocaleString('fr-FR')} kg`,
        'Total Restant': `${data.total_remaining.toLocaleString('fr-FR')} kg`,
        'Progression Globale': `${data.pct_global}%`,
      } : undefined,
    });
  };

  const handleExportExcel = () => {
    if (!filteredItems.length) return;

    const columns = [
      { header: 'Client', key: 'client_name' },
      { header: 'Code', key: 'client_code' },
      { header: 'Pays', key: 'country' },
      { header: 'Saison', key: 'season' },
      { header: 'Contracté (kg)', key: 'total_contracted_kg' },
      { header: 'Livré (kg)', key: 'total_shipped_kg' },
      { header: 'Restant (kg)', key: 'remaining_kg' },
      { header: '% Complété', key: 'pct_completed' },
      { header: 'Nb Contrats', key: 'contracts_count' },
      { header: 'Nb Expéditions', key: 'shipments_count' },
    ];

    const exportData = filteredItems.map((item) => ({
      client_name: item.client_name,
      client_code: item.client_code,
      country: item.country || '',
      season: item.season,
      total_contracted_kg: item.total_contracted_kg,
      total_shipped_kg: item.total_shipped_kg,
      remaining_kg: item.remaining_kg,
      pct_completed: item.pct_completed,
      contracts_count: item.contracts_count,
      shipments_count: item.shipments_count,
    }));

    exportToExcel({
      title: 'Récap Clients',
      subtitle: season ? `Saison ${season}` : undefined,
      filename: `recap-clients-${season || 'all'}-${new Date().toISOString().split('T')[0]}`,
      columns,
      data: exportData,
      filters: searchQuery ? { search: searchQuery } : undefined,
    });
  };


  // Progress bar color based on percentage
  const getProgressColor = (pct: number) => {
    if (pct >= 100) return 'bg-green-500';
    if (pct >= 75) return 'bg-emerald-500';
    if (pct >= 50) return 'bg-yellow-500';
    if (pct >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Récap Clients</h1>
          <p className="text-gray-500 mt-1">
            Suivi des engagements et livraisons par client
          </p>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            disabled={!filteredItems.length}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FileDown className="h-4 w-4" />
            PDF
          </button>
          <button
            onClick={handleExportExcel}
            disabled={!filteredItems.length}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Clients Actifs</p>
                <p className="text-2xl font-bold text-gray-900">{data.total_clients}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Package className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Contracté</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.total_contracted.toLocaleString('fr-FR')} <span className="text-sm font-normal">kg</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Livré</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.total_shipped.toLocaleString('fr-FR')} <span className="text-sm font-normal">kg</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Progression</p>
                <p className="text-2xl font-bold text-gray-900">{data.pct_global}%</p>
              </div>
            </div>
            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full ${getProgressColor(data.pct_global)} transition-all`}
                style={{ width: `${Math.min(100, data.pct_global)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Season filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Toutes les saisons</option>
              {seasons.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>


      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Pays
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Contracté (kg)
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Livré (kg)
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Restant (kg)
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Progression
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    {searchQuery ? 'Aucun client trouvé' : 'Aucune donnée disponible'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.client_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-50 rounded-lg">
                          <Building2 className="h-4 w-4 text-primary-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{item.client_name}</p>
                          <p className="text-sm text-gray-500">{item.client_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Globe className="h-4 w-4 text-gray-400" />
                        {item.country || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-gray-900">
                      {item.total_contracted_kg.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-green-600">
                      {item.total_shipped_kg.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-amber-600">
                      {item.remaining_kg.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${getProgressColor(item.pct_completed)} transition-all`}
                            style={{ width: `${Math.min(100, item.pct_completed)}%` }}
                          />
                        </div>
                        <span className={`text-sm font-medium ${
                          item.pct_completed >= 100 ? 'text-green-600' : 'text-gray-600'
                        }`}>
                          {item.pct_completed}%
                        </span>
                        {item.pct_completed >= 100 && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Summary footer */}
        {data && filteredItems.length > 0 && (
          <div className="bg-gray-50 border-t border-gray-100 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
              <span className="text-gray-500">
                {filteredItems.length} client{filteredItems.length > 1 ? 's' : ''} affiché{filteredItems.length > 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-6">
                <span className="text-gray-600">
                  <span className="font-medium">{data.total_remaining.toLocaleString('fr-FR')}</span> kg à livrer
                </span>
                <span className="flex items-center gap-1 text-gray-600">
                  <Clock className="h-4 w-4" />
                  Saison: <span className="font-medium">{season || 'Toutes'}</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
