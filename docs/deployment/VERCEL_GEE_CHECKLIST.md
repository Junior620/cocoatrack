# Vercel Google Earth Engine Configuration Checklist

This checklist ensures all Google Earth Engine credentials are properly configured in Vercel for production deployment.

## ✅ Configuration Checklist

### Local Environment (Completed)

- [x] `GOOGLE_EARTH_ENGINE_PROJECT_ID` added to `.env.local`
- [x] `GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT` added to `.env.local`
- [x] `GOOGLE_EARTH_ENGINE_PRIVATE_KEY` added to `.env.local`
- [x] `.env.local.example` updated with placeholder values and documentation
- [x] Documentation created for GEE setup

### Vercel Production Environment (Action Required)

Follow these steps to complete the production configuration:

#### Step 1: Access Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your CocoaTrack project
3. Navigate to **Settings** → **Environment Variables**

#### Step 2: Add Environment Variables

Add the following three environment variables:

##### Variable 1: GOOGLE_EARTH_ENGINE_PROJECT_ID

```
Name: GOOGLE_EARTH_ENGINE_PROJECT_ID
Value: ste-scpb
Environments: ☑ Production ☑ Preview ☑ Development
```

##### Variable 2: GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT

```
Name: GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT
Value: gee-service-account@ste-scpb.iam.gserviceaccount.com
Environments: ☑ Production ☑ Preview ☑ Development
```

##### Variable 3: GOOGLE_EARTH_ENGINE_PRIVATE_KEY

```
Name: GOOGLE_EARTH_ENGINE_PRIVATE_KEY
Value: [Copy the entire GOOGLE_EARTH_ENGINE_PRIVATE_KEY value from your .env.local file]
Environments: ☑ Production ☑ Preview ☑ Development
```

**Important Notes for Private Key:**
- Include the quotes around the key
- Include the `\n` characters (do not replace with actual newlines)
- Include the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` markers
- The value should look like: `"-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"`

#### Step 3: Verify Configuration

After adding all variables:

1. Click **Save** for each variable
2. Trigger a new deployment or redeploy your project
3. Check deployment logs for any authentication errors
4. Test the satellite imagery feature in production

## 🔍 Verification Steps

### 1. Check Environment Variables in Vercel

```bash
# In Vercel dashboard, verify all three variables are present:
✓ GOOGLE_EARTH_ENGINE_PROJECT_ID
✓ GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT
✓ GOOGLE_EARTH_ENGINE_PRIVATE_KEY
```

### 2. Test GEE Connection Locally

Run the test script to verify local configuration:

```bash
npm run test:gee-connection
```

Expected output:
```
✅ Google Earth Engine authentication successful
✅ Service Account: gee-service-account@ste-scpb.iam.gserviceaccount.com
✅ Project ID: ste-scpb
```

### 3. Test in Production

After deploying to Vercel:

1. Navigate to a parcelle detail page
2. Click on "Satellite Imagery" or "NDVI Analysis"
3. Verify that imagery loads without authentication errors
4. Check Vercel deployment logs for any GEE-related errors

## 📚 Additional Resources

- [Vercel GEE Setup Guide](./vercel-gee-setup.md) - Detailed setup instructions
- [GEE Service Account Setup](../satellite/gee-service-account-setup.md) - Service account creation guide
- [GEE Quick Reference](../satellite/GEE_QUICK_REFERENCE.md) - Quick reference for GEE configuration

## 🔒 Security Reminders

- ✅ `.env.local` is in `.gitignore` (never commit credentials)
- ✅ Use Vercel's encrypted environment variable storage
- ⚠️ Rotate service account keys every 90 days
- ⚠️ Monitor API usage in Google Cloud Console
- ⚠️ Limit service account permissions to Earth Engine API only

## 🐛 Troubleshooting

### Authentication Errors in Production

If you see "Authentication failed" errors:

1. Verify the private key format in Vercel includes `\n` characters
2. Ensure the key is wrapped in double quotes
3. Check that all three variables are set in the correct environment
4. Redeploy after adding/updating variables

### Missing Environment Variables

If variables are not accessible:

1. Verify variables are added to Production environment
2. Check variable names match exactly (case-sensitive)
3. Redeploy the application after adding variables

### Rate Limiting Issues

If you encounter rate limits:

1. Check API usage in Google Cloud Console
2. Implement Redis caching (recommended for production)
3. Consider Earth Engine commercial license if needed

## ✅ Task Completion

Once all steps are completed:

- [ ] All three environment variables added to Vercel
- [ ] Variables configured for Production, Preview, and Development
- [ ] Application redeployed
- [ ] Satellite imagery feature tested in production
- [ ] No authentication errors in deployment logs

**Task Status**: Ready for Vercel configuration
**Next Step**: Add environment variables to Vercel dashboard following Step 2 above
