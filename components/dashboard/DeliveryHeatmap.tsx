'use client';

// CocoaTrack V2 - Delivery Heatmap Component
// Geographic heatmap of deliveries using Mapbox GL JS
// Requirements: 6.3, 6.6

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Source, Layer, NavigationControl, Popup } from 'react-map-gl';
import type { MapRef, MapLayerMouseEvent } from 'react-map-gl';
import type { CircleLayer, HeatmapLayer } from 'mapbox-gl';

import 'mapbox-gl/dist/mapbox-gl.css';

// Cameroon default center
const CAMEROON_CENTER: [number, number] = [12.3547, 7.3697];
const DEFAULT_ZOOM = 6;

export interface HeatmapPoint {
  id: string;
  coordinates: [number, number]; // [lng, lat]
  weight: number; // weight_kg for intensity
  amount: number; // total_amount
  planteurName?: string;
  chefPlanteurName?: string;
  date?: string;
}

interface DeliveryHeatmapProps {
  points: HeatmapPoint[];
  loading?: boolean;
  className?: string;
  onPointClick?: (point: HeatmapPoint) => void;
}

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

// Heatmap layer style
const heatmapLayer: HeatmapLayer = {
  id: 'deliveries-heat',
  type: 'heatmap',
  source: 'deliveries',
  maxzoom: 15,
  paint: {
    // Increase weight based on delivery weight
    'heatmap-weight': [
      'interpolate',
      ['linear'],
      ['get', 'weight'],
      0, 0,
      100, 0.5,
      500, 1,
    ],
    // Increase intensity as zoom level increases
    'heatmap-intensity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      0, 1,
      15, 3,
    ],
    // Color ramp for heatmap
    'heatmap-color': [
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0, 'rgba(33,102,172,0)',
      0.2, 'rgb(103,169,207)',
      0.4, 'rgb(209,229,240)',
      0.6, 'rgb(253,219,199)',
      0.8, 'rgb(239,138,98)',
      1, 'rgb(178,24,43)',
    ],
    // Adjust radius based on zoom
    'heatmap-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      0, 2,
      15, 20,
    ],
    // Fade out heatmap at high zoom
    'heatmap-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      12, 1,
      15, 0,
    ],
  },
};

// Circle layer for individual points at high zoom
const circleLayer: CircleLayer = {
  id: 'deliveries-point',
  type: 'circle',
  source: 'deliveries',
  minzoom: 12,
  paint: {
    // Size based on weight
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['get', 'weight'],
      0, 4,
      100, 8,
      500, 12,
    ],
    // Color based on weight
    'circle-color': [
      'interpolate',
      ['linear'],
      ['get', 'weight'],
      0, '#10B981',
      100, '#F59E0B',
      500, '#EF4444',
    ],
    'circle-stroke-color': 'white',
    'circle-stroke-width': 1,
    'circle-opacity': [
      'interpolate',
      ['linear'],
      ['zoom'],
      12, 0,
      13, 1,
    ],
  },
};

/**
 * Skeleton loader for heatmap
 */
function HeatmapSkeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`}>
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400">Chargement de la carte...</div>
      </div>
    </div>
  );
}

/**
 * Offline fallback for heatmap
 */
function HeatmapOfflineFallback({ points, className }: { points: HeatmapPoint[]; className?: string }) {
  const totalWeight = points.reduce((sum, p) => sum + p.weight, 0);
  const totalAmount = points.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className={`rounded-lg bg-gray-100 p-6 ${className}`}>
      <div className="text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">Mode hors ligne</h3>
        <p className="mt-1 text-sm text-gray-500">
          La carte n&apos;est pas disponible hors ligne
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg bg-white p-3">
            <p className="text-gray-500">Points</p>
            <p className="text-lg font-semibold text-gray-900">{points.length}</p>
          </div>
          <div className="rounded-lg bg-white p-3">
            <p className="text-gray-500">Poids total</p>
            <p className="text-lg font-semibold text-gray-900">{totalWeight.toFixed(0)} kg</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Delivery Heatmap Component
 */
export function DeliveryHeatmap({
  points,
  loading = false,
  className = 'h-96',
  onPointClick,
}: DeliveryHeatmapProps) {
  const mapRef = useRef<MapRef>(null);
  const isOnline = useOnlineStatus();
  const [viewState, setViewState] = useState({
    longitude: CAMEROON_CENTER[0],
    latitude: CAMEROON_CENTER[1],
    zoom: DEFAULT_ZOOM,
  });
  const [selectedPoint, setSelectedPoint] = useState<HeatmapPoint | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Convert points to GeoJSON
  const geojsonData = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: points.map((point) => ({
      type: 'Feature' as const,
      properties: {
        id: point.id,
        weight: point.weight,
        amount: point.amount,
        planteurName: point.planteurName,
        chefPlanteurName: point.chefPlanteurName,
        date: point.date,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: point.coordinates,
      },
    })),
  }), [points]);

  // Handle click on circle layer
  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const features = event.features;
      if (features && features.length > 0) {
        const feature = features[0];
        const props = feature.properties;
        if (props) {
          const clickedPoint: HeatmapPoint = {
            id: props.id,
            coordinates: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
            weight: props.weight,
            amount: props.amount,
            planteurName: props.planteurName,
            chefPlanteurName: props.chefPlanteurName,
            date: props.date,
          };
          setSelectedPoint(clickedPoint);
          onPointClick?.(clickedPoint);
        }
      }
    },
    [onPointClick]
  );

  // Fit bounds to points
  useEffect(() => {
    if (points.length > 0 && mapRef.current) {
      const lngs = points.map((p) => p.coordinates[0]);
      const lats = points.map((p) => p.coordinates[1]);
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ];

      // Only fit if we have valid bounds
      if (bounds[0][0] !== bounds[1][0] || bounds[0][1] !== bounds[1][1]) {
        mapRef.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 12,
          duration: 1000,
        });
      }
    }
  }, [points]);

  if (loading) {
    return <HeatmapSkeleton className={className} />;
  }

  if (!isOnline) {
    return <HeatmapOfflineFallback points={points} className={className} />;
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
    return <HeatmapOfflineFallback points={points} className={className} />;
  }

  if (points.length === 0) {
    return (
      <div className={`flex items-center justify-center rounded-lg bg-gray-100 p-8 ${className}`}>
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-500">Aucune livraison géolocalisée</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onError={(evt) => setMapError(evt.error?.message || 'Map error')}
        onClick={handleClick}
        interactiveLayerIds={['deliveries-point']}
        mapboxAccessToken={mapboxToken}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: '100%', height: '100%' }}
        minZoom={4}
        maxZoom={18}
      >
        <NavigationControl position="top-right" />

        <Source id="deliveries" type="geojson" data={geojsonData}>
          <Layer {...heatmapLayer} />
          <Layer {...circleLayer} />
        </Source>

        {/* Popup for selected point */}
        {selectedPoint && (
          <Popup
            longitude={selectedPoint.coordinates[0]}
            latitude={selectedPoint.coordinates[1]}
            anchor="bottom"
            onClose={() => setSelectedPoint(null)}
            closeOnClick={false}
          >
            <div className="p-2 min-w-[150px]">
              {selectedPoint.planteurName && (
                <p className="font-semibold text-gray-900">{selectedPoint.planteurName}</p>
              )}
              {selectedPoint.chefPlanteurName && (
                <p className="text-sm text-gray-600">{selectedPoint.chefPlanteurName}</p>
              )}
              <div className="mt-2 space-y-1 text-sm">
                <p className="text-gray-700">
                  <span className="font-medium">{selectedPoint.weight.toFixed(2)}</span> kg
                </p>
                <p className="text-gray-700">
                  <span className="font-medium">
                    {new Intl.NumberFormat('fr-FR').format(selectedPoint.amount)}
                  </span>{' '}
                  XAF
                </p>
                {selectedPoint.date && (
                  <p className="text-gray-500 text-xs">
                    {new Date(selectedPoint.date).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 rounded-lg bg-white p-3 shadow-lg">
        <p className="mb-2 text-xs font-semibold text-gray-700">Intensité</p>
        <div className="flex items-center gap-1">
          <div className="h-3 w-16 rounded" style={{
            background: 'linear-gradient(to right, rgb(103,169,207), rgb(253,219,199), rgb(178,24,43))'
          }} />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Faible</span>
          <span>Élevée</span>
        </div>
      </div>

      {/* Stats overlay */}
      <div className="absolute top-4 left-4 rounded-lg bg-white/90 backdrop-blur-sm p-3 shadow-lg">
        <p className="text-xs text-gray-500">{points.length} livraisons</p>
        <p className="text-sm font-semibold text-gray-900">
          {points.reduce((sum, p) => sum + p.weight, 0).toFixed(0)} kg
        </p>
      </div>
    </div>
  );
}
