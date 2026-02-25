'use client';

// CocoaTrack V2 - LeafletMap Component (Internal)
// Actual Leaflet implementation - dynamically imported to avoid SSR issues

import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Import leaflet-fullscreen plugin for fullscreen control
import 'leaflet-fullscreen';
import 'leaflet-fullscreen/dist/leaflet.fullscreen.css';

import type { Parcelle } from '@/types/parcelles';
import { CONFORMITY_COLORS } from './ParcelleMap';

// Fix Leaflet default marker icon path issue
// This is a common bug when using Leaflet with bundlers like webpack/Next.js
// We need to manually set the icon URLs since the default paths don't work
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

interface LeafletMapProps {
  parcelles: Parcelle[];
  selectedId?: string;
  onSelect?: (parcelle: Parcelle) => void;
  bbox?: [number, number, number, number];
  onBboxChange?: (bbox: [number, number, number, number], zoom?: number) => void;
  showCentroids?: boolean;
  enableFullscreen?: boolean;
  zoomToFit?: boolean;
  /** When true, automatically zoom to the selected parcelle when selectedId changes */
  zoomToSelected?: boolean;
}

export function LeafletMap({
  parcelles,
  selectedId,
  onSelect,
  bbox,
  onBboxChange,
  showCentroids = false,
  enableFullscreen = true,
  zoomToFit = false,
  zoomToSelected = false,
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polygonLayerRef = useRef<L.GeoJSON | null>(null);
  const centroidLayerRef = useRef<L.LayerGroup | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  
  // Store onBboxChange in a ref to avoid stale closures in event listeners
  const onBboxChangeRef = useRef(onBboxChange);
  useEffect(() => {
    onBboxChangeRef.current = onBboxChange;
  }, [onBboxChange]);

  // Get color for conformity status
  const getPolygonColor = useCallback((status: string): string => {
    return CONFORMITY_COLORS[status] || CONFORMITY_COLORS.informations_manquantes;
  }, []);

  // Format popup content
  const formatPopupContent = useCallback((parcelle: Parcelle): string => {
    const certifications = parcelle.certifications?.length 
      ? parcelle.certifications.join(', ') 
      : 'Aucune';
    
    return `
      <div class="parcelle-popup">
        <h3 class="font-semibold text-gray-900 mb-1">${parcelle.planteur?.name || 'Planteur inconnu'}</h3>
        <div class="text-sm space-y-1">
          <p><span class="text-gray-500">Code:</span> ${parcelle.code}</p>
          <p><span class="text-gray-500">Surface:</span> ${parcelle.surface_hectares?.toFixed(2) || '?'} ha</p>
          <p><span class="text-gray-500">Village:</span> ${parcelle.village || 'Non renseigné'}</p>
          <p><span class="text-gray-500">Certifications:</span> ${certifications}</p>
          <p>
            <span class="text-gray-500">Statut:</span> 
            <span class="inline-block px-2 py-0.5 rounded text-xs font-medium" 
                  style="background-color: ${getPolygonColor(parcelle.conformity_status)}20; color: ${getPolygonColor(parcelle.conformity_status)}">
              ${formatStatus(parcelle.conformity_status)}
            </span>
          </p>
        </div>
      </div>
    `;
  }, [getPolygonColor]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create map instance with fullscreen control option
    const map = L.map(mapContainerRef.current, {
      center: CAMEROON_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      // Enable fullscreen control via leaflet-fullscreen plugin
      // @ts-expect-error - leaflet-fullscreen extends L.MapOptions
      fullscreenControl: enableFullscreen,
      fullscreenControlOptions: {
        position: 'topright',
        title: 'Plein écran',
        titleCancel: 'Quitter le plein écran',
      },
    });

    // Add OpenStreetMap tile layer
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    
    baseTileLayerRef.current = tileLayer;

    // Create layer groups
    polygonLayerRef.current = L.geoJSON(undefined, {
      style: () => ({
        fillOpacity: 0.4,
        weight: 2,
        opacity: 1,
      }),
    }).addTo(map);

    centroidLayerRef.current = L.layerGroup().addTo(map);

    // Handle map move/zoom for bbox callback
    // Using both moveend and zoomend ensures bbox is updated on pan and zoom
    const handleBoundsChange = () => {
      if (onBboxChangeRef.current) {
        const bounds = map.getBounds();
        const zoom = map.getZoom();
        onBboxChangeRef.current([
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ], zoom);
      }
    };
    
    map.on('moveend', handleBoundsChange);
    map.on('zoomend', handleBoundsChange);

    mapRef.current = map;

    // Cleanup on unmount
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [enableFullscreen]);

  // Update parcelles on map
  useEffect(() => {
    if (!mapRef.current || !polygonLayerRef.current) return;

    // Clear existing layers
    polygonLayerRef.current.clearLayers();
    centroidLayerRef.current?.clearLayers();

    if (parcelles.length === 0) return;

    // Add parcelles as GeoJSON features
    const features = parcelles
      .filter((p) => p.geometry)
      .map((parcelle) => ({
        type: 'Feature' as const,
        properties: { ...parcelle },
        geometry: parcelle.geometry,
      }));

    if (features.length === 0) return;

    const geoJsonLayer = L.geoJSON(
      { type: 'FeatureCollection' as const, features } as GeoJSON.FeatureCollection,
      {
        style: (feature) => {
          const status = feature?.properties?.conformity_status || 'informations_manquantes';
          const isSelected = feature?.properties?.id === selectedId;
          return {
            fillColor: getPolygonColor(status),
            fillOpacity: isSelected ? 0.6 : 0.4,
            color: isSelected ? '#1f2937' : getPolygonColor(status),
            weight: isSelected ? 3 : 2,
            opacity: 1,
          };
        },
        onEachFeature: (feature, layer) => {
          const parcelle = feature.properties as Parcelle;
          
          // Add popup
          layer.bindPopup(formatPopupContent(parcelle), {
            maxWidth: 300,
            className: 'parcelle-popup-container',
          });

          // Handle click - show popup AND highlight in list
          layer.on('click', (e) => {
            // Open popup at click location
            // For polygon layers, we need to set the popup's latlng before opening
            const popup = layer.getPopup();
            if (popup) {
              popup.setLatLng(e.latlng);
              layer.openPopup();
            }
            
            // Notify parent to highlight in list
            if (onSelect) {
              onSelect(parcelle);
            }
          });

          // Hover effects
          layer.on('mouseover', () => {
            (layer as L.Path).setStyle({
              fillOpacity: 0.7,
              weight: 3,
            });
          });

          layer.on('mouseout', () => {
            const isSelected = parcelle.id === selectedId;
            (layer as L.Path).setStyle({
              fillOpacity: isSelected ? 0.6 : 0.4,
              weight: isSelected ? 3 : 2,
            });
          });
        },
      }
    );

    polygonLayerRef.current.addLayer(geoJsonLayer);

    // Add centroid markers if enabled
    if (showCentroids && centroidLayerRef.current) {
      parcelles.forEach((parcelle) => {
        if (parcelle.centroid) {
          const marker = L.circleMarker(
            [parcelle.centroid.lat, parcelle.centroid.lng],
            {
              radius: 5,
              fillColor: getPolygonColor(parcelle.conformity_status),
              fillOpacity: 1,
              color: '#fff',
              weight: 2,
            }
          );
          if (parcelle.code) {
            marker.bindTooltip(parcelle.code, { permanent: false });
          }
          centroidLayerRef.current?.addLayer(marker);
        }
      });
    }

    // Zoom to fit if requested or if there's only one parcelle
    if (zoomToFit || parcelles.length === 1) {
      const bounds = geoJsonLayer.getBounds();
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [parcelles, selectedId, showCentroids, zoomToFit, onSelect, getPolygonColor, formatPopupContent]);

  // Handle initial bbox
  useEffect(() => {
    if (!mapRef.current || !bbox) return;
    
    const bounds = L.latLngBounds(
      [bbox[1], bbox[0]], // SW corner
      [bbox[3], bbox[2]]  // NE corner
    );
    
    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds);
    }
  }, [bbox]);

  // Zoom to selected parcelle when selectedId changes (if zoomToSelected is enabled)
  useEffect(() => {
    if (!mapRef.current || !selectedId || !zoomToSelected) return;

    const selectedParcelle = parcelles.find((p) => p.id === selectedId);
    if (!selectedParcelle?.geometry) return;

    // Create a temporary GeoJSON layer to get bounds
    const tempLayer = L.geoJSON(selectedParcelle.geometry as GeoJSON.Geometry);
    const bounds = tempLayer.getBounds();

    if (bounds.isValid()) {
      mapRef.current.flyToBounds(bounds, {
        padding: [80, 80],
        duration: 0.5,
        maxZoom: 16,
      });
    }
  }, [selectedId, zoomToSelected, parcelles]);

  // Handle map style toggle
  const toggleMapStyle = useCallback(() => {
    if (!mapRef.current || !baseTileLayerRef.current) return;
    
    // Remove current tile layer
    mapRef.current.removeLayer(baseTileLayerRef.current);
    
    // Add new tile layer based on style
    const newStyle = mapStyle === 'streets' ? 'satellite' : 'streets';
    
    let newTileLayer: L.TileLayer;
    if (newStyle === 'satellite') {
      // Use Esri World Imagery (free satellite tiles)
      newTileLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
          maxZoom: 19,
        }
      ).addTo(mapRef.current);
    } else {
      // Use OpenStreetMap
      newTileLayer = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }
      ).addTo(mapRef.current);
    }
    
    baseTileLayerRef.current = newTileLayer;
    setMapStyle(newStyle);
  }, [mapStyle]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Map Style Toggle */}
      <div className="absolute top-4 right-4 z-[1000]">
        <button
          onClick={toggleMapStyle}
          className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-lg transition-colors hover:bg-gray-50"
          title={mapStyle === 'streets' ? 'Vue satellite' : 'Vue carte'}
        >
          {mapStyle === 'streets' ? (
            <>
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Satellite
            </>
          ) : (
            <>
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              Carte
            </>
          )}
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg p-3 shadow-lg">
        <p className="mb-2 text-xs font-semibold text-gray-700">Légende</p>
        <div className="space-y-1">
          <LegendItem color={CONFORMITY_COLORS.conforme} label="Conforme" />
          <LegendItem color={CONFORMITY_COLORS.en_cours} label="En cours" />
          <LegendItem color={CONFORMITY_COLORS.non_conforme} label="Non conforme" />
          <LegendItem color={CONFORMITY_COLORS.informations_manquantes} label="Info. manquantes" />
        </div>
      </div>
    </div>
  );
}

// Legend item component
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-3 w-3 rounded"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  );
}

// Format status for display
function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    conforme: 'Conforme',
    non_conforme: 'Non conforme',
    en_cours: 'En cours',
    informations_manquantes: 'Info. manquantes',
  };
  return statusMap[status] || status;
}

export default LeafletMap;
