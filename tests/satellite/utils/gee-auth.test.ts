/**
 * Unit tests for Google Earth Engine authentication helper
 * 
 * Tests configuration, error handling, and caching behavior.
 * Note: Full authentication flow requires valid GEE credentials and is tested in integration tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getAuthConfig,
  clearTokenCache,
  hasValidToken,
} from '../../../lib/satellite/utils/gee-auth';
import { AuthenticationError } from '../../../lib/satellite/types';

// ============================================================================
// Test Setup
// ============================================================================

// Mock environment variables
const mockEnv = {
  GOOGLE_EARTH_ENGINE_PROJECT_ID: 'test-project-id',
  GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT: 'test-service@test-project.iam.gserviceaccount.com',
  GOOGLE_EARTH_ENGINE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC\n-----END PRIVATE KEY-----\n',
};

// ============================================================================
// Test Suites
// ============================================================================

describe('GEE Authentication Helper', () => {
  beforeEach(() => {
    // Set up environment variables
    Object.entries(mockEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });

    // Clear token cache before each test
    clearTokenCache();
  });

  afterEach(() => {
    // Clean up environment variables
    Object.keys(mockEnv).forEach((key) => {
      delete process.env[key];
    });
  });

  // ==========================================================================
  // Configuration Tests
  // ==========================================================================

  describe('getAuthConfig', () => {
    it('should return auth config from environment variables', () => {
      const config = getAuthConfig();

      expect(config.projectId).toBe(mockEnv.GOOGLE_EARTH_ENGINE_PROJECT_ID);
      expect(config.serviceAccount).toBe(mockEnv.GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT);
      expect(config.privateKey).toContain('BEGIN PRIVATE KEY');
    });

    it('should unescape newlines in private key', () => {
      process.env.GOOGLE_EARTH_ENGINE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC\\n-----END PRIVATE KEY-----\\n';

      const config = getAuthConfig();

      expect(config.privateKey).toContain('\n');
      expect(config.privateKey).not.toContain('\\n');
    });

    it('should throw AuthenticationError if project ID is missing', () => {
      delete process.env.GOOGLE_EARTH_ENGINE_PROJECT_ID;

      expect(() => getAuthConfig()).toThrow(AuthenticationError);
      expect(() => getAuthConfig()).toThrow(/Missing required Google Earth Engine credentials/);
    });

    it('should throw AuthenticationError if service account is missing', () => {
      delete process.env.GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT;

      expect(() => getAuthConfig()).toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError if private key is missing', () => {
      delete process.env.GOOGLE_EARTH_ENGINE_PRIVATE_KEY;

      expect(() => getAuthConfig()).toThrow(AuthenticationError);
    });
  });

  // ==========================================================================
  // Cache Management Tests
  // ==========================================================================

  describe('Token Cache Management', () => {
    it('should return false when no token is cached initially', () => {
      expect(hasValidToken()).toBe(false);
    });

    it('should clear cached token', () => {
      // Initially no token
      expect(hasValidToken()).toBe(false);

      // Clear cache (should not throw even if no token exists)
      clearTokenCache();

      // Still no token
      expect(hasValidToken()).toBe(false);
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should provide descriptive error messages for missing credentials', () => {
      delete process.env.GOOGLE_EARTH_ENGINE_PROJECT_ID;
      delete process.env.GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT;
      delete process.env.GOOGLE_EARTH_ENGINE_PRIVATE_KEY;

      try {
        getAuthConfig();
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        expect((error as AuthenticationError).message).toContain('Missing required Google Earth Engine credentials');
        expect((error as AuthenticationError).message).toContain('GOOGLE_EARTH_ENGINE_PROJECT_ID');
        expect((error as AuthenticationError).message).toContain('GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT');
        expect((error as AuthenticationError).message).toContain('GOOGLE_EARTH_ENGINE_PRIVATE_KEY');
      }
    });

    it('should have correct error code for authentication errors', () => {
      delete process.env.GOOGLE_EARTH_ENGINE_PROJECT_ID;

      try {
        getAuthConfig();
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        expect((error as AuthenticationError).code).toBe('AUTHENTICATION_FAILED');
        expect((error as AuthenticationError).statusCode).toBe(401);
      }
    });
  });
});

/**
 * Integration Test Notes:
 * 
 * The following functionality requires valid GEE credentials and should be tested
 * in integration tests with real credentials:
 * 
 * 1. authenticate() - Full OAuth2 JWT flow
 * 2. refreshToken() - Token refresh with real API
 * 3. getAuthToken() - Token retrieval and caching
 * 4. getAccessToken() - Access token string retrieval
 * 5. createJWT() - JWT creation with real private key
 * 6. Token expiration handling
 * 7. Network error handling
 * 8. Rate limiting behavior
 * 
 * To run integration tests:
 * 1. Set up valid GEE service account credentials
 * 2. Configure environment variables
 * 3. Run: npm test -- tests/satellite/integration/gee-auth.integration.test.ts
 */
