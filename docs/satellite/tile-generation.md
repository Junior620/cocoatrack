# Satellite Imagery Tile Generation

This document describes the tile generation system for satellite imagery in CocoaTrack.

## Overview

The tile generation system converts Google Earth Engine (GEE) imagery into map tiles that can be displayed in Leaflet or Google Maps. Tiles are cached in Supabase Storage for offline access and performance optimization.

## Architecture

### Tile Generation Flow

```
1. User requests imagery for a parcelle
   ↓
2. Check if tiles are cached in Supabase Storage
   ↓
3. If cached: Return cached tile URL
   ↓
4. If not cached:
   a. Query GEE for imagery
   b. Generate GEE Map ID
   c. Create tile URL template
   d. Cache tile metadata in Supabase Storage
   e. Store cache metadata in database
   f. Return tile URL template
```

### Tile URL Format

Tiles use the standard {z}/{x}/{y} format compatible with Leaflet and Google Maps:

```
https://earthengine.googleapis.com/v1/projects/{project}/maps/{mapId}/tiles/{z}/{x}/{y}
```

Where:
- `{project}`: Google Earth Engine project ID
- `{mapId}`: GEE Map ID for the rendered imagery
- `{z}`: Zoom level
- `{x}`: Tile X coordinate
- `{y}`: Tile Y coordinate

## Implementation

### ImageryService Methods

#### `generateTileUrl()`

Generates a tile URL for GEE imagery. Checks cache first, then generates new tiles if needed.

```typescript
async generateTileUrl(
  parcelleId: string,
  geometry: MultiPolygon,
  date: Date
): Promise<string>
```

**Parameters:**
- `parcelleId`: Parcelle ID
- `geometry`: Parcelle geometry (MultiPolygon)
- `date`: Imagery acquisition date

**Returns:** Tile URL template with {z}/{x}/{y} placeholders

**Example:**
```typescript
const service = new ImageryService();
const tileUrl = await service.generateTileUrl(
  'parcelle-123',
  geometry,
  new Date('2024-01-15')
);
// Returns: 'https://earthengine.googleapis.com/v1/projects/cocoatrack/maps/abc123/tiles/{z}/{x}/{y}'
```

#### `getGEEMapId()`

Queries Google Earth Engine to get a Map ID for the imagery. The Map ID represents a rendered visualization of the imagery.

```typescript
private async getGEEMapId(
  geometry: MultiPolygon,
  date: Date
): Promise<string>
```

**GEE API Call Structure:**
```json
{
  "expression": {
    "functionInvocationValue": {
      "functionName": "Image.visualize",
      "arguments": {
        "image": {
          "functionInvocationValue": {
            "functionName": "ImageCollection.filterBounds",
            "arguments": {
              "collection": "COPERNICUS/S2_SR_HARMONIZED",
              "geometry": { "type": "MultiPolygon", "coordinates": [...] }
            }
          }
        },
        "visParams": {
          "bands": ["B4", "B3", "B2"],
          "min": 0,
          "max": 3000
        }
      }
    }
  }
}
```

#### `createTileUrlTemplate()`

Creates a tile URL template that can be used with Leaflet or Google Maps.

```typescript
private createTileUrlTemplate(mapId: string): string
```

**Example:**
```typescript
const template = createTileUrlTemplate('abc123');
// Returns: 'https://earthengine.googleapis.com/v1/projects/cocoatrack/maps/abc123/tiles/{z}/{x}/{y}'
```

#### `cacheTileMetadata()`

Stores tile metadata in Supabase Storage for future retrieval.

```typescript
private async cacheTileMetadata(
  cacheKey: string,
  metadata: Record<string, unknown>
): Promise<void>
```

**Metadata Structure:**
```json
{
  "parcelleId": "parcelle-123",
  "date": "2024-01-15T00:00:00.000Z",
  "mapId": "abc123",
  "tileUrlTemplate": "https://earthengine.googleapis.com/v1/projects/cocoatrack/maps/abc123/tiles/{z}/{x}/{y}",
  "bounds": [10.0, 5.0, 10.1, 5.1],
  "createdAt": "2024-05-03T10:00:00.000Z"
}
```

#### `getOptimizationParams()`

Returns optimization parameters for tile generation.

```typescript
getOptimizationParams(
  tileSize: number = 256,
  quality: number = 85
): Record<string, unknown>
```

**Parameters:**
- `tileSize`: Tile size in pixels (default 256)
- `quality`: JPEG quality 0-100 (default 85)

**Returns:**
```json
{
  "tileSize": 256,
  "quality": 85,
  "format": "image/jpeg",
  "compression": "JPEG",
  "maxZoom": 18,
  "minZoom": 10
}
```

## Caching Strategy

### Cache Key Format

Cache keys use the format: `{parcelleId}/{date}`

Example: `parcelle-123/2024-01-15`

### Cache Storage

Tiles are cached in two locations:

1. **Supabase Storage** (`satellite-imagery` bucket)
   - Path: `{parcelleId}/{date}/tiles.json`
   - Contains tile metadata (Map ID, URL template, bounds)
   - Retention: 90 days

2. **Database** (`satellite_cache_metadata` table)
   - Tracks cache entries for management
   - Enables cache statistics and monitoring
   - Supports LRU eviction

### Cache Retrieval

```typescript
private async getCachedTileUrl(cacheKey: string): Promise<string | null>
```

1. Check if tiles exist in Supabase Storage
2. If found, generate signed URL (24-hour expiry)
3. Return signed URL
4. If not found, return null to trigger fresh generation

## Usage with Map Libraries

### Leaflet

```typescript
import L from 'leaflet';
import { imageryService } from '@/lib/satellite/services/imagery.service';

// Get tile URL
const tileUrl = await imageryService.generateTileUrl(
  parcelleId,
  geometry,
  new Date()
);

// Add tile layer to map
const tileLayer = L.tileLayer(tileUrl, {
  attribution: '© Google Earth Engine',
  maxZoom: 18,
  minZoom: 10,
  opacity: 0.8,
});

tileLayer.addTo(map);
```

### Google Maps

```typescript
import { imageryService } from '@/lib/satellite/services/imagery.service';

// Get tile URL
const tileUrl = await imageryService.generateTileUrl(
  parcelleId,
  geometry,
  new Date()
);

// Create ImageMapType
const imageMapType = new google.maps.ImageMapType({
  getTileUrl: (coord, zoom) => {
    return tileUrl
      .replace('{z}', zoom.toString())
      .replace('{x}', coord.x.toString())
      .replace('{y}', coord.y.toString());
  },
  tileSize: new google.maps.Size(256, 256),
  maxZoom: 18,
  minZoom: 10,
  opacity: 0.8,
  name: 'Satellite',
});

// Add to map
map.overlayMapTypes.push(imageMapType);
```

## Optimization

### Tile Size

- **Default**: 256x256 pixels
- **Alternative**: 512x512 pixels for higher resolution
- **Trade-off**: Larger tiles = fewer requests but larger file sizes

### Compression

- **Format**: JPEG for RGB imagery (smaller file size)
- **Quality**: 85% (good balance between quality and size)
- **Alternative**: PNG for imagery with transparency

### Zoom Levels

- **Min Zoom**: 10 (prevents excessive API calls at low zoom)
- **Max Zoom**: 18 (Sentinel-2 resolution limit)

### Performance Tips

1. **Limit concurrent tile requests**: Use request queuing
2. **Implement tile prefetching**: Load adjacent tiles in advance
3. **Use progressive loading**: Show low-res tiles first, then high-res
4. **Cache aggressively**: Store tiles in IndexedDB for offline access

## Error Handling

### Common Errors

1. **Tile Generation Failed**
   - Cause: GEE API error or network issue
   - Solution: Retry with exponential backoff

2. **Cache Storage Failed**
   - Cause: Supabase Storage error
   - Solution: Continue without caching (non-blocking)

3. **Invalid Map ID**
   - Cause: GEE returned invalid Map ID
   - Solution: Regenerate Map ID

### Error Recovery

```typescript
try {
  const tileUrl = await imageryService.generateTileUrl(
    parcelleId,
    geometry,
    date
  );
  // Use tile URL
} catch (error) {
  if (error instanceof SatelliteError) {
    console.error('Tile generation failed:', error.message);
    // Fall back to base map or cached imagery
  }
}
```

## Monitoring

### Cache Statistics

Query cache statistics from the database:

```sql
SELECT 
  COUNT(*) as total_cached_tiles,
  SUM(size_bytes) as total_size_bytes,
  AVG(EXTRACT(EPOCH FROM (NOW() - last_accessed_at))) as avg_age_seconds
FROM satellite_cache_metadata
WHERE data_type = 'imagery';
```

### Cache Hit Rate

Track cache hit rate in application logs:

```typescript
const cacheHits = 0;
const cacheMisses = 0;

// In getCachedTileUrl:
if (cachedUrl) {
  cacheHits++;
} else {
  cacheMisses++;
}

const hitRate = cacheHits / (cacheHits + cacheMisses);
console.log(`Cache hit rate: ${(hitRate * 100).toFixed(2)}%`);
```

## Future Enhancements

1. **Tile Prefetching**: Automatically load adjacent tiles
2. **Progressive Loading**: Show low-res tiles first
3. **WebP Support**: Use WebP format for better compression
4. **CDN Integration**: Serve tiles from CDN for faster delivery
5. **Tile Stitching**: Combine multiple tiles into single image
6. **Custom Styling**: Apply custom color palettes to tiles

## Related Documentation

- [Satellite Imagery Setup](./gee-setup.md)
- [Storage Buckets](./storage-buckets.md)
- [Caching Strategy](./caching.md)
- [API Documentation](../api/satellite.md)
