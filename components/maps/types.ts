// CocoaTrack V2 - Map Types

export type MarkerType = 'planteur' | 'chef_planteur' | 'warehouse';

export interface MapMarker {
  id: string;
  type: MarkerType;
  coordinates: [number, number]; // [lng, lat]
  name: string;
  code?: string;
  data?: Record<string, unknown>;
}

export interface MapViewProps {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  onMarkerClick?: (marker: MapMarker) => void;
  clusterThreshold?: number;
  className?: string;
}

export interface MarkerFilter {
  types?: MarkerType[];
  search?: string;
}

// Cameroon default center (approximately)
export const CAMEROON_CENTER: [number, number] = [12.3547, 7.3697];
export const DEFAULT_ZOOM = 6;
export const CLUSTER_THRESHOLD = 50;

// Marker colors by type
export const MARKER_COLORS: Record<MarkerType, string> = {
  planteur: '#10B981', // green
  chef_planteur: '#3B82F6', // blue
  warehouse: '#F59E0B', // amber
};
