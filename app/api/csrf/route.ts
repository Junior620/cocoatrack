// CocoaTrack V2 - CSRF Token API
// Endpoint to get/refresh CSRF token

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateCSRFToken, getCSRFCookieOptions } from '@/lib/security/csrf';

const CSRF_TOKEN_NAME = 'csrf_token';

export async function GET() {
  const cookieStore = await cookies();
  let token = cookieStore.get(CSRF_TOKEN_NAME)?.value;
  
  // Generate new token if not exists
  if (!token) {
    token = generateCSRFToken();
  }
  
  // Create response with token
  const response = NextResponse.json({ token });
  
  // Set cookie
  response.cookies.set(CSRF_TOKEN_NAME, token, getCSRFCookieOptions());
  
  return response;
}
