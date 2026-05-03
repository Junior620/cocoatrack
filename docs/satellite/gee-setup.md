# Google Earth Engine Setup Guide

This guide walks you through setting up Google Earth Engine (GEE) integration for the CocoaTrack satellite imagery analysis feature.

## Overview

Google Earth Engine is a cloud-based platform for planetary-scale geospatial analysis. CocoaTrack uses GEE to access Sentinel-2 satellite imagery for NDVI analysis, deforestation detection, and crop health monitoring.

**Key Information**:
- **Cost**: Free for non-commercial use (250,000 requests/day limit)
- **Imagery Source**: Sentinel-2 (10-20m resolution, 5-day revisit frequency)
- **Setup Time**: 1-3 days (includes GEE account approval)
- **Technical Level**: Intermediate (requires Google Cloud Platform knowledge)

## Prerequisites

Before starting, ensure you have:
- [ ] A Google account
- [ ] Access to Google Cloud Console
- [ ] Basic understanding of service accounts and API keys
- [ ] Admin access to your CocoaTrack deployment

## Step 1: Create Google Earth Engine Account

### 1.1 Sign Up for Earth Engine

1. Navigate to [https://earthengine.google.com/signup](https://earthengine.google.com/signup)
2. Click **"Sign up for Earth Engine"**
3. Select your use case:
   - Choose **"Non-commercial"** for CocoaTrack
   - Select **"Agriculture"** as the primary application
4. Fill out the registration form:
   - **Organization**: Your cooperative or organization name
   - **Project Description**: "Cocoa traceability and crop health monitoring for EUDR compliance"
   - **Country**: Cameroon (or your deployment location)
5. Submit the application

### 1.2 Wait for Approval

- **Typical approval time**: 1-2 business days
- **Check status**: You'll receive an email when approved
- **Access verification**: Once approved, visit [https://code.earthengine.google.com](https://code.earthengine.google.com) to verify access

**Note**: While waiting for approval, you can proceed with Steps 2-3 to prepare your Google Cloud project.

## Step 2: Create Google Cloud Project

### 2.1 Create New Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click the project dropdown at the top
3. Click **"New Project"**
4. Configure the project:
   - **Project name**: `cocoatrack-satellite` (or your preferred name)
   - **Organization**: Select your organization (if applicable)
   - **Location**: Leave as default or select your organization
5. Click **"Create"**
6. **Save your Project ID** - you'll need this later (format: `cocoatrack-satellite-123456`)

### 2.2 Enable Earth Engine API

1. In the Google Cloud Console, ensure your new project is selected
2. Navigate to **"APIs & Services" > "Library"**
3. Search for **"Earth Engine API"**
4. Click on **"Google Earth Engine API"**
5. Click **"Enable"**
6. Wait for the API to be enabled (usually takes 1-2 minutes)

### 2.3 Enable Required APIs

Enable these additional APIs for full functionality:

1. **Cloud Storage API** (for caching imagery)
   - Search for "Cloud Storage API" in the API Library
   - Click "Enable"

2. **Cloud Resource Manager API** (for project management)
   - Search for "Cloud Resource Manager API"
   - Click "Enable"

## Step 3: Create Service Account

Service accounts allow CocoaTrack to authenticate with Google Earth Engine without user interaction.

### 3.1 Create Service Account

1. In Google Cloud Console, navigate to **"IAM & Admin" > "Service Accounts"**
2. Click **"Create Service Account"**
3. Configure the service account:
   - **Service account name**: `cocoatrack-earth-engine`
   - **Service account ID**: `cocoatrack-earth-engine` (auto-generated)
   - **Description**: "Service account for CocoaTrack satellite imagery analysis"
4. Click **"Create and Continue"**

### 3.2 Grant Permissions

1. In the **"Grant this service account access to project"** section:
   - Click **"Select a role"**
   - Search for and select **"Earth Engine Resource Admin"**
   - Click **"Add Another Role"**
   - Search for and select **"Storage Object Viewer"** (for caching)
2. Click **"Continue"**
3. Skip the **"Grant users access to this service account"** section
4. Click **"Done"**

### 3.3 Create and Download Key

1. In the Service Accounts list, find your newly created service account
2. Click on the service account email to open details
3. Navigate to the **"Keys"** tab
4. Click **"Add Key" > "Create new key"**
5. Select **"JSON"** as the key type
6. Click **"Create"**
7. **Save the downloaded JSON file securely** - you'll need it for configuration

**Security Warning**: This JSON file contains sensitive credentials. Never commit it to version control or share it publicly.

### 3.4 Register Service Account with Earth Engine

After your Earth Engine account is approved:

1. Go to [https://code.earthengine.google.com](https://code.earthengine.google.com)
2. Click on **"Assets"** tab in the left sidebar
3. Click the **"New"** button
4. Select **"Cloud Project"**
5. Enter your **Project ID** from Step 2.1
6. Click **"Select"**

This registers your Google Cloud project with Earth Engine.

## Step 4: Configure CocoaTrack Environment

### 4.1 Extract Credentials from JSON Key

Open the downloaded JSON key file. You'll need these values:

```json
{
  "type": "service_account",
  "project_id": "cocoatrack-satellite-123456",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "cocoatrack-earth-engine@cocoatrack-satellite-123456.iam.gserviceaccount.com",
  "client_id": "123456789...",
  ...
}
```

### 4.2 Update Environment Variables

Add these variables to your `.env.local` file (for local development) or your deployment environment:

```bash
# Google Earth Engine Configuration
GOOGLE_EARTH_ENGINE_PROJECT_ID=cocoatrack-satellite-123456
GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT=cocoatrack-earth-engine@cocoatrack-satellite-123456.iam.gserviceaccount.com
GOOGLE_EARTH_ENGINE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"
```

**Important Notes**:
- Replace `cocoatrack-satellite-123456` with your actual Project ID
- Replace the service account email with your actual service account email
- Copy the **entire** `private_key` value including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines
- Keep the newline characters (`\n`) in the private key

### 4.3 Alternative: Use JSON Key File Path (Local Development Only)

For local development, you can use the JSON key file directly:

```bash
# Alternative configuration (local development only)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your-service-account-key.json
```

**Warning**: Do NOT use this approach in production. Use environment variables instead.

### 4.4 Update .env.local.example

The `.env.local.example` file already includes placeholders for GEE configuration. Verify it matches your setup:

```bash
# Google Earth Engine Configuration
GOOGLE_EARTH_ENGINE_PROJECT_ID=your-gcp-project-id
GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_EARTH_ENGINE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"
```

## Step 5: Verify Configuration

### 5.1 Test Authentication

Create a test script to verify your GEE authentication:

```typescript
// scripts/test-gee-auth.ts
import { google } from 'googleapis';

async function testGEEAuth() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT,
        private_key: process.env.GOOGLE_EARTH_ENGINE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/earthengine'],
    });

    const client = await auth.getClient();
    console.log('✅ Authentication successful!');
    console.log('Service Account:', process.env.GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT);
    console.log('Project ID:', process.env.GOOGLE_EARTH_ENGINE_PROJECT_ID);
    
    return true;
  } catch (error) {
    console.error('❌ Authentication failed:', error);
    return false;
  }
}

testGEEAuth();
```

Run the test:

```bash
npx tsx scripts/test-gee-auth.ts
```

### 5.2 Test Sentinel-2 Access

Once authentication works, test Sentinel-2 imagery access:

```typescript
// scripts/test-sentinel2-access.ts
import ee from '@google/earthengine';

async function testSentinel2Access() {
  try {
    // Initialize Earth Engine
    await ee.data.authenticateViaPrivateKey(
      {
        client_email: process.env.GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT!,
        private_key: process.env.GOOGLE_EARTH_ENGINE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      },
      () => {
        ee.initialize(null, null, () => {
          console.log('✅ Earth Engine initialized');
          
          // Test Sentinel-2 access
          const sentinel2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED');
          const count = sentinel2.size();
          
          count.evaluate((result: number) => {
            console.log(`✅ Sentinel-2 access successful! Found ${result} images`);
          });
        });
      }
    );
  } catch (error) {
    console.error('❌ Sentinel-2 access failed:', error);
  }
}

testSentinel2Access();
```

### 5.3 Expected Results

If everything is configured correctly, you should see:

```
✅ Authentication successful!
Service Account: cocoatrack-earth-engine@cocoatrack-satellite-123456.iam.gserviceaccount.com
Project ID: cocoatrack-satellite-123456
✅ Earth Engine initialized
✅ Sentinel-2 access successful! Found 5000000+ images
```

## Step 6: Production Deployment

### 6.1 Vercel Deployment

If deploying to Vercel:

1. Go to your Vercel project dashboard
2. Navigate to **"Settings" > "Environment Variables"**
3. Add the three GEE environment variables:
   - `GOOGLE_EARTH_ENGINE_PROJECT_ID`
   - `GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT`
   - `GOOGLE_EARTH_ENGINE_PRIVATE_KEY`
4. Set the environment to **"Production"** (and optionally Preview/Development)
5. Redeploy your application

### 6.2 Other Platforms

For other platforms (AWS, Azure, etc.), use their secrets management service:

- **AWS**: Use AWS Secrets Manager or Parameter Store
- **Azure**: Use Azure Key Vault
- **Google Cloud**: Use Secret Manager
- **Docker**: Use Docker secrets or environment files

**Security Best Practice**: Never hardcode credentials in your codebase or commit them to version control.

## Troubleshooting

### Issue: "Earth Engine account not registered"

**Symptoms**: Error message when trying to access Earth Engine API

**Solutions**:
1. Verify your Earth Engine account is approved (check email)
2. Ensure you've registered your Cloud Project with Earth Engine (Step 3.4)
3. Wait 24 hours after approval for propagation
4. Try accessing [https://code.earthengine.google.com](https://code.earthengine.google.com) to confirm access

### Issue: "Invalid credentials" or "Authentication failed"

**Symptoms**: 401 Unauthorized errors

**Solutions**:
1. Verify the service account email is correct
2. Check that the private key includes the BEGIN/END lines
3. Ensure newline characters (`\n`) are preserved in the private key
4. Verify the service account has "Earth Engine Resource Admin" role
5. Regenerate the service account key if necessary

### Issue: "Earth Engine API not enabled"

**Symptoms**: Error message about API not being enabled

**Solutions**:
1. Go to Google Cloud Console
2. Navigate to "APIs & Services" > "Library"
3. Search for "Earth Engine API"
4. Click "Enable"
5. Wait 5-10 minutes for propagation

### Issue: "Quota exceeded" or "Rate limit reached"

**Symptoms**: 429 Too Many Requests errors

**Solutions**:
1. Check your API usage in Google Cloud Console
2. Implement caching to reduce API calls (already built into CocoaTrack)
3. Consider upgrading to commercial Earth Engine if needed
4. Monitor usage with the admin dashboard

### Issue: "Service account has no access to Earth Engine"

**Symptoms**: Permission denied errors

**Solutions**:
1. Verify the service account has "Earth Engine Resource Admin" role
2. Ensure the Cloud Project is registered with Earth Engine (Step 3.4)
3. Wait 24 hours after registration for permissions to propagate
4. Try creating a new service account if issues persist

### Issue: Private key format errors

**Symptoms**: "Invalid key format" or parsing errors

**Solutions**:
1. Ensure the private key is enclosed in double quotes
2. Keep the `\n` characters (don't replace with actual newlines in .env file)
3. Don't add extra spaces or line breaks
4. Copy the entire key including BEGIN/END markers

**Correct format**:
```bash
GOOGLE_EARTH_ENGINE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n"
```

**Incorrect format**:
```bash
# ❌ Missing quotes
GOOGLE_EARTH_ENGINE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...

# ❌ Actual newlines instead of \n
GOOGLE_EARTH_ENGINE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBg...
-----END PRIVATE KEY-----"

# ❌ Missing BEGIN/END markers
GOOGLE_EARTH_ENGINE_PRIVATE_KEY="MIIEvQIBADANBg..."
```

### Issue: "Project not found" errors

**Symptoms**: Errors referencing project ID

**Solutions**:
1. Verify the Project ID is correct (check Google Cloud Console)
2. Ensure the project has billing enabled (required for some GCP features)
3. Verify the service account belongs to the correct project
4. Check that the Earth Engine API is enabled for this specific project

## Monitoring and Maintenance

### Monitor API Usage

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **"APIs & Services" > "Dashboard"**
3. Select **"Earth Engine API"**
4. View usage metrics and quotas

### Set Up Usage Alerts

1. In Google Cloud Console, go to **"Billing" > "Budgets & alerts"**
2. Click **"Create Budget"**
3. Set a budget threshold (e.g., alert at 80% of free tier limit)
4. Configure email notifications

### Best Practices

1. **Cache aggressively**: CocoaTrack caches imagery for 24 hours to minimize API calls
2. **Monitor usage**: Check the admin dashboard regularly for API usage statistics
3. **Rotate keys**: Regenerate service account keys annually for security
4. **Use signed URLs**: For client-side imagery access, use signed URLs with expiration
5. **Implement rate limiting**: CocoaTrack includes rate limiting (100 req/min per user)

## Rate Limits and Quotas

### Free Tier Limits

- **Requests per day**: 250,000
- **Concurrent requests**: 100
- **Compute time**: 10,000 compute-seconds per day
- **Storage**: 250 GB (for Earth Engine assets)

### Typical CocoaTrack Usage

Based on 100 active users:
- **Imagery requests**: ~5,000/day (with caching)
- **NDVI calculations**: ~2,000/day
- **Temporal analysis**: ~1,000/day
- **Total**: ~8,000 requests/day (3% of free tier)

**Conclusion**: The free tier is sufficient for most CocoaTrack deployments.

## Security Checklist

Before going to production, verify:

- [ ] Service account key is stored securely (not in version control)
- [ ] Environment variables are set in production environment
- [ ] Service account has minimum required permissions
- [ ] API usage monitoring is configured
- [ ] Rate limiting is enabled in CocoaTrack
- [ ] Signed URLs are used for client-side access
- [ ] Audit logging is enabled for GEE API calls
- [ ] Key rotation schedule is documented

## Next Steps

After completing this setup:

1. ✅ **Test the imagery endpoint**: `GET /api/satellite/imagery?parcelleId=xxx`
2. ✅ **Verify NDVI calculation**: `POST /api/satellite/ndvi`
3. ✅ **Check storage buckets**: Ensure satellite imagery is being cached
4. ✅ **Review documentation**: Read [NDVI Calculation Guide](./ndvi-calculation.md)
5. ✅ **Configure monitoring**: Set up alerts for API usage and errors

## Additional Resources

- [Google Earth Engine Documentation](https://developers.google.com/earth-engine)
- [Sentinel-2 User Guide](https://sentinel.esa.int/web/sentinel/user-guides/sentinel-2-msi)
- [Earth Engine JavaScript API](https://developers.google.com/earth-engine/guides/getstarted)
- [Earth Engine Python API](https://developers.google.com/earth-engine/guides/python_install)
- [CocoaTrack Satellite API Documentation](../api/satellite.md)
- [Storage Buckets Configuration](./storage-buckets.md)

## Support

If you encounter issues not covered in this guide:

1. Check the [Earth Engine Forum](https://groups.google.com/g/google-earth-engine-developers)
2. Review [Stack Overflow questions tagged 'google-earth-engine'](https://stackoverflow.com/questions/tagged/google-earth-engine)
3. Contact the CocoaTrack development team
4. File an issue in the CocoaTrack repository

## Changelog

- **2026-05-03**: Initial documentation created
- **Future**: Updates will be tracked here
