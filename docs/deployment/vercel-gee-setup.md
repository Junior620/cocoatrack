# Google Earth Engine Configuration for Vercel Production

This guide explains how to configure Google Earth Engine credentials in Vercel for production deployment.

## Prerequisites

- Vercel project connected to your repository
- Google Earth Engine service account credentials (JSON key file)
- Access to Vercel project settings

## Environment Variables to Configure

Add the following environment variables in your Vercel project settings:

### 1. Navigate to Vercel Environment Variables

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your CocoaTrack project
3. Go to **Settings** → **Environment Variables**

### 2. Add Google Earth Engine Variables

Add each of the following variables:

#### GOOGLE_EARTH_ENGINE_PROJECT_ID

- **Name**: `GOOGLE_EARTH_ENGINE_PROJECT_ID`
- **Value**: Your Google Cloud Project ID (e.g., `ste-scpb`)
- **Environment**: Production, Preview, Development (select all)

#### GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT

- **Name**: `GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT`
- **Value**: Your service account email (format: `service-account-name@project-id.iam.gserviceaccount.com`)
- **Environment**: Production, Preview, Development (select all)

#### GOOGLE_EARTH_ENGINE_PRIVATE_KEY

- **Name**: `GOOGLE_EARTH_ENGINE_PRIVATE_KEY`
- **Value**: The complete private key from your JSON key file, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines
- **Environment**: Production, Preview, Development (select all)
- **Important**: 
  - Copy the entire `private_key` value from your JSON key file
  - Include the newline characters (`\n`) in the key
  - Wrap the entire value in double quotes
  - Example format: `"-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"`

### 3. Optional Variables

#### SENTINEL2_CLOUD_COVER_THRESHOLD

- **Name**: `SENTINEL2_CLOUD_COVER_THRESHOLD`
- **Value**: `20` (default, adjust as needed)
- **Environment**: Production, Preview, Development

#### REDIS_URL (for caching)

- **Name**: `REDIS_URL`
- **Value**: Your Redis connection string (if using Redis for caching)
- **Environment**: Production, Preview, Development

## Verification

After adding the environment variables:

1. Trigger a new deployment or redeploy your project
2. Check the deployment logs for any authentication errors
3. Test the satellite imagery feature in production
4. Verify that imagery loads correctly for test parcelles

## Security Best Practices

1. **Never commit credentials to Git**: The `.env.local` file is in `.gitignore`
2. **Use Vercel's encrypted storage**: Environment variables in Vercel are encrypted at rest
3. **Rotate keys periodically**: Generate new service account keys every 90 days
4. **Limit service account permissions**: Only grant Earth Engine API access
5. **Monitor API usage**: Track Google Earth Engine API usage in Google Cloud Console

## Troubleshooting

### Authentication Errors

If you see authentication errors in production:

1. Verify the private key format includes `\n` characters
2. Ensure the key is wrapped in double quotes
3. Check that the service account has Earth Engine API enabled
4. Verify the project ID matches your Google Cloud project

### Rate Limiting

If you encounter rate limit errors:

1. Check your API usage in Google Cloud Console
2. Implement caching with Redis (recommended for production)
3. Consider upgrading to Earth Engine commercial license if needed

### Missing Environment Variables

If variables are not accessible in your code:

1. Ensure variables are added to the correct environment (Production/Preview/Development)
2. Redeploy after adding new variables
3. Check that variable names match exactly (case-sensitive)

## Additional Resources

- [Google Earth Engine Authentication](https://developers.google.com/earth-engine/guides/service_account)
- [Vercel Environment Variables Documentation](https://vercel.com/docs/concepts/projects/environment-variables)
- [Google Cloud Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
