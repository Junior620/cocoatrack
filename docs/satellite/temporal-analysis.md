# Temporal Analysis Documentation

## Overview

The Temporal Analysis feature provides interactive tools for tracking vegetation health changes over time using satellite imagery and NDVI (Normalized Difference Vegetation Index) data. This feature enables users to visualize trends, identify significant changes, and make data-driven decisions about crop management.

**Key Capabilities**:
- Interactive temporal slider for navigating historical imagery
- Line chart visualization of NDVI trends over time
- Automatic detection of significant vegetation changes
- CSV export for external analysis
- Keyboard and touch gesture support
- Responsive design for mobile and desktop

---

## Components

### TemporalSlider

An interactive timeline slider that allows users to navigate through historical satellite imagery and NDVI data.

#### Features

**Navigation**:
- Drag slider to select specific dates
- Click date markers to jump to specific points
- Play/pause animation for automatic progression
- Skip to start/end buttons
- Keyboard shortcuts for efficient navigation

**Visual Indicators**:
- Current date display with NDVI value and health status
- Cloud cover percentage for each date
- Significant change markers (orange dots for NDVI change > 0.15)
- Color-coded health status badges
- Progress bar showing current position in timeline

**Accessibility**:
- Full keyboard navigation support
- Touch gesture support for mobile devices
- ARIA labels for screen readers
- Focus indicators for keyboard users

#### Usage Example

```typescript
import { TemporalSlider } from '@/components/satellite';

function ParcelleAnalysis({ parcelleId }: { parcelleId: string }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-12-31');

  return (
    <TemporalSlider
      parcelleId={parcelleId}
      startDate={startDate}
      endDate={endDate}
      interval="monthly"
      onDateChange={setSelectedDate}
      highlightChanges={true}
      animationSpeed={1000}
    />
  );
}
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `parcelleId` | string | Yes | - | UUID of the parcelle to analyze |
| `startDate` | Date | Yes | - | Start date of temporal range |
| `endDate` | Date | Yes | - | End date of temporal range |
| `interval` | 'daily' \| 'weekly' \| 'monthly' | Yes | - | Time interval for data points |
| `onDateChange` | (date: Date) => void | Yes | - | Callback when selected date changes |
| `highlightChanges` | boolean | No | true | Highlight dates with significant NDVI changes |
| `animationSpeed` | number | No | 1000 | Animation speed in milliseconds |
| `className` | string | No | '' | Custom CSS class name |

#### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` (Left Arrow) | Navigate to previous date |
| `→` (Right Arrow) | Navigate to next date |
| `Space` | Play/pause animation |
| `Home` | Jump to first date |
| `End` | Jump to last date |

#### Touch Gestures (Mobile)

| Gesture | Action |
|---------|--------|
| Swipe Right | Navigate to previous date |
| Swipe Left | Navigate to next date |
| Tap Marker | Select specific date |
| Tap Play Button | Start/stop animation |

**Gesture Configuration**:
- **Swipe Threshold**: 50 pixels minimum distance
- **Velocity Threshold**: 0.3 px/ms minimum velocity
- **Touch Targets**: Larger buttons (48x48px) on mobile for better usability

---

### TemporalDataChart

A line chart component that visualizes NDVI values over time with interactive features and statistical summaries.

#### Features

**Visualization**:
- Line chart showing NDVI values over time
- Color-coded data points based on NDVI value
- Reference lines for health status thresholds
- Vertical line indicating currently selected date
- Significant change markers (orange circles)

**Statistics**:
- Mean NDVI across the time period
- Minimum and maximum NDVI values
- Number of significant changes detected
- Trend indicator (improving, stable, declining)

**Interactivity**:
- Click data points to select dates
- Hover tooltips with detailed information
- CSV export button for data download
- Responsive legend and axis labels

#### Usage Example

```typescript
import { TemporalDataChart } from '@/components/satellite';

function NDVITrendAnalysis({ parcelleId }: { parcelleId: string }) {
  const [timeline, setTimeline] = useState<TemporalDataPoint[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-12-31');

  return (
    <TemporalDataChart
      timeline={timeline}
      selectedDate={selectedDate}
      parcelleId={parcelleId}
      startDate={startDate}
      endDate={endDate}
      onDateSelect={setSelectedDate}
      showChangeMarkers={true}
    />
  );
}
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `timeline` | TemporalDataPoint[] | Yes | - | Array of temporal data points |
| `selectedDate` | Date | Yes | - | Currently selected date |
| `parcelleId` | string | Yes | - | UUID for CSV export filename |
| `startDate` | Date | Yes | - | Start date of temporal range |
| `endDate` | Date | Yes | - | End date of temporal range |
| `onDateSelect` | (date: Date) => void | No | - | Callback when data point is clicked |
| `showChangeMarkers` | boolean | No | true | Show markers for significant changes |
| `className` | string | No | '' | Custom CSS class name |
| `loading` | boolean | No | false | Show loading skeleton |
| `error` | Error \| null | No | null | Show error state |

#### Chart Elements

**Reference Lines**:
- **Excellent** (NDVI 0.7): Dark green dashed line
- **Fair** (NDVI 0.5): Yellow dashed line
- **Poor** (NDVI 0.3): Orange dashed line

**Data Point Colors**:
- NDVI 0.8-1.0: Dark green (#2d5016)
- NDVI 0.6-0.8: Green (#6FAF3D)
- NDVI 0.4-0.6: Light green (#84cc16)
- NDVI 0.2-0.4: Yellow (#fbbf24)
- NDVI 0.0-0.2: Red (#ef4444)

**Tooltip Information**:
- Full date (e.g., "lundi 3 mai 2024")
- NDVI value (3 decimal places)
- Health status badge
- Cloud cover percentage
- Significant change indicator (if applicable)

---

## Change Detection Algorithm

The temporal analysis system automatically detects significant vegetation changes using the following algorithm:

### Detection Criteria

A change is considered **significant** when:
1. **NDVI Change > 0.15**: The absolute difference between consecutive NDVI measurements exceeds 0.15
2. **Consecutive Measurements**: Comparison is made between adjacent time points in the timeline

### Algorithm Steps

```typescript
// Pseudocode for change detection
function detectSignificantChanges(timeline: TemporalDataPoint[]): void {
  for (let i = 1; i < timeline.length; i++) {
    const currentNDVI = timeline[i].ndvi;
    const previousNDVI = timeline[i - 1].ndvi;
    const change = Math.abs(currentNDVI - previousNDVI);
    
    if (change > 0.15) {
      timeline[i].hasSignificantChange = true;
    }
  }
}
```

### Change Types

**Positive Change** (NDVI increase > 0.15):
- Indicates vegetation improvement
- Possible causes: rainfall, irrigation, fertilization, crop growth
- Trend indicator: "En amélioration" (Improving)

**Negative Change** (NDVI decrease > 0.15):
- Indicates vegetation decline
- Possible causes: drought, disease, deforestation, harvest
- Trend indicator: "En déclin" (Declining)
- May trigger deforestation alerts if sustained

**Stable** (NDVI change ≤ 0.05):
- Indicates consistent vegetation health
- Trend indicator: "Stable"

### Visual Indicators

**In TemporalSlider**:
- Orange dots on timeline markers
- "Changement significatif" badge next to current date

**In TemporalDataChart**:
- Orange circles with emphasis rings on data points
- Count displayed in statistics summary
- Legend explaining the marker meaning

### Practical Examples

**Example 1: Seasonal Growth**
```
January:  NDVI 0.45 (Fair)
February: NDVI 0.48 (Fair) - No significant change
March:    NDVI 0.52 (Fair) - No significant change
April:    NDVI 0.68 (Good) - SIGNIFICANT CHANGE (+0.16)
May:      NDVI 0.72 (Excellent) - No significant change
```

**Example 2: Drought Impact**
```
June:     NDVI 0.75 (Excellent)
July:     NDVI 0.71 (Excellent) - No significant change
August:   NDVI 0.54 (Fair) - SIGNIFICANT CHANGE (-0.17)
September: NDVI 0.48 (Fair) - No significant change
```

---

## CSV Export

The temporal analysis feature includes CSV export functionality for external analysis and reporting.

### Export Format

The exported CSV file includes the following columns:

| Column | Description | Format |
|--------|-------------|--------|
| `date` | Measurement date | ISO 8601 (YYYY-MM-DD) |
| `ndvi` | Mean NDVI value | Decimal (3 places) |
| `min_ndvi` | Minimum NDVI | Decimal (3 places) |
| `max_ndvi` | Maximum NDVI | Decimal (3 places) |
| `cloud_cover` | Cloud cover percentage | Integer (0-100) |
| `health_status` | Health classification | String (excellent/good/fair/poor/critical) |
| `significant_change` | Change indicator | Boolean (true/false) |

### Example CSV Output

```csv
date,ndvi,min_ndvi,max_ndvi,cloud_cover,health_status,significant_change
2024-01-01,0.650,0.520,0.780,15,good,false
2024-02-01,0.655,0.530,0.785,12,good,false
2024-03-01,0.720,0.610,0.850,8,excellent,true
2024-04-01,0.735,0.625,0.865,5,excellent,false
2024-05-01,0.550,0.420,0.680,18,fair,true
```

### Usage

**From TemporalDataChart Component**:
```typescript
// Export is triggered by clicking the "Exporter CSV" button
// File is automatically downloaded with filename:
// temporal-ndvi-{parcelleId}-{startDate}-{endDate}.csv
```

**Programmatic Export**:
```typescript
import { exportTemporalDataAsCSV } from '@/lib/satellite/utils/csv-export';

function exportData() {
  const timeline: TemporalDataPoint[] = [...]; // Your data
  const parcelleId = '123e4567-e89b-12d3-a456-426614174000';
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-12-31');
  
  exportTemporalDataAsCSV(timeline, parcelleId, startDate, endDate);
}
```

### Use Cases

1. **External Analysis**: Import into Excel, R, Python for advanced statistical analysis
2. **Reporting**: Include in management reports and presentations
3. **Compliance**: Provide evidence for EUDR certification audits
4. **Archival**: Long-term storage of historical vegetation data
5. **Comparison**: Compare multiple parcelles side-by-side

---

## API Integration

### GET /api/satellite/temporal

Retrieve temporal NDVI data for a parcelle over a specified date range.

#### Request

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `parcelleId` | UUID | Yes | Parcelle identifier |
| `startDate` | ISO 8601 | Yes | Start date (YYYY-MM-DD) |
| `endDate` | ISO 8601 | Yes | End date (YYYY-MM-DD) |
| `interval` | String | Yes | Time interval: 'daily', 'weekly', or 'monthly' |

**Example Request**:
```bash
curl -X GET "https://cocoatrack.com/api/satellite/temporal?parcelleId=123e4567-e89b-12d3-a456-426614174000&startDate=2024-01-01&endDate=2024-12-31&interval=monthly" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Response

**Success Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "parcelleId": "123e4567-e89b-12d3-a456-426614174000",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z",
    "interval": "monthly",
    "summary": {
      "timeline": [
        {
          "date": "2024-01-01T00:00:00Z",
          "ndvi": 0.650,
          "cloudCover": 15,
          "healthStatus": "good",
          "hasSignificantChange": false
        },
        {
          "date": "2024-02-01T00:00:00Z",
          "ndvi": 0.655,
          "cloudCover": 12,
          "healthStatus": "good",
          "hasSignificantChange": false
        },
        {
          "date": "2024-03-01T00:00:00Z",
          "ndvi": 0.720,
          "cloudCover": 8,
          "healthStatus": "excellent",
          "hasSignificantChange": true
        }
      ],
      "trend": "improving",
      "totalDataPoints": 12,
      "significantChanges": 2,
      "averageNDVI": 0.685
    }
  },
  "cached": true
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `summary.timeline` | Array | Array of temporal data points |
| `summary.trend` | String | Overall trend: 'improving', 'stable', or 'declining' |
| `summary.totalDataPoints` | Number | Total number of data points in timeline |
| `summary.significantChanges` | Number | Count of significant changes detected |
| `summary.averageNDVI` | Number | Mean NDVI across all data points |
| `cached` | Boolean | Whether data was served from cache |

#### Error Responses

**404 Not Found** - No data available:
```json
{
  "success": false,
  "error": "No temporal data available for the specified date range",
  "code": "NO_DATA_AVAILABLE"
}
```

**422 Unprocessable Entity** - Invalid date range:
```json
{
  "success": false,
  "error": "Invalid date range: end date must be after start date",
  "code": "INVALID_DATE_RANGE"
}
```

---

## Integration Example

### Complete Temporal Analysis View

This example demonstrates how to integrate both the TemporalSlider and TemporalDataChart components:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { TemporalSlider, TemporalDataChart } from '@/components/satellite';
import type { TemporalDataPoint } from '@/lib/satellite/types';

interface TemporalAnalysisViewProps {
  parcelleId: string;
  startDate: Date;
  endDate: Date;
  interval: 'daily' | 'weekly' | 'monthly';
}

export function TemporalAnalysisView({
  parcelleId,
  startDate,
  endDate,
  interval,
}: TemporalAnalysisViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(endDate);
  const [timeline, setTimeline] = useState<TemporalDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch temporal data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          parcelleId,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          interval,
        });

        const response = await fetch(`/api/satellite/temporal?${params}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch temporal data');
        }

        const data = await response.json();
        setTimeline(data.data.summary.timeline);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [parcelleId, startDate, endDate, interval]);

  return (
    <div className="space-y-6">
      {/* Temporal Chart */}
      <TemporalDataChart
        timeline={timeline}
        selectedDate={selectedDate}
        parcelleId={parcelleId}
        startDate={startDate}
        endDate={endDate}
        onDateSelect={setSelectedDate}
        showChangeMarkers={true}
        loading={loading}
        error={error}
      />

      {/* Temporal Slider */}
      <TemporalSlider
        parcelleId={parcelleId}
        startDate={startDate}
        endDate={endDate}
        interval={interval}
        onDateChange={setSelectedDate}
        highlightChanges={true}
        animationSpeed={1000}
      />
    </div>
  );
}
```

---

## Best Practices

### 1. Date Range Selection

**Recommended Ranges**:
- **Daily interval**: Maximum 90 days (3 months)
- **Weekly interval**: Maximum 365 days (1 year)
- **Monthly interval**: Maximum 730 days (2 years)

**Rationale**: Larger date ranges with finer intervals can result in:
- Slower API response times
- Cluttered visualizations
- Increased data transfer

### 2. Interval Selection

Choose the appropriate interval based on your analysis needs:

| Interval | Best For | Data Points (1 year) |
|----------|----------|----------------------|
| Daily | Short-term monitoring, rapid change detection | ~365 |
| Weekly | Seasonal trends, medium-term analysis | ~52 |
| Monthly | Long-term trends, annual comparisons | 12 |

### 3. Performance Optimization

**Client-Side Caching**:
```typescript
// Cache temporal data to avoid redundant API calls
const [cache, setCache] = useState<Map<string, TemporalDataPoint[]>>(new Map());

function getCacheKey(parcelleId: string, startDate: Date, endDate: Date, interval: string) {
  return `${parcelleId}-${startDate.toISOString()}-${endDate.toISOString()}-${interval}`;
}

// Check cache before fetching
const cacheKey = getCacheKey(parcelleId, startDate, endDate, interval);
if (cache.has(cacheKey)) {
  setTimeline(cache.get(cacheKey)!);
  return;
}
```

**Debounced Date Selection**:
```typescript
import { useDebouncedCallback } from 'use-debounce';

const debouncedDateChange = useDebouncedCallback(
  (date: Date) => {
    // Update map layers or trigger other expensive operations
    updateMapLayers(date);
  },
  300 // 300ms delay
);
```

### 4. Error Handling

Always implement comprehensive error handling:

```typescript
try {
  const response = await fetch(`/api/satellite/temporal?${params}`);
  
  if (!response.ok) {
    const error = await response.json();
    
    switch (error.code) {
      case 'NO_DATA_AVAILABLE':
        // Show message suggesting different date range
        showMessage('No data available for this period. Try a different date range.');
        break;
      case 'INVALID_DATE_RANGE':
        // Show validation error
        showError('Invalid date range. End date must be after start date.');
        break;
      default:
        // Generic error
        showError('Failed to load temporal data. Please try again.');
    }
    return;
  }
  
  const data = await response.json();
  setTimeline(data.data.summary.timeline);
} catch (error) {
  // Network error
  showError('Network error. Please check your connection and try again.');
}
```

### 5. Accessibility

Ensure your temporal analysis interface is accessible:

```typescript
// Provide keyboard navigation
<div
  role="region"
  aria-label="Temporal analysis controls"
  tabIndex={0}
  onKeyDown={handleKeyDown}
>
  {/* Controls */}
</div>

// Add ARIA labels to interactive elements
<button
  aria-label={`Select date ${formatDate(date)}`}
  onClick={() => selectDate(date)}
>
  {/* Button content */}
</button>

// Announce changes to screen readers
<div role="status" aria-live="polite" aria-atomic="true">
  {selectedDate && `Selected date: ${formatDate(selectedDate)}`}
</div>
```

### 6. Mobile Optimization

**Touch-Friendly Design**:
- Minimum touch target size: 48x48 pixels
- Adequate spacing between interactive elements
- Swipe gestures for navigation
- Larger buttons and controls on mobile

**Responsive Layout**:
```typescript
// Adjust chart height for mobile
<TemporalDataChart
  className="h-64 md:h-80"
  // ... other props
/>

// Stack components vertically on mobile
<div className="flex flex-col gap-4 md:flex-row">
  <TemporalSlider {...props} />
  <TemporalDataChart {...props} />
</div>
```

---

## Troubleshooting

### Issue: No Data Available

**Symptoms**: Empty timeline, "Aucune donnée temporelle disponible" message

**Possible Causes**:
1. No NDVI calculations exist for the date range
2. Cloud cover exceeds threshold for all dates
3. Parcelle has no satellite imagery coverage

**Solutions**:
1. Calculate NDVI for the parcelle first using the NDVI calculation endpoint
2. Expand the date range to include more potential data points
3. Adjust the cloud cover threshold (if configurable)
4. Check if the parcelle geometry is valid

### Issue: Slow Loading

**Symptoms**: Long wait times, loading spinner persists

**Possible Causes**:
1. Large date range with daily interval
2. Network latency
3. Server-side processing delays

**Solutions**:
1. Use weekly or monthly intervals for large date ranges
2. Implement client-side caching
3. Show progressive loading (load recent data first)
4. Add timeout handling with retry logic

### Issue: Significant Changes Not Detected

**Symptoms**: No orange markers despite visible NDVI changes

**Possible Causes**:
1. NDVI changes are below 0.15 threshold
2. `highlightChanges` prop set to false
3. Insufficient data points for comparison

**Solutions**:
1. Verify NDVI values in the data
2. Ensure `highlightChanges={true}` is set
3. Use finer interval (e.g., weekly instead of monthly)
4. Check that consecutive data points exist

### Issue: Animation Not Working

**Symptoms**: Play button doesn't start animation

**Possible Causes**:
1. Already at the end of timeline
2. Only one data point available
3. JavaScript error in animation logic

**Solutions**:
1. Click "Skip to Start" button first
2. Ensure timeline has multiple data points
3. Check browser console for errors
4. Verify `animationSpeed` prop is valid

---

## Related Documentation

- [NDVI Calculation Guide](./ndvi-calculation.md)
- [Satellite Imagery API Reference](../api/satellite.md)
- [Deforestation Detection](./deforestation-detection.md)
- [Google Earth Engine Setup](../deployment/vercel-gee-setup.md)

---

## Support

For issues or questions about temporal analysis:

1. Check the [Troubleshooting](#troubleshooting) section above
2. Review the [API documentation](../api/satellite.md)
3. Contact the development team
4. Submit a bug report with:
   - Parcelle ID
   - Date range and interval used
   - Browser and device information
   - Screenshots or error messages
