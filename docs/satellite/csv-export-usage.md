# CSV Export Usage Guide

## Overview

The CSV export feature allows users to export temporal NDVI data for parcelles as CSV files with comprehensive statistics. This guide provides practical examples for integrating the CSV export functionality into your application.

## Quick Start

### 1. Using the React Component (Recommended)

The easiest way to add CSV export to your UI is using the `ExportCSVButton` component:

```tsx
import { ExportCSVButton } from '@/components/satellite/ExportCSVButton';

function ParcelleDetailPage({ parcelle }) {
  return (
    <div>
      <h1>{parcelle.label}</h1>
      
      {/* Basic usage */}
      <ExportCSVButton parcelleId={parcelle.id} />
      
      {/* With date range */}
      <ExportCSVButton
        parcelleId={parcelle.id}
        parcelleCode={parcelle.code}
        startDate={new Date('2024-01-01')}
        endDate={new Date('2024-12-31')}
      />
      
      {/* Styled variant */}
      <ExportCSVButton
        parcelleId={parcelle.id}
        variant="primary"
        size="lg"
        className="mt-4"
      />
    </div>
  );
}
```

### 2. Using the API Directly

For custom implementations, call the API endpoint directly:

```typescript
async function exportNDVIData(
  parcelleId: string,
  options?: {
    startDate?: string;
    endDate?: string;
  }
) {
  // Get authentication token
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  // Build query parameters
  const params = new URLSearchParams({ parcelleId });
  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);

  // Fetch CSV
  const response = await fetch(`/api/satellite/export/csv?${params}`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  // Download file
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ndvi-export-${parcelleId}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Usage
await exportNDVIData('123e4567-e89b-12d3-a456-426614174000', {
  startDate: '2024-01-01',
  endDate: '2024-12-31',
});
```

### 3. Using the Service Layer

For server-side or advanced use cases:

```typescript
import { exportService } from '@/lib/satellite/services/export.service';
import type { NDVIResult } from '@/lib/satellite/types';

// Fetch NDVI results from database
const ndviResults: NDVIResult[] = await fetchNDVIResults(parcelleId);

// Generate CSV
const csv = await exportService.exportTemporalCSVWithStats(
  parcelleId,
  ndviResults
);

// Save to file or send as response
fs.writeFileSync('export.csv', csv);
```

## Component Props

### ExportCSVButton

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `parcelleId` | string | Yes | - | UUID of the parcelle |
| `parcelleCode` | string | No | - | Parcelle code for filename |
| `startDate` | Date | No | - | Start date for filtering |
| `endDate` | Date | No | - | End date for filtering |
| `className` | string | No | '' | Additional CSS classes |
| `variant` | 'primary' \| 'secondary' \| 'outline' | No | 'outline' | Button style variant |
| `size` | 'sm' \| 'md' \| 'lg' | No | 'md' | Button size |

## API Endpoint

### GET /api/satellite/export/csv

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `parcelleId` | UUID | Yes | Parcelle identifier |
| `startDate` | YYYY-MM-DD | No | Start date (inclusive) |
| `endDate` | YYYY-MM-DD | No | End date (inclusive) |

**Response:**

- **Content-Type**: `text/csv; charset=utf-8`
- **Content-Disposition**: `attachment; filename="ndvi-temporal-{code}-{date}.csv"`

**CSV Format:**

```csv
date,mean_ndvi,min_ndvi,max_ndvi,std_dev,health_status,change_from_previous
2024-01-01,0.7543,0.6521,0.8567,0.0543,excellent,0.0000
2024-02-01,0.7821,0.6789,0.8901,0.0498,excellent,0.0278
```

## Use Cases

### 1. Export All Historical Data

```tsx
<ExportCSVButton
  parcelleId={parcelle.id}
  parcelleCode={parcelle.code}
/>
```

### 2. Export Specific Time Period

```tsx
<ExportCSVButton
  parcelleId={parcelle.id}
  startDate={new Date('2024-01-01')}
  endDate={new Date('2024-03-31')}
/>
```

### 3. Export for Multiple Parcelles (Batch)

```tsx
function BatchExport({ parcelleIds }: { parcelleIds: string[] }) {
  const handleBatchExport = async () => {
    for (const id of parcelleIds) {
      await exportNDVIData(id);
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  return (
    <button onClick={handleBatchExport}>
      Export All ({parcelleIds.length})
    </button>
  );
}
```

### 4. Custom Filename

```typescript
async function exportWithCustomFilename(
  parcelleId: string,
  filename: string
) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(
    `/api/satellite/export/csv?parcelleId=${parcelleId}`,
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    }
  );

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename; // Custom filename
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Usage
await exportWithCustomFilename(
  'parcelle-id',
  'my-custom-export-2024.csv'
);
```

### 5. Integration with Data Analysis Tools

#### Excel/Google Sheets

1. Click the export button
2. Open the downloaded CSV in Excel or Google Sheets
3. Data is automatically formatted with proper columns

#### Python/Pandas

```python
import pandas as pd

# Read exported CSV
df = pd.read_csv('ndvi-export.csv')

# Analyze data
print(df.describe())
print(df['health_status'].value_counts())

# Plot NDVI trend
import matplotlib.pyplot as plt
plt.plot(df['date'], df['mean_ndvi'])
plt.xlabel('Date')
plt.ylabel('Mean NDVI')
plt.title('NDVI Trend Over Time')
plt.show()
```

#### R

```r
# Read exported CSV
data <- read.csv('ndvi-export.csv')

# Summary statistics
summary(data)

# Plot NDVI trend
plot(as.Date(data$date), data$mean_ndvi,
     type='l',
     xlab='Date',
     ylab='Mean NDVI',
     main='NDVI Trend Over Time')
```

## Error Handling

### Component Error Display

The `ExportCSVButton` component automatically displays errors:

```tsx
<ExportCSVButton parcelleId={parcelle.id} />
{/* Error message appears below button automatically */}
```

### Custom Error Handling

```typescript
try {
  await exportNDVIData(parcelleId);
} catch (error) {
  if (error.message.includes('Unauthorized')) {
    // Handle authentication error
    router.push('/login');
  } else if (error.message.includes('not found')) {
    // Handle missing data
    toast.error('No NDVI data available for this parcelle');
  } else {
    // Handle other errors
    toast.error('Export failed. Please try again.');
  }
}
```

## Performance Tips

1. **Rate Limiting**: Respect the 100 requests/minute limit
2. **Batch Exports**: Add delays between requests
3. **Date Ranges**: Use date filters to reduce data size
4. **Caching**: Data is fetched fresh; consider caching on client side

## Troubleshooting

### No Data Available

**Error**: "No NDVI data found for this parcelle in the specified date range"

**Solution**: 
- Check if NDVI calculations have been performed for this parcelle
- Verify the date range includes calculated NDVI data
- Try removing date filters to see all available data

### Authentication Error

**Error**: "Unauthorized"

**Solution**:
- Ensure user is logged in
- Check session is valid
- Verify user has access to the parcelle

### Invalid Date Format

**Error**: "Invalid startDate format"

**Solution**:
- Use YYYY-MM-DD format for dates
- Ensure dates are valid (e.g., not 2024-13-01)
- Use ISO 8601 format for API calls

## Best Practices

1. **Always provide parcelleCode** for better filenames
2. **Use date ranges** for large datasets to improve performance
3. **Handle errors gracefully** with user-friendly messages
4. **Show loading states** during export
5. **Test with different data sizes** before production use
6. **Consider rate limits** for batch operations
7. **Validate data** before exporting

## Related Documentation

- [API Documentation](../api/satellite.md)
- [NDVI Calculation Guide](./ndvi-calculation.md)
- [Temporal Analysis Guide](./temporal-analysis.md)
- [ExportService API Reference](../../lib/satellite/services/export.service.ts)

## Support

For issues or questions:
- Check the [API documentation](../api/satellite.md)
- Review test files for examples
- Contact the development team
