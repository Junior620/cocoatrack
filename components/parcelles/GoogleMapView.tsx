'use client';

// CocoaTrack V2 - Google Maps View Component
// Displays parcelles on Google Maps with satellite imagery

import { useEffect, useState } from 'react';
import type { ParcelleWithPlanteur } from '@/types/parcelles';

interface GoogleMapViewProps {
  parcelles: ParcelleWithPlanteur[];
  selectedParcelleId?: string | null;
  onParcelleClick?: (parcelle: ParcelleWithPlanteur) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
}

const defaultCenter = {
  lat: 4.0511, // Cameroun
  lng: 9.7679,
};

export function GoogleMapView({
  parcelles,
  selectedParcelleId,
  onParcelleClick,
  center,
  zoom = 12,
}: GoogleMapViewProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Initialisation...</p>
        </div>
      </div>
    );
  }

  // Dynamically import the actual Google Maps component only on client
  const GoogleMapClient = require('./GoogleMapClient').GoogleMapClient;
  
  return (
    <GoogleMapClient
      parcelles={parcelles}
      selectedParcelleId={selectedParcelleId}
      onParcelleClick={onParcelleClick}
      center={center}
      zoom={zoom}
    />
  );
}
