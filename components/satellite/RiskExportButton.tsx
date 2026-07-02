'use client';

/**
 * RiskExportButton Component
 * 
 * Provides UI for exporting parcelles filtered by risk categories
 */

import { useState } from 'react';
import { Download, Filter, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { RISK_CATEGORIES, type RiskCategory } from '@/lib/satellite/services/risk-assessment.service';

export interface RiskExportFilters {
  categories?: RiskCategory[];
  region?: string;
  hasDeforestation?: boolean;
  calculateNDVI?: boolean;
  maxParcelles?: number;
}

export interface RiskExportButtonProps {
  regions?: string[];
  defaultFilters?: RiskExportFilters;
  showQuickActions?: boolean;
  className?: string;
}

export default function RiskExportButton({
  regions = [],
  defaultFilters = { calculateNDVI: true, maxParcelles: 100 },
  showQuickActions = true,
  className = '',
}: RiskExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<RiskExportFilters>(defaultFilters);
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');

  const handleExport = async (customFilters?: RiskExportFilters) => {
    setLoading(true);
    setError(null);
    setProgressMessage('');

    try {
      const exportFilters = customFilters || filters;
      const params = new URLSearchParams();

      if (exportFilters.categories && exportFilters.categories.length > 0) {
        params.append('category', exportFilters.categories.join(','));
      }
      if (exportFilters.region) {
        params.append('region', exportFilters.region);
      }
      if (exportFilters.hasDeforestation !== undefined) {
        params.append('hasDeforestation', exportFilters.hasDeforestation.toString());
      }

      const shouldCalculateNDVI = exportFilters.calculateNDVI !== false;
      params.append('calculateNDVI', String(shouldCalculateNDVI));

      if (exportFilters.maxParcelles !== undefined) {
        params.append('maxParcelles', exportFilters.maxParcelles.toString());
      }
      params.append('format', format);

      if (shouldCalculateNDVI) {
        setProgressMessage('Calcul du NDVI en cours... Cela peut prendre quelques minutes.');
      } else {
        setProgressMessage('Préparation de l\'export...');
      }

      const response = await fetch(`/api/satellite/risk-export?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      setProgressMessage('Téléchargement du fichier...');

      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const contentDisposition = response.headers.get('Content-Disposition');
        const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
        a.download = filenameMatch ? filenameMatch[1] : 'parcelles-export.csv';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'parcelles-export.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }

      setProgressMessage('Export terminé avec succès!');
      setTimeout(() => {
        setShowFilters(false);
        setProgressMessage('');
      }, 1000);
    } catch (err) {
      console.error('Export error:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setProgressMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleExportHighRisk = () => {
    handleExport({
      categories: [RISK_CATEGORIES.HIGH_RISK],
    });
  };

  const handleExportGoodHealth = () => {
    handleExport({
      categories: [RISK_CATEGORIES.EXCELLENT, RISK_CATEGORIES.LOW_RISK],
    });
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showQuickActions && (
        <>
          <button
            onClick={handleExportHighRisk}
            disabled={loading}
            className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <AlertTriangle size={16} />
            )}
            Exporter Parcelles à Risque
          </button>

          <button
            onClick={handleExportGoodHealth}
            disabled={loading}
            className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle size={16} />
            )}
            Exporter Bonnes Parcelles
          </button>
        </>
      )}

      <button
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <Filter size={16} />
        Filtres Avancés
      </button>

      {showFilters && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/40 backdrop-blur-sm pt-20 pb-4 px-4 overflow-y-auto" onClick={() => setShowFilters(false)}>
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl" style={{ maxHeight: 'calc(100vh - 112px)', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Filtres d'Export</h2>
                  <p className="mt-1 text-sm text-gray-500">Affinez les résultats de vos parcelles</p>
                </div>
                <button
                  onClick={() => setShowFilters(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5" style={{ backgroundColor: '#FAFAFA' }}>
              {/* Error Display */}
              {error && (
                <div className="mb-4 rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Progress Message */}
              {progressMessage && (
                <div className="mb-4 rounded-xl bg-blue-50 border border-blue-100 p-4 flex items-center gap-3">
                  <Loader2 size={18} className="animate-spin text-blue-600" />
                  <span className="text-sm text-blue-700">{progressMessage}</span>
                </div>
              )}

              <div className="space-y-6">
                {/* État de Santé */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Catégories de Risque
                  </label>
                  <div className="space-y-2.5">
                    {[
                      { value: RISK_CATEGORIES.EXCELLENT, label: 'Excellente Santé', color: 'text-emerald-700' },
                      { value: RISK_CATEGORIES.LOW_RISK, label: 'Santé Correcte', color: 'text-green-700' },
                      { value: RISK_CATEGORIES.MEDIUM_RISK, label: 'À Surveiller', color: 'text-orange-600' },
                      { value: RISK_CATEGORIES.HIGH_RISK, label: 'À Risque Élevé', color: 'text-red-600' },
                      { value: RISK_CATEGORIES.UNKNOWN, label: 'Non Évalué', color: 'text-gray-600' },
                    ].map((category) => (
                      <label key={category.value} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group">
                        <input
                          type="checkbox"
                          checked={filters.categories?.includes(category.value) || false}
                          onChange={(e) => {
                            const newCategories = e.target.checked
                              ? [...(filters.categories || []), category.value]
                              : (filters.categories || []).filter((c) => c !== category.value);
                            setFilters({ ...filters, categories: newCategories });
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                        />
                        <span className={`text-sm font-medium ${category.color} group-hover:text-gray-900 transition-colors`}>{category.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Localisation */}
                {regions.length > 0 && (
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      Région
                    </label>
                    <select
                      value={filters.region || ''}
                      onChange={(e) =>
                        setFilters({ ...filters, region: e.target.value || undefined })
                      }
                      className="w-full h-11 rounded-lg border-gray-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm font-medium transition-all"
                    >
                      <option value="">Toutes les régions</option>
                      {regions.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Déforestation */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Déforestation
                  </label>
                  <select
                    value={
                      filters.hasDeforestation === undefined
                        ? ''
                        : filters.hasDeforestation
                        ? 'true'
                        : 'false'
                    }
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        hasDeforestation:
                          e.target.value === '' ? undefined : e.target.value === 'true',
                      })
                    }
                    className="w-full h-11 rounded-lg border-gray-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm font-medium transition-all"
                  >
                    <option value="">Toutes</option>
                    <option value="true">Avec alertes</option>
                    <option value="false">Sans alertes</option>
                  </select>
                </div>

                {/* Options d'export */}
                <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Format d'Export
                  </label>
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center justify-center gap-2 h-11 px-4 rounded-lg border-2 border-gray-200 hover:border-blue-300 cursor-pointer transition-all has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                      <input
                        type="radio"
                        value="csv"
                        checked={format === 'csv'}
                        onChange={() => setFormat('csv')}
                        className="h-4 w-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">CSV</span>
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-2 h-11 px-4 rounded-lg border-2 border-gray-200 hover:border-blue-300 cursor-pointer transition-all has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                      <input
                        type="radio"
                        value="json"
                        checked={format === 'json'}
                        onChange={() => setFormat('json')}
                        className="h-4 w-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">JSON</span>
                    </label>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-blue-50/50 cursor-pointer transition-colors group">
                      <input
                        type="checkbox"
                        checked={filters.calculateNDVI !== false}
                        onChange={(e) =>
                          setFilters({ ...filters, calculateNDVI: e.target.checked })
                        }
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900">Calculer le NDVI avant export</span>
                        <p className="mt-0.5 text-xs text-gray-500">Recommandé pour obtenir les données les plus récentes</p>
                      </div>
                    </label>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Limite de parcelles
                    </label>
                    <input
                      type="number"
                      placeholder="100"
                      value={filters.maxParcelles || 100}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          maxParcelles: e.target.value ? Number(e.target.value) : 100,
                        })
                      }
                      className="w-full h-11 rounded-lg border-gray-200 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm font-medium transition-all"
                      min="1"
                      max="1000"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-white rounded-b-2xl" style={{ flexShrink: 0 }}>
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    setFilters(defaultFilters);
                  }}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Réinitialiser
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowFilters(false)}
                    disabled={loading}
                    className="h-10 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => handleExport()}
                    disabled={loading}
                    className="h-10 px-6 flex items-center gap-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm hover:shadow transition-all"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Export en cours...
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Exporter
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
