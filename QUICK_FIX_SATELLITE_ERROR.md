# Quick Fix: Satellite Imagery "Band data arrays are empty" Error

## Problem

You're seeing this error:
```
Failed to fetch NDVI: Band data arrays are empty
```

This happens because the satellite imagery feature requires Google Earth Engine (GEE) integration, which isn't set up yet.

## Quick Solution (Enable Mock Data)

To continue development without setting up GEE, enable the mock imagery service:

### Step 1: Add to `.env.local`

```bash
NEXT_PUBLIC_USE_MOCK_IMAGERY=true
```

### Step 2: Restart the development server

```bash
# Stop the current server (Ctrl+C)
pnpm dev
```

### What This Does

- Uses synthetic satellite data that simulates healthy cocoa vegetation
- Generates realistic NDVI values (0.5 - 0.8 range)
- Creates a 20x20 pixel grid with spatial variation
- Includes some "stressed" areas for realistic testing
- No external API calls required

### Expected Result

After enabling mock data, you should see:
- ✅ NDVI calculations complete successfully
- ✅ Health status badges display (Good, Excellent, etc.)
- ✅ NDVI values in the 0.5-0.8 range
- ✅ Console log: `[NDVI Service] Using mock imagery service for development`

## Long-Term Solution (Production)

For production use, you need to set up Google Earth Engine:

1. **Sign up for GEE**: https://earthengine.google.com/signup
2. **Create service account**: Follow `docs/deployment/vercel-gee-setup.md`
3. **Configure credentials**: Add GEE environment variables to `.env.local`
4. **Disable mock data**: Set `NEXT_PUBLIC_USE_MOCK_IMAGERY=false`

See `SATELLITE_SETUP_REQUIRED.md` for detailed instructions.

## Files Created

- ✅ `lib/satellite/services/imagery.service.mock.ts` - Mock imagery service
- ✅ `SATELLITE_SETUP_REQUIRED.md` - Detailed setup guide
- ✅ Updated `.env.local.example` - Added mock imagery flag
- ✅ Updated `lib/satellite/services/ndvi.service.ts` - Auto-detects mock mode

## Testing

After enabling mock data, test the feature:

1. Navigate to the parcelles page
2. Click on a parcelle to view details
3. Look for the health status badge
4. Try calculating NDVI (if there's a button)
5. Check the browser console for `[MOCK]` log messages

## Important Notes

⚠️ **DO NOT use mock data in production** - It's for development only

⚠️ **Mock data is synthetic** - It doesn't reflect real vegetation conditions

✅ **Safe for development** - No external API calls, no rate limits, instant responses

---

**Need help?** Check `SATELLITE_SETUP_REQUIRED.md` for more details.
