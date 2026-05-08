# Satellite Imagery Analysis Examples

This directory contains example files demonstrating the satellite imagery analysis features of CocoaTrack.

## Files

### temporal-kml-sample.kml

A sample KML file demonstrating time-enabled visualization of NDVI evolution over 4 months (January - April 2024).

**Features demonstrated:**
- TimeStamp elements for temporal navigation
- ISO 8601 formatted timestamps
- Health status color coding (Good → Excellent → Fair → Good)
- Significant change detection (marked with ⚠ symbol)
- Folder organization for temporal data
- Detailed HTML descriptions with NDVI values and metadata

**How to use:**
1. Download the `temporal-kml-sample.kml` file
2. Open it in Google Earth Desktop or Google Earth Web
3. Enable the time slider: View > Show Time Slider (or Ctrl+Alt+T)
4. Use the time slider to navigate through the 4 temporal points
5. Click on the parcelle at each time point to see detailed NDVI information

**What to observe:**
- The parcelle color changes based on health status:
  - January: Green (Good, NDVI 0.75)
  - February: Dark Green (Excellent, NDVI 0.78)
  - March: Yellow (Fair, NDVI 0.55) - Significant change detected!
  - April: Green (Good, NDVI 0.65) - Recovery
- The March data point shows a significant change warning (⚠) due to NDVI drop > 0.15
- Cloud cover varies across dates (8% - 25%)

## Testing Temporal KML

### Manual Testing Steps

1. **Open in Google Earth Desktop**
   - Download and install [Google Earth Pro](https://www.google.com/earth/versions/#earth-pro)
   - Open the KML file: File > Open > Select `temporal-kml-sample.kml`
   - Verify the folder appears in the Places panel

2. **Enable Time Slider**
   - Go to View > Show Time Slider (or press Ctrl+Alt+T on Windows, Cmd+Alt+T on Mac)
   - The time slider should appear at the top of the 3D viewer
   - Verify it shows the date range: January 1, 2024 - April 1, 2024

3. **Navigate Through Time**
   - Move the time slider to January 1, 2024
   - Verify the parcelle appears in green (Good health status)
   - Click on the parcelle to see the description with NDVI 0.750
   - Move to February 1, 2024
   - Verify the parcelle changes to dark green (Excellent health status)
   - Click to see NDVI 0.780
   - Move to March 1, 2024
   - Verify the parcelle changes to yellow (Fair health status)
   - Click to see NDVI 0.550 and the significant change warning (⚠)
   - Move to April 1, 2024
   - Verify the parcelle returns to green (Good health status)
   - Click to see NDVI 0.650

4. **Test Animation**
   - Click the play button in the time slider
   - Verify the parcelle animates through the color changes
   - Adjust animation speed using the slider controls
   - Verify smooth transitions between dates

5. **Verify Description Content**
   - At each time point, click the parcelle
   - Verify the description includes:
     - Point number (e.g., "Point 1 de 4")
     - Date in French format (e.g., "1 janvier 2024")
     - NDVI value with 3 decimal places
     - Health status in French (Bon, Excellent, Moyen)
     - Cloud cover percentage
     - Significant change indicator (only for March)
     - Parcelle information (Code, Surface, Village)

### Google Earth Web Testing

1. **Open in Google Earth Web**
   - Go to [earth.google.com/web](https://earth.google.com/web)
   - Click the menu icon (☰) > Projects > Import KML file from computer
   - Select `temporal-kml-sample.kml`

2. **Enable Time Controls**
   - The time slider should appear automatically if temporal data is detected
   - If not, look for the clock icon in the toolbar

3. **Verify Functionality**
   - Follow the same navigation steps as desktop
   - Verify all features work in the web version

### Expected Results

✅ **Pass Criteria:**
- KML file opens without errors
- Folder structure is correct
- Time slider displays correct date range
- Parcelle appears at each time point
- Colors change according to health status
- Descriptions display correctly with all data
- Significant change warning appears for March
- Animation works smoothly
- All timestamps are in ISO 8601 format

❌ **Fail Criteria:**
- KML file fails to open
- Time slider doesn't appear
- Parcelle doesn't appear at some time points
- Colors don't match health status
- Descriptions are missing or malformed
- Timestamps are not in ISO 8601 format
- Animation is jerky or doesn't work

## Creating Your Own Temporal KML

To create temporal KML files for your parcelles:

```typescript
import { exportService } from '@/lib/satellite/services/export.service';

// Fetch temporal data for your parcelle
const temporal = await fetchTemporalData(parcelleId, startDate, endDate);

// Prepare export data
const data = [{
  parcelle: {
    id: parcelleId,
    code: 'P001',
    label: 'My Parcelle',
    village: 'Village Name',
    region: 'Centre',
    geometry: parcelleGeometry,
    surface_hectares: 2.5,
  },
  temporal: temporal,
}];

// Export with temporal option enabled
const kml = await exportService.exportKML(data, {
  includeTemporal: true,
  includeNDVI: true,
  includeDeforestation: false,
  format: 'kml',
});

// Save to file
const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `parcelle-${parcelleId}-temporal.kml`;
a.click();
```

## Troubleshooting

### Time Slider Doesn't Appear

**Problem:** The time slider doesn't appear in Google Earth.

**Solutions:**
1. Verify the KML file contains `<TimeStamp>` elements
2. Check that timestamps are in ISO 8601 format
3. Manually enable time slider: View > Show Time Slider
4. Restart Google Earth and try again

### Parcelle Doesn't Appear at Some Time Points

**Problem:** The parcelle disappears at certain dates.

**Solutions:**
1. Verify each temporal point has a corresponding placemark
2. Check that all placemarks have valid geometry
3. Ensure timestamps are sequential and valid
4. Verify the time slider range includes all dates

### Colors Don't Match Health Status

**Problem:** Parcelle colors don't correspond to health status.

**Solutions:**
1. Verify style definitions are included in the KML header
2. Check that each placemark references the correct style
3. Ensure health status values are valid (excellent, good, fair, poor, critical)
4. Verify color hex codes are correctly converted to KML format (AABBGGRR)

### Descriptions Are Malformed

**Problem:** HTML descriptions don't display correctly.

**Solutions:**
1. Verify descriptions are wrapped in `<![CDATA[...]]>` tags
2. Check that HTML is well-formed (all tags closed)
3. Ensure special characters are properly escaped
4. Test HTML in a browser before embedding in KML

## Additional Resources

- [KML 2.2 Reference](https://developers.google.com/kml/documentation/kmlreference)
- [Google Earth Time Slider Tutorial](https://www.google.com/earth/outreach/learn/visualizing-time-based-data/)
- [Temporal KML Export Documentation](../temporal-kml-export.md)
- [NDVI Calculation Guide](../ndvi-calculation.md)

## Support

For issues or questions about temporal KML export:
1. Check the [Temporal KML Export Documentation](../temporal-kml-export.md)
2. Review the test suite in `tests/satellite/services/export.service.test.ts`
3. Contact the development team
