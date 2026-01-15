// CocoaTrack V2 - Next.js Middleware
// Handles session refresh, route protection, geo-blocking, and security

import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Security headers
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// Allowed countries (ISO 3166-1 alpha-2 codes)
// CM = Cameroon
const ALLOWED_COUNTRIES = ['CM'];

// Paths that bypass geo-blocking (blocked page, static assets, etc.)
const GEO_BYPASS_PATHS = ['/blocked', '/api/health'];

/**
 * Check if the request should bypass geo-blocking
 */
function shouldBypassGeoBlock(pathname: string): boolean {
  return GEO_BYPASS_PATHS.some(path => pathname.startsWith(path));
}

/**
 * Check if the request is from an allowed country
 * Uses Vercel's geo headers (x-vercel-ip-country)
 * Falls back to allowing access if geo info is not available (localhost, etc.)
 */
function isAllowedCountry(request: NextRequest): boolean {
  // Get country from Vercel's geo headers
  // Vercel automatically adds x-vercel-ip-country header
  const country = request.headers.get('x-vercel-ip-country');
  
  // If no geo info available (localhost, development), allow access
  if (!country) {
    console.log('[Geo] No country info available, allowing access');
    return true;
  }
  
  const isAllowed = ALLOWED_COUNTRIES.includes(country);
  
  if (!isAllowed) {
    console.log(`[Geo] Blocked access from country: ${country}`);
  }
  
  return isAllowed;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check geo-blocking first (before auth)
  if (!shouldBypassGeoBlock(pathname) && !isAllowedCountry(request)) {
    // Redirect to blocked page
    const blockedUrl = new URL('/blocked', request.url);
    return NextResponse.redirect(blockedUrl);
  }
  
  // Update session (auth)
  const response = await updateSession(request);
  
  // Add security headers to all responses
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (manifest.json, sw.js, icons, etc.)
     * - api routes that don't need auth
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
