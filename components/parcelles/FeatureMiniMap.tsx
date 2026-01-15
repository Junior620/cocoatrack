'use client';

// CocoaTrack V2 - FeatureMiniMap Component
// Displays a small map preview for a single parsed feature in the import preview
// Uses Leaflet for rendering the polygon geometry

import { useEffect, useRef, memo } from 'react';
import type { MultiPolygon } from 'geojson';
import type { Centroid } from '@/types/parcelles';

// Leaflet types - imported dynamically to avoid SSR issues
type LeafletMap = import('leaflet').Map;
type LeafletGeoJSON = import('leaflet').GeoJSON;

interface FeatureMiniMapProps {
  /** GeoJSON MultiPolygon geometry to display */
  geometry: MultiPolygon;
  /** Centroid point for the feature */
  centroid: Centroid;
  /** Whether the feature is valid (affects polygon color) */
  isValid: boolean;
  /** Whether the feature is a duplicate (affects polygon color) */
  isDuplicate: boolean;
  /** Height of the mini-map in pixels */
  height?: number;
  /** Width of the mini-map (CSS value) */
  width?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * FeatureMiniMap - Small map preview for a single feature
 * 
 * Displays the polygon geometry on a minimal map with:
 * - Color coding based on validation status (green=valid, red=error, amber=duplicate)
 * - Auto-fit bounds to show the entire polygon
 * - No interactive controls (zoom, pan disabled)
 * - Lightweight rendering for performance in lists
 */
function FeatureMiniMapComponent({
  geometry,
  centroid,
  isValid,
  isDuplicate,
  height = 120,
  width = '100%',
  className = '',
}: FeatureMiniMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const geoJsonLayerRef = useRef<LeafletGeoJSON | null>(null);

  // Determine polygon color based on status
  const getPolygonColor = (): string => {
    if (!isValid) return '#ef4444'; // red for errors
    if (isDuplicate) return '#f59e0b'; // amber for duplicates
    return '#6FAF3D'; // CocoaTrack green for valid
  };

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    // Dynamically import Leaflet to avoid SSR issues
    const initMap = async () => {
      const L = (await import('leaflet')).default;
      // CSS is imported in the parent component or layout
      // import('leaflet/dist/leaflet.css') doesn't work with TypeScript

      // Don't reinitialize if map already exists
      if (mapRef.current) {
        // Just update the layer
        if (geoJsonLayerRef.current) {
          geoJsonLayerRef.current.clearLayers();
          const newLayer = L.geoJSON(geometry, {
            style: {
              fillColor: getPolygonColor(),
              fillOpacity: 0.4,
              color: getPolygonColor(),
              weight: 2,
              opacity: 1,
            },
          });
          geoJsonLayerRef.current.addLayer(newLayer);
          
          // Fit bounds
          const bounds = newLayer.getBounds();
          if (bounds.isValid()) {
            mapRef.current.fitBounds(bounds, { padding: [10, 10] });
          }
        }
        return;
      }

      // Create map instance with minimal controls
      const map = L.map(mapContainerRef.current!, {
        center: [centroid.lat, centroid.lng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
      });

      // Add a simple tile layer (light style for mini-maps)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Create GeoJSON layer for the polygon
      const geoJsonLayer = L.geoJSON(geometry, {
        style: {
          fillColor: getPolygonColor(),
          fillOpacity: 0.4,
          color: getPolygonColor(),
          weight: 2,
          opacity: 1,
        },
      }).addTo(map);

      geoJsonLayerRef.current = geoJsonLayer;

      // Fit bounds to show the entire polygon
      const bounds = geoJsonLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [10, 10] });
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry, centroid, isValid, isDuplicate]);

  return (
    <div
      ref={mapContainerRef}
      className={`rounded-lg overflow-hidden border border-gray-200 ${className}`}
      style={{ height, width }}
    />
  );
}

// Memoize to prevent unnecessary re-renders in lists
export const FeatureMiniMap = memo(FeatureMiniMapComponent);

export default FeatureMiniMap;
