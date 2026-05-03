# Google Maps Satellite Imagery Integration

## Overview

This document describes the integration of satellite imagery overlay functionality with the GoogleMapClient component.

## Implementation Summary

### Changes Made

The `GoogleMapClient` component has been enhanced to support satellite imagery overlays with the following features:

1. **Satellite Overlay Toggle**: Users can show/hide satellite imagery for selected parcelles
2. **Opacity Control**: Adjustable opacity slider (0-100%) for the satellite overlay
3. **Loading States**: Visual feedback during imagery loading
4. **Error Handling**: User-friendly error messages with retry functionality
5. **Imagery Metadata Display**: Shows acquisition date, cloud cover, satellite source, and resolution

### Component Props

New props added to `GoogleMapClient`:

```typescript
interface GoogleMapClientProps {
  // ... existing props
  /** Enable satellite imagery overlay */
  enableSatelliteOverlay?: boolean;
  /** Initial satellite overlay opacity (0-1) */
  satelliteOverlayOpacity?: number;
}
```

### State Management

The component manages the following satellite-related state:

- `showSatelliteOverlay`: Boolean to control overlay visibility
- `satelliteOpacity`: Number (0-1) for overlay opacity
- `satelliteImagery`: ImageryData object containing imagery metadata
- `satelliteLoading`: Boolean for loading state
- `satelliteError`: String for error messages
- `imageMapTypeRef`: Ref to the Google Maps ImageMapType overlay

### API Integration

The component fetches satellite imagery from the `/api/satellite/imagery` endpoint with the following parameters:

- `parcelleId`: ID of the selected parcelle
- `cloudCoverThreshold`: Maximum acceptable cloud cover (default: 20%)

### Google Maps Integration

The satellite overlay is implemented using Google Maps' `ImageMapType`:

```typescript
const imageMapType = new google.maps.ImageMapType({
  getTileUrl: (coord, zoom) => satelliteImagery.tileUrl,
  tileSize: new google.maps.Size(256, 256),
  opacity: satelliteOpacity,
  name: 'Satellite Imagery',
});

map.overlayMapTypes.push(imageMapType);
```

### UI Components

#### Toggle Button
- Located in the top-right corner of the map
- Shows green when overlay is active, white when inactive
- Only visible when a parcelle is selected

#### Control Panel
- Located in the bottom-left corner of the map
- Displays imagery metadata (date, cloud cover, source, resolution)
- Contains opacity slider for adjusting overlay transparency
- Only visible when imagery is successfully loaded

#### Loading Indicator
- Shows a spinner with loading message
- Displayed while fetching imagery from the API

#### Error Display
- Shows error message with retry button
- Displayed when imagery fetch fails

### Parcelle Bounds Handling

The overlay respects parcelle bounds by:

1. Extracting bounds from the `ImageryData.bounds` property (GeoJSON BBox format)
2. Using the bounds to position the overlay correctly on the map
3. Ensuring the overlay only covers the selected parcelle area

### Lifecycle Management

The component properly manages the overlay lifecycle:

1. **Creation**: Overlay is created when imagery is loaded and overlay is enabled
2. **Update**: Overlay opacity updates when slider changes
3. **Removal**: Overlay is removed when:
   - User toggles overlay off
   - Different parcelle is selected
   - Component unmounts

### Error Handling

The implementation handles the following error scenarios:

- API request failures
- Network errors
- Invalid imagery data
- Missing parcelle geometry

All errors display user-friendly messages with retry functionality.

## Usage Example

```tsx
<GoogleMapClient
  parcelles={parcelles}
  selectedParcelleId={selectedId}
  onParcelleClick={handleParcelleClick}
  enableSatelliteOverlay={true}
  satelliteOverlayOpacity={0.7}
/>
```

## Dependencies

- `@react-google-maps/api`: Google Maps React wrapper
- `/api/satellite/imagery`: Satellite imagery API endpoint
- `@/lib/satellite/types`: TypeScript type definitions

## Future Enhancements

Potential improvements for future iterations:

1. **Tile Coordinate Calculation**: Implement proper tile coordinate calculation for better performance
2. **Caching**: Add client-side caching of imagery tiles
3. **Multiple Parcelles**: Support overlay for multiple parcelles simultaneously
4. **Temporal Slider**: Integrate temporal analysis slider for historical imagery
5. **NDVI Overlay**: Add NDVI visualization layer option

## Testing

The integration should be tested with:

1. Different parcelle sizes and geometries
2. Various cloud cover percentages
3. Network error scenarios
4. Rapid parcelle selection changes
5. Opacity slider interactions
6. Toggle button functionality

## Related Files

- `components/parcelles/GoogleMapClient.tsx`: Main component implementation
- `lib/satellite/types/index.ts`: Type definitions
- `app/api/satellite/imagery/route.ts`: API endpoint (to be implemented)
- `components/satellite/SatelliteImageryOverlay.tsx`: Standalone overlay component

## Notes

- The overlay is only shown when a parcelle is selected
- The implementation uses Google Maps' native overlay system for optimal performance
- All text is in French to match the application's localization
- The component maintains backward compatibility with existing GoogleMapClient usage
