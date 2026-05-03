'use client';

// CocoaTrack V2 - Google Maps Client Component (Client-side only)
// This component is only loaded on the client side to avoid SSR issues

import { useCallback, useState, useEffect, useRef } from 'react';
import { GoogleMap, Polygon, useJsApiLoader } from '@react-google-maps/api';
import type { ParcelleWithPlanteur } from '@/types/parcelles';
import type { ImageryData } from '@/lib/satellite/types';

// CocoaTrack conformity colors
const CONFORMITY_COLORS: Record<string, string> = {
  conforme: '#6FAF3D',              // CocoaTrack green
  en_cours: '#E68A1F',              // CocoaTrack orange
  non_conforme: '#ef4444',          // red
  informations_manquantes: '#9ca3af', // gray
};

interface GoogleMapClientProps {
  parcelles: ParcelleWithPlanteur[];
  selectedParcelleId?: string | null;
  onParcelleClick?: (parcelle: ParcelleWithPlanteur) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  /** Enable satellite imagery overlay */
  enableSatelliteOverlay?: boolean;
  /** Initial satellite overlay opacity (0-1) */
  satelliteOverlayOpacity?: number;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 4.0511,
  lng: 9.7679,
};

export function GoogleMapClient({
  parcelles,
  selectedParcelleId,
  onParcelleClick,
  center,
  zoom = 12,
  enableSatelliteOverlay = false,
  satelliteOverlayOpacity = 0.7,
}: GoogleMapClientProps) {
  const [map, setMap] = useState<any>(null);
  const [hasZoomedToFit, setHasZoomedToFit] = useState(false);
  const [showSatelliteOverlay, setShowSatelliteOverlay] = useState(enableSatelliteOverlay);
  const [satelliteOpacity, setSatelliteOpacity] = useState(satelliteOverlayOpacity);
  const [satelliteImagery, setSatelliteImagery] = useState<ImageryData | null>(null);
  const [satelliteLoading, setSatelliteLoading] = useState(false);
  const [satelliteError, setSatelliteError] = useState<string | null>(null);
  const imageMapTypeRef = useRef<google.maps.ImageMapType | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

  const onLoad = useCallback((mapInstance: any) => {
    setMap(mapInstance);
    setHasZoomedToFit(false); // Reset flag when map loads
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
    setHasZoomedToFit(false);
  }, []);

  // Zoom to fit all parcelles on initial load
  useEffect(() => {
    if (map && parcelles.length > 0 && !hasZoomedToFit && typeof window !== 'undefined' && (window as any).google) {
      const google = (window as any).google;
      const bounds = new google.maps.LatLngBounds();
      
      parcelles.forEach((parcelle) => {
        if (parcelle.centroid) {
          bounds.extend({
            lat: parcelle.centroid.lat,
            lng: parcelle.centroid.lng,
          });
        }
      });
      
      map.fitBounds(bounds);
      setHasZoomedToFit(true);
    }
  }, [map, parcelles, hasZoomedToFit]);

  // Zoom to selected parcelle when it changes
  useEffect(() => {
    if (map && selectedParcelleId && typeof window !== 'undefined' && (window as any).google) {
      const selectedParcelle = parcelles.find(p => p.id === selectedParcelleId);
      if (selectedParcelle && selectedParcelle.centroid) {
        const google = (window as any).google;
        map.panTo({ lat: selectedParcelle.centroid.lat, lng: selectedParcelle.centroid.lng });
        if (map.getZoom() < 16) {
          map.setZoom(16);
        }
      }
    }
  }, [map, selectedParcelleId, parcelles]);

  // Fetch satellite imagery when overlay is enabled and parcelle is selected
  useEffect(() => {
    if (!showSatelliteOverlay || !selectedParcelleId || !map) {
      setSatelliteImagery(null);
      setSatelliteError(null);
      return;
    }

    const fetchSatelliteImagery = async () => {
      setSatelliteLoading(true);
      setSatelliteError(null);

      try {
        const params = new URLSearchParams({
          parcelleId: selectedParcelleId,
          cloudCoverThreshold: '20',
        });

        const response = await fetch(`/api/satellite/imagery?${params.toString()}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Failed to fetch imagery: ${response.statusText}`
          );
        }

        const data = await response.json();
        const imagery: ImageryData = {
          ...data.imagery,
          acquisitionDate: new Date(data.imagery.acquisitionDate),
          createdAt: new Date(data.imagery.createdAt),
        };

        setSatelliteImagery(imagery);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setSatelliteError(errorMessage);
        console.error('Error fetching satellite imagery:', error);
      } finally {
        setSatelliteLoading(false);
      }
    };

    fetchSatelliteImagery();
  }, [showSatelliteOverlay, selectedParcelleId, map]);

  // Update satellite overlay on map when imagery or opacity changes
  useEffect(() => {
    if (!map || typeof window === 'undefined' || !(window as any).google) return;

    const google = (window as any).google;

    // Remove existing overlay if it exists
    if (imageMapTypeRef.current) {
      const overlayMapTypes = map.overlayMapTypes;
      const index = overlayMapTypes.getArray().indexOf(imageMapTypeRef.current);
      if (index !== -1) {
        overlayMapTypes.removeAt(index);
      }
      imageMapTypeRef.current = null;
    }

    // Add satellite overlay if enabled and imagery is available
    if (showSatelliteOverlay && satelliteImagery && !satelliteError) {
      const selectedParcelle = parcelles.find(p => p.id === selectedParcelleId);
      if (!selectedParcelle || !selectedParcelle.geometry) return;

      // Get parcelle bounds
      const bounds = satelliteImagery.bounds;
      const [minLng, minLat, maxLng, maxLat] = bounds;

      // Create ImageMapType for the satellite overlay
      const imageMapType = new google.maps.ImageMapType({
        getTileUrl: (coord: any, zoom: number) => {
          // For simplicity, we'll use the tile URL directly
          // In a production system, you'd implement proper tile coordinate calculation
          return satelliteImagery.tileUrl;
        },
        tileSize: new google.maps.Size(256, 256),
        opacity: satelliteOpacity,
        name: 'Satellite Imagery',
      });

      // Add the overlay to the map
      map.overlayMapTypes.push(imageMapType);
      imageMapTypeRef.current = imageMapType;
    }
  }, [map, showSatelliteOverlay, satelliteImagery, satelliteOpacity, satelliteError, selectedParcelleId, parcelles]);

  // Toggle satellite overlay visibility
  const toggleSatelliteOverlay = useCallback(() => {
    setShowSatelliteOverlay((prev) => !prev);
  }, []);

  // Handle satellite overlay opacity change
  const handleSatelliteOpacityChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newOpacity = parseFloat(event.target.value) / 100;
    setSatelliteOpacity(newOpacity);
  }, []);

  // Retry fetching satellite imagery
  const retrySatelliteImagery = useCallback(() => {
    if (selectedParcelleId) {
      setShowSatelliteOverlay(true);
    }
  }, [selectedParcelleId]);

  // Format date for display
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const convertCoordinates = (parcelle: ParcelleWithPlanteur) => {
    try {
      const geometry = parcelle.geometry;
      
      if (!geometry || !geometry.coordinates || !Array.isArray(geometry.coordinates)) {
        console.warn('Invalid geometry for parcelle:', parcelle.code);
        return [];
      }
      
      // Parcelles are always stored as MultiPolygon in the database
      // geometry.coordinates is [polygons[rings]]
      const polygons = geometry.coordinates;
      
      console.log('Converting parcelle:', parcelle.code, 'polygons count:', polygons.length);
      
      const result = polygons.flatMap((polygon: any, polyIndex: number) => {
        if (!Array.isArray(polygon)) {
          console.warn('Invalid polygon at index', polyIndex);
          return [];
        }
        
        return polygon.map((ring: any, ringIndex: number) => {
          if (!Array.isArray(ring)) {
            console.warn('Invalid ring at polygon', polyIndex, 'ring', ringIndex);
            return [];
          }
          
          // Check if ring is empty
          if (ring.length === 0) {
            console.warn('Empty ring at polygon', polyIndex, 'ring', ringIndex);
            return [];
          }
          
          const firstElement = ring[0];
          
          // Array of pairs: [[lng, lat], [lng, lat], ...]
          if (Array.isArray(firstElement) && firstElement.length >= 2) {
            const coords = ring
              .map((coord: any) => {
                if (Array.isArray(coord) && coord.length >= 2) {
                  const [lng, lat] = coord;
                  const latNum = Number(lat);
                  const lngNum = Number(lng);
                  if (isFinite(latNum) && isFinite(lngNum)) {
                    return { lat: latNum, lng: lngNum };
                  }
                }
                return null;
              })
              .filter((c: any): c is { lat: number; lng: number } => c !== null);
            console.log('Array of pairs converted:', coords.length, 'points for ring', ringIndex);
            return coords;
          }
          
          console.warn('Unknown coordinate format at polygon', polyIndex, 'ring', ringIndex, 'first element:', firstElement);
          return [];
        }).filter((ring: any) => ring.length > 0);
      }).filter((polygon: any) => polygon.length > 0);
      
      console.log('Final result for', parcelle.code, ':', result.length, 'paths');
      if (result.length > 0 && result[0].length > 0) {
        console.log('First path sample:', result[0].slice(0, 3));
      }
      
      return result;
    } catch (error) {
      console.error('Error converting coordinates for parcelle:', parcelle.code, error);
      return [];
    }
  };

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center">
          <p className="text-red-600 font-medium">Erreur de chargement Google Maps</p>
          <p className="text-sm text-gray-600 mt-2">{loadError.message}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Chargement de Google Maps...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center || defaultCenter}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          mapTypeId: 'hybrid',
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: true,
          scaleControl: true,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: true,
        }}
      >
        {parcelles.map((parcelle) => {
          const isSelected = parcelle.id === selectedParcelleId;
          const paths = convertCoordinates(parcelle);

          if (paths.length === 0) {
            return null;
          }

          // Get color based on conformity status
          const baseColor = CONFORMITY_COLORS[parcelle.conformity_status] || CONFORMITY_COLORS.informations_manquantes;
          const selectedColor = '#3B82F6'; // Blue for selected

          return paths.map((path, index) => {
            if (!Array.isArray(path) || path.length === 0) {
              return null;
            }

            return (
              <Polygon
                key={`${parcelle.id}-${index}`}
                paths={path}
                options={{
                  fillColor: isSelected ? selectedColor : baseColor,
                  fillOpacity: isSelected ? 0.5 : 0.35,
                  strokeColor: isSelected ? '#1D4ED8' : baseColor,
                  strokeWeight: isSelected ? 3 : 2,
                  strokeOpacity: 1,
                  clickable: true,
                  zIndex: isSelected ? 100 : 1,
                }}
                onClick={() => onParcelleClick?.(parcelle)}
              />
            );
          });
        })}
      </GoogleMap>

      {/* Satellite Overlay Toggle Button */}
      {selectedParcelleId && (
        <button
          onClick={toggleSatelliteOverlay}
          className={`absolute right-4 top-4 z-[1000] flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow-lg transition-colors ${
            showSatelliteOverlay
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
          title={
            showSatelliteOverlay
              ? 'Masquer imagerie satellite'
              : 'Afficher imagerie satellite'
          }
        >
          <svg
            className="h-5 w-5"
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
          <span>{showSatelliteOverlay ? 'Satellite' : 'Satellite'}</span>
        </button>
      )}

      {/* Satellite Loading State */}
      {satelliteLoading && showSatelliteOverlay && (
        <div className="absolute bottom-20 left-4 z-[1000] rounded-lg bg-white p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
            <p className="text-sm text-gray-700">
              Chargement de l&apos;imagerie satellite...
            </p>
          </div>
        </div>
      )}

      {/* Satellite Error State */}
      {satelliteError && showSatelliteOverlay && !satelliteLoading && (
        <div className="absolute bottom-20 left-4 z-[1000] max-w-sm rounded-lg bg-white p-4 shadow-lg">
          <div className="mb-3 flex items-start gap-2">
            <svg
              className="h-5 w-5 flex-shrink-0 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-900">
                Erreur de chargement
              </h4>
              <p className="mt-1 text-xs text-gray-600">{satelliteError}</p>
            </div>
          </div>
          <button
            onClick={retrySatelliteImagery}
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Satellite Imagery Controls */}
      {satelliteImagery && showSatelliteOverlay && !satelliteLoading && !satelliteError && (
        <div className="absolute bottom-20 left-4 z-[1000] rounded-lg bg-white p-4 shadow-lg">
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-gray-700">
              Imagerie Satellite
            </h4>
            <p className="mt-1 text-xs text-gray-500">
              {formatDate(satelliteImagery.acquisitionDate)}
            </p>
            <p className="text-xs text-gray-500">
              Couverture nuageuse: {satelliteImagery.cloudCoverPercent.toFixed(1)}%
            </p>
          </div>

          {/* Opacity Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="satellite-opacity-slider"
                className="text-xs font-medium text-gray-700"
              >
                Opacité
              </label>
              <span className="text-xs text-gray-600">
                {Math.round(satelliteOpacity * 100)}%
              </span>
            </div>
            <input
              id="satellite-opacity-slider"
              type="range"
              min="0"
              max="100"
              value={satelliteOpacity * 100}
              onChange={handleSatelliteOpacityChange}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
              style={{
                background: `linear-gradient(to right, #2563eb 0%, #2563eb ${
                  satelliteOpacity * 100
                }%, #e5e7eb ${satelliteOpacity * 100}%, #e5e7eb 100%)`,
              }}
            />
          </div>

          {/* Imagery Info */}
          <div className="mt-3 border-t border-gray-200 pt-3">
            <div className="flex items-center gap-2 text-xs text-gray-500">
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
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>
                {satelliteImagery.satelliteSource === 'sentinel-2'
                  ? 'Sentinel-2'
                  : satelliteImagery.satelliteSource}
              </span>
              <span>•</span>
              <span>{satelliteImagery.resolutionMeters}m</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
