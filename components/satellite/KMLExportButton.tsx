/**
 * KML Export Button Component
 * 
 * Provides a button to export parcelle data as KML file for Google Earth visualization.
 * Includes an options modal for configuring export settings (temporal data, NDVI overlay).
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

'use client';

import { useState } from 'react';
import { Download, X, Loader2, FileDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { KMLExportOptions } from '@/lib/satellite/types';

interface KMLExportButtonProps {
  /** Single parcelle ID or array of parcelle IDs for batch export */
  parcelleIds: string | string[];
  /** Optional parcelle code(s) for filename generation */
  parcelleCodes?: string | string[];
  /** Callback when export completes successfully */
  onComplete?: (fileUrl: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'outline';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Show full button text or icon only */
  showText?: boolean;
}

/**
 * Button component to export parcelle data as KML file
 * 
 * Features:
 * - Export options modal (include temporal, include NDVI, include deforestation)
 * - Progress indicator during export
 * - Automatic file download
 * - Support for single or batch export
 * - Date range selection for temporal data
 * - KML/KMZ format selection
 */
export function KMLExportButton({
  parcelleIds,
  parcelleCodes,
  onComplete,
  className = '',
  variant = 'outline',
  size = 'md',
  showText = true,
}: KMLExportButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<number>(0);

  // Export options state
  const [options, setOptions] = useState<KMLExportOptions>({
    includeTemporal: false,
    includeNDVI: true,
    includeDeforestation: false,
    format: 'kml',
  });

  // Date range state for temporal data
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Normalize parcelleIds to array
  const parcelleIdArray = Array.isArray(parcelleIds) ? parcelleIds : [parcelleIds];
  const isBatchExport = parcelleIdArray.length > 1;

  /**
   * Handle export button click - open modal
   */
  const handleExportClick = () => {
    setShowModal(true);
    setError(null);
    setExportProgress(0);
  };

  /**
   * Handle modal close
   */
  const handleCloseModal = () => {
    if (!isExporting) {
      setShowModal(false);
      setError(null);
      setExportProgress(0);
    }
  };

  /**
   * Handle export execution
   */
  const handleExport = async () => {
    try {
      setIsExporting(true);
      setError(null);
      setExportProgress(10);

      // Get authenticated Supabase client
      const supabase = createClient();
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();

      if (authError || !session) {
        setError('Vous devez être connecté pour exporter les données');
        return;
      }

      setExportProgress(20);

      // Build request body
      const requestBody = {
        parcelleIds: parcelleIdArray,
        options: {
          ...options,
          startDate: options.includeTemporal && startDate ? new Date(startDate).toISOString() : undefined,
          endDate: options.includeTemporal && endDate ? new Date(endDate).toISOString() : undefined,
        },
      };

      setExportProgress(30);

      // Call export API
      const response = await fetch('/api/satellite/export/kml', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      setExportProgress(60);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Échec de l\'export KML');
      }

      setExportProgress(80);

      // Get filename from Content-Disposition header or generate default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `parcelle-export.${options.format}`;
      
      if (contentDisposition) {
        // Extract filename from Content-Disposition header
        // Handles both: filename="file.kml" and filename=file.kml
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
        if (filenameMatch && filenameMatch[1]) {
          // Remove quotes if present
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      } else if (parcelleCodes) {
        // Generate filename from parcelle codes
        const codeArray = Array.isArray(parcelleCodes) ? parcelleCodes : [parcelleCodes];
        const codeStr = isBatchExport ? `${codeArray.length}-parcelles` : codeArray[0];
        filename = `kml-export-${codeStr}.${options.format}`;
      }

      setExportProgress(90);

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportProgress(100);

      // Call completion callback
      if (onComplete) {
        onComplete(url);
      }

      // Close modal after short delay
      setTimeout(() => {
        setShowModal(false);
        setIsExporting(false);
        setExportProgress(0);
      }, 500);
    } catch (err) {
      console.error('Error exporting KML:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'export KML');
      setExportProgress(0);
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Validate form before export
   */
  const canExport = () => {
    // If temporal data is included, date range is required
    if (options.includeTemporal && (!startDate || !endDate)) {
      return false;
    }
    // At least one option must be selected
    return options.includeNDVI || options.includeTemporal || options.includeDeforestation;
  };

  // Button styles
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    primary: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-green-500',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm rounded',
    md: 'px-4 py-2 text-base rounded-md',
    lg: 'px-6 py-3 text-lg rounded-lg',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <>
      {/* Export Button */}
      <button
        onClick={handleExportClick}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        title="Exporter en KML pour Google Earth"
      >
        <FileDown className={`${showText ? '-ml-1 mr-2' : ''} ${iconSizes[size]}`} />
        {showText && 'Exporter KML'}
      </button>

      {/* Export Options Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 99999 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="kml-export-dialog-title"
        >
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleCloseModal}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col" style={{ zIndex: 100000 }}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <FileDown className="h-5 w-5 text-green-600" aria-hidden="true" />
                <h2 id="kml-export-dialog-title" className="text-lg font-semibold text-gray-900">
                  Exporter en KML
                </h2>
              </div>
              <button
                onClick={handleCloseModal}
                disabled={isExporting}
                className="p-1 text-gray-400 hover:text-gray-600 rounded disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500"
                aria-label="Fermer la boîte de dialogue"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Selection info */}
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  {isBatchExport 
                    ? `Export de ${parcelleIdArray.length} parcelles`
                    : 'Export d\'une parcelle'}
                </p>
              </div>

              {/* Export options */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-900">Options d'export</h3>

                {/* Include NDVI */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.includeNDVI}
                    onChange={(e) => setOptions({ ...options, includeNDVI: e.target.checked })}
                    disabled={isExporting}
                    className="mt-0.5 h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500 disabled:opacity-50"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">Inclure NDVI</span>
                    <p className="text-xs text-gray-500">Superposition colorée de l'indice de végétation</p>
                  </div>
                </label>

                {/* Include Temporal */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.includeTemporal}
                    onChange={(e) => setOptions({ ...options, includeTemporal: e.target.checked })}
                    disabled={isExporting}
                    className="mt-0.5 h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500 disabled:opacity-50"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">Données temporelles</span>
                    <p className="text-xs text-gray-500">Évolution NDVI dans le temps (KML animé)</p>
                  </div>
                </label>

                {/* Date range for temporal data */}
                {options.includeTemporal && (
                  <div className="ml-7 space-y-2 p-3 bg-gray-50 rounded border border-gray-200">
                    <div>
                      <label htmlFor="start-date" className="block text-xs font-medium text-gray-700 mb-1">
                        Date de début
                      </label>
                      <input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        disabled={isExporting}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-green-500 focus:border-green-500 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label htmlFor="end-date" className="block text-xs font-medium text-gray-700 mb-1">
                        Date de fin
                      </label>
                      <input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        disabled={isExporting}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-green-500 focus:border-green-500 disabled:opacity-50"
                      />
                    </div>
                  </div>
                )}

                {/* Include Deforestation */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.includeDeforestation}
                    onChange={(e) => setOptions({ ...options, includeDeforestation: e.target.checked })}
                    disabled={isExporting}
                    className="mt-0.5 h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500 disabled:opacity-50"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">Alertes déforestation</span>
                    <p className="text-xs text-gray-500">Zones de perte de végétation détectées</p>
                  </div>
                </label>
              </div>

              {/* Format selection */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-900">Format</h3>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="kml"
                      checked={options.format === 'kml'}
                      onChange={(e) => setOptions({ ...options, format: e.target.value as 'kml' | 'kmz' })}
                      disabled={isExporting}
                      className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500 disabled:opacity-50"
                    />
                    <span className="text-sm text-gray-900">KML</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="kmz"
                      checked={options.format === 'kmz'}
                      onChange={(e) => setOptions({ ...options, format: e.target.value as 'kml' | 'kmz' })}
                      disabled={isExporting}
                      className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500 disabled:opacity-50"
                    />
                    <span className="text-sm text-gray-900">KMZ (compressé)</span>
                  </label>
                </div>
              </div>

              {/* Progress indicator */}
              {isExporting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">Export en cours...</span>
                    <span className="text-gray-900 font-medium">{exportProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-green-600 h-full transition-all duration-300 ease-out"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <X className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Validation warning */}
              {!canExport() && !isExporting && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <Loader2 className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    {options.includeTemporal && (!startDate || !endDate)
                      ? 'Veuillez sélectionner une plage de dates pour les données temporelles'
                      : 'Veuillez sélectionner au moins une option d\'export'}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={handleCloseModal}
                disabled={isExporting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting || !canExport()}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Export en cours...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Exporter
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default KMLExportButton;
