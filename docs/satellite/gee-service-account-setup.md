# Google Earth Engine Service Account Setup

This guide walks you through creating a Google Cloud service account for Google Earth Engine API access in CocoaTrack.

## Prerequisites

- Google account with access to Google Cloud Console
- Google Earth Engine account approved (Task 1.1.1 completed)
- Billing account set up in Google Cloud (optional for free tier)

## Step 1: Create Google Cloud Project

1. Navigate to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top of the page
3. Click **"New Project"**
4. Enter project details:
   - **Project name**: `CocoaTrack-Satellite`
   - **Organization**: (Select your organization if applicable)
   - **Location**: (Select appropriate location)
5. Click **"Create"**
6. Wait for project creation to complete (usually 10-30 seconds)
7. Select the newly created project from the project dropdown

## Step 2: Enable Earth Engine API

1. In the Google Cloud Console, ensure `CocoaTrack-Satellite` project is selected
2. Navigate to **APIs & Services** > **Library** (or use search bar: "API Library")
3. Search for **"Earth Engine API"**
4. Click on **"Earth Engine API"** from the results
5. Click **"Enable"** button
6. Wait for the API to be enabled (usually instant)
7. You should see "API enabled" confirmation

## Step 3: Create Service Account

1. Navigate to **IAM & Admin** > **Service Accounts**
2. Click **"Create Service Account"** at the top
3. Enter service account details:
   - **Service account name**: `cocoatrack-earth-engine`
   - **Service account ID**: `cocoatrack-earth-engine` (auto-generated)
   - **Service account description**: `Service account for CocoaTrack satellite imagery analysis using Google Earth Engine`
4. Click **"Create and Continue"**

## Step 4: Grant Earth Engine Permissions

1. In the "Grant this service account access to project" section:
   - Click **"Select a role"** dropdown
   - Search for **"Earth Engine"**
   - Select **"Earth Engine Resource Admin"** role
   - Alternatively, select **"Earth Engine Resource Viewer"** for read-only access (recommended for production)
2. Click **"Continue"**
3. Skip the "Grant users access to this service account" section (optional)
4. Click **"Done"**

## Step 5: Create and Download JSON Key

1. In the Service Accounts list, find `cocoatrack-earth-engine@cocoatrack-satellite.iam.gserviceaccount.com`
2. Click on the service account email to open details
3. Navigate to the **"Keys"** tab
4. Click **"Add Key"** > **"Create new key"**
5. Select **"JSON"** as the key type
6. Click **"Create"**
7. The JSON key file will automatically download to your computer
8. **IMPORTANT**: Store this file securely - it cannot be recovered if lost

## Step 6: Register Service Account with Earth Engine

1. Navigate to [Google Earth Engine Code Editor](https://code.earthengine.google.com/)
2. Click on **"Assets"** tab in the left panel
3. Click the **"NEW"** button and select **"Cloud Project"**
4. Enter your project ID: `cocoatrack-satellite`
5. Click **"Select"**
6. Alternatively, use the Earth Engine Python API to register:

```python
import ee

# Authenticate with service account
service_account = 'cocoatrack-earth-engine@cocoatrack-satellite.iam.gserviceaccount.com'
credentials = ee.ServiceAccountCredentials(service_account, 'path/to/key.json')
ee.Initialize(credentials)
```

## Step 7: Store Credentials Securely

### For Local Development

1. Rename the downloaded JSON key file to `gee-service-account.json`
2. Move it to a secure location (DO NOT commit to git)
3. Add the path to your `.env.local` file:

```bash
# Google Earth Engine Configuration
GOOGLE_EARTH_ENGINE_PROJECT_ID=cocoatrack-satellite
GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT=cocoatrack-earth-engine@cocoatrack-satellite.iam.gserviceaccount.com
GOOGLE_EARTH_ENGINE_PRIVATE_KEY_PATH=/path/to/gee-service-account.json
```

### For Production (Vercel)

1. Open the JSON key file and copy the `private_key` value
2. In Vercel dashboard, navigate to your project
3. Go to **Settings** > **Environment Variables**
4. Add the following variables:
   - `GOOGLE_EARTH_ENGINE_PROJECT_ID`: `cocoatrack-satellite`
   - `GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT`: `cocoatrack-earth-engine@cocoatrack-satellite.iam.gserviceaccount.com`
   - `GOOGLE_EARTH_ENGINE_PRIVATE_KEY`: (paste the entire private key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
   - `GOOGLE_EARTH_ENGINE_CLIENT_EMAIL`: (copy from JSON key file)

## Step 8: Verify Service Account Access

Create a test script to verify the service account has proper access:

```typescript
// test-gee-connection.ts
import ee from '@google/earthengine';

async function testGEEConnection() {
  try {
    const serviceAccount = process.env.GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT!;
    const privateKey = process.env.GOOGLE_EARTH_ENGINE_PRIVATE_KEY!;
    
    const credentials = new ee.ServiceAccountCredentials(
      serviceAccount,
      privateKey
    );
    
    await ee.data.authenticateViaPrivateKey(credentials);
    await ee.initialize();
    
    // Test query: Get Sentinel-2 image count for a small area
    const testPoint = ee.Geometry.Point([11.5, 4.5]); // Cameroon coordinates
    const collection = ee.ImageCollection('COPERNICUS/S2_SR')
      .filterBounds(testPoint)
      .filterDate('2024-01-01', '2024-01-31')
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));
    
    const count = await collection.size().getInfo();
    console.log(`✅ GEE Connection Successful! Found ${count} Sentinel-2 images.`);
    
    return true;
  } catch (error) {
    console.error('❌ GEE Connection Failed:', error);
    return false;
  }
}

testGEEConnection();
```

Run the test:
```bash
npx ts-node test-gee-connection.ts
```

## Security Best Practices

1. **Never commit service account keys to version control**
   - Add `gee-service-account.json` to `.gitignore`
   - Add `*.json` to `.gitignore` for all credential files

2. **Rotate keys regularly**
   - Create new keys every 90 days
   - Delete old keys after rotation

3. **Use least privilege principle**
   - Use "Earth Engine Resource Viewer" role instead of "Admin" if possible
   - Only grant necessary permissions

4. **Monitor usage**
   - Enable Cloud Audit Logs for the service account
   - Set up alerts for unusual API usage

5. **Secure storage**
   - Use environment variables for credentials
   - Use secret management services (Google Secret Manager, Vercel Environment Variables)
   - Never log or expose private keys

## Troubleshooting

### Error: "Service account does not have Earth Engine access"

**Solution**: Ensure you've registered the service account with Earth Engine:
1. Go to [Earth Engine Code Editor](https://code.earthengine.google.com/)
2. Register your Cloud Project
3. Wait 5-10 minutes for propagation

### Error: "Invalid credentials"

**Solution**: Verify the JSON key file is valid:
1. Check the file is not corrupted
2. Ensure the service account email matches
3. Verify the private key is complete (includes BEGIN/END markers)

### Error: "Earth Engine API not enabled"

**Solution**: Enable the API in Google Cloud Console:
1. Navigate to APIs & Services > Library
2. Search for "Earth Engine API"
3. Click "Enable"

### Error: "Quota exceeded"

**Solution**: Check your API usage:
1. Navigate to APIs & Services > Dashboard
2. Check Earth Engine API quota usage
3. Request quota increase if needed (for free tier: 250,000 requests/day)

## Next Steps

After completing this setup:
1. ✅ Mark Task 1.1.2 as complete
2. ➡️ Proceed to Task 1.1.3: Configure GEE credentials in environment
3. ➡️ Proceed to Task 1.1.4: Test GEE API connection

## References

- [Google Earth Engine Service Account Documentation](https://developers.google.com/earth-engine/guides/service_account)
- [Google Cloud Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
- [Earth Engine Python API Authentication](https://developers.google.com/earth-engine/guides/python_install)
