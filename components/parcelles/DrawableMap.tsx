'use client';

// CocoaTrack V2 - DrawableMap Component
// Interactive map with polygon drawing capabilities using Leaflet Draw
//
// Features:
// - Draw polygons on the map
// - Edit existing polygons
// - Delete polygons
// - Display existing geometry
// - Zoom to fit drawn geometry

import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-fullscreen';
import 'leaflet-fullscreen/dist/leaflet.fullscreen.css';

import type { MultiPolygon, Polygon, Feature, FeatureCollection } from 'geojson';

// Fix Leaflet default marker icon path issue
const fixLeafletIcons = () => {
  // @ts-expect-error - Leaflet types don't include _getIconUrl
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
};

// Apply fix immediately
fixLeafletIcons();

// Cameroon center coordinates (default view)
const CAMEROON_CENTER: [number, number] = [5.9631, 10.1591];
const DEFAULT_ZOOM = 6;

// CocoaTrack brand colors
const DRAW_COLOR = '#6FAF3D'; // CocoaTrack green

/**
 * Props for DrawableMap component
 */
export interface DrawableMapProps {
  /** Current geometry value */
  geometry?: Polygon | MultiPolygon | null;
  /** Callback when geometry changes */
  onGeometryChange: (geometry: Polygon | MultiPolygon | null) => void;
  /** Whether the map is disabled (no drawing allowed) */
  disabled?: boolean;
  /** Map height (default: 100%) */
  height?: string;
}

/**
 * DrawableMap - Interactive map with polygon drawing tools
 *
 * Uses Leaflet Draw plugin to allow users to:
 * - Draw new polygons
 * - Edit existing polygons
 * - Delete polygons
 *
 * The component converts Leaflet layers to GeoJSON and notifies parent via onGeometryChange
 */
export function DrawableMap({
  geometry,
  onGeometryChange,
  disabled = false,
  height = '100%',
}: DrawableMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Convert GeoJSON geometry to Leaflet layer
  const geometryToLayer = useCallback((geom: Polygon | MultiPolygon): L.Layer | null => {
    try {
      const geoJsonLayer = L.geoJSON(geom as GeoJSON.Geometry, {
        style: {
          color: DRAW_COLOR,
          fillColor: DRAW_COLOR,
          fillOpacity: 0.3,
          weight: 2,
        },
      });
      return geoJsonLayer;
    } catch (error) {
      console.error('Error converting geometry to layer:', error);
      return null;
    }
  }, []);

  // Convert Leaflet FeatureGroup to GeoJSON
  const layersToGeoJSON = useCallback((featureGroup: L.FeatureGroup): Polygon | MultiPolygon | null => {
    const layers = featureGroup.getLayers();
    if (layers.length === 0) return null;

    const features: Feature<Polygon>[] = [];

    layers.forEach((layer) => {
      if (layer instanceof L.Polygon) {
        const geoJson = layer.toGeoJSON() as Feature<Polygon>;
        features.push(geoJson);
      }
    });

    if (features.length === 0) return null;

    if (features.length === 1) {
      // Return single polygon
      return features[0].geometry;
    }

    // Return MultiPolygon for multiple polygons
    const multiPolygon: MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: features.map((f) => f.geometry.coordinates),
    };
    return multiPolygon;
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create map instance
    // Note: fullscreenControl options are added via leaflet-fullscreen plugin
    // We need to cast to any to avoid TypeScript errors with extended options
    const mapOptions = {
      center: CAMEROON_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      fullscreenControl: true,
      fullscreenControlOptions: {
        position: 'topright',
        title: 'Plein écran',
        titleCancel: 'Quitter le plein écran',
      },
    } as L.MapOptions;
    const map = L.map(mapContainerRef.current, mapOptions);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Create feature group for drawn items
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    // Create draw control
    const drawControl = new L.Control.Draw({
      position: 'topleft',
      draw: {
        polygon: {
          allowIntersection: false,
          drawError: {
            color: '#e74c3c',
            message: '<strong>Erreur:</strong> Les lignes ne peuvent pas se croiser!',
          },
          shapeOptions: {
            color: DRAW_COLOR,
            fillColor: DRAW_COLOR,
            fillOpacity: 0.3,
            weight: 2,
          },
          showArea: true,
          metric: true,
        },
        polyline: false,
        circle: false,
        circlemarker: false,
        marker: false,
        rectangle: {
          shapeOptions: {
            color: DRAW_COLOR,
            fillColor: DRAW_COLOR,
            fillOpacity: 0.3,
            weight: 2,
          },
        },
      },
      edit: {
        featureGroup: drawnItems,
        remove: true,
        // @ts-expect-error - leaflet-draw types are incomplete
        edit: true,
      },
    });

    if (!disabled) {
      map.addControl(drawControl);
    }
    drawControlRef.current = drawControl;

    mapRef.current = map;
    setIsInitialized(true);

    // Cleanup on unmount
    return () => {
      map.remove();
      mapRef.current = null;
      drawnItemsRef.current = null;
      drawControlRef.current = null;
      setIsInitialized(false);
    };
  }, [disabled]);

  // Handle draw events
  useEffect(() => {
    if (!mapRef.current || !drawnItemsRef.current || !isInitialized) return;

    const map = mapRef.current;
    const drawnItems = drawnItemsRef.current;

    // Handle created event
    const handleCreated = (e: L.LeafletEvent) => {
      const event = e as L.DrawEvents.Created;
      const layer = event.layer;
      drawnItems.addLayer(layer);
      
      // Convert to GeoJSON and notify parent
      const geoJson = layersToGeoJSON(drawnItems);
      onGeometryChange(geoJson);
    };

    // Handle edited event
    const handleEdited = () => {
      const geoJson = layersToGeoJSON(drawnItems);
      onGeometryChange(geoJson);
    };

    // Handle deleted event
    const handleDeleted = () => {
      const geoJson = layersToGeoJSON(drawnItems);
      onGeometryChange(geoJson);
    };

    // Add event listeners
    map.on(L.Draw.Event.CREATED, handleCreated);
    map.on(L.Draw.Event.EDITED, handleEdited);
    map.on(L.Draw.Event.DELETED, handleDeleted);

    // Cleanup event listeners
    return () => {
      map.off(L.Draw.Event.CREATED, handleCreated);
      map.off(L.Draw.Event.EDITED, handleEdited);
      map.off(L.Draw.Event.DELETED, handleDeleted);
    };
  }, [isInitialized, layersToGeoJSON, onGeometryChange]);

  // Update map when geometry prop changes
  useEffect(() => {
    if (!mapRef.current || !drawnItemsRef.current || !isInitialized) return;

    const map = mapRef.current;
    const drawnItems = drawnItemsRef.current;

    // Clear existing layers
    drawnItems.clearLayers();

    // Add geometry if provided
    if (geometry) {
      const layer = geometryToLayer(geometry);
      if (layer) {
        // Add all layers from the GeoJSON layer group
        if (layer instanceof L.LayerGroup) {
          layer.eachLayer((l) => {
            drawnItems.addLayer(l);
          });
        } else {
          drawnItems.addLayer(layer);
        }

        // Zoom to fit the geometry
        const bounds = drawnItems.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }
      }
    }
  }, [geometry, isInitialized, geometryToLayer]);

  // Update draw control when disabled changes
  useEffect(() => {
    if (!mapRef.current || !drawControlRef.current) return;

    const map = mapRef.current;
    const drawControl = drawControlRef.current;

    if (disabled) {
      map.removeControl(drawControl);
    } else {
      map.addControl(drawControl);
    }
  }, [disabled]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} style={{ height, width: '100%' }} />

      {/* Instructions overlay */}
      {!disabled && !geometry && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg">
          <p className="text-sm text-gray-700">
            Cliquez sur l'icône <span className="font-medium">polygone</span> à gauche pour commencer à dessiner
          </p>
        </div>
      )}

      {/* Disabled overlay */}
      {disabled && (
        <div className="absolute inset-0 bg-gray-100/50 z-[1000] flex items-center justify-center">
          <p className="text-sm text-gray-500 bg-white px-4 py-2 rounded-lg shadow">
            Dessin désactivé
          </p>
        </div>
      )}
    </div>
  );
}

export default DrawableMap;
