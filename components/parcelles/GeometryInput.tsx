'use client';

// CocoaTrack V2 - GeometryInput Component
// Allows users to input geometry via:
// 1. Drawing on an interactive map (using Leaflet Draw)
// 2. Uploading a file (Shapefile, KML, KMZ, GeoJSON)
//
// Features:
// - Tab-based interface to switch between draw and upload modes
// - Interactive map with polygon drawing tools
// - File upload with auto-parse
// - Preview of drawn/uploaded geometry
// - Clear/reset functionality

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Pencil, Upload, Trash2, AlertCircle, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShapefileUploader } from './ShapefileUploader';
import type { MultiPolygon, Polygon } from 'geojson';
import type { ParsedFeature, ParseReport, ParcelImportFile } from '@/types/parcelles';

// Dynamically import the DrawableMap component to avoid SSR issues with Leaflet
const DrawableMap = dynamic(() => import('./DrawableMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center bg-gray-100 rounded-lg">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Chargement de la carte...</p>
      </div>
    </div>
  ),
});

/**
 * Input mode for geometry
 */
type InputMode = 'draw' | 'upload';

/**
 * Props for GeometryInput component
 */
export interface GeometryInputProps {
  /** Current geometry value */
  value?: Polygon | MultiPolygon | null;
  /** Callback when geometry changes */
  onChange: (geometry: Polygon | MultiPolygon | null) => void;
  /** Callback when import file is created (for linking to parcelle) */
  onImportFileCreated?: (importFile: ParcelImportFile) => void;
  /** Callback when features are parsed from upload */
  onFeaturesParseComplete?: (features: ParsedFeature[], report: ParseReport) => void;
  /** Error message to display */
  error?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Height of the map (default: 400px) */
  mapHeight?: string;
  /** Planteur ID for import (optional) */
  planteurId?: string;
}

/**
 * GeometryInput - Combined geometry input via drawing or file upload
 *
 * Provides two modes:
 * 1. Draw mode: Interactive map where users can draw polygons
 * 2. Upload mode: File uploader for Shapefile, KML, KMZ, GeoJSON
 *
 * The component maintains the geometry state and notifies parent via onChange
 */
export function GeometryInput({
  value,
  onChange,
  onImportFileCreated,
  onFeaturesParseComplete,
  error,
  disabled = false,
  className,
  mapHeight = '400px',
  planteurId,
}: GeometryInputProps) {
  const [mode, setMode] = useState<InputMode>('draw');
  const [uploadedFeatures, setUploadedFeatures] = useState<ParsedFeature[]>([]);
  const [selectedFeatureIndex, setSelectedFeatureIndex] = useState<number>(0);

  // Handle geometry drawn on map
  const handleDrawnGeometry = useCallback(
    (geometry: Polygon | MultiPolygon | null) => {
      onChange(geometry);
      // Clear uploaded features when drawing
      setUploadedFeatures([]);
    },
    [onChange]
  );

  // Handle file upload complete
  const handleUploadComplete = useCallback(
    (importFile: ParcelImportFile) => {
      onImportFileCreated?.(importFile);
    },
    [onImportFileCreated]
  );

  // Handle parse complete from upload
  const handleParseComplete = useCallback(
    (features: ParsedFeature[], report: ParseReport) => {
      setUploadedFeatures(features);
      onFeaturesParseComplete?.(features, report);

      // If there's only one feature, auto-select it
      if (features.length === 1) {
        onChange(features[0].geom_geojson);
        setSelectedFeatureIndex(0);
      } else if (features.length > 1) {
        // Select first feature by default
        onChange(features[0].geom_geojson);
        setSelectedFeatureIndex(0);
      }
    },
    [onChange, onFeaturesParseComplete]
  );

  // Handle feature selection from uploaded features
  const handleFeatureSelect = useCallback(
    (index: number) => {
      if (uploadedFeatures[index]) {
        setSelectedFeatureIndex(index);
        onChange(uploadedFeatures[index].geom_geojson);
      }
    },
    [uploadedFeatures, onChange]
  );

  // Clear geometry
  const handleClear = useCallback(() => {
    onChange(null);
    setUploadedFeatures([]);
    setSelectedFeatureIndex(0);
  }, [onChange]);

  // Calculate area for display (approximate)
  const getAreaDisplay = (geom: Polygon | MultiPolygon | null): string => {
    if (!geom) return '0';
    // Simple approximation - actual calculation done by PostGIS
    try {
      const turf = require('@turf/turf');
      const area = turf.area(geom);
      return (area / 10000).toFixed(2); // Convert m² to hectares
    } catch {
      return '?';
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Mode tabs */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setMode('draw')}
          disabled={disabled}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
            mode === 'draw'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Pencil className="h-4 w-4" />
          Dessiner sur la carte
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          disabled={disabled}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
            mode === 'upload'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Upload className="h-4 w-4" />
          Importer un fichier
        </button>
      </div>

      {/* Draw mode */}
      {mode === 'draw' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Utilisez les outils de dessin pour tracer le contour de la parcelle sur la carte.
          </p>
          <div style={{ height: mapHeight }} className="rounded-lg overflow-hidden border border-gray-200">
            <DrawableMap
              geometry={value}
              onGeometryChange={handleDrawnGeometry}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {/* Upload mode */}
      {mode === 'upload' && (
        <div className="space-y-4">
          <ShapefileUploader
            planteurId={planteurId}
            onUploadComplete={handleUploadComplete}
            onParseComplete={handleParseComplete}
            disabled={disabled}
          />

          {/* Feature selection for multiple features */}
          {uploadedFeatures.length > 1 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-800 mb-3">
                {uploadedFeatures.length} parcelles détectées - Sélectionnez celle à utiliser:
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {uploadedFeatures.map((feature, index) => (
                  <button
                    key={feature.temp_id}
                    type="button"
                    onClick={() => handleFeatureSelect(index)}
                    className={cn(
                      'w-full flex items-center justify-between p-3 rounded-md text-left transition-colors',
                      selectedFeatureIndex === index
                        ? 'bg-blue-100 border-2 border-blue-500'
                        : 'bg-white border border-gray-200 hover:border-blue-300'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className={cn(
                        'h-4 w-4',
                        selectedFeatureIndex === index ? 'text-blue-600' : 'text-gray-400'
                      )} />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {feature.label || `Parcelle ${index + 1}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {feature.area_ha.toFixed(2)} ha
                        </p>
                      </div>
                    </div>
                    {selectedFeatureIndex === index && (
                      <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                        Sélectionnée
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Geometry preview/info */}
      {value && (
        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
              <MapPin className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-800">
                Géométrie définie
              </p>
              <p className="text-xs text-green-600">
                Surface estimée: {getAreaDisplay(value)} ha
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Effacer
          </button>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}

export default GeometryInput;
