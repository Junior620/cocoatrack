// CocoaTrack V2 - Security Middleware Utilities
// Helpers for API route security

import { NextRequest, NextResponse } from 'next/server';
import { 
  checkRateLimit, 
  getRateLimitIdentifier, 
  createRateLimitHeaders,
  rateLimitExceededResponse,
  RATE_LIMIT_CONFIGS,
  type RateLimitResult 
} from './rate-limiter';

type RateLimitType = keyof typeof RATE_LIMIT_CONFIGS;

/**
 * Get client IP from request
 */
export function getClientIP(request: NextRequest): string {
  // Check various headers for IP (in order of preference)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Fallback
  return 'unknown';
}

/**
 * Apply rate limiting to a request
 */
export function applyRateLimit(
  request: NextRequest,
  type: RateLimitType = 'api',
  userId?: string | null
): { allowed: boolean; result: RateLimitResult; response?: Response } {
  const ip = getClientIP(request);
  const endpoint = new URL(request.url).pathname;
  const identifier = getRateLimitIdentifier(ip, userId, endpoint);
  
  const config = RATE_LIMIT_CONFIGS[type];
  const result = checkRateLimit(identifier, config);
  
  if (!result.success) {
    return {
      allowed: false,
      result,
      response: rateLimitExceededResponse(result),
    };
  }
  
  return { allowed: true, result };
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  const headers = createRateLimitHeaders(result);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Security headers to add to all responses
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * Add security headers to response
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Create a secured API handler wrapper
 */
export function withSecurity(
  handler: (request: NextRequest) => Promise<Response>,
  options: {
    rateLimit?: RateLimitType;
    requireAuth?: boolean;
    csrfProtection?: boolean;
  } = {}
) {
  return async (request: NextRequest): Promise<Response> => {
    // Apply rate limiting
    if (options.rateLimit) {
      const { allowed, result, response } = applyRateLimit(request, options.rateLimit);
      if (!allowed && response) {
        return response;
      }
    }
    
    // Call the actual handler
    const response = await handler(request);
    
    // Convert to NextResponse if needed
    const nextResponse = response instanceof NextResponse 
      ? response 
      : NextResponse.json(await response.json(), { status: response.status });
    
    // Add security headers
    addSecurityHeaders(nextResponse);
    
    return nextResponse;
  };
}

/**
 * Validate request origin for CSRF protection
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  
  // No origin header (same-origin request)
  if (!origin) {
    return true;
  }
  
  // Check if origin matches host
  try {
    const originUrl = new URL(origin);
    const expectedHost = host?.split(':')[0];
    return originUrl.hostname === expectedHost || originUrl.hostname === 'localhost';
  } catch {
    return false;
  }
}
