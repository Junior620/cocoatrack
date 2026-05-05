# Satellite Components

This directory contains React components for the satellite imagery analysis feature of CocoaTrack.

## Components

### HealthStatusBadge

A color-coded badge component that displays the health status of a parcelle based on NDVI (Normalized Difference Vegetation Index) analysis.

#### Features

- **5 Health Status Levels**: Excellent, Good, Fair, Poor, Critical
- **Color-Coded Display**: Uses distinct colors for each status level
- **Trend Indicators**: Optional arrows showing improving/stable/declining trends
- **Multiple Sizes**: Small, Medium, and Large variants
- **Accessibility**: Includes proper ARIA labels and semantic HTML
- **Customizable**: Supports custom CSS classes

#### Usage

```tsx
import HealthStatusBadge from '@/components/satellite/HealthStatusBadge';

// Basic usage
<HealthStatusBadge status="good" />

// With trend indicator
<HealthStatusBadge 
  status="good" 
  showTrend 
  trend="improving" 
/>

// Different sizes
<HealthStatusBadge status="excellent" size="sm" />
<HealthStatusBadge status="fair" size="md" />
<HealthStatusBadge status="poor" size="lg" />

// With custom styling
<HealthStatusBadge 
  status="critical" 
  className="shadow-lg" 
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `status` | `'excellent' \| 'good' \| 'fair' \| 'poor' \| 'critical'` | Required | The health status to display |
| `showTrend` | `boolean` | `false` | Whether to show the trend indicator |
| `trend` | `'improving' \| 'stable' \| 'declining'` | `undefined` | The trend direction (only shown if `showTrend` is true) |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | The size of the badge |
| `className` | `string` | `''` | Additional CSS classes to apply |

#### Color Scheme

The component uses the following color scheme as defined in the design document:

- **Excellent**: Dark Green (#2d5016) - NDVI 0.7-1.0
- **Good**: Green (#6FAF3D) - NDVI 0.6-0.7
- **Fair**: Yellow (#fbbf24) - NDVI 0.5-0.6
- **Poor**: Orange (#E68A1F) - NDVI 0.3-0.5
- **Critical**: Red (#ef4444) - NDVI 0.0-0.3

#### Accessibility

The component includes:
- `role="status"` for screen reader announcements
- Descriptive `aria-label` including status and trend
- Semantic HTML structure
- Color-blind friendly color palette

#### Examples

See `HealthStatusBadge.examples.tsx` for comprehensive usage examples including:
- Basic usage
- Size variants
- Trend indicators
- Integration in parcelle lists
- Integration in detail pages
- Integration in map popups

#### Testing

The component has comprehensive test coverage including:
- Basic rendering for all status levels
- Color coding verification
- Size variant rendering
- Trend indicator display
- Custom styling
- Accessibility features
- All combinations of status, trend, and size

Run tests with:
```bash
npm test -- tests/components/satellite/HealthStatusBadge.test.tsx
```

#### Design Reference

This component implements the design specifications from:
- `.kiro/specs/satellite-imagery-analysis/design.md` - Section: HealthStatusBadge Component
- `.kiro/specs/satellite-imagery-analysis/requirements.md` - Requirement 6: Health Status Classification

#### Related Components

- `NDVILayer` - Displays NDVI visualization on maps
- `SatelliteImageryOverlay` - Shows satellite imagery overlays
- `TemporalSlider` - Interactive timeline for historical imagery

### TemporalSlider

Interactive timeline slider for viewing historical satellite imagery and NDVI data over time.

#### Features

- **Interactive Slider**: Date markers with visual feedback
- **Play/Pause Animation**: Automatic date progression with configurable speed
- **Cloud Cover Display**: Shows cloud cover percentage for each date
- **Significant Change Highlighting**: Highlights dates with NDVI changes >0.15
- **Keyboard Navigation**: Full keyboard support (arrow keys, space, home/end)
- **Loading & Error States**: User-friendly loading and error handling with retry
- **Responsive Design**: Works on mobile and desktop
- **French Language Support**: All text in French for Cameroon context

#### Usage

```tsx
import { TemporalSlider } from '@/components/satellite';

function ParcelleDetailPage() {
  const handleDateChange = (date: Date) => {
    console.log('Selected date:', date);
    // Update map layers or other components
  };

  return (
    <TemporalSlider
      parcelleId="123e4567-e89b-12d3-a456-426614174000"
      startDate={new Date('2024-01-01')}
      endDate={new Date('2024-12-31')}
      interval="monthly"
      onDateChange={handleDateChange}
      highlightChanges={true}
      animationSpeed={1000}
    />
  );
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `parcelleId` | `string` | Required | ID of the parcelle to display temporal data for |
| `startDate` | `Date` | Required | Start date of the temporal range |
| `endDate` | `Date` | Required | End date of the temporal range |
| `interval` | `'daily' \| 'weekly' \| 'monthly'` | Required | Time interval for data points |
| `onDateChange` | `(date: Date) => void` | Required | Callback when the selected date changes |
| `highlightChanges` | `boolean` | `true` | Whether to highlight dates with significant changes |
| `animationSpeed` | `number` | `1000` | Animation speed in milliseconds |
| `className` | `string` | `''` | Additional CSS classes to apply |

#### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Navigate between dates |
| `Space` | Play/pause animation |
| `Home` | Jump to first date |
| `End` | Jump to last date |

#### API Integration

The component fetches data from `/api/satellite/temporal` endpoint with the following query parameters:
- `parcelleId`: UUID of the parcelle
- `startDate`: Start date in ISO 8601 format (YYYY-MM-DD)
- `endDate`: End date in ISO 8601 format (YYYY-MM-DD)
- `interval`: Time interval ('daily', 'weekly', or 'monthly')

The API returns temporal NDVI data including:
- Timeline of NDVI values with dates
- Cloud cover percentages
- Health status for each date
- Significant change indicators
- Trend analysis (improving/stable/declining)

#### States

**Loading State**: Displays spinner and loading message while fetching data

**Error State**: Shows error message with retry button if fetch fails

**No Data State**: Displays helpful message when no temporal data is available

**Data State**: Shows interactive slider with all controls and information

#### Design Reference

This component implements the design specifications from:
- `.kiro/specs/satellite-imagery-analysis/design.md` - Section: TemporalSlider Component
- `.kiro/specs/satellite-imagery-analysis/requirements.md` - Requirement 3: Temporal Analysis Interface
- `.kiro/specs/satellite-imagery-analysis/tasks.md` - Task 3.3.1: Create TemporalSlider component

#### Testing

Run tests with:
```bash
npm test -- tests/components/satellite/TemporalSlider.test.tsx
```

Test coverage includes:
- Component rendering
- Data fetching and display
- Date selection
- Play/pause animation
- Keyboard navigation
- Loading and error states
- Significant change highlighting
- Cloud cover display

### TemporalDataChart

Line chart visualization for temporal NDVI data showing vegetation health trends over time.

#### Features

- **Line Chart Visualization**: NDVI values plotted over time with smooth curves
- **Selected Date Highlighting**: Vertical reference line showing current selection
- **Significant Change Markers**: Orange markers for NDVI changes >0.15
- **Interactive Tooltips**: Hover to see NDVI value, date, health status, and cloud cover
- **Trend Analysis**: Automatic calculation of improving/stable/declining trends
- **Statistics Display**: Shows average, min, max NDVI and change count
- **Reference Lines**: Visual guides for NDVI thresholds (excellent, fair, poor)
- **Color-Blind Friendly**: Uses accessible color scheme matching NDVI standards
- **Responsive Design**: Works on mobile and desktop devices
- **Loading & Error States**: User-friendly state management

#### Usage

```tsx
import { TemporalDataChart } from '@/components/satellite';

function TemporalAnalysisPage() {
  const [timeline, setTimeline] = useState<TemporalDataPoint[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    // Update other components or fetch additional data
  };

  return (
    <TemporalDataChart
      timeline={timeline}
      selectedDate={selectedDate}
      onDateSelect={handleDateSelect}
      showChangeMarkers={true}
    />
  );
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `timeline` | `TemporalDataPoint[]` | Required | Array of temporal NDVI data points |
| `selectedDate` | `Date` | Required | Currently selected date to highlight |
| `onDateSelect` | `(date: Date) => void` | `undefined` | Callback when a data point is clicked |
| `showChangeMarkers` | `boolean` | `true` | Whether to show significant change markers |
| `className` | `string` | `''` | Additional CSS classes to apply |
| `loading` | `boolean` | `false` | Loading state |
| `error` | `Error \| null` | `null` | Error state |

#### Chart Features

**Y-Axis (NDVI Values)**:
- Range: -0.1 to 1.0
- Labeled ticks at key thresholds
- Reference lines for health status boundaries

**X-Axis (Dates)**:
- Formatted dates (day/month)
- Angled labels for readability
- Responsive spacing

**Data Points**:
- Color-coded by NDVI value
- Larger dots for selected date
- Special markers for significant changes

**Tooltips**:
- Date (full format)
- NDVI value (3 decimal places)
- Health status badge
- Cloud cover percentage
- Significant change indicator

#### Statistics Panel

The component displays four key statistics:
- **NDVI Moyen**: Average NDVI across all data points
- **NDVI Min**: Minimum NDVI value in the timeline
- **NDVI Max**: Maximum NDVI value in the timeline
- **Changements**: Count of significant changes (NDVI >0.15)

#### Trend Indicator

Automatically calculates and displays trend:
- **En amélioration** (Improving): NDVI increase >0.05
- **Stable**: NDVI change between -0.05 and +0.05
- **En déclin** (Declining): NDVI decrease >0.05

Shows trend icon and change value.

#### Integration with TemporalSlider

The TemporalDataChart is designed to work seamlessly with TemporalSlider:

```tsx
import { TemporalSlider, TemporalDataChart } from '@/components/satellite';

function IntegratedTemporalView() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timeline, setTimeline] = useState<TemporalDataPoint[]>([]);

  return (
    <div className="space-y-6">
      <TemporalDataChart
        timeline={timeline}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
      />
      <TemporalSlider
        parcelleId="..."
        startDate={startDate}
        endDate={endDate}
        interval="monthly"
        onDateChange={setSelectedDate}
      />
    </div>
  );
}
```

Or use the pre-built `TemporalAnalysisView` component:

```tsx
import { TemporalAnalysisView } from '@/components/satellite';

<TemporalAnalysisView
  parcelleId="123e4567-e89b-12d3-a456-426614174000"
  startDate={new Date('2023-01-01')}
  endDate={new Date('2024-01-01')}
  interval="monthly"
/>
```

#### Color Scheme

NDVI values are color-coded according to vegetation health:
- **Dark Green (#2d5016)**: NDVI 0.8-1.0 (Excellent)
- **Green (#6FAF3D)**: NDVI 0.6-0.8 (Good)
- **Light Green (#84cc16)**: NDVI 0.4-0.6 (Fair)
- **Yellow (#fbbf24)**: NDVI 0.2-0.4 (Poor)
- **Red (#ef4444)**: NDVI 0.0-0.2 (Critical)

#### States

**Loading State**: Displays skeleton loader with loading message

**Error State**: Shows error message with optional retry button

**Empty State**: Displays helpful message when no data is available

**Data State**: Shows full chart with all features and statistics

#### Design Reference

This component implements the design specifications from:
- `.kiro/specs/satellite-imagery-analysis/design.md` - Section: Temporal Analysis Components
- `.kiro/specs/satellite-imagery-analysis/requirements.md` - Requirement 3: Temporal Analysis Interface
- `.kiro/specs/satellite-imagery-analysis/tasks.md` - Task 3.3.4: Add temporal data visualization

#### Testing

Run tests with:
```bash
npm test -- tests/components/satellite/TemporalDataChart.test.tsx
```

Test coverage includes:
- Component rendering with valid data
- Loading, error, and empty states
- Statistics calculation (average, min, max)
- Trend calculation (improving, stable, declining)
- Significant change markers
- Selected date highlighting
- Tooltip display
- Click interaction
- Accessibility features
- Edge cases (single point, extreme values)
- Data formatting

## Development

### Adding New Components

When adding new satellite-related components:

1. Create the component file in this directory
2. Add comprehensive TypeScript types
3. Include JSDoc comments for props
4. Create test file in `tests/components/satellite/`
5. Add usage examples in `.examples.tsx` file
6. Update this README with component documentation

### Testing Guidelines

All components should have:
- Unit tests for all props and variants
- Accessibility tests (ARIA labels, keyboard navigation)
- Integration tests where applicable
- Minimum 80% code coverage

### Code Style

- Use TypeScript for type safety
- Follow existing naming conventions
- Use Tailwind CSS for styling
- Include accessibility features by default
- Add JSDoc comments for complex logic
