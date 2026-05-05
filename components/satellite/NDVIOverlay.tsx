/**
 * NDVI Overlay Component
 * 
 * Displays an NDVI raster image as an overlay on a Leaflet map.
 * The overlay is positioned using geographic bounds and can be toggled on/off.
 */

'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ============================================================================
// Types
// ============================================================================

export interface NDVIOverlayProps {
  /**
   * Leaflet map instance
   */
  map: L.Map | null;

  /**
   * URL of the NDVI raster image
   */
  rasterUrl: string;

  /**
   * Geographic bounds of the raster [minLng, minLat, maxLng, maxLat]
   */
  bounds: [number, number, number, number];

  /**
   * Opacity of the overlay (0-1)
   * Default: 0.7
   */
  opacity?: number;

  /**
   * Whether the overlay is visible
   * Default: true
   */
  visible?: boolean;

  /**
   * Z-index of the overlay
   * Default: 400
   */
  zIndex?: number;
}

// ============================================================================
// NDVIOverlay Component
// ============================================================================

/**
 * NDVI Overlay Component
 * 
 * Renders an NDVI raster image as an overlay on a Leaflet map.
 * 
 * @example
 * ```tsx
 * <NDVIOverlay
 *   map={mapInstance}
 *   rasterUrl="https://storage.supabase.co/.../ndvi-raster.png"
 *   bounds={[-5.5, 6.5, -5.4, 6.6]}
 *   opacity={0.7}
 *   visible={true}
 * />
 * ```
 */
export function NDVIOverlay({
  map,
  rasterUrl,
  bounds,
  opacity = 0.7,
  visible = true,
  zIndex = 400,
}: NDVIOverlayProps) {
  const overlayRef = useRef<L.ImageOverlay | null>(null);

  useEffect(() => {
    if (!map || !rasterUrl) {
      return;
    }

    // Create Leaflet bounds from array
    const leafletBounds = L.latLngBounds(
      [bounds[1], bounds[0]], // Southwest corner [lat, lng]
      [bounds[3], bounds[2]]  // Northeast corner [lat, lng]
    );

    // Create image overlay
    const overlay = L.imageOverlay(rasterUrl, leafletBounds, {
      opacity,
      interactive: false, // Don't capture mouse events
      crossOrigin: 'anonymous', // Allow CORS
      className: 'ndvi-overlay',
      zIndex,
    });

    // Add to map
    overlay.addTo(map);
    overlayRef.current = overlay;

    // Cleanup on unmount
    return () => {
      if (overlayRef.current) {
        overlayRef.current.remove();
        overlayRef.current = null;
      }
    };
  }, [map, rasterUrl, bounds, opacity, zIndex]);

  // Handle visibility changes
  useEffect(() => {
    if (overlayRef.current) {
      if (visible) {
        overlayRef.current.setOpacity(opacity);
      } else {
        overlayRef.current.setOpacity(0);
      }
    }
  }, [visible, opacity]);

  return null; // This component doesn't render anything in React
}

export default NDVIOverlay;
