# Satellite Utility Functions

This directory contains utility functions for the satellite imagery analysis feature.

## GEE Authentication (`gee-auth.ts`)

Google Earth Engine authentication helper that implements OAuth2 JWT flow for service account authentication.

### Features

- **Service Account Authentication**: Authenticate using GEE service account credentials
- **Token Caching**: Automatic in-memory caching of access tokens
- **Token Refresh**: Automatic token refresh when expired
- **Error Handling**: Comprehensive error handling with descriptive messages
- **Multiple Credential Sources**: Support for environment variables or JSON key file

### Setup

#### 1. Create Google Earth Engine Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Earth Engine API: https://console.cloud.google.com/apis/library/earthengine.googleapis.com
4. Create a service account with Earth Engine permissions
5. Download the JSON key file
6. Register for Earth Engine access: https://earthengine.google.com/signup

#### 2. Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# Google Cloud Project ID
GOOGLE_EARTH_ENGINE_PROJECT_ID=your-gcp-project-id

# Service Account Email
GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT=your-service-account@your-project.iam.gserviceaccount.com

# Service Account Private Key (from JSON key file)
GOOGLE_EARTH_ENGINE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"
```

**Alternative**: Use JSON key file path:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your-service-account-key.json
```

### Usage

#### Basic Authentication

```typescript
import { authenticate, getAccessToken } from '@/lib/satellite/utils/gee-auth';

// Get authentication token
const token = await authenticate();
console.log('Access token:', token.accessToken);
console.log('Expires at:', token.expiresAt);

// Or get just the access token string
const accessToken = await getAccessToken();
```

#### Using in API Requests

```typescript
import { getAccessToken } from '@/lib/satellite/utils/gee-auth';

// Make authenticated request to Google Earth Engine
const accessToken = await getAccessToken();

const response = await fetch('https://earthengine.googleapis.com/v1/projects/PROJECT_ID/...', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
});
```

#### Token Refresh

```typescript
import { refreshToken, hasValidToken } from '@/lib/satellite/utils/gee-auth';

// Check if we have a valid cached token
if (!hasValidToken()) {
  // Force refresh if needed
  await refreshToken();
}
```

#### Cache Management

```typescript
import { clearTokenCache } from '@/lib/satellite/utils/gee-auth';

// Clear cached token (forces re-authentication on next request)
clearTokenCache();
```

### API Reference

#### `authenticate(): Promise<AuthToken>`

Authenticate with Google Earth Engine using service account credentials. Returns a cached token if available and valid, otherwise performs OAuth2 JWT flow.

**Returns**: `Promise<AuthToken>` - Authentication token with expiration

**Throws**: `AuthenticationError` - If authentication fails

#### `refreshToken(): Promise<AuthToken>`

Force a new token to be generated, even if cached token is still valid.

**Returns**: `Promise<AuthToken>` - New authentication token

**Throws**: `AuthenticationError` - If token refresh fails

#### `getAuthToken(): Promise<AuthToken>`

Get the current authentication token (from cache or by authenticating).

**Returns**: `Promise<AuthToken>` - Current authentication token

**Throws**: `AuthenticationError` - If authentication fails

#### `getAccessToken(): Promise<string>`

Get the access token string for use in API requests.

**Returns**: `Promise<string>` - Access token string

**Throws**: `AuthenticationError` - If authentication fails

#### `clearTokenCache(): void`

Clear the cached authentication token. Forces re-authentication on next request.

#### `hasValidToken(): boolean`

Check if we have a valid cached token.

**Returns**: `boolean` - True if a valid token is cached

#### `getAuthConfig(): GEEAuthConfig`

Get authentication configuration from environment variables.

**Returns**: `GEEAuthConfig` - Authentication configuration

**Throws**: `AuthenticationError` - If required environment variables are missing

#### `createJWT(config: GEEAuthConfig): Promise<string>`

Create a signed JWT for service account authentication.

**Parameters**:
- `config: GEEAuthConfig` - Authentication configuration

**Returns**: `Promise<string>` - Signed JWT

**Throws**: `AuthenticationError` - If JWT creation fails

### Types

```typescript
interface GEEAuthConfig {
  projectId: string;
  serviceAccount: string;
  privateKey: string;
}

interface AuthToken {
  accessToken: string;
  expiresAt: Date;
  tokenType: string;
}
```

### Error Handling

All authentication functions throw `AuthenticationError` on failure:

```typescript
import { authenticate } from '@/lib/satellite/utils/gee-auth';
import { AuthenticationError } from '@/lib/satellite/types';

try {
  const token = await authenticate();
  // Use token...
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Status code:', error.statusCode);
  }
}
```

### Token Caching

Tokens are cached in memory with automatic expiration handling:

- Tokens are cached for their full lifetime (typically 1 hour)
- Automatic refresh 5 minutes before expiration
- Cache is cleared on authentication failure
- Cache is shared across all requests in the same process

**Note**: In production with multiple server instances, consider using Redis or another distributed cache for token sharing.

### Security Considerations

1. **Never expose credentials to client**: All authentication must happen server-side
2. **Use environment variables**: Never commit credentials to version control
3. **Rotate keys regularly**: Follow Google Cloud security best practices
4. **Monitor API usage**: Track authentication failures and unusual patterns
5. **Use secrets manager in production**: Consider using Google Secret Manager or similar

### Testing

Unit tests focus on configuration and error handling:

```bash
npm test -- tests/satellite/utils/gee-auth.test.ts
```

Integration tests with real credentials:

```bash
# Set up valid credentials first
npm test -- tests/satellite/integration/gee-auth.integration.test.ts
```

### Troubleshooting

#### "Missing required Google Earth Engine credentials"

- Ensure all three environment variables are set: `GOOGLE_EARTH_ENGINE_PROJECT_ID`, `GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT`, `GOOGLE_EARTH_ENGINE_PRIVATE_KEY`
- Check that `.env.local` is loaded correctly

#### "Failed to create JWT: error:1E08010C:DECODER routines::unsupported"

- Private key format is invalid
- Ensure private key includes BEGIN/END markers
- Check for proper newline escaping (`\n` in environment variables)

#### "Token exchange failed with status 401"

- Service account email is incorrect
- Private key doesn't match service account
- Service account doesn't have Earth Engine permissions

#### "Token exchange failed with status 403"

- Service account doesn't have Earth Engine API access
- Project doesn't have Earth Engine API enabled
- Need to register for Earth Engine access

### Rate Limiting

Google Earth Engine free tier limits:
- 250,000 requests per day
- Token caching helps minimize authentication requests
- Monitor usage in admin dashboard

### References

- [Google Earth Engine Documentation](https://developers.google.com/earth-engine)
- [Google Cloud Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
- [OAuth 2.0 JWT Flow](https://developers.google.com/identity/protocols/oauth2/service-account)
