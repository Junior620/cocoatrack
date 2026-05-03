# Leaflet Map Satellite Imagery Integration

## Overview

This document describes the integration of satellite imagery overlay functionality into the LeafletMap component.

## Implementation Summary

### Changes Made

#### 1. Component Props
Added new props to `LeafletMapProps`:
- `enableSatelliteOverlay?: boolean` - Enable/disable satellite imagery overlay feature
- `satelliteOverlayOpacity?: number` - Initial opacity value (0-1) for the overlay

#### 2. State Management
Added state variables to manage satellite overlay:
- `showSatelliteOverlay` - Controls visibility of the satellite overlay
- `satelliteOpacity` - Controls opacity of the satellite overlay (0-1)
- `satelliteTileUrl` - Stores the tile URL from the imagery API
- `satelliteTileLayerRef` - Ref to the Leaflet tile layer for the satellite overlay

#### 3. Satellite Imagery Fetching
Implemented automatic fetching of satellite imagery when:
- A parcelle is selected (`selectedId` changes)
- Satellite overlay is enabled (`showSatelliteOverlay` is true)

The fetch logic:
- Calls `/api/satellite/imagery` endpoint with `parcelleId` and `cloudCoverThreshold` parameters
- Extracts the `tileUrl` from the response
- Updates the `satelliteTileUrl` state

#### 4. Tile Layer Management
Created a useEffect hook that:
- Removes existing satellite tile layer when visibility changes
- Adds new satellite tile layer when enabled and tile URL is available
- Uses Leaflet's `L.tileLayer()` with:
  - Dynamic opacity control
  - Max zoom level of 19
  - Attribution to Sentinel-2 via Google Earth Engine

#### 5. User Interface Controls

##### Satellite Overlay Toggle Button
- Appears when a parcelle is selected
- Green background when active, white when inactive
- Cloud icon for visual identification
- French labels: "Imagerie"

##### Opacity Slider
- Appears when satellite overlay is active and tile URL is loaded
- Range: 0-100%
- Real-time opacity adjustment
- Visual gradient indicator showing current opacity level
- Green accent color matching the toggle button

#### 6. Integration with Existing Map Controls
The satellite overlay controls are positioned in the top-right control panel alongside:
- Map style toggle (Streets/Satellite/Hybrid)
- Labels toggle (for satellite mode)

## Usage

### Basic Usage

```tsx
<LeafletMap
  parcelles={parcelles}
  selectedId={selectedParcelleId}
  enableSatelliteOverlay={true}
  satelliteOverlayOpacity={0.7}
  onSelect={handleParcelleSelect}
/>
```

### User Workflow

1. User selects a parcelle on the map
2. "Imagerie" button appears in the top-right controls
3. User clicks "Imagerie" to enable satellite overlay
4. System fetches satellite imagery for the selected parcelle
5. Satellite imagery displays as a tile layer over the base map
6. User can adjust opacity using the slider that appears
7. User can toggle overlay on/off without re-fetching data

## Technical Details

### API Integration

The component integrates with the satellite imagery API:

**Endpoint**: `GET /api/satellite/imagery`

**Query Parameters**:
- `parcelleId` (required): UUID of the parcelle
- `cloudCoverThreshold` (optional): Maximum acceptable cloud cover percentage (default: 20)

**Response**:
```json
{
  "imagery": {
    "tileUrl": "https://...",
    "acquisitionDate": "2024-05-03T00:00:00Z",
    "cloudCoverPercent": 15.2,
    ...
  }
}
```

### Leaflet Integration

The satellite overlay uses Leaflet's `L.TileLayer`:

```typescript
const satelliteLayer = L.tileLayer(satelliteTileUrl, {
  opacity: satelliteOpacity,
  maxZoom: 19,
  attribution: '&copy; Sentinel-2 via Google Earth Engine',
}).addTo(mapRef.current);
```

### Parcelle Bounds Respect

The satellite imagery automatically respects parcelle bounds because:
1. The imagery API returns tiles specific to the parcelle geometry
2. The tile layer is added to the same map instance as the parcelle polygons
3. Leaflet's coordinate system ensures proper alignment

## Error Handling

The implementation includes basic error handling:
- Console logging of fetch errors
- Graceful degradation if imagery is unavailable
- No error UI displayed to avoid cluttering the map interface

## Future Enhancements

Potential improvements for future iterations:
1. Loading indicator while fetching imagery
2. Error toast notifications for failed requests
3. Imagery metadata display (acquisition date, cloud cover)
4. Date picker for historical imagery
5. Caching of tile URLs to reduce API calls
6. Support for multiple parcelle selection

## Dependencies

- Leaflet 1.9.4+
- Next.js 14+
- Satellite imagery API endpoint (`/api/satellite/imagery`)
- Google Earth Engine integration (backend)

## Testing

To test the integration:
1. Ensure the satellite imagery API is configured and running
2. Select a parcelle on the map
3. Click the "Imagerie" button
4. Verify satellite imagery appears over the parcelle
5. Adjust opacity slider and verify changes
6. Toggle overlay off and verify it disappears
7. Select a different parcelle and verify imagery updates

## Acceptance Criteria Met

✅ Update `components/parcelles/LeafletMap.tsx`
✅ Add satellite imagery layer using L.TileLayer
✅ Implement layer toggle (show/hide satellite overlay)
✅ Add opacity control integration
✅ Ensure overlay respects parcelle bounds
✅ Satellite imagery displays on Leaflet map

## Related Files

- `components/parcelles/LeafletMap.tsx` - Main implementation
- `lib/satellite/types/index.ts` - TypeScript types
- `components/satellite/SatelliteImageryOverlay.tsx` - Standalone overlay component (not used in this integration)
- `.kiro/specs/satellite-imagery-analysis/tasks.md` - Task specification

## Notes

- The implementation uses direct API calls rather than the `SatelliteImageryOverlay` component to maintain a cleaner integration with the existing LeafletMap architecture
- The satellite overlay is only available when a parcelle is selected to ensure relevant imagery is displayed
- The opacity control provides a better user experience than a simple on/off toggle
- The green color scheme for satellite controls differentiates them from other map controls
