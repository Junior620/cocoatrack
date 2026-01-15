'use client';

// CocoaTrack V2 - ImportPreview Component
// Displays parsed features from import file with validation status
// Allows field mapping and applying the import
//
// Features:
// - Parsed features table with validation status
// - Mini-map per feature (optional)
// - Duplicate warnings
// - Field mapping dropdowns
// - Default values inputs
// - Apply/Cancel buttons
// - Summary statistics (nb_features, nb_duplicates)

import { useState, useMemo } from 'react';
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  FileText,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import type {
  ParsedFeature,
  ParseReport,
  FieldMapping,
  ImportDefaults,
  Certification,
  ConformityStatus,
} from '@/types/parcelles';
import {
  CERTIFICATIONS_WHITELIST,
  CERTIFICATION_LABELS,
  CONFORMITY_STATUS_VALUES,
  CONFORMITY_STATUS_LABELS,
  CONFORMITY_STATUS_COLORS,
} from '@/types/parcelles';

// Dynamically import FeatureMiniMap to avoid SSR issues with Leaflet
const FeatureMiniMap = dynamic(
  () => import('./FeatureMiniMap').then((mod) => mod.FeatureMiniMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[120px] w-full bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
        <MapPin className="h-6 w-6 text-gray-300" />
      </div>
    ),
  }
);


// Props interface
export interface ImportPreviewProps {
  /** Parsed features from the import file */
  features: ParsedFeature[];
  /** Parse report with errors and warnings */
  report: ParseReport;
  /** Available DBF/attribute fields for mapping */
  dbfFields: string[];
  /** Callback when field mapping changes */
  onMappingChange: (mapping: FieldMapping) => void;
  /** Callback when defaults change */
  onDefaultsChange?: (defaults: ImportDefaults) => void;
  /** Callback when apply button is clicked */
  onApply: () => void;
  /** Callback when cancel button is clicked */
  onCancel: () => void;
  /** Whether the apply operation is in progress */
  isApplying?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// Feature row component for the table
interface FeatureRowProps {
  feature: ParsedFeature;
  index: number;
  mapping: FieldMapping;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function FeatureRow({ feature, index, mapping, isExpanded, onToggleExpand }: FeatureRowProps) {
  // Get mapped values
  const getMappedValue = (field: keyof FieldMapping): string => {
    const fieldName = mapping[field];
    if (!fieldName) return '-';
    const value = feature.dbf_attributes[fieldName];
    return value !== undefined && value !== null ? String(value) : '-';
  };

  // Determine status icon and color
  const getStatusDisplay = () => {
    if (!feature.validation.ok) {
      return {
        icon: <AlertCircle className="h-4 w-4 text-red-500" />,
        text: 'Erreur',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
      };
    }
    if (feature.is_duplicate) {
      return {
        icon: <Copy className="h-4 w-4 text-amber-500" />,
        text: 'Doublon',
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
      };
    }
    if (feature.validation.warnings.length > 0) {
      return {
        icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
        text: 'Avertissement',
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
      };
    }
    return {
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
      text: 'Valide',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
    };
  };

  const status = getStatusDisplay();

  return (
    <>
      <tr
        className={cn(
          'hover:bg-gray-50 transition-colors cursor-pointer',
          !feature.validation.ok && 'bg-red-50/30',
          feature.is_duplicate && 'bg-amber-50/30'
        )}
        onClick={onToggleExpand}
      >
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
            <span className="text-sm font-medium text-gray-900">#{index + 1}</span>
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="text-sm text-gray-900">
            {feature.label || getMappedValue('label_field') || '-'}
          </span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="text-sm text-gray-600">
            {getMappedValue('code_field')}
          </span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="text-sm text-gray-600">
            {getMappedValue('village_field')}
          </span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="text-sm font-medium text-gray-900">
            {feature.area_ha.toFixed(2)} ha
          </span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="h-3 w-3" />
            <span>
              {feature.centroid.lat.toFixed(6)}, {feature.centroid.lng.toFixed(6)}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
              status.bgColor,
              status.textColor
            )}
          >
            {status.icon}
            {status.text}
          </span>
        </td>
      </tr>
      {/* Expanded details row */}
      {isExpanded && (
        <tr className="bg-gray-50">
          <td colSpan={7} className="px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Mini-map for the feature */}
              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">
                  Aperçu carte
                </h4>
                <FeatureMiniMap
                  geometry={feature.geom_geojson}
                  centroid={feature.centroid}
                  isValid={feature.validation.ok}
                  isDuplicate={feature.is_duplicate}
                  height={140}
                />
              </div>
              {/* Validation messages */}
              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">
                  Validation
                </h4>
                {feature.validation.errors.length > 0 && (
                  <ul className="space-y-1 mb-2">
                    {feature.validation.errors.map((err, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-red-600">
                        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        {err}
                      </li>
                    ))}
                  </ul>
                )}
                {feature.validation.warnings.length > 0 && (
                  <ul className="space-y-1 mb-2">
                    {feature.validation.warnings.map((warn, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        {warn}
                      </li>
                    ))}
                  </ul>
                )}
                {feature.validation.ok && feature.validation.warnings.length === 0 && !feature.is_duplicate && (
                  <p className="flex items-center gap-2 text-xs text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    Géométrie valide
                  </p>
                )}
                {/* Enhanced duplicate warning display */}
                {feature.is_duplicate && (
                  <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-start gap-2">
                      <Copy className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-amber-800">
                          Doublon détecté
                        </p>
                        <p className="text-xs text-amber-700 mt-0.5">
                          Cette parcelle existe déjà dans le système avec la même géométrie.
                        </p>
                        {feature.existing_parcelle_id && (
                          <p className="text-xs text-amber-600 mt-1">
                            <span className="font-medium">Parcelle existante:</span>{' '}
                            <code className="font-mono text-[10px] bg-amber-100 px-1 py-0.5 rounded">
                              {feature.existing_parcelle_id}
                            </code>
                          </p>
                        )}
                        <p className="text-xs text-amber-600 mt-1">
                          <span className="font-medium">Hash:</span>{' '}
                          <code className="font-mono text-[10px] bg-amber-100 px-1 py-0.5 rounded">
                            {feature.feature_hash.slice(0, 16)}...
                          </code>
                        </p>
                        <p className="text-xs text-amber-500 mt-2 italic">
                          Cette parcelle sera ignorée lors de l&apos;import.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* DBF Attributes */}
              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">
                  Attributs du fichier
                </h4>
                <div className="max-h-32 overflow-y-auto">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {Object.entries(feature.dbf_attributes).map(([key, value]) => (
                      <div key={key} className="contents">
                        <dt className="font-medium text-gray-500 truncate">{key}:</dt>
                        <dd className="text-gray-900 truncate">
                          {value !== null && value !== undefined ? String(value) : '-'}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}


/**
 * ImportPreview - Preview and configure import before applying
 *
 * Displays:
 * - Summary statistics (total features, duplicates, errors)
 * - Parsed features table with validation status
 * - Field mapping configuration
 * - Default values for conformity and certifications
 * - Apply/Cancel actions
 */
export function ImportPreview({
  features,
  report,
  dbfFields,
  onMappingChange,
  onDefaultsChange,
  onApply,
  onCancel,
  isApplying = false,
  className,
}: ImportPreviewProps) {
  // State for field mapping
  const [mapping, setMapping] = useState<FieldMapping>({
    label_field: undefined,
    code_field: undefined,
    village_field: undefined,
  });

  // State for defaults
  const [defaults, setDefaults] = useState<ImportDefaults>({
    conformity_status: 'informations_manquantes',
    certifications: [],
  });

  // State for expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Calculate summary statistics
  const stats = useMemo(() => {
    const total = features.length;
    const valid = features.filter((f) => f.validation.ok && !f.is_duplicate).length;
    const duplicates = features.filter((f) => f.is_duplicate).length;
    const errors = features.filter((f) => !f.validation.ok).length;
    const warnings = features.filter(
      (f) => f.validation.ok && !f.is_duplicate && f.validation.warnings.length > 0
    ).length;
    return { total, valid, duplicates, errors, warnings };
  }, [features]);

  // Handle mapping change
  const handleMappingChange = (field: keyof FieldMapping, value: string) => {
    const newMapping = {
      ...mapping,
      [field]: value || undefined,
    };
    setMapping(newMapping);
    onMappingChange(newMapping);
  };

  // Handle defaults change
  const handleDefaultsChange = (field: keyof ImportDefaults, value: unknown) => {
    const newDefaults = {
      ...defaults,
      [field]: value,
    };
    setDefaults(newDefaults);
    onDefaultsChange?.(newDefaults);
  };

  // Handle certification toggle
  const handleCertificationToggle = (cert: Certification) => {
    const current = defaults.certifications || [];
    const newCerts = current.includes(cert)
      ? current.filter((c) => c !== cert)
      : [...current, cert];
    handleDefaultsChange('certifications', newCerts);
  };

  // Toggle row expansion
  const toggleRowExpand = (tempId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) {
        next.delete(tempId);
      } else {
        next.add(tempId);
      }
      return next;
    });
  };

  // Check if apply is possible
  const canApply = stats.valid > 0 && !isApplying;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Import Summary Banner */}
      <div className="bg-gradient-to-r from-primary-50 to-primary-100/50 rounded-xl p-4 border border-primary-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <FileText className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Résumé de l&apos;import</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                {report.nb_features} parcelle(s) détectée(s) dans le fichier
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="font-medium text-green-700">{stats.valid}</span>
              <span className="text-gray-500">valide(s)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Copy className="h-4 w-4 text-amber-500" />
              <span className="font-medium text-amber-700">{stats.duplicates}</span>
              <span className="text-gray-500">doublon(s)</span>
            </div>
            {stats.errors > 0 && (
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="font-medium text-red-700">{stats.errors}</span>
                <span className="text-gray-500">erreur(s)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-500">Total</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">{stats.total}</p>
          {report.nb_features !== stats.total && (
            <p className="text-xs text-gray-400 mt-1">
              ({report.nb_features} dans le fichier)
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl p-4 border border-green-100 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium text-green-600">Valides</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-green-700">{stats.valid}</p>
          <p className="text-xs text-gray-400 mt-1">
            {stats.total > 0 ? Math.round((stats.valid / stats.total) * 100) : 0}% du total
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-amber-100 shadow-sm">
          <div className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-medium text-amber-600">Doublons</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-700">{stats.duplicates}</p>
          <p className="text-xs text-gray-400 mt-1">
            {stats.total > 0 ? Math.round((stats.duplicates / stats.total) * 100) : 0}% du total
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-red-100 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-sm font-medium text-red-600">Erreurs</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-red-700">{stats.errors}</p>
          <p className="text-xs text-gray-400 mt-1">
            {stats.total > 0 ? Math.round((stats.errors / stats.total) * 100) : 0}% du total
          </p>
        </div>
      </div>

      {/* Duplicate Warnings Banner */}
      {stats.duplicates > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Copy className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                {stats.duplicates} doublon(s) détecté(s)
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Ces parcelles existent déjà dans le système (même géométrie pour le même planteur). 
                Elles seront ignorées lors de l&apos;import.
              </p>
              {/* List duplicate features with their existing parcelle IDs */}
              <div className="mt-3 space-y-1.5">
                {features
                  .filter((f) => f.is_duplicate)
                  .slice(0, 5)
                  .map((f, i) => (
                    <div
                      key={f.temp_id}
                      className="flex items-center gap-2 text-xs text-amber-700 bg-amber-100/50 rounded-lg px-2 py-1.5"
                    >
                      <Copy className="h-3 w-3 flex-shrink-0" />
                      <span className="font-medium">#{features.indexOf(f) + 1}</span>
                      {f.label && <span className="truncate max-w-[150px]">{f.label}</span>}
                      <span className="text-amber-500">→</span>
                      <span className="font-mono text-[10px] bg-amber-200/50 px-1.5 py-0.5 rounded">
                        {f.existing_parcelle_id 
                          ? `Parcelle existante: ${f.existing_parcelle_id.slice(0, 8)}...`
                          : 'Doublon dans le fichier'}
                      </span>
                    </div>
                  ))}
                {stats.duplicates > 5 && (
                  <p className="text-xs text-amber-600 font-medium pl-2">
                    ... et {stats.duplicates - 5} autre(s) doublon(s)
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Parse Report Errors/Warnings */}
      {(report.errors.length > 0 || report.warnings.length > 0) && (
        <div className="space-y-3">
          {report.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">
                    {report.errors.length} erreur(s) globale(s)
                  </p>
                  <ul className="mt-2 space-y-1">
                    {report.errors.slice(0, 5).map((err, i) => (
                      <li key={i} className="text-xs text-red-700">
                        {err.code}: {err.message}
                      </li>
                    ))}
                    {report.errors.length > 5 && (
                      <li className="text-xs text-red-600 font-medium">
                        ... et {report.errors.length - 5} autre(s)
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
          {report.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    {report.warnings.length} avertissement(s)
                  </p>
                  <ul className="mt-2 space-y-1">
                    {report.warnings.slice(0, 5).map((warn, i) => (
                      <li key={i} className="text-xs text-amber-700">
                        {warn.code}: {warn.message}
                        {warn.requires_confirmation && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-200 text-amber-800">
                            Confirmation requise
                          </span>
                        )}
                      </li>
                    ))}
                    {report.warnings.length > 5 && (
                      <li className="text-xs text-amber-600 font-medium">
                        ... et {report.warnings.length - 5} autre(s)
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}


      {/* Field Mapping Section */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Correspondance des champs
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Associez les champs du fichier importé aux champs CocoaTrack
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Champ Label
            </label>
            <select
              value={mapping.label_field || ''}
              onChange={(e) => handleMappingChange('label_field', e.target.value)}
              className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">-- Aucun --</option>
              {dbfFields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Champ Code
            </label>
            <select
              value={mapping.code_field || ''}
              onChange={(e) => handleMappingChange('code_field', e.target.value)}
              className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">-- Auto-généré --</option>
              {dbfFields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Champ Village
            </label>
            <select
              value={mapping.village_field || ''}
              onChange={(e) => handleMappingChange('village_field', e.target.value)}
              className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">-- Aucun --</option>
              {dbfFields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Default Values Section */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Valeurs par défaut
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Ces valeurs seront appliquées à toutes les parcelles importées
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Conformity Status */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Statut de conformité
            </label>
            {/* Auto-detection checkbox */}
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="auto-detect-conformity"
                checked={defaults.auto_detect_conformity || false}
                onChange={(e) => handleDefaultsChange('auto_detect_conformity', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="auto-detect-conformity" className="text-xs text-gray-600">
                Détection automatique basée sur les données
              </label>
            </div>
            <select
              value={defaults.conformity_status || 'informations_manquantes'}
              onChange={(e) =>
                handleDefaultsChange('conformity_status', e.target.value as ConformityStatus)
              }
              disabled={defaults.auto_detect_conformity}
              className={cn(
                "w-full rounded-lg border border-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20",
                defaults.auto_detect_conformity && "bg-gray-100 text-gray-500 cursor-not-allowed"
              )}
            >
              {CONFORMITY_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {CONFORMITY_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            {defaults.auto_detect_conformity && (
              <p className="mt-1 text-xs text-gray-500">
                Le statut sera déterminé automatiquement selon les données de chaque parcelle
              </p>
            )}
          </div>
          {/* Certifications */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Certifications
            </label>
            <div className="flex flex-wrap gap-2">
              {CERTIFICATIONS_WHITELIST.map((cert) => (
                <button
                  key={cert}
                  type="button"
                  onClick={() => handleCertificationToggle(cert)}
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                    defaults.certifications?.includes(cert)
                      ? 'bg-primary-100 text-primary-800 ring-1 ring-primary-500'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {CERTIFICATION_LABELS[cert]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Features Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">
            Parcelles détectées ({features.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Label
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Village
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Surface
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Centroïde
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {features.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="p-3 bg-gray-100 rounded-full mb-3">
                        <FileText className="h-6 w-6 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        Aucune parcelle détectée
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Le fichier ne contient pas de géométries valides
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                features.map((feature, index) => (
                  <FeatureRow
                    key={feature.temp_id}
                    feature={feature}
                    index={index}
                    mapping={mapping}
                    isExpanded={expandedRows.has(feature.temp_id)}
                    onToggleExpand={() => toggleRowExpand(feature.temp_id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* Action Buttons */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="text-sm text-gray-600">
          {stats.valid > 0 ? (
            <span>
              <span className="font-medium text-gray-900">{stats.valid}</span> parcelle(s) seront
              créées
              {stats.duplicates > 0 && (
                <span className="text-amber-600">
                  {' '}
                  ({stats.duplicates} doublon(s) ignoré(s))
                </span>
              )}
            </span>
          ) : (
            <span className="text-red-600">
              Aucune parcelle valide à importer
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isApplying}
            className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <X className="mr-2 h-4 w-4" />
            Annuler
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={!canApply}
            className={cn(
              'inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors',
              canApply
                ? 'bg-primary-600 hover:bg-primary-700'
                : 'bg-gray-400 cursor-not-allowed'
            )}
          >
            {isApplying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Import en cours...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Importer {stats.valid} parcelle(s)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportPreview;
