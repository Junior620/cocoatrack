'use client';

// CocoaTrack V2 - MapView Component
// Interactive map with markers and clustering using Mapbox GL JS

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapGL, { Marker, Popup, NavigationControl, GeolocateControl } from 'react-map-gl';
import type { MapRef } from 'react-map-gl';

import { OfflineMapFallback } from './OfflineMapFallback';
import {
  CAMEROON_CENTER,
  CLUSTER_THRESHOLD,
  DEFAULT_ZOOM,
  MARKER_COLORS,
} from './types';
import type { MapMarker, MapViewProps } from './types';

import 'mapbox-gl/dist/mapbox-gl.css';

// Check if we're online
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// Simple clustering algorithm
function clusterMarkers(
  markers: MapMarker[],
  zoom: number,
  threshold: number
): { clusters: MapMarker[][]; singles: MapMarker[] } {
  if (markers.length <= threshold || zoom >= 12) {
    return { clusters: [], singles: markers };
  }

  // Grid-based clustering
  const gridSize = 0.5 / Math.pow(2, zoom - 6); // Adjust grid size based on zoom
  const grid: Map<string, MapMarker[]> = new Map();

  markers.forEach((marker) => {
    const [lng, lat] = marker.coordinates;
    const gridX = Math.floor(lng / gridSize);
    const gridY = Math.floor(lat / gridSize);
    const key = `${gridX},${gridY}`;

    if (!grid.has(key)) {
      grid.set(key, []);
    }
    grid.get(key)!.push(marker);
  });

  const clusters: MapMarker[][] = [];
  const singles: MapMarker[] = [];

  grid.forEach((cellMarkers) => {
    if (cellMarkers.length >= 3) {
      clusters.push(cellMarkers);
    } else {
      singles.push(...cellMarkers);
    }
  });

  return { clusters, singles };
}

// Calculate cluster center
function getClusterCenter(markers: MapMarker[]): [number, number] {
  const sumLng = markers.reduce((sum, m) => sum + m.coordinates[0], 0);
  const sumLat = markers.reduce((sum, m) => sum + m.coordinates[1], 0);
  return [sumLng / markers.length, sumLat / markers.length];
}

export function MapView({
  markers,
  center = CAMEROON_CENTER,
  zoom = DEFAULT_ZOOM,
  onMarkerClick,
  clusterThreshold = CLUSTER_THRESHOLD,
  className = '',
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const isOnline = useOnlineStatus();
  const [viewState, setViewState] = useState({
    longitude: center[0],
    latitude: center[1],
    zoom: zoom,
  });
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  // Get Mapbox token
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Cluster markers based on current zoom
  const { clusters, singles } = useMemo(
    () => clusterMarkers(markers, viewState.zoom, clusterThreshold),
    [markers, viewState.zoom, clusterThreshold]
  );

  // Handle marker click
  const handleMarkerClick = useCallback(
    (marker: MapMarker) => {
      setSelectedMarker(marker);
      onMarkerClick?.(marker);
    },
    [onMarkerClick]
  );

  // Handle cluster click - zoom in
  const handleClusterClick = useCallback(
    (clusterMarkers: MapMarker[]) => {
      const [lng, lat] = getClusterCenter(clusterMarkers);
      mapRef.current?.flyTo({
        center: [lng, lat],
        zoom: viewState.zoom + 2,
        duration: 500,
      });
    },
    [viewState.zoom]
  );

  // Close popup
  const handleClosePopup = useCallback(() => {
    setSelectedMarker(null);
  }, []);

  // Show offline fallback if not online or no token
  if (!isOnline) {
    return <OfflineMapFallback markers={markers} className={className} />;
  }

  if (!mapboxToken) {
    return (
      <div className={`flex items-center justify-center rounded-lg bg-gray-100 p-8 ${className}`}>
        <p className="text-sm text-gray-500">
          Mapbox token non configuré. Ajoutez NEXT_PUBLIC_MAPBOX_TOKEN dans .env.local
        </p>
      </div>
    );
  }

  if (mapError) {
    return <OfflineMapFallback markers={markers} className={className} error={mapError} />;
  }

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      <MapGL
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onError={(evt) => setMapError(evt.error?.message || 'Map error')}
        mapboxAccessToken={mapboxToken}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: '100%', height: '100%' }}
        minZoom={4}
        maxZoom={18}
      >
        <NavigationControl position="top-right" />
        <GeolocateControl position="top-right" />

        {/* Render clusters */}
        {clusters.map((clusterMarkers, index) => {
          const [lng, lat] = getClusterCenter(clusterMarkers);
          return (
            <Marker
              key={`cluster-${index}`}
              longitude={lng}
              latitude={lat}
              anchor="center"
              onClick={() => handleClusterClick(clusterMarkers)}
            >
              <div
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white shadow-lg transition-transform hover:scale-110"
                title={`${clusterMarkers.length} éléments`}
              >
                {clusterMarkers.length}
              </div>
            </Marker>
          );
        })}

        {/* Render single markers */}
        {singles.map((marker) => (
          <Marker
            key={marker.id}
            longitude={marker.coordinates[0]}
            latitude={marker.coordinates[1]}
            anchor="bottom"
            onClick={() => handleMarkerClick(marker)}
          >
            <div
              className="cursor-pointer transition-transform hover:scale-110"
              title={marker.name}
            >
              <MarkerIcon type={marker.type} />
            </div>
          </Marker>
        ))}

        {/* Popup for selected marker */}
        {selectedMarker && (
          <Popup
            longitude={selectedMarker.coordinates[0]}
            latitude={selectedMarker.coordinates[1]}
            anchor="bottom"
            onClose={handleClosePopup}
            closeOnClick={false}
            className="map-popup"
          >
            <div className="p-2">
              <h3 className="font-semibold text-gray-900">{selectedMarker.name}</h3>
              {selectedMarker.code && (
                <p className="text-sm text-gray-500">Code: {selectedMarker.code}</p>
              )}
              <p className="text-xs text-gray-400 capitalize">{selectedMarker.type.replace('_', ' ')}</p>
            </div>
          </Popup>
        )}
      </MapGL>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 rounded-lg bg-white p-3 shadow-lg">
        <p className="mb-2 text-xs font-semibold text-gray-700">Légende</p>
        <div className="space-y-1">
          <LegendItem color={MARKER_COLORS.planteur} label="Planteur" />
          <LegendItem color={MARKER_COLORS.chef_planteur} label="Chef Planteur" />
          <LegendItem color={MARKER_COLORS.warehouse} label="Entrepôt" />
        </div>
      </div>
    </div>
  );
}

// Marker icon component
function MarkerIcon({ type }: { type: MapMarker['type'] }) {
  const color = MARKER_COLORS[type];
  return (
    <svg
      width="24"
      height="32"
      viewBox="0 0 24 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z"
        fill={color}
      />
      <circle cx="12" cy="12" r="5" fill="white" />
    </svg>
  );
}

// Legend item component
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-3 w-3 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  );
}
