'use client';

// CocoaTrack V2 - LeafletMap Component (Internal)
// Actual Leaflet implementation - dynamically imported to avoid SSR issues
// Updated: Added error message UI for satellite imagery

import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Import leaflet-fullscreen plugin for fullscreen control
import 'leaflet-fullscreen';
import 'leaflet-fullscreen/dist/leaflet.fullscreen.css';

import type { Parcelle } from '@/types/parcelles';
import { CONFORMITY_COLORS } from './ParcelleMap';

// Fix Leaflet default marker icon path issue
// This is a common bug when using Leaflet with bundlers like webpack/Next.js
// We need to manually set the icon URLs since the default paths don't work
const fixLeafletIcons = () => {
  // @ts-expect-error - Leaflet types don't include _getIconUrl
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
};

// Apply fix immediately
fixLeafletIcons();

// Cameroon center coordinates (default view)
const CAMEROON_CENTER: [number, number] = [5.9631, 10.1591];
const DEFAULT_ZOOM = 6;

interface LeafletMapProps {
  parcelles: Parcelle[];
  selectedId?: string;
  onSelect?: (parcelle: Parcelle) => void;
  bbox?: [number, number, number, number];
  onBboxChange?: (bbox: [number, number, number, number], zoom?: number) => void;
  showCentroids?: boolean;
  enableFullscreen?: boolean;
  zoomToFit?: boolean;
  /** When true, automatically zoom to the selected parcelle when selectedId changes */
  zoomToSelected?: boolean;
  /** Tile layer to use: 'osm' for OpenStreetMap, 'satellite' for Esri World Imagery */
  tileLayer?: 'osm' | 'satellite';
  /** Enable satellite imagery overlay */
  enableSatelliteOverlay?: boolean;
  /** Initial satellite overlay opacity (0-1) */
  satelliteOverlayOpacity?: number;
  /** Enable NDVI layer overlay */
  enableNDVILayer?: boolean;
  /** Initial NDVI layer opacity (0-1) */
  ndviLayerOpacity?: number;
  /** Enable deforestation alert indicators */
  showDeforestationAlerts?: boolean;
}

export interface LeafletMapHandle {
  /** Programmatically zoom to a parcelle by id (e.g. from a list click) */
  zoomToParcelle: (id: string) => void;
  /** Fly to a bounding box [minLng, minLat, maxLng, maxLat] */
  flyToBbox: (bbox: [number, number, number, number]) => void;
}

export const LeafletMap = forwardRef<LeafletMapHandle, LeafletMapProps>(function LeafletMap({
  parcelles,
  selectedId,
  onSelect,
  bbox,
  onBboxChange,
  showCentroids = false,
  enableFullscreen = true,
  zoomToFit = false,
  zoomToSelected = false,
  tileLayer = 'osm',
  enableSatelliteOverlay = false,
  satelliteOverlayOpacity = 0.7,
  enableNDVILayer = false,
  ndviLayerOpacity = 0.7,
  showDeforestationAlerts = true,
}, ref: React.Ref<LeafletMapHandle>) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polygonLayerRef = useRef<L.GeoJSON | null>(null);
  const centroidLayerRef = useRef<L.LayerGroup | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const labelsLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteTileLayerRef = useRef<L.TileLayer | null>(null);
  const ndviTileLayerRef = useRef<L.ImageOverlay | null>(null);
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite' | 'hybrid'>('streets');
  const [showLabels, setShowLabels] = useState(true);
  const [showSatelliteOverlay, setShowSatelliteOverlay] = useState(enableSatelliteOverlay);
  const [satelliteOpacity, setSatelliteOpacity] = useState(satelliteOverlayOpacity);
  const [satelliteTileUrl, setSatelliteTileUrl] = useState<string | null>(null);
  const [imageryError, setImageryError] = useState<string | null>(null);
  const [isLoadingImagery, setIsLoadingImagery] = useState(false);
  const [showPeriodSelector, setShowPeriodSelector] = useState(false);
  const [selectedPeriodDays, setSelectedPeriodDays] = useState(120);
  const [customDays, setCustomDays] = useState('');
  const [showNDVILayer, setShowNDVILayer] = useState(enableNDVILayer);
  const [ndviOpacity, setNdviOpacity] = useState(ndviLayerOpacity);
  const [ndviRasterUrl, setNdviRasterUrl] = useState<string | null>(null);
  const [ndviError, setNdviError] = useState<string | null>(null);
  const [isLoadingNDVI, setIsLoadingNDVI] = useState(false);
  const [deforestationAlerts, setDeforestationAlerts] = useState<Record<string, number>>({});
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const prevSelectedIdRef = useRef<string | undefined>(undefined);
  // Track if the initial fit-to-bounds has already been done
  const hasInitialFitRef = useRef(false);

  // Store onBboxChange in a ref to avoid stale closures in event listeners
  const onBboxChangeRef = useRef(onBboxChange);
  useEffect(() => {
    onBboxChangeRef.current = onBboxChange;
  }, [onBboxChange]);

  // Keep parcelles accessible in imperative handle without stale closure
  const parcellesRef = useRef(parcelles);
  useEffect(() => {
    parcellesRef.current = parcelles;
  }, [parcelles]);

  // Expose zoomToParcelle for parent components (e.g. list click)
  useImperativeHandle(ref, () => ({
    zoomToParcelle: (id: string) => {
      if (!mapRef.current) return;
      const parcelle = parcellesRef.current.find((p) => p.id === id);
      if (!parcelle?.geometry) return;
      const tempLayer = L.geoJSON(parcelle.geometry as GeoJSON.Geometry);
      const bounds = tempLayer.getBounds();
      if (bounds.isValid()) {
        mapRef.current.flyToBounds(bounds, {
          padding: [80, 80],
          duration: 0.5,
          maxZoom: 16,
        });
      }
    },
    flyToBbox: (bbox: [number, number, number, number]) => {
      if (!mapRef.current) return;
      const bounds = L.latLngBounds([bbox[1], bbox[0]], [bbox[3], bbox[2]]);
      if (bounds.isValid()) {
        mapRef.current.flyToBounds(bounds, { padding: [20, 20], duration: 0.8 });
      }
    },
  }));

  // Get color for conformity status
  const getPolygonColor = useCallback((status: string): string => {
    return CONFORMITY_COLORS[status] || CONFORMITY_COLORS.informations_manquantes;
  }, []);

  // Format popup content with health status
  const formatPopupContent = useCallback(async (parcelle: Parcelle): Promise<string> => {
    const certifications = parcelle.certifications?.length 
      ? parcelle.certifications.join(', ') 
      : 'Aucune';
    
    // Fetch health status data
    let healthStatusHTML = '';
    try {
      const response = await fetch(`/api/satellite/health-status/${parcelle.id}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const { healthStatus, meanNDVI } = result.data;
          
          // Map health status to colors (matching HealthStatusBadge)
          const healthColors: Record<string, { bg: string; text: string; label: string }> = {
            excellent: { bg: '#2d5016', text: '#ffffff', label: 'Excellent' },
            good: { bg: '#6FAF3D', text: '#ffffff', label: 'Bon' },
            fair: { bg: '#fbbf24', text: '#111827', label: 'Moyen' },
            poor: { bg: '#E68A1F', text: '#ffffff', label: 'Faible' },
            critical: { bg: '#ef4444', text: '#ffffff', label: 'Critique' },
          };
          
          const statusInfo = healthColors[healthStatus] || healthColors.fair;
          
          healthStatusHTML = `
            <p>
              <span class="text-gray-500">Santé:</span> 
              <span class="inline-flex items-center justify-center rounded-full font-medium px-3 py-1 text-sm" 
                    style="background-color: ${statusInfo.bg}; color: ${statusInfo.text}">
                ${statusInfo.label}
              </span>
            </p>
            <p><span class="text-gray-500">NDVI:</span> ${meanNDVI?.toFixed(3) || 'N/A'}</p>
          `;
        }
      }
    } catch (error) {
      // Silently fail - health status is optional
      console.error('Failed to fetch health status for popup:', error);
    }
    
    // Add deforestation alert count if available
    let alertHTML = '';
    const alertCount = deforestationAlerts[parcelle.id];
    if (alertCount && alertCount > 0) {
      alertHTML = `
        <p>
          <span class="text-gray-500">Alertes déforestation:</span> 
          <span class="inline-flex items-center justify-center rounded-full font-semibold px-2 py-0.5 text-xs" 
                style="background-color: #fee2e2; color: #991b1b">
            ${alertCount} alerte${alertCount > 1 ? 's' : ''}
          </span>
        </p>
      `;
    }
    
    return `
      <div class="parcelle-popup">
        <h3 class="font-semibold text-gray-900 mb-1">${parcelle.planteur?.name || 'Planteur inconnu'}</h3>
        <div class="text-sm space-y-1">
          <p><span class="text-gray-500">Code:</span> ${parcelle.code}</p>
          <p><span class="text-gray-500">Surface:</span> ${parcelle.surface_hectares?.toFixed(2) || '?'} ha</p>
          <p><span class="text-gray-500">Village:</span> ${parcelle.village || 'Non renseigné'}</p>
          <p><span class="text-gray-500">Certifications:</span> ${certifications}</p>
          ${healthStatusHTML}
          ${alertHTML}
          <p>
            <span class="text-gray-500">Statut:</span> 
            <span class="inline-block px-2 py-0.5 rounded text-xs font-medium" 
                  style="background-color: ${getPolygonColor(parcelle.conformity_status)}20; color: ${getPolygonColor(parcelle.conformity_status)}">
              ${formatStatus(parcelle.conformity_status)}
            </span>
          </p>
        </div>
      </div>
    `;
  }, [getPolygonColor, deforestationAlerts]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create map instance with fullscreen control option
    const map = L.map(mapContainerRef.current, {
      center: CAMEROON_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      // Enable fullscreen control via leaflet-fullscreen plugin
      // @ts-expect-error - leaflet-fullscreen extends L.MapOptions
      fullscreenControl: enableFullscreen,
      fullscreenControlOptions: {
        position: 'topright',
        title: 'Plein écran',
        titleCancel: 'Quitter le plein écran',
      },
    });

    // Add tile layer based on prop
    let tileLayerUrl: string;
    let attribution: string;
    
    if (tileLayer === 'satellite') {
      // Esri World Imagery (satellite)
      tileLayerUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
    } else {
      // OpenStreetMap (default)
      tileLayerUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    }
    
    const tileLayerInstance = L.tileLayer(tileLayerUrl, {
      attribution,
      maxZoom: 19,
    }).addTo(map);
    
    baseTileLayerRef.current = tileLayerInstance;

    // Add labels overlay for satellite view
    if (tileLayer === 'satellite') {
      const labelsLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png',
        {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 19,
          pane: 'shadowPane',
        }
      ).addTo(map);
      
      labelsLayerRef.current = labelsLayer;
    }

    // Create layer groups
    polygonLayerRef.current = L.geoJSON(undefined, {
      style: () => ({
        fillOpacity: 0.4,
        weight: 2,
        opacity: 1,
      }),
    }).addTo(map);

    centroidLayerRef.current = L.layerGroup().addTo(map);

    // moveend already fires after both a pan and a zoom.
    const handleBoundsChange = () => {
      if (onBboxChangeRef.current) {
        const bounds = map.getBounds();
        const zoom = map.getZoom();
        onBboxChangeRef.current([
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ], zoom);
      }
    };
    
    map.on('moveend', handleBoundsChange);

    mapRef.current = map;

    // Cleanup on unmount
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [enableFullscreen]);

  // Update tile layer when tileLayer prop changes
  useEffect(() => {
    if (!mapRef.current || !baseTileLayerRef.current) return;

    let tileLayerUrl: string;
    let attribution: string;
    
    if (tileLayer === 'satellite') {
      tileLayerUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
    } else {
      tileLayerUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    }

    // Remove old tile layer
    baseTileLayerRef.current.remove();
    
    // Remove old labels layer if it exists
    if (labelsLayerRef.current) {
      labelsLayerRef.current.remove();
      labelsLayerRef.current = null;
    }
    
    // Add new tile layer
    const newTileLayer = L.tileLayer(tileLayerUrl, {
      attribution,
      maxZoom: 19,
    }).addTo(mapRef.current);
    
    baseTileLayerRef.current = newTileLayer;

    // Add labels overlay for satellite view
    if (tileLayer === 'satellite') {
      const labelsLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png',
        {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 19,
          pane: 'shadowPane',
        }
      ).addTo(mapRef.current);
      
      labelsLayerRef.current = labelsLayer;
    }
  }, [tileLayer]);

  // Fetch deforestation alerts for visible parcelles
  useEffect(() => {
    if (!showDeforestationAlerts || parcelles.length === 0) {
      setDeforestationAlerts({});
      return;
    }

    const fetchDeforestationAlerts = async () => {
      setIsLoadingAlerts(true);
      
      try {
        // Fetch alerts for all visible parcelles
        const alertPromises = parcelles.map(async (parcelle) => {
          try {
            const response = await fetch(
              `/api/satellite/deforestation?parcelleId=${parcelle.id}&status=pending`
            );
            
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data) {
                return {
                  parcelleId: parcelle.id,
                  count: result.data.summary?.pendingAlerts || 0,
                };
              }
            }
            return { parcelleId: parcelle.id, count: 0 };
          } catch (error) {
            console.error(`Failed to fetch alerts for parcelle ${parcelle.id}:`, error);
            return { parcelleId: parcelle.id, count: 0 };
          }
        });

        const results = await Promise.all(alertPromises);
        
        // Build alert count map
        const alertMap: Record<string, number> = {};
        results.forEach(({ parcelleId, count }) => {
          if (count > 0) {
            alertMap[parcelleId] = count;
          }
        });
        
        setDeforestationAlerts(alertMap);
      } catch (error) {
        console.error('Error fetching deforestation alerts:', error);
      } finally {
        setIsLoadingAlerts(false);
      }
    };

    fetchDeforestationAlerts();
  }, [parcelles, showDeforestationAlerts]);

  // Update parcelles on map
  useEffect(() => {
    if (!mapRef.current || !polygonLayerRef.current) return;

    // Clear existing layers
    polygonLayerRef.current.clearLayers();
    centroidLayerRef.current?.clearLayers();

    if (parcelles.length === 0) return;

    // Add parcelles as GeoJSON features
    const features = parcelles
      .filter((p) => p.geometry)
      .map((parcelle) => ({
        type: 'Feature' as const,
        properties: { ...parcelle },
        geometry: parcelle.geometry,
      }));

    if (features.length === 0) return;

    const geoJsonLayer = L.geoJSON(
      { type: 'FeatureCollection' as const, features } as GeoJSON.FeatureCollection,
      {
        style: (feature) => {
          const status = feature?.properties?.conformity_status || 'informations_manquantes';
          const isSelected = feature?.properties?.id === selectedId;
          const hasAlerts = feature?.properties?.id && deforestationAlerts[feature.properties.id] > 0;
          
          return {
            fillColor: getPolygonColor(status),
            fillOpacity: isSelected ? 0.6 : 0.4,
            color: hasAlerts ? '#dc2626' : (isSelected ? '#1f2937' : getPolygonColor(status)),
            weight: hasAlerts ? 4 : (isSelected ? 3 : 2),
            opacity: 1,
            dashArray: hasAlerts ? '10, 5' : undefined,
          };
        },
        onEachFeature: (feature, layer) => {
          const parcelle = feature.properties as Parcelle;
          
          // Add popup with loading state
          const popup = L.popup({
            maxWidth: 300,
            className: 'parcelle-popup-container',
          });
          
          // Set initial loading content
          popup.setContent(`
            <div class="parcelle-popup">
              <h3 class="font-semibold text-gray-900 mb-1">${parcelle.planteur?.name || 'Planteur inconnu'}</h3>
              <div class="text-sm space-y-1">
                <p class="text-gray-500">Chargement des données...</p>
              </div>
            </div>
          `);
          
          layer.bindPopup(popup);

          // Handle click - show popup AND highlight in list
          // We track mousedown position to distinguish a real click from a zoom gesture
          let mouseDownPos: L.Point | null = null;
          layer.on('mousedown', (e) => {
            mouseDownPos = mapRef.current?.latLngToContainerPoint(e.latlng) ?? null;
          });
          layer.on('click', async (e) => {
            // If the mouse moved more than 5px between mousedown and click,
            // it was likely a drag/zoom gesture, ignore it
            if (mouseDownPos && mapRef.current) {
              const clickPos = mapRef.current.latLngToContainerPoint(e.latlng);
              const dist = mouseDownPos.distanceTo(clickPos);
              if (dist > 5) return;
            }

            // Open popup at click location
            const popup = layer.getPopup();
            if (popup) {
              popup.setLatLng(e.latlng);
              layer.openPopup();
              
              // Load full content asynchronously
              const content = await formatPopupContent(parcelle);
              popup.setContent(content);
            }

            // Notify parent to highlight in list
            if (onSelect) {
              onSelect(parcelle);
            }
          });

          // Hover effects
          layer.on('mouseover', () => {
            const hasAlerts = parcelle.id && deforestationAlerts[parcelle.id] > 0;
            (layer as L.Path).setStyle({
              fillOpacity: 0.7,
              weight: hasAlerts ? 4 : 3,
            });
          });

          layer.on('mouseout', () => {
            const isSelected = parcelle.id === selectedId;
            const hasAlerts = parcelle.id && deforestationAlerts[parcelle.id] > 0;
            (layer as L.Path).setStyle({
              fillOpacity: isSelected ? 0.6 : 0.4,
              weight: hasAlerts ? 4 : (isSelected ? 3 : 2),
            });
          });
        },
      }
    );

    polygonLayerRef.current.addLayer(geoJsonLayer);

    // Add centroid markers if enabled
    if (showCentroids && centroidLayerRef.current) {
      parcelles.forEach((parcelle) => {
        if (parcelle.centroid) {
          const marker = L.circleMarker(
            [parcelle.centroid.lat, parcelle.centroid.lng],
            {
              radius: 5,
              fillColor: getPolygonColor(parcelle.conformity_status),
              fillOpacity: 1,
              color: '#fff',
              weight: 2,
            }
          );
          if (parcelle.code) {
            marker.bindTooltip(parcelle.code, { permanent: false });
          }
          centroidLayerRef.current?.addLayer(marker);
        }
      });
    }

    // Zoom to fit if requested, but only on first load, not on every bbox refetch
    // We use a ref to track if we've already done the initial fit
    if (zoomToFit || parcelles.length === 1) {
      if (!hasInitialFitRef.current) {
        hasInitialFitRef.current = true;
        const bounds = geoJsonLayer.getBounds();
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    }
  }, [parcelles, selectedId, showCentroids, zoomToFit, onSelect, getPolygonColor, formatPopupContent, deforestationAlerts]);

  // Handle initial bbox
  useEffect(() => {
    if (!mapRef.current || !bbox) return;
    
    const bounds = L.latLngBounds(
      [bbox[1], bbox[0]], // SW corner
      [bbox[3], bbox[2]]  // NE corner
    );
    
    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds);
    }
  }, [bbox]);

  // Zoom to selected parcelle when selectedId changes (if zoomToSelected is enabled)
  useEffect(() => {
    if (!mapRef.current || !selectedId || !zoomToSelected) return;

    // Only fly to the parcelle if the selection actually changed
    if (selectedId === prevSelectedIdRef.current) return;
    prevSelectedIdRef.current = selectedId;

    const selectedParcelle = parcelles.find((p) => p.id === selectedId);
    if (!selectedParcelle?.geometry) return;

    // Create a temporary GeoJSON layer to get bounds
    const tempLayer = L.geoJSON(selectedParcelle.geometry as GeoJSON.Geometry);
    const bounds = tempLayer.getBounds();

    if (bounds.isValid()) {
      mapRef.current.flyToBounds(bounds, {
        padding: [80, 80],
        duration: 0.5,
        maxZoom: 16,
      });
    }
  }, [selectedId, zoomToSelected, parcelles]);

  // Handle map style toggle
  const toggleMapStyle = useCallback(() => {
    if (!mapRef.current || !baseTileLayerRef.current) return;
    
    // Remove current tile layer
    mapRef.current.removeLayer(baseTileLayerRef.current);
    
    // Remove labels layer if it exists
    if (labelsLayerRef.current) {
      mapRef.current.removeLayer(labelsLayerRef.current);
      labelsLayerRef.current = null;
    }
    
    // Cycle through: streets -> satellite -> hybrid -> streets
    let newStyle: 'streets' | 'satellite' | 'hybrid';
    if (mapStyle === 'streets') {
      newStyle = 'satellite';
    } else if (mapStyle === 'satellite') {
      newStyle = 'hybrid';
    } else {
      newStyle = 'streets';
    }
    
    let newTileLayer: L.TileLayer;
    if (newStyle === 'satellite' || newStyle === 'hybrid') {
      // Google Satellite, meilleure couverture mondiale, y compris Afrique
      newTileLayer = L.tileLayer(
        'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        {
          attribution: '&copy; Google Maps',
          subdomains: ['0', '1', '2', '3'],
          maxZoom: 21,
          tileSize: 256,
        }
      ).addTo(mapRef.current);
      
      // Add labels overlay for hybrid mode or if showLabels is true in satellite mode
      if (newStyle === 'hybrid' || (newStyle === 'satellite' && showLabels)) {
        // Google hybrid labels overlay (routes + labels sur satellite)
        const labelsLayer = L.tileLayer(
          'https://mt{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',
          {
            attribution: '&copy; Google Maps',
            subdomains: ['0', '1', '2', '3'],
            maxZoom: 21,
            tileSize: 256,
            pane: 'shadowPane',
          }
        ).addTo(mapRef.current);
        
        labelsLayerRef.current = labelsLayer;
      }
    } else {
      // Use OpenStreetMap
      newTileLayer = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }
      ).addTo(mapRef.current);
    }
    
    baseTileLayerRef.current = newTileLayer;
    setMapStyle(newStyle);
  }, [mapStyle, showLabels]);

  // Toggle labels visibility (only in satellite mode)
  const toggleLabels = useCallback(() => {
    if (!mapRef.current || mapStyle !== 'satellite') return;
    
    const newShowLabels = !showLabels;
    setShowLabels(newShowLabels);
    
    if (newShowLabels) {
      // Add labels layer
      if (!labelsLayerRef.current) {
        const labelsLayer = L.tileLayer(
          'https://mt{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',
          {
            attribution: '&copy; Google Maps',
            subdomains: ['0', '1', '2', '3'],
            maxZoom: 21,
            tileSize: 256,
            pane: 'shadowPane',
          }
        ).addTo(mapRef.current);
        
        labelsLayerRef.current = labelsLayer;
      }
    } else {
      // Remove labels layer
      if (labelsLayerRef.current) {
        mapRef.current.removeLayer(labelsLayerRef.current);
        labelsLayerRef.current = null;
      }
    }
  }, [mapStyle, showLabels]);

  // Toggle satellite overlay visibility
  const toggleSatelliteOverlay = useCallback(() => {
    if (!showSatelliteOverlay) {
      // Show period selector when enabling overlay
      setShowPeriodSelector(true);
    } else {
      // Disable overlay
      setShowSatelliteOverlay(false);
      setShowPeriodSelector(false);
    }
  }, [showSatelliteOverlay]);

  // Toggle NDVI layer visibility
  const toggleNDVILayer = useCallback(() => {
    setShowNDVILayer((prev) => !prev);
  }, []);

  // Load imagery with selected period
  const loadImageryWithPeriod = useCallback((days: number) => {
    setSelectedPeriodDays(days);
    setShowSatelliteOverlay(true);
    setShowPeriodSelector(false);
    setCustomDays(''); // Reset custom input
  }, []);

  // Load imagery with custom period
  const loadImageryWithCustomPeriod = useCallback(() => {
    const days = parseInt(customDays, 10);
    if (isNaN(days) || days < 1 || days > 5475) {
      setImageryError('Veuillez entrer un nombre entre 1 et 5475 jours');
      return;
    }
    loadImageryWithPeriod(days);
  }, [customDays, loadImageryWithPeriod]);

  // Handle satellite overlay opacity change
  const handleSatelliteOpacityChange = useCallback((newOpacity: number) => {
    setSatelliteOpacity(newOpacity);
    if (satelliteTileLayerRef.current) {
      satelliteTileLayerRef.current.setOpacity(newOpacity);
    }
  }, []);

  // Handle NDVI layer opacity change
  const handleNDVIOpacityChange = useCallback((newOpacity: number) => {
    setNdviOpacity(newOpacity);
    if (ndviTileLayerRef.current) {
      ndviTileLayerRef.current.setOpacity(newOpacity);
    }
  }, []);

  // Update satellite tile layer when tile URL or visibility changes
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing satellite overlay if it exists
    if (satelliteTileLayerRef.current) {
      mapRef.current.removeLayer(satelliteTileLayerRef.current);
      satelliteTileLayerRef.current = null;
    }

    // Add satellite overlay if enabled and tile URL is available
    if (showSatelliteOverlay && satelliteTileUrl) {
      console.log('[LeafletMap] Adding satellite TileLayer with URL:', satelliteTileUrl.substring(0, 120));
      const satelliteLayer = L.tileLayer(satelliteTileUrl, {
        opacity: satelliteOpacity,
        maxZoom: 19,
        attribution: '&copy; Sentinel-2 via Google Earth Engine',
      }).addTo(mapRef.current);

      satelliteTileLayerRef.current = satelliteLayer;
    }
  }, [showSatelliteOverlay, satelliteTileUrl, satelliteOpacity]);

  // Update NDVI layer when raster URL or visibility changes
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing NDVI overlay if it exists
    if (ndviTileLayerRef.current) {
      mapRef.current.removeLayer(ndviTileLayerRef.current);
      ndviTileLayerRef.current = null;
    }

    // Add NDVI overlay if enabled and raster URL is available
    if (showNDVILayer && ndviRasterUrl && selectedId) {
      // Get the selected parcelle to determine bounds
      const selectedParcelle = parcelles.find((p) => p.id === selectedId);
      if (selectedParcelle?.geometry) {
        // Create a temporary GeoJSON layer to get bounds
        const tempLayer = L.geoJSON(selectedParcelle.geometry as GeoJSON.Geometry);
        const bounds = tempLayer.getBounds();

        if (bounds.isValid()) {
          // Create image overlay with parcelle bounds
          const ndviLayer = L.imageOverlay(ndviRasterUrl, bounds, {
            opacity: ndviOpacity,
            interactive: false,
            attribution: '&copy; NDVI Analysis',
          }).addTo(mapRef.current);

          ndviTileLayerRef.current = ndviLayer;
        }
      }
    }
  }, [showNDVILayer, ndviRasterUrl, ndviOpacity, selectedId, parcelles]);

  // Fetch satellite imagery when overlay is enabled and parcelle is selected
  useEffect(() => {
    if (!showSatelliteOverlay || !selectedId) {
      setSatelliteTileUrl(null);
      setImageryError(null);
      return;
    }

    const fetchSatelliteImagery = async () => {
      setIsLoadingImagery(true);
      setImageryError(null);
      
      try {
        const params = new URLSearchParams({
          parcelleId: selectedId,
          cloudCoverThreshold: '20',
          daysOffset: selectedPeriodDays.toString(),
        });

        const response = await fetch(`/api/satellite/imagery?${params.toString()}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown', message: response.statusText }));
          console.error('Failed to fetch satellite imagery:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            parcelleId: selectedId,
          });
          
          // Set user-friendly error message
          if (response.status === 404 || errorData.code === 'IMAGERY_UNAVAILABLE') {
            setImageryError('Imagerie satellite non disponible pour cette parcelle');
          } else if (response.status === 401 || response.status === 403) {
            setImageryError('Erreur d\'authentification avec Google Earth Engine');
          } else {
            setImageryError('Erreur lors du chargement de l\'imagerie satellite');
          }
          setIsLoadingImagery(false);
          return;
        }

        const data = await response.json();
        if (data.imagery?.tileUrl) {
          console.log('[LeafletMap] tileUrl received:', data.imagery.tileUrl.substring(0, 120));
          setSatelliteTileUrl(data.imagery.tileUrl);
          setImageryError(null);
        } else {
          setImageryError('Aucune imagerie disponible');
        }
      } catch (error) {
        console.error('Error fetching satellite imagery:', error);
        setImageryError('Erreur de connexion au serveur');
      } finally {
        setIsLoadingImagery(false);
      }
    };

    fetchSatelliteImagery();
  }, [showSatelliteOverlay, selectedId, selectedPeriodDays]);

  // Fetch NDVI data when NDVI layer is enabled and parcelle is selected
  useEffect(() => {
    if (!showNDVILayer || !selectedId) {
      setNdviRasterUrl(null);
      setNdviError(null);
      return;
    }

    const fetchNDVI = async () => {
      setIsLoadingNDVI(true);
      setNdviError(null);
      
      try {
        const response = await fetch('/api/satellite/ndvi', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            parcelleId: selectedId,
            forceRecalculate: false,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown', message: response.statusText }));
          console.error('Failed to fetch NDVI:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            parcelleId: selectedId,
          });
          
          // Set user-friendly error message
          if (response.status === 404 || errorData.code === 'IMAGERY_UNAVAILABLE') {
            setNdviError('Données NDVI non disponibles pour cette parcelle');
          } else if (response.status === 401 || response.status === 403) {
            setNdviError('Erreur d\'authentification');
          } else {
            setNdviError('Erreur lors du calcul du NDVI');
          }
          setIsLoadingNDVI(false);
          return;
        }

        const data = await response.json();
        if (data.data?.ndvi?.ndviRasterUrl) {
          setNdviRasterUrl(data.data.ndvi.ndviRasterUrl);
          setNdviError(null);
        } else {
          // NDVI calculated but no raster URL available
          // This is expected as per the current implementation
          setNdviError('Visualisation NDVI non disponible (raster non généré)');
        }
      } catch (error) {
        console.error('Error fetching NDVI:', error);
        setNdviError('Erreur de connexion au serveur');
      } finally {
        setIsLoadingNDVI(false);
      }
    };

    fetchNDVI();
  }, [showNDVILayer, selectedId]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Map Style Toggle */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <button
          onClick={toggleMapStyle}
          className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-lg transition-colors hover:bg-gray-50"
          title={
            mapStyle === 'streets' 
              ? 'Passer en vue satellite' 
              : mapStyle === 'satellite'
              ? 'Passer en vue hybride'
              : 'Passer en vue carte'
          }
        >
          {mapStyle === 'streets' ? (
            <>
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
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Satellite
            </>
          ) : mapStyle === 'satellite' ? (
            <>
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
                  d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z"
                />
              </svg>
              Hybride
            </>
          ) : (
            <>
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
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              Carte
            </>
          )}
        </button>

        {/* Labels Toggle (only visible in satellite mode) */}
        {mapStyle === 'satellite' && (
          <button
            onClick={toggleLabels}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow-lg transition-colors ${
              showLabels
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
            title={showLabels ? 'Masquer les labels' : 'Afficher les labels'}
          >
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
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            Labels
          </button>
        )}

        {/* Satellite Overlay Toggle */}
        {selectedId && (
          <>
            <button
              onClick={toggleSatelliteOverlay}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow-lg transition-colors ${
                showSatelliteOverlay
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title={
                showSatelliteOverlay
                  ? 'Masquer imagerie satellite'
                  : 'Afficher imagerie satellite'
              }
              disabled={isLoadingImagery}
            >
              {isLoadingImagery ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Chargement...
                </>
              ) : (
                <>
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
                      d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                    />
                  </svg>
                  Imagerie
                </>
              )}
            </button>

            {/* NDVI Layer Toggle */}
            <button
              onClick={toggleNDVILayer}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow-lg transition-colors ${
                showNDVILayer
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title={
                showNDVILayer
                  ? 'Masquer couche NDVI'
                  : 'Afficher couche NDVI'
              }
              disabled={isLoadingNDVI}
            >
              {isLoadingNDVI ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Chargement...
                </>
              ) : (
                <>
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
                      d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                    />
                  </svg>
                  NDVI
                </>
              )}
            </button>

            {/* Period Selector Panel */}
            {showPeriodSelector && (
              <div className="rounded-lg bg-white p-3 shadow-lg">
                <p className="mb-2 text-xs font-semibold text-gray-700">
                  Période historique
                </p>
                <div className="space-y-2">
                  {[
                    { days: 30, label: '30 jours' },
                    { days: 60, label: '60 jours' },
                    { days: 90, label: '90 jours' },
                    { days: 120, label: '120 jours' },
                    { days: 180, label: '6 mois' },
                    { days: 365, label: '1 an' },
                  ].map(({ days, label }) => (
                    <button
                      key={days}
                      onClick={() => loadImageryWithPeriod(days)}
                      className="w-full rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-green-100 hover:text-green-700"
                    >
                      {label}
                    </button>
                  ))}
                  
                  {/* Custom period input */}
                  <div className="border-t border-gray-200 pt-2">
                    <p className="mb-1.5 text-xs font-medium text-gray-600">
                      Période personnalisée
                    </p>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="5475"
                        value={customDays}
                        onChange={(e) => setCustomDays(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            loadImageryWithCustomPeriod();
                          }
                        }}
                        placeholder="Jours"
                        className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                      <button
                        onClick={loadImageryWithCustomPeriod}
                        disabled={!customDays}
                        className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        OK
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] text-gray-500">
                      Entre 1 et 5475 jours (15 ans)
                    </p>
                  </div>

                  <button
                    onClick={() => setShowPeriodSelector(false)}
                    className="w-full rounded bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-300"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Satellite Opacity Control (visible when overlay is active) */}
        {showSatelliteOverlay && satelliteTileUrl && (
          <div className="rounded-lg bg-white p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
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
              onChange={(e) =>
                handleSatelliteOpacityChange(parseFloat(e.target.value) / 100)
              }
              className="h-2 w-32 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-green-600"
              style={{
                background: `linear-gradient(to right, #16a34a 0%, #16a34a ${
                  satelliteOpacity * 100
                }%, #e5e7eb ${satelliteOpacity * 100}%, #e5e7eb 100%)`,
              }}
            />
          </div>
        )}

        {/* NDVI Opacity Control (visible when NDVI layer is active) */}
        {showNDVILayer && ndviRasterUrl && (
          <div className="rounded-lg bg-white p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="ndvi-opacity-slider"
                className="text-xs font-medium text-gray-700"
              >
                Opacité NDVI
              </label>
              <span className="text-xs text-gray-600">
                {Math.round(ndviOpacity * 100)}%
              </span>
            </div>
            <input
              id="ndvi-opacity-slider"
              type="range"
              min="0"
              max="100"
              value={ndviOpacity * 100}
              onChange={(e) =>
                handleNDVIOpacityChange(parseFloat(e.target.value) / 100)
              }
              className="h-2 w-32 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-emerald-600"
              style={{
                background: `linear-gradient(to right, #059669 0%, #059669 ${
                  ndviOpacity * 100
                }%, #e5e7eb ${ndviOpacity * 100}%, #e5e7eb 100%)`,
              }}
            />
          </div>
        )}

        {/* Error Message (visible when there's an error) */}
        {showSatelliteOverlay && imageryError && (
          <div className="rounded-lg bg-red-50 p-3 shadow-lg">
            <div className="flex items-start gap-2">
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
                <p className="text-xs font-medium text-red-800">
                  {imageryError}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* NDVI Error Message (visible when there's an NDVI error) */}
        {showNDVILayer && ndviError && (
          <div className="rounded-lg bg-orange-50 p-3 shadow-lg">
            <div className="flex items-start gap-2">
              <svg
                className="h-5 w-5 flex-shrink-0 text-orange-600"
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
                <p className="text-xs font-medium text-orange-800">
                  {ndviError}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg p-3 shadow-lg">
        <p className="mb-2 text-xs font-semibold text-gray-700">Légende</p>
        <div className="space-y-1">
          <LegendItem color={CONFORMITY_COLORS.conforme} label="Conforme" />
          <LegendItem color={CONFORMITY_COLORS.en_cours} label="En cours" />
          <LegendItem color={CONFORMITY_COLORS.non_conforme} label="Non conforme" />
          <LegendItem color={CONFORMITY_COLORS.informations_manquantes} label="Info. manquantes" />
          {showDeforestationAlerts && (
            <div className="pt-1 mt-1 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded border-2"
                  style={{ 
                    borderColor: '#dc2626',
                    borderStyle: 'dashed',
                    backgroundColor: 'transparent'
                  }}
                />
                <span className="text-xs text-gray-600">Alerte déforestation</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// Legend item component
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-3 w-3 rounded"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  );
}

// Format status for display
function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    conforme: 'Conforme',
    non_conforme: 'Non conforme',
    en_cours: 'En cours',
    informations_manquantes: 'Info. manquantes',
  };
  return statusMap[status] || status;
}

export default LeafletMap;