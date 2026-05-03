# Task 1.1.2 Checklist: Create GEE Service Account

Use this checklist to track your progress through the service account creation process.

## Pre-requisites

- [ ] Task 1.1.1 completed (GEE account approved)
- [ ] Access to Google Cloud Console
- [ ] Google account with appropriate permissions

## Step-by-Step Checklist

### 1. Create Google Cloud Project

- [ ] Navigate to [Google Cloud Console](https://console.cloud.google.com/)
- [ ] Click "New Project"
- [ ] Enter project name: `CocoaTrack-Satellite`
- [ ] Click "Create"
- [ ] Wait for project creation to complete
- [ ] Select the new project from dropdown

**Project ID**: _________________________ (note this down)

### 2. Enable Earth Engine API

- [ ] Navigate to APIs & Services > Library
- [ ] Search for "Earth Engine API"
- [ ] Click on "Earth Engine API"
- [ ] Click "Enable"
- [ ] Verify "API enabled" confirmation appears

### 3. Create Service Account

- [ ] Navigate to IAM & Admin > Service Accounts
- [ ] Click "Create Service Account"
- [ ] Enter service account name: `cocoatrack-earth-engine`
- [ ] Enter description: `Service account for CocoaTrack satellite imagery analysis`
- [ ] Click "Create and Continue"

**Service Account Email**: _________________________ (note this down)

### 4. Grant Permissions

- [ ] Select role: "Earth Engine Resource Viewer" (or "Earth Engine Resource Admin")
- [ ] Click "Continue"
- [ ] Skip optional user access section
- [ ] Click "Done"

### 5. Create JSON Key

- [ ] Click on the service account email in the list
- [ ] Navigate to "Keys" tab
- [ ] Click "Add Key" > "Create new key"
- [ ] Select "JSON" format
- [ ] Click "Create"
- [ ] Verify JSON file downloaded
- [ ] Move file to secure location (NOT in git repository)

**Key File Location**: _________________________ (note this down)

### 6. Register with Earth Engine

- [ ] Navigate to [Earth Engine Code Editor](https://code.earthengine.google.com/)
- [ ] Click "Assets" tab
- [ ] Click "NEW" > "Cloud Project"
- [ ] Enter project ID from Step 1
- [ ] Click "Select"
- [ ] Wait 5-10 minutes for registration to propagate

### 7. Update .gitignore

- [ ] Verify `.gitignore` includes service account key patterns
- [ ] Confirm `gee-service-account.json` is listed
- [ ] Confirm `*-service-account.json` is listed

### 8. Store Credentials

#### Local Development

- [ ] Rename JSON key to `gee-service-account.json`
- [ ] Move to secure location outside repository
- [ ] Note the file path for `.env.local` configuration (Task 1.1.3)

#### Production (Vercel) - To be done later

- [ ] Extract `private_key` from JSON file
- [ ] Extract `client_email` from JSON file
- [ ] Keep these values ready for Vercel environment variable setup

### 9. Verify Setup

- [ ] Run configuration test: `npx ts-node scripts/test-gee-connection.ts`
- [ ] Verify all environment checks pass
- [ ] Confirm no errors in output

## Acceptance Criteria Verification

- [ ] ✅ Google Cloud project created for CocoaTrack
- [ ] ✅ Earth Engine API enabled in Google Cloud Console
- [ ] ✅ Service account created with Earth Engine permissions
- [ ] ✅ Service account JSON key file downloaded and stored securely
- [ ] ✅ Service account registered with Earth Engine
- [ ] ✅ `.gitignore` updated to exclude credential files
- [ ] ✅ Configuration test script runs without errors

## Important Information to Save

Record these values for use in subsequent tasks:

```
Project ID: _________________________
Service Account Email: _________________________
JSON Key File Path: _________________________
```

## Next Steps

After completing this checklist:

1. ✅ Mark Task 1.1.2 as complete in tasks.md
2. ➡️ Proceed to Task 1.1.3: Configure GEE credentials in environment
3. ➡️ Proceed to Task 1.1.4: Test GEE API connection

## Troubleshooting

If you encounter issues, refer to:
- `docs/satellite/gee-service-account-setup.md` - Detailed setup guide
- Troubleshooting section in the setup guide
- [Google Earth Engine Service Account Documentation](https://developers.google.com/earth-engine/guides/service_account)

## Security Reminders

- ⚠️ NEVER commit service account keys to git
- ⚠️ Store keys in secure location with restricted access
- ⚠️ Rotate keys every 90 days
- ⚠️ Use least privilege permissions (Viewer over Admin when possible)
- ⚠️ Monitor API usage regularly
