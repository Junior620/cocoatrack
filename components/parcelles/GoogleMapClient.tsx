'use client';

// CocoaTrack V2 - Google Maps Client Component (Client-side only)
// This component is only loaded on the client side to avoid SSR issues

import { useCallback, useState, useEffect } from 'react';
import { GoogleMap, Polygon, useJsApiLoader } from '@react-google-maps/api';
import type { ParcelleWithPlanteur } from '@/types/parcelles';

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
}: GoogleMapClientProps) {
  const [map, setMap] = useState<any>(null);
  const [hasZoomedToFit, setHasZoomedToFit] = useState(false);

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
  );
}
