// CocoaTrack V2 - CSRF Protection
// Cross-Site Request Forgery protection utilities

import { cookies } from 'next/headers';

const CSRF_TOKEN_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure random token
 */
function generateToken(): string {
  const array = new Uint8Array(CSRF_TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Get or create CSRF token for the current session
 * Call this in server components or API routes
 */
export async function getCSRFToken(): Promise<string> {
  const cookieStore = await cookies();
  let token = cookieStore.get(CSRF_TOKEN_NAME)?.value;
  
  if (!token) {
    token = generateToken();
    // Token will be set via setCSRFCookie in middleware or API
  }
  
  return token;
}

/**
 * Create CSRF cookie options
 */
export function getCSRFCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  };
}

/**
 * Validate CSRF token from request
 * Returns true if valid, false otherwise
 */
export async function validateCSRFToken(request: Request): Promise<boolean> {
  // Skip validation for safe methods
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true;
  }
  
  // Get token from cookie
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_TOKEN_NAME)?.value;
  
  if (!cookieToken) {
    return false;
  }
  
  // Get token from header or body
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  
  // For form submissions, also check body
  let bodyToken: string | null = null;
  const contentType = request.headers.get('content-type');
  
  if (contentType?.includes('application/x-www-form-urlencoded')) {
    try {
      const clonedRequest = request.clone();
      const formData = await clonedRequest.formData();
      bodyToken = formData.get('_csrf') as string | null;
    } catch {
      // Ignore parsing errors
    }
  }
  
  const providedToken = headerToken || bodyToken;
  
  if (!providedToken) {
    return false;
  }
  
  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(cookieToken, providedToken);
}

/**
 * Constant-time string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * CSRF validation error response
 */
export function csrfErrorResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'Forbidden',
      message: 'Invalid or missing CSRF token',
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Generate new CSRF token and return it
 * Use this in API routes that need to provide a token to the client
 */
export function generateCSRFToken(): string {
  return generateToken();
}
