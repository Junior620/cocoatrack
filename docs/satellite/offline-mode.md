# Offline Mode Documentation

## Overview

The satellite imagery analysis feature includes comprehensive offline support to enable users to access previously loaded satellite data in areas with poor or no internet connectivity. This is particularly important for field operations in rural Cameroon where network coverage may be limited or unreliable.

## How Offline Mode Works

### Multi-Layer Caching Architecture

The system implements a three-tier caching strategy:

1. **Client-Side Cache (IndexedDB)**: Stores imagery and NDVI data in the browser for offline access
2. **Server-Side Cache (Supabase Storage)**: Stores imagery tiles and raster data with 90-day retention
3. **Database Cache (PostgreSQL)**: Stores NDVI results and metadata indefinitely

### Automatic Caching

When you view satellite imagery or NDVI analysis for a parcelle while online, the system automatically:

- Stores the imagery tiles in IndexedDB
- Caches NDVI calculation results
- Saves health status and temporal analysis data
- Records metadata (cache date, size, expiration)

### Offline Detection

The system automatically detects when you lose internet connectivity and:

- Switches to cached data mode
- Displays a "cached data" indicator with the cache date
- Disables features that require real-time data
- Provides clear feedback about data freshness

## What Works Offline

### ✅ Fully Available Offline

The following features work completely offline using cached data:

1. **Satellite Imagery Display**
   - View previously loaded satellite imagery overlays
   - Adjust opacity controls
   - Switch between Leaflet and Google Maps base layers
   - Pan and zoom within cached parcelles

2. **NDVI Visualization**
   - View cached NDVI color overlays
   - Display NDVI statistics (mean, min, max, std dev)
   - View health status badges and indicators
   - Access NDVI legends and color scales

3. **Health Status Information**
   - View current health status for cached parcelles
   - See health status trends (improving, stable, declining)
   - Read health status recommendations
   - View health status distribution at cooperative level

4. **Temporal Analysis (Limited)**
   - View previously loaded temporal data
   - Navigate temporal slider for cached dates
   - View NDVI trends over time
   - See significant change markers

5. **Deforestation Alerts**
   - View existing deforestation alerts
   - Read alert details and metadata
   - Access before/after imagery comparisons (if cached)

6. **Map Navigation**
   - View parcelle boundaries and geometries
   - Use map controls (zoom, pan, layer switching)
   - View map popups with cached data
   - Access parcelle detail pages

7. **Data Export (Limited)**
   - Export cached temporal data as CSV
   - Generate KML files from cached data
   - Download previously generated reports

### ⚠️ Limited Functionality Offline

These features have reduced functionality when offline:

1. **Temporal Slider**
   - Can only view dates that were previously loaded
   - Cannot load new dates or refresh imagery
   - Warning displayed for uncached dates

2. **Multi-Parcelle Analysis**
   - Only works for parcelles that are already cached
   - Cannot analyze new parcelles
   - Aggregate statistics limited to cached data

3. **KML Export**
   - Can only export cached parcelle data
   - Temporal KML limited to cached date ranges
   - Cannot include real-time NDVI overlays

### ❌ Not Available Offline

These features require internet connectivity:

1. **New NDVI Calculations**
   - Cannot calculate NDVI for new dates
   - Cannot force recalculation of existing NDVI
   - Cannot retrieve new satellite imagery

2. **Deforestation Detection**
   - Cannot run new deforestation checks
   - Cannot acknowledge or dispute alerts (requires database write)
   - Cannot generate new deforestation reports

3. **Yield Predictions**
   - Cannot calculate new yield predictions
   - Cannot update prediction models
   - Cannot input actual yield data

4. **Certification Reports**
   - Cannot generate new EUDR compliance reports
   - Cannot retrieve baseline imagery for new parcelles
   - Cannot digitally sign reports

5. **Cache Management**
   - Cannot manually refresh cache (requires API access)
   - Cannot sync with server-side cache
   - Cannot update cache metadata

6. **Notifications**
   - Cannot send or receive notifications
   - Cannot update notification preferences
   - Cannot mark notifications as read

## Cache Management

### Cache Capacity

- **Maximum Parcelles**: 50 parcelles per user device
- **Storage Limit**: Approximately 500 MB (varies by device)
- **Eviction Policy**: Least Recently Used (LRU)
- **Cache TTL**: 30 days for imagery, indefinite for NDVI results

### Cache Status Indicators

The system displays cache status for each parcelle:

- **🟢 Cached (Fresh)**: Data cached within last 7 days
- **🟡 Cached (Stale)**: Data cached 8-30 days ago
- **🔴 Not Cached**: No offline data available
- **⚠️ Partial Cache**: Some data cached, some missing

### Manual Cache Management

#### Viewing Cache Statistics

Access cache statistics from the satellite imagery settings:

1. Navigate to **Settings** → **Satellite Imagery**
2. View cache statistics:
   - Total cached parcelles
   - Total storage used
   - Cache hit rate
   - Oldest cached data

#### Refreshing Cache

To manually refresh cached data for specific parcelles:

1. Select parcelles from the list
2. Click **"Refresh Cache"** button
3. System will reload imagery and NDVI data
4. Requires internet connectivity

#### Clearing Cache

To free up storage space:

1. Navigate to **Settings** → **Satellite Imagery**
2. Click **"Clear Cache"** button
3. Choose option:
   - **Clear All**: Remove all cached data
   - **Clear Stale**: Remove data older than 30 days
   - **Clear Selected**: Remove specific parcelles

**Warning**: Clearing cache will remove offline access to satellite data.

### Prioritizing Parcelles for Offline Access

To ensure important parcelles are always cached:

1. Mark parcelles as **favorites** (⭐ icon)
2. Favorite parcelles are:
   - Cached with higher priority
   - Protected from LRU eviction
   - Automatically refreshed when online
   - Loaded first when viewing maps

## Offline Workflow Best Practices

### Before Going to the Field

1. **Pre-load Critical Parcelles**
   - Open each parcelle you'll need offline
   - Wait for imagery and NDVI to fully load
   - Verify cache status shows 🟢 (cached)

2. **Mark Favorites**
   - Star parcelles you'll visit frequently
   - System will prioritize these for caching

3. **Check Cache Statistics**
   - Verify sufficient storage available
   - Clear stale data if needed
   - Note cache dates for data freshness

4. **Download Reports**
   - Generate any needed certification reports
   - Export temporal data as CSV
   - Save KML files for offline viewing

### While Offline in the Field

1. **Check Cache Indicators**
   - Look for "cached data" badge
   - Note cache date for data freshness
   - Understand limitations of stale data

2. **Use Cached Features**
   - View satellite imagery overlays
   - Check health status indicators
   - Review NDVI trends
   - Access deforestation alerts

3. **Take Notes**
   - Document observations for later entry
   - Note parcelles needing attention
   - Record any issues or anomalies

4. **Avoid Unsupported Actions**
   - Don't attempt new NDVI calculations
   - Don't try to acknowledge alerts
   - Don't generate new reports

### After Returning Online

1. **Sync Data**
   - System automatically syncs when online
   - Review any pending notifications
   - Check for new deforestation alerts

2. **Refresh Cache**
   - Update cached parcelles with latest data
   - Recalculate NDVI if needed
   - Generate updated reports

3. **Enter Field Observations**
   - Add notes from field visit
   - Acknowledge or dispute alerts
   - Update parcelle metadata

## Limitations and Considerations

### Data Freshness

**Stale Data Warning**: Cached data older than 30 days displays a warning:

> ⚠️ **Données en cache**: Ces données datent du [date]. Connectez-vous à Internet pour obtenir les dernières informations.

**Impact of Stale Data**:
- NDVI values may not reflect current conditions
- Health status may be outdated
- Deforestation alerts may be incomplete
- Yield predictions may be less accurate

**Recommendation**: Refresh cache at least weekly for active parcelles.

### Storage Limitations

**Browser Storage Limits**:
- Chrome/Edge: ~500 MB per origin
- Firefox: ~500 MB per origin
- Safari: ~1 GB per origin (iOS may be lower)

**Managing Storage**:
- System automatically evicts least recently used data
- Favorite parcelles are protected from eviction
- Clear stale cache regularly to free space
- Monitor storage usage in settings

### Network Connectivity

**Partial Connectivity**:
- System may work slowly with poor connection
- Some features may timeout and fall back to cache
- Cache refresh may fail with unstable connection

**Recommendation**: Use offline mode intentionally rather than relying on poor connectivity.

### Device Compatibility

**Supported Browsers**:
- ✅ Chrome 90+ (desktop and mobile)
- ✅ Firefox 88+ (desktop and mobile)
- ✅ Safari 14+ (desktop and mobile)
- ✅ Edge 90+ (desktop)

**Not Supported**:
- ❌ Internet Explorer
- ❌ Older mobile browsers
- ❌ Browsers with IndexedDB disabled

### Mobile Considerations

**Mobile-Specific Limitations**:
- Reduced cache capacity (typically 50-100 MB)
- Fewer parcelles can be cached (10-20 vs 50)
- Background cache eviction by OS
- Battery impact of cache operations

**Mobile Best Practices**:
- Cache only essential parcelles
- Clear cache more frequently
- Use Wi-Fi for cache refresh
- Monitor battery usage

## Troubleshooting

### Problem: "No cached data available"

**Symptoms**: Offline indicator shows, but no data displays

**Causes**:
- Parcelle was never viewed while online
- Cache was cleared manually
- Browser storage was cleared
- Cache expired (>30 days old)

**Solutions**:
1. Connect to internet and load parcelle
2. Wait for imagery and NDVI to fully load
3. Verify cache status shows 🟢
4. Try again offline

### Problem: "Cache storage full"

**Symptoms**: Error message when trying to cache new parcelles

**Causes**:
- 50 parcelle limit reached
- Browser storage quota exceeded
- Large imagery files consuming space

**Solutions**:
1. Clear stale cache (>30 days)
2. Remove non-favorite parcelles
3. Clear browser cache and cookies
4. Use "Clear Selected" to remove specific parcelles

### Problem: "Cached data is stale"

**Symptoms**: Warning message about old data

**Causes**:
- Data cached more than 30 days ago
- No internet connection to refresh
- Automatic refresh failed

**Solutions**:
1. Connect to internet
2. Click "Refresh Cache" button
3. Wait for data to reload
4. Verify cache date is recent

### Problem: "Some features not working offline"

**Symptoms**: Buttons disabled, features grayed out

**Causes**:
- Feature requires real-time data
- Feature requires database write
- Feature requires external API

**Solutions**:
1. Check "What Works Offline" section above
2. Note which features are unavailable
3. Plan to use these features when online
4. Use cached alternatives where possible

### Problem: "Imagery not displaying offline"

**Symptoms**: Map shows but no satellite overlay

**Causes**:
- Imagery tiles not fully cached
- Cache corrupted or incomplete
- Browser storage cleared
- Tile URLs expired

**Solutions**:
1. Connect to internet
2. Reload parcelle page
3. Wait for imagery to fully load
4. Verify cache status
5. Try clearing and refreshing cache

### Problem: "Temporal slider shows no dates"

**Symptoms**: Slider is empty or shows only one date

**Causes**:
- Only current date was cached
- Historical dates not loaded while online
- Temporal data not included in cache

**Solutions**:
1. Connect to internet
2. Move temporal slider through date range
3. Wait for each date to load
4. System will cache loaded dates
5. Try again offline

### Problem: "Cache not updating automatically"

**Symptoms**: Old data persists despite being online

**Causes**:
- Cache TTL not expired (24 hours for imagery)
- Automatic refresh disabled
- Network issues preventing refresh
- Browser cache settings

**Solutions**:
1. Use "Refresh Cache" button manually
2. Check internet connection
3. Clear browser cache
4. Reload page with Ctrl+Shift+R (hard refresh)

## Technical Details

### IndexedDB Schema

The offline cache uses IndexedDB with the following structure:

**Database**: `cocoatrack-satellite-cache`

**Object Stores**:

1. **imagery**
   - Key: `{parcelleId}_{date}`
   - Value: Blob (imagery tiles)
   - Indexes: parcelleId, date, cacheDate

2. **ndvi**
   - Key: `{parcelleId}_{date}`
   - Value: NDVIResult object
   - Indexes: parcelleId, date, healthStatus

3. **metadata**
   - Key: cacheKey
   - Value: Cache metadata (size, expiration, access count)
   - Indexes: parcelleId, expiresAt, lastAccessedAt

### Cache Invalidation

Cache entries are invalidated when:

1. **TTL Expired**: Imagery >30 days old
2. **Manual Refresh**: User clicks "Refresh Cache"
3. **Storage Full**: LRU eviction triggered
4. **Data Updated**: New NDVI calculation for same date
5. **Parcelle Deleted**: All cache entries removed

### Performance Optimization

**Cache Read Performance**:
- IndexedDB queries use indexes for fast lookup
- Imagery blobs loaded asynchronously
- NDVI results cached in memory after first read
- Metadata pre-loaded on app initialization

**Cache Write Performance**:
- Imagery tiles written in batches
- NDVI results written immediately
- Metadata updated asynchronously
- Background eviction to avoid blocking UI

## Frequently Asked Questions

### Q: How much data does caching use?

**A**: Approximately 5-10 MB per parcelle, depending on:
- Parcelle size (larger parcelles = more imagery tiles)
- Number of cached dates (temporal data)
- NDVI raster resolution
- Metadata and statistics

Typical usage: 250-500 MB for 50 parcelles.

### Q: Does offline mode work on mobile?

**A**: Yes, but with reduced capacity:
- Mobile devices typically cache 10-20 parcelles (vs 50 on desktop)
- Storage limits are lower (50-100 MB vs 500 MB)
- OS may evict cache more aggressively
- Battery impact should be considered

### Q: Can I use offline mode without ever going online?

**A**: No. You must be online at least once to:
- Load initial satellite imagery
- Calculate NDVI values
- Cache data for offline access

After initial caching, you can work offline indefinitely (within 30-day TTL).

### Q: What happens if I exceed the 50 parcelle limit?

**A**: The system automatically evicts the least recently used parcelle to make room for the new one. Favorite parcelles are protected from eviction.

### Q: Can I increase the cache limit?

**A**: No, the 50 parcelle limit is hardcoded for performance and storage reasons. However, you can:
- Prioritize important parcelles as favorites
- Clear stale cache regularly
- Use multiple devices for different regions

### Q: Does offline mode work with deforestation alerts?

**A**: Partially. You can:
- ✅ View existing alerts
- ✅ Read alert details
- ❌ Acknowledge or dispute alerts (requires database write)
- ❌ Run new deforestation checks (requires API access)

### Q: How do I know if data is cached?

**A**: Look for cache indicators:
- 🟢 Green badge: Fresh cached data (<7 days)
- 🟡 Yellow badge: Stale cached data (8-30 days)
- 🔴 Red badge: Not cached
- "Cached data" label with date

### Q: Can I export data while offline?

**A**: Yes, but only cached data:
- ✅ Export temporal CSV for cached dates
- ✅ Generate KML from cached parcelles
- ❌ Generate new certification reports
- ❌ Include real-time NDVI overlays

### Q: What happens when I go back online?

**A**: The system automatically:
- Syncs any pending changes
- Checks for new deforestation alerts
- Updates notification status
- Refreshes stale cache (if enabled)
- Resumes full functionality

### Q: Is offline mode secure?

**A**: Yes. Cached data is:
- Stored locally in browser (not transmitted)
- Subject to same authentication as online mode
- Cleared when you log out
- Protected by browser security policies

However, be aware that cached data persists in browser storage until cleared.

## Support and Feedback

### Getting Help

If you encounter issues with offline mode:

1. **Check this documentation** for troubleshooting steps
2. **Contact support** at support@cocoatrack.cm
3. **Report bugs** through the in-app feedback form
4. **Request features** via the feature request portal

### Providing Feedback

Help us improve offline mode by:

- Reporting which features you use most offline
- Sharing your field workflow and challenges
- Suggesting improvements to cache management
- Testing new offline features in beta

### Known Issues

Current known limitations:

1. **Safari iOS**: Cache may be evicted aggressively by OS
2. **Firefox Private Mode**: IndexedDB disabled, offline mode unavailable
3. **Large Parcelles**: May exceed cache size limits (>50 hectares)
4. **Slow Devices**: Cache operations may impact performance

These issues are being addressed in future updates.

---

**Last Updated**: May 10, 2026  
**Version**: 1.0  
**Applies to**: CocoaTrack Satellite Imagery Analysis v1.0+
