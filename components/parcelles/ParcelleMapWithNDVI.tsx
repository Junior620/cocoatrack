'use client';

/**
 * ParcelleMapWithNDVI Component
 * 
 * Wrapper around ParcelleMap that adds NDVI raster overlay functionality.
 * Displays the parcelle map with an optional NDVI visualization overlay.
 */

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Eye, EyeOff } from 'lucide-react';
import type { Parcelle } from '@/types/parcelles';
import { ParcelleMap } from './ParcelleMap';

// Dynamically import NDVIOverlay to avoid SSR issues
const NDVIOverlay = dynamic(
  () => import('@/components/satellite/NDVIOverlay').then((mod) => mod.NDVIOverlay),
  { ssr: false }
);

// ============================================================================
// Types
// ============================================================================

export interface ParcelleMapWithNDVIProps {
  /** Parcelle to display */
  parcelle: Parcelle;
  /** NDVI raster URL (if available) */
  ndviRasterUrl?: string | null;
  /** NDVI raster bounds [minLng, minLat, maxLng, maxLat] */
  ndviRasterBounds?: [number, number, number, number] | null;
  /** Height of the map container */
  height?: string;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// ParcelleMapWithNDVI Component
// ============================================================================

/**
 * Parcelle Map with NDVI Overlay
 * 
 * Displays a parcelle on a map with an optional NDVI raster overlay.
 * Includes a toggle button to show/hide the NDVI visualization.
 */
export function ParcelleMapWithNDVI({
  parcelle,
  ndviRasterUrl,
  ndviRasterBounds,
  height = '320px',
  className = '',
}: ParcelleMapWithNDVIProps) {
  const [showOverlay, setShowOverlay] = useState(true);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Extract map instance from Leaflet after it's loaded
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Wait for Leaflet map to be initialized
    const checkForMap = setInterval(() => {
      const mapElement = mapContainerRef.current?.querySelector('.leaflet-container');
      if (mapElement && (mapElement as any)._leaflet_id) {
        // Access the Leaflet map instance
        const L = (window as any).L;
        if (L) {
          const map = L.DomUtil.get((mapElement as any)._leaflet_id);
          if (map) {
            setMapInstance(map);
            clearInterval(checkForMap);
          }
        }
      }
    }, 100);

    // Cleanup
    return () => clearInterval(checkForMap);
  }, []);

  const hasNDVIData = ndviRasterUrl && ndviRasterBounds;

  return (
    <div className="relative">
      {/* Map Container */}
      <div ref={mapContainerRef}>
        <ParcelleMap
          parcelles={[parcelle]}
          selectedId={parcelle.id}
          height={height}
          zoomToFit={true}
          showCentroids={true}
          enableFullscreen={true}
          className={className}
        />
      </div>

      {/* NDVI Overlay */}
      {hasNDVIData && mapInstance && (
        <NDVIOverlay
          map={mapInstance}
          rasterUrl={ndviRasterUrl}
          bounds={ndviRasterBounds}
          opacity={0.7}
          visible={showOverlay}
          zIndex={400}
        />
      )}

      {/* Toggle Button */}
      {hasNDVIData && (
        <div className="absolute top-2 right-2 z-[500]">
          <button
            onClick={() => setShowOverlay(!showOverlay)}
            className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-md hover:bg-gray-50 transition-colors border border-gray-200"
            title={showOverlay ? 'Masquer la visualisation NDVI' : 'Afficher la visualisation NDVI'}
          >
            {showOverlay ? (
              <>
                <EyeOff className="h-4 w-4" />
                <span>Masquer NDVI</span>
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                <span>Afficher NDVI</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* No NDVI Data Message */}
      {!hasNDVIData && (
        <div className="absolute bottom-2 left-2 right-2 z-[500]">
          <div className="rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
            <p className="font-medium">Visualisation NDVI non disponible</p>
            <p className="text-xs mt-1">Le raster NDVI n'a pas encore été généré pour cette parcelle.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ParcelleMapWithNDVI;
