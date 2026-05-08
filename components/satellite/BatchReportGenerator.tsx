/**
 * Batch Report Generator Component
 * 
 * Provides UI for generating certification reports for multiple parcelles
 * with progress tracking and download functionality.
 */

'use client';

import { useState } from 'react';
import { useBatchReports } from '@/hooks/satellite/useBatchReports';
import type { ReportOptions } from '@/lib/satellite/types';
import { FileText, Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface BatchReportGeneratorProps {
  parcelleIds: string[];
  onClose?: () => void;
}

export function BatchReportGenerator({
  parcelleIds,
  onClose,
}: BatchReportGeneratorProps) {
  const [reportOptions, setReportOptions] = useState<ReportOptions>({
    includeBeforeAfter: true,
    includeNDVITrend: true,
    includeYieldPrediction: false,
    baselineDate: new Date('2020-12-31'),
    language: 'fr',
  });

  const { generateBatchReports, loading, error, progress, zipUrl, reportCount, reset } =
    useBatchReports({
      onSuccess: (url, count) => {
        console.log(`Successfully generated ${count} reports`);
      },
      onError: (err) => {
        console.error('Failed to generate reports:', err);
      },
    });

  const handleGenerate = async () => {
    await generateBatchReports(parcelleIds, reportOptions);
  };

  const handleDownload = () => {
    if (zipUrl) {
      // Trigger download
      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `certification-reports-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleReset = () => {
    reset();
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
          <FileText className="h-5 w-5 text-green-700" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Génération de Rapports en Lot
          </h3>
          <p className="text-sm text-gray-600">
            {parcelleIds.length} parcelle(s) sélectionnée(s)
          </p>
        </div>
      </div>

      {/* Options */}
      {!loading && !zipUrl && (
        <div className="mb-6 space-y-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={reportOptions.includeBeforeAfter}
                onChange={(e) =>
                  setReportOptions({
                    ...reportOptions,
                    includeBeforeAfter: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">
                Inclure la comparaison avant/après
              </span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={reportOptions.includeNDVITrend}
                onChange={(e) =>
                  setReportOptions({
                    ...reportOptions,
                    includeNDVITrend: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">
                Inclure l'évolution NDVI
              </span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={reportOptions.includeYieldPrediction}
                onChange={(e) =>
                  setReportOptions({
                    ...reportOptions,
                    includeYieldPrediction: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">
                Inclure la prévision de rendement
              </span>
            </label>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Langue du rapport
            </label>
            <select
              value={reportOptions.language}
              onChange={(e) =>
                setReportOptions({
                  ...reportOptions,
                  language: e.target.value as 'fr' | 'en',
                })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      )}

      {/* Progress Indicator */}
      {loading && progress && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">
              Génération en cours...
            </span>
            <span className="text-gray-600">
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-green-600 transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Génération des rapports PDF...</span>
          </div>
        </div>
      )}

      {/* Success State */}
      {zipUrl && reportCount && (
        <div className="mb-6 rounded-lg bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <h4 className="font-medium text-green-900">
                Rapports générés avec succès
              </h4>
              <p className="mt-1 text-sm text-green-700">
                {reportCount} rapport(s) de certification ont été générés et
                archivés dans un fichier ZIP.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div className="flex-1">
              <h4 className="font-medium text-red-900">
                Erreur lors de la génération
              </h4>
              <p className="mt-1 text-sm text-red-700">{error.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {!loading && !zipUrl && (
          <>
            <button
              onClick={handleGenerate}
              disabled={parcelleIds.length === 0}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Générer les Rapports
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                Annuler
              </button>
            )}
          </>
        )}

        {zipUrl && (
          <>
            <button
              onClick={handleDownload}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              <Download className="h-4 w-4" />
              Télécharger le ZIP
            </button>
            <button
              onClick={handleReset}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              Fermer
            </button>
          </>
        )}
      </div>

      {/* Info */}
      {!loading && !zipUrl && (
        <div className="mt-4 rounded-lg bg-blue-50 p-3">
          <p className="text-xs text-blue-700">
            <strong>Note:</strong> La génération de rapports pour{' '}
            {parcelleIds.length} parcelle(s) peut prendre quelques minutes.
            Veuillez patienter pendant le traitement.
          </p>
        </div>
      )}
    </div>
  );
}
