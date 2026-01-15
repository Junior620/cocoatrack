'use client';

// CocoaTrack V2 - ParcelleMap Component
// Interactive map for displaying parcelles as colored polygons using Leaflet
// This is a Client Component - requires "use client" directive for:
// - Leaflet DOM manipulation
// - Browser-only APIs (window, document)
// - React hooks for interactivity

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { Parcelle } from '@/types/parcelles';

// Dynamically import Leaflet components to avoid SSR issues
// Leaflet requires window/document which don't exist during SSR
const LeafletMap = dynamic(
  () => import('./LeafletMap').then((mod) => mod.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Chargement de la carte...</p>
        </div>
      </div>
    ),
  }
);

// Color mapping for conformity status (CocoaTrack brand colors)
export const CONFORMITY_COLORS: Record<string, string> = {
  conforme: '#6FAF3D',              // CocoaTrack green
  en_cours: '#E68A1F',              // CocoaTrack orange
  non_conforme: '#ef4444',          // red
  informations_manquantes: '#9ca3af', // gray
};

export interface ParcelleMapProps {
  /** Array of parcelles to display on the map */
  parcelles: Parcelle[];
  /** ID of the currently selected parcelle */
  selectedId?: string;
  /** Callback when a parcelle is selected */
  onSelect?: (parcelle: Parcelle) => void;
  /** Bounding box for initial view [minLng, minLat, maxLng, maxLat] */
  bbox?: [number, number, number, number];
  /** Callback when the map's bounding box changes (includes zoom level) */
  onBboxChange?: (bbox: [number, number, number, number], zoom?: number) => void;
  /** Whether to show centroid markers */
  showCentroids?: boolean;
  /** Height of the map container */
  height?: string;
  /** Additional CSS classes */
  className?: string;
  /** Enable fullscreen control */
  enableFullscreen?: boolean;
  /** Zoom to fit a single parcelle */
  zoomToFit?: boolean;
  /** When true, automatically zoom to the selected parcelle when selectedId changes */
  zoomToSelected?: boolean;
}

/**
 * ParcelleMap - Interactive map component for displaying agricultural parcelles
 * 
 * Features:
 * - Displays parcelles as colored polygons based on conformity status
 * - Popup on click with planteur, code, surface, status info
 * - Centroid markers (optional)
 * - Bbox filtering callback for map movement
 * - Zoom-to-fit for single parcelle view
 * - Fullscreen control
 */
export function ParcelleMap({
  parcelles,
  selectedId,
  onSelect,
  bbox,
  onBboxChange,
  showCentroids = false,
  height = '400px',
  className = '',
  enableFullscreen = true,
  zoomToFit = false,
  zoomToSelected = false,
}: ParcelleMapProps) {
  // Memoize parcelles data to prevent unnecessary re-renders
  const parcellesData = useMemo(() => parcelles, [parcelles]);

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`} style={{ height }}>
      <LeafletMap
        parcelles={parcellesData}
        selectedId={selectedId}
        onSelect={onSelect}
        bbox={bbox}
        onBboxChange={onBboxChange}
        showCentroids={showCentroids}
        enableFullscreen={enableFullscreen}
        zoomToFit={zoomToFit}
        zoomToSelected={zoomToSelected}
      />
    </div>
  );
}

export default ParcelleMap;
