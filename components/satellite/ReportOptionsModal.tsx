'use client';

// ReportOptionsModal Component
// Modal for configuring certification report generation options

import { useState } from 'react';
import { X } from 'lucide-react';

export interface ReportOptions {
  language: 'fr' | 'en';
  includeBeforeAfter: boolean;
  includeNDVITrend: boolean;
  includeYieldPrediction: boolean;
  baselineDate: string; // ISO date string
}

interface ReportOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (options: ReportOptions) => void;
  isGenerating?: boolean;
}

export default function ReportOptionsModal({
  isOpen,
  onClose,
  onGenerate,
  isGenerating = false,
}: ReportOptionsModalProps) {
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [includeBeforeAfter, setIncludeBeforeAfter] = useState(true);
  const [includeNDVITrend, setIncludeNDVITrend] = useState(true);
  const [includeYieldPrediction, setIncludeYieldPrediction] = useState(false);
  const [baselineDate, setBaselineDate] = useState('2020-12-31'); // EUDR baseline

  if (!isOpen) return null;

  const handleGenerate = () => {
    // Convert date string (YYYY-MM-DD) to ISO datetime string
    const baselineDatetime = new Date(baselineDate).toISOString();
    
    onGenerate({
      language,
      includeBeforeAfter,
      includeNDVITrend,
      includeYieldPrediction,
      baselineDate: baselineDatetime,
    });
  };

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: 99999 }}>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg rounded-lg bg-white shadow-xl" style={{ zIndex: 100000 }}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Options du Rapport de Certification
            </h2>
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-6">
            {/* Language Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Langue du rapport
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="language"
                    value="fr"
                    checked={language === 'fr'}
                    onChange={(e) => setLanguage(e.target.value as 'fr' | 'en')}
                    disabled={isGenerating}
                    className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Français</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="language"
                    value="en"
                    checked={language === 'en'}
                    onChange={(e) => setLanguage(e.target.value as 'fr' | 'en')}
                    disabled={isGenerating}
                    className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">English</span>
                </label>
              </div>
            </div>

            {/* Baseline Date */}
            <div>
              <label htmlFor="baselineDate" className="block text-sm font-medium text-gray-700 mb-2">
                Date de référence EUDR
              </label>
              <input
                type="date"
                id="baselineDate"
                value={baselineDate}
                onChange={(e) => setBaselineDate(e.target.value)}
                disabled={isGenerating}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-gray-500">
                Date de référence pour la détection de déforestation (par défaut: 31 décembre 2020)
              </p>
            </div>

            {/* Include Sections */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Sections à inclure
              </label>
              <div className="space-y-3">
                {/* Before/After Imagery */}
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={includeBeforeAfter}
                    onChange={(e) => setIncludeBeforeAfter(e.target.checked)}
                    disabled={isGenerating}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-gray-700">
                      Imagerie avant/après
                    </span>
                    <p className="text-xs text-gray-500">
                      Comparaison visuelle entre la date de référence et aujourd'hui
                    </p>
                  </div>
                </label>

                {/* NDVI Trend */}
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={includeNDVITrend}
                    onChange={(e) => setIncludeNDVITrend(e.target.checked)}
                    disabled={isGenerating}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-gray-700">
                      Tendance NDVI
                    </span>
                    <p className="text-xs text-gray-500">
                      Graphique d'évolution de l'indice de végétation sur 12 mois
                    </p>
                  </div>
                </label>

                {/* Yield Prediction */}
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={includeYieldPrediction}
                    onChange={(e) => setIncludeYieldPrediction(e.target.checked)}
                    disabled={isGenerating}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-gray-700">
                      Prédiction de rendement
                    </span>
                    <p className="text-xs text-gray-500">
                      Estimation du rendement basée sur l'analyse satellite
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Info Box */}
            <div className="rounded-md bg-blue-50 border border-blue-200 p-4">
              <div className="flex items-start gap-2">
                <svg 
                  className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-blue-900">
                    À propos du rapport
                  </h3>
                  <p className="mt-1 text-sm text-blue-700">
                    Le rapport de certification inclut les informations de la parcelle, 
                    l'analyse de déforestation, et un statut de conformité EUDR. 
                    La génération peut prendre jusqu'à 30 secondes.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <svg 
                    className="mr-2 h-4 w-4 animate-spin" 
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
                  Génération en cours...
                </>
              ) : (
                <>
                  <svg 
                    className="mr-2 h-4 w-4" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                    />
                  </svg>
                  Générer le rapport
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
