# Satellite Imagery Feature - Setup Required

## Current Status

The satellite imagery analysis feature is **partially implemented** but requires external service configuration to function properly.

## Error You're Seeing

```
Failed to fetch NDVI: Band data arrays are empty
```

This error occurs because the system is trying to calculate NDVI (vegetation index) from satellite imagery, but there's no actual satellite data available yet.

## What's Missing

### 1. Google Earth Engine (GEE) Setup

The satellite imagery feature requires Google Earth Engine API access:

- **Account**: Sign up at https://earthengine.google.com
- **Service Account**: Create a GEE service account with API access
- **Credentials**: Download the service account JSON key file
- **Environment Variables**: Configure the following in `.env.local`:
  ```
  GOOGLE_EARTH_ENGINE_API_KEY=your_api_key_here
  GOOGLE_EARTH_ENGINE_PROJECT_ID=your_project_id
  GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT=your_service_account_email
  ```

### 2. Imagery Service Implementation

The `ImageryService` class (`lib/satellite/services/imagery.service.ts`) needs to be completed with actual GEE API integration. Currently, it's a stub that returns empty data.

## Temporary Workaround

Until GEE is configured, you have two options:

### Option A: Disable the Feature in UI

Comment out or hide the NDVI-related UI components in:
- `components/parcelles/LeafletMap.tsx` (lines around 829)
- `components/parcelles/ParcelleTable.tsx` (health status column)
- `app/(dashboard)/parcelles/page.tsx` (health status filters)

### Option B: Use Mock Data (Development Only)

Create a mock imagery service that returns test data for development:

```typescript
// lib/satellite/services/imagery.service.mock.ts
export class MockImageryService {
  async getBands(geometry: MultiPolygon, date: Date, bands: string[]): Promise<BandData> {
    // Return mock band data with realistic NDVI values
    const size = 10; // 10x10 pixel grid
    const red: number[][] = [];
    const nir: number[][] = [];
    
    for (let i = 0; i < size; i++) {
      const redRow: number[] = [];
      const nirRow: number[] = [];
      for (let j = 0; j < size; j++) {
        // Generate random but realistic values
        redRow.push(Math.random() * 100 + 50); // 50-150
        nirRow.push(Math.random() * 200 + 200); // 200-400
      }
      red.push(redRow);
      nir.push(nirRow);
    }
    
    return { red, nir };
  }
}
```

Then update `ndvi.service.ts` to use the mock service in development.

## Next Steps

1. **Review the setup guide**: See `docs/deployment/vercel-gee-setup.md` for detailed GEE configuration instructions
2. **Complete GEE setup**: Follow the steps to create a service account and configure credentials
3. **Implement imagery service**: Complete the `getBands()` method in `imagery.service.ts` to call GEE API
4. **Test with real data**: Once configured, test NDVI calculation with actual Sentinel-2 imagery

## Documentation

- **API Documentation**: `docs/api/satellite.md`
- **GEE Setup Guide**: `docs/deployment/vercel-gee-setup.md`
- **Design Document**: `.kiro/specs/satellite-imagery-analysis/design.md`
- **Requirements**: `.kiro/specs/satellite-imagery-analysis/requirements.md`

## Current Implementation Status

✅ **Completed**:
- Database schema (ndvi_results, satellite_imagery tables)
- NDVI calculation logic (formula, statistics, health status)
- API endpoints (POST /api/satellite/ndvi, GET /api/satellite/health-status)
- React hooks (useParcelleHealthStatus, useNDVI)
- UI components (HealthStatusBadge, NDVILayer)
- API documentation

❌ **Not Implemented**:
- Google Earth Engine API integration
- Actual satellite imagery retrieval
- Band data extraction from Sentinel-2
- Cloud cover filtering
- Imagery caching in Supabase Storage

## Recommendation

**For Production**: Complete the GEE setup before deploying this feature to users.

**For Development**: Either disable the feature in the UI or implement a mock imagery service to continue developing other parts of the application.

---

**Last Updated**: 2026-05-03
**Status**: Awaiting GEE Configuration
