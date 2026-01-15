'use client';

// CocoaTrack V2 - PlanteurParcellesImport Component
// Collapsible section for importing parcelles when creating/editing a planteur
// 
// Features:
// - Collapsible section with toggle
// - ShapefileUploader integration
// - ImportPreview for parsed features
// - Mini-map with parsed polygons
// - Upload/parse possible BEFORE planteur creation (import_file linked to coop)
// - Apply triggered ONLY AFTER planteur created (needs planteur_id)
// 
// Workflow:
// 1. User uploads file → creates import_file record (linked to cooperative)
// 2. File is parsed → features displayed in preview
// 3. User saves planteur form → planteur created first
// 4. Then parcelles import is applied with the new planteur_id

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  ChevronDown,
  ChevronUp,
  Map,
  FileUp,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShapefileUploader } from '@/components/parcelles/ShapefileUploader';
import { ImportPreview } from '@/components/parcelles/ImportPreview';
import type {
  ParcelImportFile,
  ParsedFeature,
  ParseReport,
  FieldMapping,
  ImportDefaults,
  ParcelleApiError,
} from '@/types/parcelles';

// Dynamically import ParsedFeaturesMiniMap to avoid SSR issues with Leaflet
// This component displays ALL parsed polygons on a single map
const ParsedFeaturesMiniMap = dynamic(
  () => import('@/components/parcelles/ParsedFeaturesMiniMap').then((mod) => mod.ParsedFeaturesMiniMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] w-full bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
        <Map className="h-8 w-8 text-gray-300" />
      </div>
    ),
  }
);

export interface PlanteurParcellesImportProps {
  /** Whether the section is initially expanded */
  defaultExpanded?: boolean;
  /** Callback when import data changes (for parent form to track) */
  onImportDataChange?: (data: ImportData | null) => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
}

/** Data structure for pending import (before planteur is created) */
export interface ImportData {
  /** The import file record */
  importFile: ParcelImportFile;
  /** Parsed features from the file */
  features: ParsedFeature[];
  /** Parse report with errors/warnings */
  report: ParseReport;
  /** Field mapping configuration */
  mapping: FieldMapping;
  /** Default values for parcelles */
  defaults: ImportDefaults;
  /** Available DBF fields for mapping */
  dbfFields: string[];
}

/**
 * PlanteurParcellesImport - Collapsible section for importing parcelles
 * 
 * This component allows users to upload and preview parcelle data
 * when creating or editing a planteur. The actual import (apply) is
 * triggered by the parent form after the planteur is created.
 * 
 * Usage:
 * ```tsx
 * const [importData, setImportData] = useState<ImportData | null>(null);
 * 
 * <PlanteurParcellesImport
 *   onImportDataChange={setImportData}
 * />
 * 
 * // In form submit handler:
 * const planteur = await planteursApi.create(formData);
 * if (importData) {
 *   await parcellesImportApi.apply(importData.importFile.id, {
 *     planteur_id: planteur.id,
 *     mapping: importData.mapping,
 *     defaults: importData.defaults,
 *   });
 * }
 * ```
 */
export function PlanteurParcellesImport({
  defaultExpanded = false,
  onImportDataChange,
  className,
  disabled = false,
}: PlanteurParcellesImportProps) {
  // Section expansion state
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  // Import state
  const [importFile, setImportFile] = useState<ParcelImportFile | null>(null);
  const [features, setFeatures] = useState<ParsedFeature[]>([]);
  const [report, setReport] = useState<ParseReport | null>(null);
  const [dbfFields, setDbfFields] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Field mapping and defaults
  const [mapping, setMapping] = useState<FieldMapping>({
    label_field: undefined,
    code_field: undefined,
    village_field: undefined,
  });
  const [defaults, setDefaults] = useState<ImportDefaults>({
    conformity_status: 'informations_manquantes',
    certifications: [],
  });

  // Calculate summary stats
  const stats = useMemo(() => {
    if (!features.length) return null;
    const total = features.length;
    const valid = features.filter((f) => f.validation.ok && !f.is_duplicate).length;
    const duplicates = features.filter((f) => f.is_duplicate).length;
    const errors = features.filter((f) => !f.validation.ok).length;
    const totalArea = features
      .filter((f) => f.validation.ok)
      .reduce((sum, f) => sum + f.area_ha, 0);
    return { total, valid, duplicates, errors, totalArea };
  }, [features]);

  // Notify parent of import data changes
  const notifyParent = useCallback((data: ImportData | null) => {
    onImportDataChange?.(data);
  }, [onImportDataChange]);

  // Handle upload complete
  const handleUploadComplete = useCallback((file: ParcelImportFile) => {
    setImportFile(file);
    setError(null);
  }, []);

  // Handle parse complete
  const handleParseComplete = useCallback((parsedFeatures: ParsedFeature[], parseReport: ParseReport) => {
    setFeatures(parsedFeatures);
    setReport(parseReport);
    
    // Extract available DBF fields from first feature
    if (parsedFeatures.length > 0) {
      const fields = Object.keys(parsedFeatures[0].dbf_attributes || {});
      setDbfFields(fields);
    }
    
    // Notify parent with initial import data
    if (importFile) {
      notifyParent({
        importFile,
        features: parsedFeatures,
        report: parseReport,
        mapping,
        defaults,
        dbfFields: parsedFeatures.length > 0 
          ? Object.keys(parsedFeatures[0].dbf_attributes || {})
          : [],
      });
    }
  }, [importFile, mapping, defaults, notifyParent]);

  // Handle upload/parse error
  const handleError = useCallback((err: ParcelleApiError | Error) => {
    const message = 'error_code' in err 
      ? err.message 
      : err.message || 'Une erreur est survenue';
    setError(message);
  }, []);

  // Handle mapping change
  const handleMappingChange = useCallback((newMapping: FieldMapping) => {
    setMapping(newMapping);
    
    // Update parent with new mapping
    if (importFile && features.length > 0 && report) {
      notifyParent({
        importFile,
        features,
        report,
        mapping: newMapping,
        defaults,
        dbfFields,
      });
    }
  }, [importFile, features, report, defaults, dbfFields, notifyParent]);

  // Handle defaults change
  const handleDefaultsChange = useCallback((newDefaults: ImportDefaults) => {
    setDefaults(newDefaults);
    
    // Update parent with new defaults
    if (importFile && features.length > 0 && report) {
      notifyParent({
        importFile,
        features,
        report,
        mapping,
        defaults: newDefaults,
        dbfFields,
      });
    }
  }, [importFile, features, report, mapping, dbfFields, notifyParent]);

  // Handle cancel/reset
  const handleCancel = useCallback(() => {
    setImportFile(null);
    setFeatures([]);
    setReport(null);
    setDbfFields([]);
    setError(null);
    setMapping({
      label_field: undefined,
      code_field: undefined,
      village_field: undefined,
    });
    setDefaults({
      conformity_status: 'informations_manquantes',
      certifications: [],
    });
    notifyParent(null);
  }, [notifyParent]);

  // Toggle section expansion
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Check if we have features to display on the mini-map
  const hasFeaturesToDisplay = useMemo(() => {
    return features.length > 0 && features.some((f) => f.geom_geojson);
  }, [features]);

  return (
    <div className={cn('border-t border-gray-200 pt-6', className)}>
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={toggleExpanded}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between p-4 rounded-lg transition-colors',
          'bg-gray-50 hover:bg-gray-100',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 rounded-lg">
            <FileUp className="h-5 w-5 text-primary-600" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-gray-900">
              Importer Parcelles
            </h3>
            <p className="text-xs text-gray-500">
              {features.length > 0 
                ? `${stats?.valid || 0} parcelle(s) prête(s) à importer`
                : 'Importer des parcelles depuis un fichier Shapefile, KML ou GeoJSON'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Status indicator */}
          {features.length > 0 && stats && (
            <div className="flex items-center gap-1 mr-2">
              {stats.valid > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <CheckCircle className="h-3 w-3" />
                  {stats.valid}
                </span>
              )}
              {stats.duplicates > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  {stats.duplicates} doublon(s)
                </span>
              )}
              {stats.errors > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  <AlertCircle className="h-3 w-3" />
                  {stats.errors}
                </span>
              )}
            </div>
          )}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Error display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">Erreur</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Upload section (shown when no file uploaded yet) */}
          {!importFile && (
            <ShapefileUploader
              onUploadComplete={handleUploadComplete}
              onParseComplete={handleParseComplete}
              onError={handleError}
              disabled={disabled}
            />
          )}

          {/* Preview section (shown after file is parsed) */}
          {importFile && features.length > 0 && report && (
            <div className="space-y-4">
              {/* Mini-map preview showing ALL parsed polygons */}
              {hasFeaturesToDisplay && (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Map className="h-4 w-4" />
                      Aperçu des parcelles ({features.length})
                    </h4>
                  </div>
                  <ParsedFeaturesMiniMap
                    features={features}
                    height={220}
                    showLegend={true}
                  />
                  {stats && (
                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
                      {stats.valid} parcelle(s) valide(s) • {stats.totalArea.toFixed(2)} ha au total
                      {stats.duplicates > 0 && (
                        <span className="text-amber-600 ml-2">
                          • {stats.duplicates} doublon(s)
                        </span>
                      )}
                      {stats.errors > 0 && (
                        <span className="text-red-600 ml-2">
                          • {stats.errors} erreur(s)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Import Preview component */}
              <ImportPreview
                features={features}
                report={report}
                dbfFields={dbfFields}
                onMappingChange={handleMappingChange}
                onDefaultsChange={handleDefaultsChange}
                onApply={() => {
                  // Apply is handled by parent form after planteur creation
                  // This is just a placeholder - the actual apply happens in the form submit
                }}
                onCancel={handleCancel}
                isApplying={false}
              />

              {/* Info message about apply timing */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">
                      Import en attente
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      Les parcelles seront créées automatiquement lorsque vous enregistrerez le planteur.
                      {stats && stats.valid > 0 && (
                        <span className="font-medium">
                          {' '}{stats.valid} parcelle(s) seront importée(s).
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading state during parse */}
          {importFile && features.length === 0 && !error && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 text-primary-600 animate-spin mr-2" />
              <span className="text-sm text-gray-600">Analyse du fichier en cours...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PlanteurParcellesImport;
