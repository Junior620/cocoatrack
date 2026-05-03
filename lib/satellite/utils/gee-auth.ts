/**
 * Google Earth Engine Authentication Helper
 * 
 * This module provides authentication utilities for Google Earth Engine API
 * using service account credentials. It handles token generation, refresh,
 * and error handling for authentication failures.
 * 
 * Requirements: Task 1.3.2
 * - Authenticate with service account
 * - Refresh authentication token
 * - Handle authentication failures
 */

import { AuthenticationError } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Google Earth Engine authentication configuration
 */
export interface GEEAuthConfig {
  projectId: string;
  serviceAccount: string;
  privateKey: string;
}

/**
 * Authentication token with expiration
 */
export interface AuthToken {
  accessToken: string;
  expiresAt: Date;
  tokenType: string;
}

/**
 * Service account credentials structure (from JSON key file)
 */
interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Google OAuth2 token endpoint
 */
const TOKEN_URI = 'https://oauth2.googleapis.com/token';

/**
 * Earth Engine API scope
 */
const EARTH_ENGINE_SCOPE = 'https://www.googleapis.com/auth/earthengine.readonly';

/**
 * Token expiration buffer (refresh 5 minutes before actual expiration)
 */
const TOKEN_EXPIRATION_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

/**
 * JWT algorithm for signing
 */
const JWT_ALGORITHM = 'RS256';

// ============================================================================
// In-Memory Token Cache
// ============================================================================

/**
 * Cached authentication token
 * In production, consider using Redis or another distributed cache
 */
let cachedToken: AuthToken | null = null;

// ============================================================================
// Authentication Functions
// ============================================================================

/**
 * Get authentication configuration from environment variables
 * 
 * @throws {AuthenticationError} If required environment variables are missing
 * @returns {GEEAuthConfig} Authentication configuration
 */
export function getAuthConfig(): GEEAuthConfig {
  const projectId = process.env.GOOGLE_EARTH_ENGINE_PROJECT_ID;
  const serviceAccount = process.env.GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT;
  const privateKey = process.env.GOOGLE_EARTH_ENGINE_PRIVATE_KEY;

  if (!projectId || !serviceAccount || !privateKey) {
    throw new AuthenticationError(
      'Missing required Google Earth Engine credentials. ' +
      'Please set GOOGLE_EARTH_ENGINE_PROJECT_ID, GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT, ' +
      'and GOOGLE_EARTH_ENGINE_PRIVATE_KEY environment variables.'
    );
  }

  // Unescape newlines in private key (environment variables may escape them)
  const unescapedPrivateKey = privateKey.replace(/\\n/g, '\n');

  return {
    projectId,
    serviceAccount,
    privateKey: unescapedPrivateKey,
  };
}

/**
 * Create a JWT (JSON Web Token) for service account authentication
 * 
 * This function creates a signed JWT that can be exchanged for an access token.
 * The JWT is signed using the service account's private key.
 * 
 * @param {GEEAuthConfig} config - Authentication configuration
 * @returns {Promise<string>} Signed JWT
 * @throws {AuthenticationError} If JWT creation fails
 */
export async function createJWT(config: GEEAuthConfig): Promise<string> {
  try {
    // Import crypto module for signing (Node.js built-in)
    const crypto = await import('crypto');

    // JWT header
    const header = {
      alg: JWT_ALGORITHM,
      typ: 'JWT',
    };

    // JWT claims
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      iss: config.serviceAccount, // Issuer (service account email)
      sub: config.serviceAccount, // Subject (service account email)
      aud: TOKEN_URI, // Audience (token endpoint)
      scope: EARTH_ENGINE_SCOPE, // Requested scope
      iat: now, // Issued at
      exp: now + 3600, // Expires in 1 hour
    };

    // Encode header and claims as base64url
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedClaims = base64UrlEncode(JSON.stringify(claims));

    // Create signature input
    const signatureInput = `${encodedHeader}.${encodedClaims}`;

    // Sign with private key
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    sign.end();

    const signature = sign.sign(config.privateKey);
    const encodedSignature = base64UrlEncode(signature);

    // Combine into JWT
    const jwt = `${signatureInput}.${encodedSignature}`;

    return jwt;
  } catch (error) {
    throw new AuthenticationError(
      `Failed to create JWT: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Exchange JWT for an access token
 * 
 * @param {string} jwt - Signed JWT
 * @returns {Promise<AuthToken>} Access token with expiration
 * @throws {AuthenticationError} If token exchange fails
 */
async function exchangeJWTForToken(jwt: string): Promise<AuthToken> {
  try {
    const response = await fetch(TOKEN_URI, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AuthenticationError(
        `Token exchange failed with status ${response.status}: ${errorText}`
      );
    }

    const data = await response.json();

    if (!data.access_token || !data.expires_in) {
      throw new AuthenticationError(
        'Invalid token response: missing access_token or expires_in'
      );
    }

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    return {
      accessToken: data.access_token,
      expiresAt,
      tokenType: data.token_type || 'Bearer',
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError(
      `Failed to exchange JWT for token: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if a token is expired or about to expire
 * 
 * @param {AuthToken} token - Token to check
 * @returns {boolean} True if token is expired or about to expire
 */
function isTokenExpired(token: AuthToken): boolean {
  const now = Date.now();
  const expiresAt = token.expiresAt.getTime();
  return now >= expiresAt - TOKEN_EXPIRATION_BUFFER_MS;
}

/**
 * Authenticate with Google Earth Engine using service account credentials
 * 
 * This function performs the OAuth2 JWT flow to obtain an access token.
 * The token is cached in memory and reused until it expires.
 * 
 * @returns {Promise<AuthToken>} Authentication token
 * @throws {AuthenticationError} If authentication fails
 * 
 * @example
 * ```typescript
 * const token = await authenticate();
 * console.log('Access token:', token.accessToken);
 * console.log('Expires at:', token.expiresAt);
 * ```
 */
export async function authenticate(): Promise<AuthToken> {
  try {
    // Check if we have a valid cached token
    if (cachedToken && !isTokenExpired(cachedToken)) {
      return cachedToken;
    }

    // Get authentication configuration
    const config = getAuthConfig();

    // Create JWT
    const jwt = await createJWT(config);

    // Exchange JWT for access token
    const token = await exchangeJWTForToken(jwt);

    // Cache the token
    cachedToken = token;

    return token;
  } catch (error) {
    // Clear cached token on authentication failure
    cachedToken = null;

    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError(
      `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Refresh the authentication token
 * 
 * This function forces a new token to be generated, even if the cached token
 * is still valid. Use this when you suspect the token may have been revoked
 * or when you want to ensure you have a fresh token.
 * 
 * @returns {Promise<AuthToken>} New authentication token
 * @throws {AuthenticationError} If token refresh fails
 * 
 * @example
 * ```typescript
 * try {
 *   const newToken = await refreshToken();
 *   console.log('Token refreshed successfully');
 * } catch (error) {
 *   console.error('Token refresh failed:', error);
 * }
 * ```
 */
export async function refreshToken(): Promise<AuthToken> {
  // Clear cached token to force refresh
  cachedToken = null;

  // Authenticate to get a new token
  return authenticate();
}

/**
 * Get the current authentication token (from cache or by authenticating)
 * 
 * This is a convenience function that returns the cached token if valid,
 * or authenticates to get a new token if needed.
 * 
 * @returns {Promise<AuthToken>} Current authentication token
 * @throws {AuthenticationError} If authentication fails
 */
export async function getAuthToken(): Promise<AuthToken> {
  return authenticate();
}

/**
 * Get the access token string (for use in API requests)
 * 
 * @returns {Promise<string>} Access token string
 * @throws {AuthenticationError} If authentication fails
 * 
 * @example
 * ```typescript
 * const accessToken = await getAccessToken();
 * 
 * // Use in API request
 * const response = await fetch('https://earthengine.googleapis.com/v1/..., {
 *   headers: {
 *     'Authorization': `Bearer ${accessToken}`,
 *   },
 * });
 * ```
 */
export async function getAccessToken(): Promise<string> {
  const token = await authenticate();
  return token.accessToken;
}

/**
 * Clear the cached authentication token
 * 
 * Use this function to force re-authentication on the next request.
 * This is useful for testing or when you know the token has been revoked.
 */
export function clearTokenCache(): void {
  cachedToken = null;
}

/**
 * Check if we have a valid cached token
 * 
 * @returns {boolean} True if a valid token is cached
 */
export function hasValidToken(): boolean {
  return cachedToken !== null && !isTokenExpired(cachedToken);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Base64 URL encode a string or buffer
 * 
 * @param {string | Buffer} input - Input to encode
 * @returns {string} Base64 URL encoded string
 */
function base64UrlEncode(input: string | Buffer): string {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Load service account credentials from JSON file
 * 
 * This is an alternative to using environment variables. The JSON file path
 * should be specified in the GOOGLE_APPLICATION_CREDENTIALS environment variable.
 * 
 * @returns {Promise<GEEAuthConfig | null>} Authentication config or null if file not specified
 * @throws {AuthenticationError} If file cannot be read or is invalid
 */
export async function loadCredentialsFromFile(): Promise<GEEAuthConfig | null> {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!credentialsPath) {
    return null;
  }

  try {
    const fs = await import('fs/promises');
    const fileContent = await fs.readFile(credentialsPath, 'utf-8');
    const credentials: ServiceAccountCredentials = JSON.parse(fileContent);

    // Validate required fields
    if (!credentials.project_id || !credentials.client_email || !credentials.private_key) {
      throw new AuthenticationError(
        'Invalid service account credentials file: missing required fields'
      );
    }

    return {
      projectId: credentials.project_id,
      serviceAccount: credentials.client_email,
      privateKey: credentials.private_key,
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError(
      `Failed to load credentials from file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get authentication configuration from file or environment variables
 * 
 * This function tries to load credentials from a JSON file first (if
 * GOOGLE_APPLICATION_CREDENTIALS is set), then falls back to environment
 * variables.
 * 
 * @returns {Promise<GEEAuthConfig>} Authentication configuration
 * @throws {AuthenticationError} If credentials cannot be loaded
 */
export async function getAuthConfigFromFileOrEnv(): Promise<GEEAuthConfig> {
  // Try loading from file first
  const fileConfig = await loadCredentialsFromFile();
  if (fileConfig) {
    return fileConfig;
  }

  // Fall back to environment variables
  return getAuthConfig();
}
