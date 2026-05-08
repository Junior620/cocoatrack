# Temporal KML Export

## Overview

The temporal KML export feature allows users to visualize the evolution of parcelle vegetation health over time in Google Earth. This feature generates time-enabled KML files that display NDVI changes across multiple dates, enabling users to see how vegetation conditions have changed.

## Features

### Time-Enabled Visualization

- **TimeStamp Elements**: Each temporal data point is represented as a separate KML Placemark with a `<TimeStamp>` element
- **ISO 8601 Formatting**: All timestamps are formatted in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ) for compatibility with Google Earth
- **Historical NDVI Overlays**: Each placemark includes NDVI data and health status for that specific date
- **Folder Organization**: Temporal placemarks are grouped in a folder for easy navigation

### Data Included

Each temporal placemark includes:
- **Date**: Acquisition date of the satellite imagery
- **NDVI Value**: Normalized Difference Vegetation Index for that date
- **Health Status**: Color-coded health classification (Excellent, Good, Fair, Poor, Critical)
- **Cloud Cover**: Percentage of cloud cover in the imagery
- **Significant Changes**: Visual indicator when NDVI change exceeds 0.15 from previous measurement
- **Parcelle Information**: Code, surface area, village, and other metadata

## Usage

### Exporting Temporal KML

```typescript
import { exportService } from '@/lib/satellite/services/export.service';
import type { KMLExportData, KMLExportOptions } from '@/lib/satellite/types';

// Prepare data with temporal points
const data: KMLExportData[] = [
  {
    parcelle: {
      id: 'parcelle-id',
      code: 'P001',
      label: 'My Parcelle',
      village: 'Village Name',
      region: 'Centre',
      geometry: multiPolygonGeometry,
      surface_hectares: 2.5,
    },
    temporal: [
      {
        date: new Date('2024-01-01'),
        ndvi: 0.70,
        cloudCover: 15,
        healthStatus: 'good',
        hasSignificantChange: false,
      },
      {
        date: new Date('2024-02-01'),
        ndvi: 0.72,
        cloudCover: 10,
        healthStatus: 'good',
        hasSignificantChange: false,
      },
      {
        date: new Date('2024-03-01'),
        ndvi: 0.55,
        cloudCover: 20,
        healthStatus: 'fair',
        hasSignificantChange: true,
      },
    ],
  },
];

// Configure export options
const options: KMLExportOptions = {
  includeTemporal: true,
  includeNDVI: true,
  includeDeforestation: false,
  format: 'kml',
};

// Generate KML
const kml = await exportService.exportKML(data, options);

// Save to file or send to client
```

### Viewing in Google Earth

1. **Export KML File**: Use the export functionality to generate a KML file with temporal data
2. **Open in Google Earth**: Double-click the KML file or drag it into Google Earth
3. **Enable Time Slider**: In Google Earth, go to View > Show Time Slider (or press Ctrl+Alt+T)
4. **Navigate Through Time**: Use the time slider to move between dates and see how the parcelle's vegetation health has changed

## KML Structure

### Folder Organization

```xml
<Folder>
  <name>P001 - My Parcelle - Temporal Analysis</name>
  <description><![CDATA[Time-enabled visualization showing NDVI evolution from 1 janvier 2024 to 1 mars 2024]]></description>
  <open>0</open>
  
  <!-- Placemark for each temporal point -->
  <Placemark>
    <name>P001 - My Parcelle - 1 janvier 2024</name>
    <description><![CDATA[...]]></description>
    <styleUrl>#style_good</styleUrl>
    <TimeStamp>
      <when>2024-01-01T00:00:00.000Z</when>
    </TimeStamp>
    <MultiGeometry>
      <!-- Parcelle geometry -->
    </MultiGeometry>
  </Placemark>
  
  <!-- Additional placemarks for other dates -->
</Folder>
```

### TimeStamp Format

Each placemark includes a `<TimeStamp>` element with ISO 8601 formatted date:

```xml
<TimeStamp>
  <when>2024-01-01T00:00:00.000Z</when>
</TimeStamp>
```

This format is compatible with Google Earth's time slider and allows for precise temporal navigation.

### Health Status Styling

Each temporal placemark uses a color-coded style based on the health status:

- **Excellent** (NDVI 0.7-1.0): Dark Green (#2d5016)
- **Good** (NDVI 0.6-0.7): Green (#6FAF3D)
- **Fair** (NDVI 0.5-0.6): Yellow (#fbbf24)
- **Poor** (NDVI 0.3-0.5): Orange (#E68A1F)
- **Critical** (NDVI 0.0-0.3): Red (#ef4444)

The parcelle polygon is filled with the corresponding color, making it easy to visually identify health changes over time.

## Temporal Point Descriptions

Each temporal placemark includes a detailed HTML description with:

### NDVI Analysis Section
- NDVI value (3 decimal places)
- Health status (translated to French)
- Cloud cover percentage
- Significant change indicator (⚠ symbol when NDVI change > 0.15)

### Parcelle Information Section
- Code
- Surface area (hectares)
- Village
- Region (if available)

### Example Description

```html
<div style="font-family: Arial, sans-serif; font-size: 12px;">
  <h3 style="margin: 0 0 10px 0; color: #2d5016;">Point 1 de 3</h3>
  <p style="margin: 5px 0;"><strong>Date:</strong> 1 janvier 2024</p>
  
  <h4 style="margin: 10px 0 5px 0; color: #2d5016;">Analyse NDVI</h4>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 4px; font-weight: bold;">NDVI:</td><td style="padding: 4px;">0.700</td></tr>
    <tr><td style="padding: 4px; font-weight: bold;">État de Santé:</td><td style="padding: 4px;">Bon</td></tr>
    <tr><td style="padding: 4px; font-weight: bold;">Couverture Nuageuse:</td><td style="padding: 4px;">15.0%</td></tr>
  </table>
  
  <h4 style="margin: 10px 0 5px 0; color: #2d5016;">Informations de la Parcelle</h4>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 4px; font-weight: bold;">Code:</td><td style="padding: 4px;">P001</td></tr>
    <tr><td style="padding: 4px; font-weight: bold;">Surface:</td><td style="padding: 4px;">2.50 ha</td></tr>
    <tr><td style="padding: 4px; font-weight: bold;">Village:</td><td style="padding: 4px;">Village Name</td></tr>
  </table>
</div>
```

## Significant Change Detection

The system automatically detects and highlights significant vegetation changes:

- **Threshold**: NDVI change > 0.15 from previous measurement
- **Visual Indicator**: ⚠ symbol in the description
- **Flag**: `hasSignificantChange` boolean in temporal data

This helps users quickly identify dates when major vegetation changes occurred, which could indicate:
- Deforestation events
- Seasonal changes
- Agricultural interventions
- Natural disasters

## Best Practices

### Data Preparation

1. **Sort Temporal Data**: Ensure temporal data points are sorted chronologically
2. **Consistent Intervals**: Use consistent time intervals (monthly, weekly) for better visualization
3. **Quality Control**: Filter out data points with excessive cloud cover (>30%)
4. **Minimum Points**: Include at least 3 temporal points for meaningful trend analysis

### Export Configuration

1. **Include NDVI**: Always set `includeNDVI: true` for temporal exports
2. **Date Range**: Limit temporal range to 12 months for optimal performance
3. **File Size**: Be mindful of file size when exporting many parcelles with temporal data
4. **Format**: Use KML format for Google Earth compatibility (KMZ compression coming soon)

### Google Earth Tips

1. **Time Slider**: Enable the time slider to navigate through temporal data
2. **Animation**: Use the play button in the time slider to animate changes over time
3. **Speed Control**: Adjust animation speed for better visualization
4. **Zoom Level**: Zoom to appropriate level to see parcelle details clearly
5. **Layer Management**: Use folders to organize multiple parcelles

## Technical Details

### ISO 8601 Timestamp Format

The `formatISO8601()` method converts JavaScript Date objects to ISO 8601 format:

```typescript
private formatISO8601(date: Date): string {
  return new Date(date).toISOString();
}
```

This produces timestamps like: `2024-01-01T00:00:00.000Z`

### TimeStamp vs TimeSpan

The implementation uses `<TimeStamp>` elements rather than `<TimeSpan>` elements:

- **TimeStamp**: Represents a single point in time (used for discrete measurements)
- **TimeSpan**: Represents a time range (used for events with duration)

For NDVI measurements, TimeStamp is more appropriate as each measurement represents a specific acquisition date.

### Folder Structure

Temporal placemarks are grouped in a folder with:
- **Name**: Includes parcelle identifier and "Temporal Analysis"
- **Description**: Shows date range of temporal data
- **Open**: Set to 0 (collapsed by default) to avoid cluttering the places panel

## Limitations

1. **Google Earth Required**: Temporal visualization requires Google Earth desktop or web application
2. **File Size**: Large temporal datasets can result in large KML files
3. **Browser Support**: Some browsers may have issues with large KML files
4. **Animation Performance**: Many parcelles with temporal data may slow down animation

## Future Enhancements

1. **KMZ Compression**: Implement KMZ format to reduce file size
2. **TimeSpan Support**: Add support for time ranges (e.g., harvest seasons)
3. **Network Links**: Implement network links for dynamic data loading
4. **Custom Icons**: Add custom icons for significant change events
5. **Tour Generation**: Create automated tours through temporal data

## Related Documentation

- [KML Export](./kml-export.md)
- [Temporal Analysis](./temporal-analysis.md)
- [NDVI Calculation](./ndvi-calculation.md)
- [Google Earth Engine Setup](./gee-setup.md)

## References

- [KML 2.2 Specification](https://developers.google.com/kml/documentation/kmlreference)
- [Google Earth Time Slider](https://www.google.com/earth/outreach/learn/visualizing-time-based-data/)
- [ISO 8601 Date Format](https://en.wikipedia.org/wiki/ISO_8601)
