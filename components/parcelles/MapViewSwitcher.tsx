'use client';

// CocoaTrack V2 - Map View Switcher
// Allows switching between Leaflet and Google Maps

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Map, Satellite } from 'lucide-react';
import type { ParcelleWithPlanteur } from '@/types/parcelles';

// Dynamically import both map components to avoid SSR issues
const LeafletMap = dynamic(
  () => import('./LeafletMap').then((mod) => mod.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Chargement de la carte...</p>
        </div>
      </div>
    ),
  }
);

// Dynamically import GoogleMapView to avoid loading Google Maps API when not needed
const GoogleMapView = dynamic(
  () => import('./GoogleMapView').then((mod) => mod.GoogleMapView),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Chargement de Google Maps...</p>
        </div>
      </div>
    ),
  }
);

interface MapViewSwitcherProps {
  parcelles: ParcelleWithPlanteur[];
  selectedId?: string | null;
  onSelect?: (parcelle: ParcelleWithPlanteur) => void;
  onBboxChange?: (bbox: [number, number, number, number], zoom?: number) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  defaultProvider?: 'leaflet' | 'google';
  zoomToSelected?: boolean;
}

export function MapViewSwitcher({
  parcelles,
  selectedId,
  onSelect,
  onBboxChange,
  center,
  zoom = 12,
  height = '600px',
  defaultProvider = 'leaflet',
  zoomToSelected = false,
}: MapViewSwitcherProps) {
  const [mapProvider, setMapProvider] = useState<'leaflet' | 'google'>(defaultProvider);
  const [leafletLayer, setLeafletLayer] = useState<'osm' | 'satellite'>('osm');

  return (
    <div className="relative w-full" style={{ height }}>
      {/* Map Provider Switcher */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1001] flex gap-2 bg-white rounded-lg shadow-lg p-1">
        <button
          onClick={() => {
            setMapProvider('leaflet');
            setLeafletLayer('osm');
          }}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
            ${mapProvider === 'leaflet' && leafletLayer === 'osm'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-gray-700 hover:bg-gray-100'
            }
          `}
          title="OpenStreetMap"
        >
          <Map className="h-4 w-4" />
          <span className="hidden sm:inline">Plan</span>
        </button>
        <button
          onClick={() => {
            setMapProvider('leaflet');
            setLeafletLayer('satellite');
          }}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
            ${mapProvider === 'leaflet' && leafletLayer === 'satellite'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-gray-700 hover:bg-gray-100'
            }
          `}
          title="Satellite (Esri)"
        >
          <Satellite className="h-4 w-4" />
          <span className="hidden sm:inline">Satellite</span>
        </button>
        <button
          onClick={() => setMapProvider('google')}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
            ${mapProvider === 'google'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-gray-700 hover:bg-gray-100'
            }
          `}
          title="Google Satellite"
        >
          <Satellite className="h-4 w-4" />
          <span className="hidden sm:inline">Google</span>
        </button>
      </div>

      {/* Map Display */}
      <div className="w-full h-full">
        {mapProvider === 'leaflet' ? (
          <LeafletMap
            parcelles={parcelles}
            selectedId={selectedId || undefined}
            onSelect={onSelect as any}
            onBboxChange={onBboxChange}
            zoomToFit={true}
            zoomToSelected={zoomToSelected}
            tileLayer={leafletLayer}
          />
        ) : (
          <GoogleMapView
            parcelles={parcelles}
            selectedParcelleId={selectedId}
            onParcelleClick={onSelect}
            center={center}
            zoom={zoom}
          />
        )}
      </div>

      {/* Provider Info */}
      <div className="absolute bottom-4 left-4 z-[1001] bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2">
        <p className="text-xs text-gray-600">
          {mapProvider === 'leaflet' ? (
            <>
              <span className="font-medium">
                {leafletLayer === 'osm' ? 'OpenStreetMap' : 'Satellite (Esri)'}
              </span> · {leafletLayer === 'osm' ? 'Données libres' : 'Imagerie satellite'}
            </>
          ) : (
            <>
              <span className="font-medium">Google Maps</span> · Imagerie satellite
            </>
          )}
        </p>
      </div>
    </div>
  );
}
