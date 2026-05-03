# Google Earth Engine Quick Reference

## Service Account Information

**Project Name**: CocoaTrack-Satellite  
**Service Account Name**: cocoatrack-earth-engine  
**Service Account Email**: `cocoatrack-earth-engine@[PROJECT_ID].iam.gserviceaccount.com`

## Required Environment Variables

```bash
# Google Cloud Project ID
GOOGLE_EARTH_ENGINE_PROJECT_ID=cocoatrack-satellite

# Service Account Email
GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT=cocoatrack-earth-engine@cocoatrack-satellite.iam.gserviceaccount.com

# Private Key (from JSON key file)
GOOGLE_EARTH_ENGINE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Alternative: Path to JSON key file (local development only)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/gee-service-account.json
```

## Quick Links

- **Google Cloud Console**: https://console.cloud.google.com/
- **Earth Engine Code Editor**: https://code.earthengine.google.com/
- **Earth Engine API Library**: https://console.cloud.google.com/apis/library/earthengine.googleapis.com
- **Service Accounts**: https://console.cloud.google.com/iam-admin/serviceaccounts
- **API Dashboard**: https://console.cloud.google.com/apis/dashboard

## Common Commands

### Test Connection
```bash
npx ts-node scripts/test-gee-connection.ts
```

### Check Environment Variables
```bash
# Check if variables are set
echo $GOOGLE_EARTH_ENGINE_PROJECT_ID
echo $GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT
```

### Verify JSON Key File
```bash
# Check if file exists and is valid JSON
cat /path/to/gee-service-account.json | jq .
```

## API Limits (Free Tier)

- **Requests per day**: 250,000
- **Concurrent requests**: 100
- **Request timeout**: 5 minutes
- **Export size limit**: 10 GB

## Sentinel-2 Specifications

- **Satellite**: Sentinel-2A and Sentinel-2B
- **Revisit frequency**: 5 days (combined)
- **Resolution**: 10m (visible/NIR), 20m (red edge/SWIR), 60m (atmospheric)
- **Bands for NDVI**:
  - B4 (Red): 665 nm, 10m resolution
  - B8 (NIR): 842 nm, 10m resolution

## NDVI Formula

```
NDVI = (NIR - Red) / (NIR + Red)
NDVI = (B8 - B4) / (B8 + B4)
```

**Range**: -1 to +1  
**Healthy vegetation**: 0.6 to 0.9  
**Sparse vegetation**: 0.2 to 0.5  
**Water/clouds**: < 0.2

## Health Status Thresholds

| Status | NDVI Range | Color |
|--------|------------|-------|
| Excellent | 0.7 - 1.0 | Dark Green |
| Good | 0.6 - 0.7 | Green |
| Fair | 0.5 - 0.6 | Yellow |
| Poor | 0.3 - 0.5 | Orange |
| Critical | 0.0 - 0.3 | Red |

## Deforestation Detection

**Threshold**: NDVI decrease > 0.3  
**Minimum area**: 0.5 hectares  
**Baseline date**: December 31, 2020 (EUDR)

## Cloud Cover Handling

**Default threshold**: 20%  
**Cameroon dry season**: November - March (best imagery)  
**Rainy season**: April - October (high cloud cover)

## Troubleshooting Quick Checks

### 1. Service Account Not Working
```bash
# Verify service account exists
gcloud iam service-accounts list --project=cocoatrack-satellite

# Check permissions
gcloud projects get-iam-policy cocoatrack-satellite \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:cocoatrack-earth-engine@*"
```

### 2. API Not Enabled
```bash
# Check if Earth Engine API is enabled
gcloud services list --enabled --project=cocoatrack-satellite | grep earthengine
```

### 3. Invalid Credentials
- Re-download JSON key file
- Verify no extra whitespace in environment variables
- Check that private key includes BEGIN/END markers

### 4. Quota Exceeded
- Check usage: https://console.cloud.google.com/apis/dashboard
- Implement caching to reduce API calls
- Request quota increase if needed

## Security Best Practices

1. ✅ Never commit JSON key files to git
2. ✅ Use environment variables for credentials
3. ✅ Rotate keys every 90 days
4. ✅ Use least privilege (Viewer over Admin)
5. ✅ Monitor API usage regularly
6. ✅ Enable Cloud Audit Logs
7. ✅ Use Secret Manager in production

## Support Resources

- **Documentation**: `docs/satellite/gee-service-account-setup.md`
- **Checklist**: `docs/satellite/TASK_1.1.2_CHECKLIST.md`
- **Test Script**: `scripts/test-gee-connection.ts`
- **GEE Docs**: https://developers.google.com/earth-engine
- **GEE Community**: https://groups.google.com/g/google-earth-engine-developers
