'use client';

// CocoaTrack V2 - ParsedFeaturesMiniMap Component
// Displays all parsed features from an import on a single mini-map
// Used in PlanteurParcellesImport to show a preview of all polygons before import

import { useEffect, useRef, memo, useMemo } from 'react';
import type { MultiPolygon, FeatureCollection, Feature, Geometry } from 'geojson';
import type { ParsedFeature } from '@/types/parcelles';

// Leaflet types - imported dynamically to avoid SSR issues
type LeafletMap = import('leaflet').Map;
type LeafletGeoJSON = import('leaflet').GeoJSON;

interface ParsedFeaturesMiniMapProps {
  /** Array of parsed features to display */
  features: ParsedFeature[];
  /** Height of the mini-map in pixels */
  height?: number;
  /** Width of the mini-map (CSS value) */
  width?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show a legend */
  showLegend?: boolean;
}

// Color mapping for feature status
const FEATURE_COLORS = {
  valid: '#6FAF3D',      // CocoaTrack green for valid features
  duplicate: '#f59e0b',  // amber for duplicates
  error: '#ef4444',      // red for errors
};

/**
 * ParsedFeaturesMiniMap - Mini-map showing all parsed features
 * 
 * Displays all parsed features on a single map with:
 * - Color coding based on validation status (green=valid, amber=duplicate, red=error)
 * - Auto-fit bounds to show all polygons
 * - Minimal interactive controls
 * - Lightweight rendering for performance
 */
function ParsedFeaturesMiniMapComponent({
  features,
  height = 200,
  width = '100%',
  className = '',
  showLegend = true,
}: ParsedFeaturesMiniMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const geoJsonLayerRef = useRef<LeafletGeoJSON | null>(null);

  // Calculate statistics for legend
  const stats = useMemo(() => {
    const valid = features.filter((f) => f.validation.ok && !f.is_duplicate).length;
    const duplicates = features.filter((f) => f.is_duplicate).length;
    const errors = features.filter((f) => !f.validation.ok).length;
    return { valid, duplicates, errors };
  }, [features]);

  // Calculate average centroid for initial map center
  const mapCenter = useMemo(() => {
    const validFeatures = features.filter((f) => f.centroid);
    if (validFeatures.length === 0) return { lat: 5.9631, lng: 10.1591 }; // Cameroon default
    
    const avgLat = validFeatures.reduce((sum, f) => sum + f.centroid.lat, 0) / validFeatures.length;
    const avgLng = validFeatures.reduce((sum, f) => sum + f.centroid.lng, 0) / validFeatures.length;
    return { lat: avgLat, lng: avgLng };
  }, [features]);

  // Get color for a feature based on its status
  const getFeatureColor = (feature: ParsedFeature): string => {
    if (!feature.validation.ok) return FEATURE_COLORS.error;
    if (feature.is_duplicate) return FEATURE_COLORS.duplicate;
    return FEATURE_COLORS.valid;
  };

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined' || !mapContainerRef.current) return;
    if (features.length === 0) return;

    // Dynamically import Leaflet to avoid SSR issues
    const initMap = async () => {
      const L = (await import('leaflet')).default;

      // Clean up existing map if any
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        geoJsonLayerRef.current = null;
      }

      // Create map instance with minimal controls
      const map = L.map(mapContainerRef.current!, {
        center: [mapCenter.lat, mapCenter.lng],
        zoom: 10,
        zoomControl: true,
        attributionControl: false,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: false,
        keyboard: false,
      });

      // Add a simple tile layer (light style for mini-maps)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Create GeoJSON FeatureCollection from parsed features
      const geoJsonFeatures: Feature<Geometry>[] = features
        .filter((f) => f.geom_geojson)
        .map((feature, index) => ({
          type: 'Feature' as const,
          properties: {
            temp_id: feature.temp_id,
            label: feature.label,
            area_ha: feature.area_ha,
            isValid: feature.validation.ok,
            isDuplicate: feature.is_duplicate,
            index: index + 1,
          },
          geometry: feature.geom_geojson as Geometry,
        }));

      const featureCollection: FeatureCollection = {
        type: 'FeatureCollection',
        features: geoJsonFeatures,
      };

      // Create GeoJSON layer with styling
      const geoJsonLayer = L.geoJSON(featureCollection, {
        style: (geoFeature) => {
          const props = geoFeature?.properties;
          let color = FEATURE_COLORS.valid;
          if (!props?.isValid) color = FEATURE_COLORS.error;
          else if (props?.isDuplicate) color = FEATURE_COLORS.duplicate;
          
          return {
            fillColor: color,
            fillOpacity: 0.4,
            color: color,
            weight: 2,
            opacity: 1,
          };
        },
        onEachFeature: (geoFeature, layer) => {
          const props = geoFeature.properties;
          const status = !props?.isValid 
            ? 'Erreur' 
            : props?.isDuplicate 
              ? 'Doublon' 
              : 'Valide';
          
          layer.bindTooltip(
            `<div class="text-xs">
              <strong>#${props?.index}</strong> ${props?.label || 'Sans nom'}<br/>
              ${props?.area_ha?.toFixed(2) || '?'} ha • ${status}
            </div>`,
            { 
              permanent: false,
              direction: 'top',
              className: 'parcelle-tooltip',
            }
          );
        },
      }).addTo(map);

      geoJsonLayerRef.current = geoJsonLayer;

      // Fit bounds to show all features
      const bounds = geoJsonLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20] });
      }

      mapRef.current = map;
    };

    initMap();

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        geoJsonLayerRef.current = null;
      }
    };
  }, [features, mapCenter]);

  // Don't render if no features
  if (features.length === 0) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}
        style={{ height, width }}
      >
        <p className="text-sm text-gray-500">Aucune parcelle à afficher</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div
        ref={mapContainerRef}
        className="rounded-lg overflow-hidden border border-gray-200"
        style={{ height, width }}
      />
      
      {/* Mini legend */}
      {showLegend && (
        <div className="absolute bottom-2 left-2 z-[1000] bg-white/90 backdrop-blur-sm rounded-md px-2 py-1.5 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 text-[10px]">
            {stats.valid > 0 && (
              <div className="flex items-center gap-1">
                <div 
                  className="w-2.5 h-2.5 rounded-sm" 
                  style={{ backgroundColor: FEATURE_COLORS.valid }}
                />
                <span className="text-gray-600">{stats.valid} valide(s)</span>
              </div>
            )}
            {stats.duplicates > 0 && (
              <div className="flex items-center gap-1">
                <div 
                  className="w-2.5 h-2.5 rounded-sm" 
                  style={{ backgroundColor: FEATURE_COLORS.duplicate }}
                />
                <span className="text-gray-600">{stats.duplicates} doublon(s)</span>
              </div>
            )}
            {stats.errors > 0 && (
              <div className="flex items-center gap-1">
                <div 
                  className="w-2.5 h-2.5 rounded-sm" 
                  style={{ backgroundColor: FEATURE_COLORS.error }}
                />
                <span className="text-gray-600">{stats.errors} erreur(s)</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export const ParsedFeaturesMiniMap = memo(ParsedFeaturesMiniMapComponent);

export default ParsedFeaturesMiniMap;
