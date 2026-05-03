# Satellite Imagery Components

This directory contains React components for satellite imagery analysis features in CocoaTrack.

## Components

### SatelliteImageryOverlay

Displays satellite imagery as a map overlay with opacity control and loading/error states.

**Features:**
- Automatic imagery fetching from API
- Loading state with spinner
- Error state with retry functionality
- Opacity slider control (0-100%)
- Cloud cover and acquisition date display
- Satellite source and resolution information

**Usage:**

```tsx
import { SatelliteImageryOverlay } from '@/components/satellite';

function MyMapComponent() {
  const handleImageryLoaded = (imagery) => {
    console.log('Imagery loaded:', imagery);
  };

  const handleError = (error) => {
    console.error('Failed to load imagery:', error);
  };

  return (
    <SatelliteImageryOverlay
      parcelleId="parcelle-123"
      opacity={0.7}
      cloudCoverThreshold={20}
      onImageryLoaded={handleImageryLoaded}
      onError={handleError}
    />
  );
}
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `parcelleId` | `string` | required | ID of the parcelle to display imagery for |
| `date` | `Date` | undefined | Optional specific date for imagery (defaults to most recent) |
| `opacity` | `number` | 0.7 | Initial opacity value (0-1) |
| `onOpacityChange` | `(opacity: number) => void` | undefined | Callback when opacity changes |
| `onImageryLoaded` | `(imagery: ImageryData) => void` | undefined | Callback when imagery loads successfully |
| `onError` | `(error: Error) => void` | undefined | Callback when an error occurs |
| `cloudCoverThreshold` | `number` | 20 | Cloud cover threshold (0-100) |

**States:**

- **Loading**: Displays a spinner with loading message
- **Error**: Shows error message with retry button
- **Success**: Displays imagery controls with opacity slider and metadata

## Testing

Tests are located in `__tests__/SatelliteImageryOverlay.test.tsx` and cover:

- Component rendering
- Loading state display
- Error state with retry functionality
- Opacity control
- API integration
- Callback invocation

Run tests with:

```bash
npm run test components/satellite
```

## Integration

The component is designed to work with both Leaflet and Google Maps implementations. The actual map overlay rendering should be handled by the parent map component using the imagery data and opacity value.

## API Dependencies

This component depends on the `/api/satellite/imagery` endpoint which should return:

```typescript
{
  imagery: {
    id: string;
    parcelleId: string;
    acquisitionDate: string; // ISO 8601
    cloudCoverPercent: number;
    satelliteSource: 'sentinel-2';
    tileUrl: string;
    bounds: [number, number, number, number];
    resolutionMeters: number;
    createdAt: string; // ISO 8601
  }
}
```

## Future Components

Additional components planned for this directory:

- `NDVILayer` - NDVI visualization overlay
- `TemporalSlider` - Timeline control for historical imagery
- `HealthStatusBadge` - Health status indicator
- `DeforestationAlert` - Deforestation event display
- `KMLExportButton` - KML export functionality
