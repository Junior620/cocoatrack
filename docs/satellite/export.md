# Satellite Data Export Documentation

## Overview

The CocoaTrack satellite imagery analysis system provides multiple export formats to enable data sharing, offline analysis, and integration with external tools. This document explains the available export options, file formats, and usage examples.

## Export Formats

### 1. KML Export

**Purpose**: Export parcelle data with satellite analysis results for visualization in Google Earth Pro, Google Earth Web, or other KML-compatible applications.

**Use Cases**:
- Share parcelle analysis with stakeholders
- Visualize NDVI trends in Google Earth
- Create presentations with satellite imagery overlays
- Offline analysis in Google Earth Pro
- Integration with GIS workflows

#### KML Export Options

```typescript
interface KMLExportOptions {
  includeTemporal: boolean;      // Include historical NDVI data with time slider
  includeNDVI: boolean;          // Include NDVI color-coded overlay
  includeDeforestation: boolean; // Include deforestation alerts
  startDate?: Date;              // Start date for temporal data
  endDate?: Date;                // End date for temporal data
  format: 'kml' | 'kmz';        // KML (XML) or KMZ (compressed)
}
```

#### KML File Structure

A standard KML export includes:

1. **Parcelle Boundary**: Polygon geometry with coordinates
2. **NDVI Color Coding**: Style element with color based on health status
3. **Metadata**: Parcelle information in description field
4. **Time-Enabled Data** (optional): Historical NDVI with TimeSpan elements

**Example KML Structure**:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>CocoaTrack Parcelle Export</name>
    <description>Satellite imagery analysis for parcelle</description>
    
    <!-- Style definitions for health status -->
    <Style id="excellent">
      <LineStyle>
        <color>ff16502d</color>
        <width>2</width>
      </LineStyle>
      <PolyStyle>
        <color>7f16502d</color>
      </PolyStyle>
    </Style>
    
    <Style id="good">
      <LineStyle>
        <color>ff3DAF6F</color>
        <width>2</width>
      </LineStyle>
      <PolyStyle>
        <color>7f3DAF6F</color>
      </PolyStyle>
    </Style>
    
    <!-- Parcelle placemark -->
    <Placemark>
      <name>Parcelle ABC-001</name>
      <description><![CDATA[
        <h3>Parcelle Information</h3>
        <table>
          <tr><td><b>Surface Area:</b></td><td>2.5 hectares</td></tr>
          <tr><td><b>Mean NDVI:</b></td><td>0.72</td></tr>
          <tr><td><b>Health Status:</b></td><td>Excellent</td></tr>
          <tr><td><b>Last Analysis:</b></td><td>2024-05-08</td></tr>
          <tr><td><b>Planteur:</b></td><td>Jean Dupont</td></tr>
          <tr><td><b>Cooperative:</b></td><td>Coop Centrale</td></tr>
        </table>
      ]]></description>
      <styleUrl>#excellent</styleUrl>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              11.5123,4.0456,0
              11.5145,4.0456,0
              11.5145,4.0478,0
              11.5123,4.0478,0
              11.5123,4.0456,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>
```

#### Time-Enabled KML

When `includeTemporal: true`, the KML includes TimeSpan elements for historical data:

```xml
<Placemark>
  <name>Parcelle ABC-001 - January 2024</name>
  <TimeSpan>
    <begin>2024-01-01T00:00:00Z</begin>
    <end>2024-01-31T23:59:59Z</end>
  </TimeSpan>
  <description>Mean NDVI: 0.68 (Good)</description>
  <styleUrl>#good</styleUrl>
  <Polygon>
    <!-- Geometry -->
  </Polygon>
</Placemark>
```

This enables the time slider in Google Earth to visualize NDVI changes over time.

#### Health Status Color Mapping

| Health Status | Color (ABGR) | RGB Hex | Visual |
|--------------|--------------|---------|--------|
| Excellent | `ff16502d` | `#2d5016` | Dark Green |
| Good | `ff3DAF6F` | `#6FAF3D` | Green |
| Fair | `ff24bffb` | `#fbbf24` | Yellow |
| Poor | `ff1F8AE6` | `#E68A1F` | Orange |
| Critical | `ff4444ef` | `#ef4444` | Red |

**Note**: KML uses ABGR (Alpha-Blue-Green-Red) format, not RGB.

### 2. CSV Export

**Purpose**: Export temporal NDVI data as comma-separated values for analysis in spreadsheet applications or statistical software.

**Use Cases**:
- Statistical analysis in Excel, R, or Python
- Create custom charts and visualizations
- Integration with business intelligence tools
- Historical trend analysis
- Yield correlation studies

#### CSV Format Specification

**Column Headers**:
```
date,mean_ndvi,min_ndvi,max_ndvi,std_dev_ndvi,health_status,cloud_cover_percent,change_from_previous,percent_change
```

**Data Types**:
- `date`: ISO 8601 date format (YYYY-MM-DD)
- `mean_ndvi`: Decimal number (-1.0 to 1.0)
- `min_ndvi`: Decimal number (-1.0 to 1.0)
- `max_ndvi`: Decimal number (-1.0 to 1.0)
- `std_dev_ndvi`: Decimal number (0.0 to 1.0)
- `health_status`: String (excellent, good, fair, poor, critical)
- `cloud_cover_percent`: Integer (0 to 100)
- `change_from_previous`: Decimal number (difference from previous measurement)
- `percent_change`: Decimal number (percentage change from previous)

**Example CSV Content**:

```csv
date,mean_ndvi,min_ndvi,max_ndvi,std_dev_ndvi,health_status,cloud_cover_percent,change_from_previous,percent_change
2024-01-15,0.6800,0.4200,0.8500,0.0850,good,12,0.0000,0.00
2024-02-15,0.7200,0.4800,0.8800,0.0720,excellent,8,0.0400,5.88
2024-03-15,0.7500,0.5200,0.9000,0.0680,excellent,15,0.0300,4.17
2024-04-15,0.7100,0.4500,0.8600,0.0750,excellent,18,-0.0400,-5.33
2024-05-15,0.6500,0.4000,0.8200,0.0820,good,22,-0.0600,-8.45
```

#### CSV Encoding

- **Character Encoding**: UTF-8 with BOM (for Excel compatibility)
- **Line Endings**: CRLF (`\r\n`) for Windows compatibility
- **Decimal Separator**: Period (`.`)
- **Thousands Separator**: None
- **Quoted Fields**: Fields containing commas, quotes, or newlines are quoted
- **Null Values**: Empty string for missing data

### 3. PDF Certification Reports

**Purpose**: Generate EUDR compliance reports with satellite imagery analysis for certification audits.

**Use Cases**:
- EUDR compliance verification
- Certification audit documentation
- Stakeholder reporting
- Legal documentation
- Archive records

#### Report Sections

1. **Cover Page**
   - Report title
   - Parcelle identification
   - Generation date
   - Compliance status indicator

2. **Parcelle Information**
   - Parcelle name and code
   - Surface area
   - GPS coordinates
   - Planteur information
   - Cooperative affiliation

3. **Satellite Imagery Comparison**
   - Baseline imagery (December 31, 2020)
   - Current imagery
   - Side-by-side comparison

4. **NDVI Analysis**
   - Current NDVI value and health status
   - 12-month NDVI trend chart
   - Significant change events

5. **Deforestation Analysis**
   - Baseline NDVI vs. current NDVI
   - Vegetation change calculation
   - Affected area (if applicable)
   - Compliance determination

6. **Declaration Statement**
   - Certification statement
   - Digital signature
   - Timestamp
   - Auditor credentials

7. **Appendix**
   - Methodology explanation
   - Data sources
   - Accuracy statements
   - Contact information

## API Endpoints

### Export KML

**Endpoint**: `POST /api/satellite/export/kml`

**Request Body**:
```json
{
  "parcelleIds": ["uuid-1", "uuid-2"],
  "options": {
    "includeTemporal": true,
    "includeNDVI": true,
    "includeDeforestation": false,
    "startDate": "2024-01-01",
    "endDate": "2024-05-08",
    "format": "kmz"
  }
}
```

**Response**:
```json
{
  "fileUrl": "https://storage.supabase.co/v1/object/public/kml-exports/parcelle-export-20240508.kmz",
  "fileName": "parcelle-export-20240508.kmz",
  "fileSize": 245678,
  "expiresAt": "2024-05-15T12:00:00Z"
}
```

**cURL Example**:
```bash
curl -X POST https://cocoatrack.app/api/satellite/export/kml \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parcelleIds": ["abc-123"],
    "options": {
      "includeTemporal": true,
      "includeNDVI": true,
      "format": "kmz"
    }
  }'
```

### Export CSV

**Endpoint**: `POST /api/satellite/export/csv`

**Request Body**:
```json
{
  "parcelleId": "uuid-1",
  "startDate": "2024-01-01",
  "endDate": "2024-05-08"
}
```

**Response**:
```json
{
  "csvContent": "date,mean_ndvi,min_ndvi,...\n2024-01-15,0.68,0.42,...",
  "fileName": "parcelle-abc-001-ndvi-temporal.csv"
}
```

**cURL Example**:
```bash
curl -X POST https://cocoatrack.app/api/satellite/export/csv \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parcelleId": "abc-123",
    "startDate": "2024-01-01",
    "endDate": "2024-05-08"
  }' \
  --output parcelle-ndvi.csv
```

### Generate Certification Report

**Endpoint**: `POST /api/satellite/reports/certification`

**Request Body**:
```json
{
  "parcelleId": "uuid-1",
  "options": {
    "includeBeforeAfter": true,
    "includeNDVITrend": true,
    "includeYieldPrediction": false,
    "baselineDate": "2020-12-31",
    "language": "fr"
  }
}
```

**Response**:
```json
{
  "reportUrl": "https://storage.supabase.co/v1/object/public/certification-reports/report-abc-123.pdf",
  "reportId": "report-uuid",
  "generatedAt": "2024-05-08T14:30:00Z",
  "expiresAt": "2025-05-08T14:30:00Z"
}
```

## Usage Examples

### Example 1: Export Single Parcelle as KML

**Scenario**: Export a single parcelle with NDVI overlay for Google Earth visualization.

**Code (TypeScript/React)**:
```typescript
import { useState } from 'react';

function ExportKMLButton({ parcelleId }: { parcelleId: string }) {
  const [loading, setLoading] = useState(false);
  
  const handleExport = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/satellite/export/kml', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          parcelleIds: [parcelleId],
          options: {
            includeTemporal: false,
            includeNDVI: true,
            includeDeforestation: false,
            format: 'kml',
          },
        }),
      });
      
      const data = await response.json();
      
      // Trigger download
      window.open(data.fileUrl, '_blank');
      
      alert(`KML exported successfully: ${data.fileName}`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <button onClick={handleExport} disabled={loading}>
      {loading ? 'Exporting...' : 'Export as KML'}
    </button>
  );
}
```

### Example 2: Export Multiple Parcelles with Temporal Data

**Scenario**: Export all parcelles in a cooperative with 12-month NDVI history.

**Code (TypeScript/React)**:
```typescript
async function exportCooperativeParcelles(cooperativeId: string) {
  // 1. Get all parcelle IDs for cooperative
  const parcelles = await fetchParcellesByCooperative(cooperativeId);
  const parcelleIds = parcelles.map(p => p.id);
  
  // 2. Calculate date range (last 12 months)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 12);
  
  // 3. Export as KMZ (compressed)
  const response = await fetch('/api/satellite/export/kml', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify({
      parcelleIds,
      options: {
        includeTemporal: true,
        includeNDVI: true,
        includeDeforestation: true,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        format: 'kmz', // Compressed for smaller file size
      },
    }),
  });
  
  const data = await response.json();
  
  // Download file
  const link = document.createElement('a');
  link.href = data.fileUrl;
  link.download = data.fileName;
  link.click();
  
  return data;
}
```

### Example 3: Export Temporal NDVI as CSV

**Scenario**: Export 6-month NDVI data for statistical analysis.

**Code (TypeScript/React)**:
```typescript
async function exportTemporalCSV(parcelleId: string) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 6);
  
  const response = await fetch('/api/satellite/export/csv', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify({
      parcelleId,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    }),
  });
  
  const data = await response.json();
  
  // Create blob and download
  const blob = new Blob([data.csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = data.fileName;
  link.click();
  
  // Clean up
  URL.revokeObjectURL(link.href);
}
```

### Example 4: Generate EUDR Certification Report

**Scenario**: Generate compliance report for certification audit.

**Code (TypeScript/React)**:
```typescript
async function generateCertificationReport(parcelleId: string) {
  const response = await fetch('/api/satellite/reports/certification', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify({
      parcelleId,
      options: {
        includeBeforeAfter: true,
        includeNDVITrend: true,
        includeYieldPrediction: true,
        baselineDate: '2020-12-31', // EUDR baseline
        language: 'fr', // French language
      },
    }),
  });
  
  const data = await response.json();
  
  // Open PDF in new tab
  window.open(data.reportUrl, '_blank');
  
  return {
    reportId: data.reportId,
    reportUrl: data.reportUrl,
    generatedAt: new Date(data.generatedAt),
  };
}
```

### Example 5: Batch Export with Progress Tracking

**Scenario**: Export multiple parcelles with progress indicator.

**Code (TypeScript/React)**:
```typescript
import { useState } from 'react';

function BatchExportComponent({ parcelleIds }: { parcelleIds: string[] }) {
  const [progress, setProgress] = useState(0);
  const [exporting, setExporting] = useState(false);
  
  const handleBatchExport = async () => {
    setExporting(true);
    setProgress(0);
    
    const batchSize = 10; // Export 10 parcelles at a time
    const batches = [];
    
    // Split into batches
    for (let i = 0; i < parcelleIds.length; i += batchSize) {
      batches.push(parcelleIds.slice(i, i + batchSize));
    }
    
    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      try {
        await fetch('/api/satellite/export/kml', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`,
          },
          body: JSON.stringify({
            parcelleIds: batch,
            options: {
              includeTemporal: false,
              includeNDVI: true,
              format: 'kmz',
            },
          }),
        });
        
        // Update progress
        setProgress(((i + 1) / batches.length) * 100);
      } catch (error) {
        console.error(`Batch ${i + 1} failed:`, error);
      }
    }
    
    setExporting(false);
    alert('Batch export completed!');
  };
  
  return (
    <div>
      <button onClick={handleBatchExport} disabled={exporting}>
        Export {parcelleIds.length} Parcelles
      </button>
      {exporting && (
        <div>
          <progress value={progress} max={100} />
          <span>{Math.round(progress)}% complete</span>
        </div>
      )}
    </div>
  );
}
```

## File Size Considerations

### KML File Sizes

**Factors Affecting Size**:
- Number of parcelles
- Geometry complexity (number of vertices)
- Temporal data points
- Embedded imagery (if included)

**Typical Sizes**:
- Single parcelle (no temporal): 5-20 KB
- Single parcelle (12-month temporal): 50-200 KB
- 10 parcelles (no temporal): 50-200 KB
- 10 parcelles (12-month temporal): 500 KB - 2 MB
- 100 parcelles (no temporal): 500 KB - 2 MB

**Optimization Tips**:
- Use KMZ format (compressed) for large exports
- Limit temporal data to necessary date range
- Simplify geometry if parcelle has many vertices
- Exclude deforestation data if not needed

### CSV File Sizes

**Typical Sizes**:
- 12 months (monthly interval): 1-2 KB
- 12 months (weekly interval): 3-5 KB
- 12 months (daily interval): 15-30 KB

### PDF Report Sizes

**Typical Sizes**:
- Basic report (no imagery): 100-200 KB
- Standard report (with imagery): 500 KB - 2 MB
- Comprehensive report (multiple images): 2-5 MB

## Error Handling

### Common Export Errors

#### 1. Parcelle Not Found

**Error Response**:
```json
{
  "error": {
    "code": "PARCELLE_NOT_FOUND",
    "message": "Parcelle with ID 'abc-123' not found",
    "retryable": false
  }
}
```

**Resolution**: Verify parcelle ID is correct.

#### 2. Insufficient Data

**Error Response**:
```json
{
  "error": {
    "code": "INSUFFICIENT_DATA",
    "message": "No NDVI data available for the specified date range",
    "details": {
      "requestedRange": {
        "start": "2024-01-01",
        "end": "2024-05-08"
      },
      "availableRange": {
        "start": "2024-03-01",
        "end": "2024-05-08"
      }
    },
    "retryable": false,
    "suggestedAction": "Adjust date range to available data"
  }
}
```

**Resolution**: Adjust date range or calculate NDVI for missing dates.

#### 3. Export Too Large

**Error Response**:
```json
{
  "error": {
    "code": "EXPORT_TOO_LARGE",
    "message": "Export exceeds maximum file size of 10 MB",
    "details": {
      "estimatedSize": 12582912,
      "maxSize": 10485760
    },
    "retryable": false,
    "suggestedAction": "Reduce number of parcelles or date range"
  }
}
```

**Resolution**: Split export into smaller batches or use KMZ format.

#### 4. Rate Limit Exceeded

**Error Response**:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many export requests. Please try again in 60 seconds.",
    "retryable": true,
    "retryAfter": 60
  }
}
```

**Resolution**: Wait and retry after specified time.

## Best Practices

### 1. Choose the Right Format

- **KML/KMZ**: For visualization and sharing with non-technical stakeholders
- **CSV**: For statistical analysis and custom visualizations
- **PDF**: For official documentation and compliance reporting

### 2. Optimize Export Size

- Use KMZ (compressed) for large exports
- Limit temporal data to necessary date range
- Export in batches for large numbers of parcelles
- Exclude unnecessary options (e.g., deforestation data if not needed)

### 3. Handle Errors Gracefully

- Implement retry logic for transient errors
- Provide clear error messages to users
- Log errors for debugging
- Offer alternative actions when export fails

### 4. Respect Rate Limits

- Implement exponential backoff for retries
- Batch exports to reduce API calls
- Cache export results when possible
- Monitor API usage to avoid hitting limits

### 5. Secure Exported Data

- Exported files contain sensitive parcelle data
- Use secure HTTPS URLs for file downloads
- Set appropriate expiration times for temporary files
- Implement access control for exported files
- Delete temporary files after expiration

## Troubleshooting

### KML Not Displaying in Google Earth

**Symptoms**: KML file opens but parcelles don't appear.

**Possible Causes**:
1. Coordinates outside visible area
2. Invalid geometry
3. Missing style definitions

**Solutions**:
- Verify coordinates are in correct format (longitude, latitude, altitude)
- Check geometry is valid using validation tools
- Ensure style IDs match styleUrl references

### CSV Not Opening in Excel

**Symptoms**: CSV file shows garbled characters or incorrect formatting.

**Possible Causes**:
1. Character encoding issue
2. Incorrect decimal separator for locale

**Solutions**:
- Ensure file is saved with UTF-8 BOM encoding
- Use Excel's "Import Data" feature instead of double-clicking
- Adjust regional settings if decimal separator is incorrect

### PDF Report Missing Images

**Symptoms**: PDF generates but satellite imagery is missing.

**Possible Causes**:
1. Imagery not cached
2. Storage bucket access denied
3. Image URL expired

**Solutions**:
- Ensure imagery is calculated before generating report
- Verify storage bucket permissions
- Regenerate report if URLs have expired

## Related Documentation

- [Satellite Imagery Setup](./gee-setup.md)
- [NDVI Calculation](./ndvi-calculation.md)
- [Temporal Analysis](./temporal-analysis.md)
- [API Reference](../api/satellite.md)
- [Database Schema](../database/schema.md)

## Support

For issues or questions about satellite data export:

- **Technical Support**: support@cocoatrack.app
- **Documentation**: https://docs.cocoatrack.app
- **GitHub Issues**: https://github.com/cocoatrack/cocoatrack/issues
