// CocoaTrack V2 - Forgot Password API Route
// POST /api/auth/forgot-password - Send password reset email

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';

interface ForgotPasswordRequest {
  email: string;
}

interface ForgotPasswordResponse {
  success: boolean;
  error?: string;
}

/**
 * POST /api/auth/forgot-password
 * 
 * Send a password reset email to the user
 * Always returns success to prevent email enumeration attacks
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting (stricter for public endpoints)
  const { allowed, response: rateLimitResponse } = applyRateLimit(request, 'auth');
  if (!allowed && rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Parse request body
    let body: ForgotPasswordRequest;
    try {
      body = await request.json();
    } catch {
      const response = NextResponse.json(
        { success: false, error: 'Le corps de la requête doit être un JSON valide' },
        { status: 400 }
      );
      addSecurityHeaders(response);
      return response;
    }

    const { email } = body;

    // Validate email
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      const response = NextResponse.json(
        { success: false, error: 'Email invalide' },
        { status: 400 }
      );
      addSecurityHeaders(response);
      return response;
    }

    // Create admin client
    const adminClient = createAdminClient();

    // Send password reset email
    // Note: We don't check if the user exists to prevent email enumeration
    await adminClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?type=recovery`,
    });

    // Always return success (even if email doesn't exist)
    const response = NextResponse.json<ForgotPasswordResponse>(
      { success: true },
      { status: 200 }
    );
    addSecurityHeaders(response);
    return response;

  } catch (error) {
    console.error('Error in POST /api/auth/forgot-password:', error);
    
    // Return generic success to prevent information leakage
    const response = NextResponse.json<ForgotPasswordResponse>(
      { success: true },
      { status: 200 }
    );
    addSecurityHeaders(response);
    return response;
  }
}
