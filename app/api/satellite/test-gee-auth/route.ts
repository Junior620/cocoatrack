/**
 * GET /api/satellite/test-gee-auth
 * 
 * Diagnostic endpoint to test Google Earth Engine authentication.
 * Tests each step: config loading, JWT creation, token exchange.
 * 
 * DEVELOPMENT ONLY - remove before production deployment.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const results: Record<string, unknown> = {};

  // Step 1: Check environment variables
  results.env = {
    hasProjectId: !!process.env.GOOGLE_EARTH_ENGINE_PROJECT_ID,
    projectId: process.env.GOOGLE_EARTH_ENGINE_PROJECT_ID,
    hasServiceAccount: !!process.env.GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT,
    serviceAccount: process.env.GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT,
    hasPrivateKey: !!process.env.GOOGLE_EARTH_ENGINE_PRIVATE_KEY,
    privateKeyLength: process.env.GOOGLE_EARTH_ENGINE_PRIVATE_KEY?.length ?? 0,
    privateKeyStart: process.env.GOOGLE_EARTH_ENGINE_PRIVATE_KEY?.substring(0, 40),
    privateKeyHasNewlines: process.env.GOOGLE_EARTH_ENGINE_PRIVATE_KEY?.includes('\n'),
    privateKeyHasEscapedNewlines: process.env.GOOGLE_EARTH_ENGINE_PRIVATE_KEY?.includes('\\n'),
  };

  // Step 2: Test JWT creation
  try {
    const { getAuthConfig, createJWT } = await import('@/lib/satellite/utils/gee-auth');
    const config = getAuthConfig();
    results.configLoaded = true;

    const jwt = await createJWT(config);
    results.jwtCreated = true;
    results.jwtLength = jwt.length;
    results.jwtPreview = jwt.substring(0, 50) + '...';
  } catch (err) {
    results.jwtError = (err as Error).message;
  }

  // Step 3: Test network connectivity to Google OAuth
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15 seconds
    
    const pingRes = await fetch('https://oauth2.googleapis.com/', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    results.googleOAuthReachable = true;
    results.googleOAuthStatus = pingRes.status;
  } catch (err) {
    results.googleOAuthReachable = false;
    results.googleOAuthError = (err as Error).message;
    
    // Try alternative: test with a simple GET to check DNS resolution
    try {
      const dnsTest = await fetch('https://www.googleapis.com/', { 
        method: 'HEAD',
        signal: AbortSignal.timeout(15000),
      });
      results.googleApisReachable = true;
      results.googleApisStatus = dnsTest.status;
    } catch (dnsErr) {
      results.googleApisReachable = false;
      results.googleApisError = (dnsErr as Error).message;
    }
  }

  // Step 4: Test full token exchange
  try {
    const { authenticate } = await import('@/lib/satellite/utils/gee-auth');
    const token = await authenticate();
    results.tokenExchange = 'success';
    results.tokenType = token.tokenType;
    results.tokenExpiresAt = token.expiresAt;
    results.accessTokenPreview = token.accessToken.substring(0, 20) + '...';
  } catch (err) {
    results.tokenExchange = 'failed';
    results.tokenError = (err as Error).message;
  }

  return NextResponse.json(results, { status: 200 });
}
