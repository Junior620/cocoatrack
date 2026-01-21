// CocoaTrack V2 - Resend Password Reset Email API Route
// POST /api/admin/users/[id]/resend-password-reset - Resend password reset email (admin only)

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyRateLimit, addSecurityHeaders, getClientIP } from '@/lib/security/middleware';

interface ResendPasswordResetResponse {
  success: boolean;
  error?: string;
  emailSent?: boolean;
}

/**
 * Error response helper
 */
function errorResponse(
  message: string,
  status: number
): NextResponse<ResendPasswordResetResponse> {
  const response = NextResponse.json(
    { success: false, error: message },
    { status }
  );
  addSecurityHeaders(response);
  return response;
}

/**
 * POST /api/admin/users/[id]/resend-password-reset
 * 
 * Resend password reset email to a user (admin only)
 * 
 * Steps:
 * 1. Verify the requesting user is an admin
 * 2. Get the target user's email from profiles
 * 3. Send password reset email
 * 4. Log action in audit_logs
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const { allowed, response: rateLimitResponse } = applyRateLimit(request, 'api');
  if (!allowed && rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { id: targetUserId } = await params;

    // Create Supabase client for auth check
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return errorResponse('Non authentifié', 401);
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single<{ role: string }>();

    if (profileError || !profile) {
      return errorResponse('Profil non trouvé', 401);
    }

    // Check if user is admin
    if (profile.role !== 'admin') {
      return errorResponse('Accès non autorisé', 403);
    }

    // Get target user's email
    const { data: targetUser, error: targetUserError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', targetUserId)
      .single<{ email: string; full_name: string }>();

    if (targetUserError || !targetUser) {
      return errorResponse('Utilisateur non trouvé', 404);
    }

    // Create admin client
    const adminClient = createAdminClient();

    // Send password reset email
    const { error: resetError } = await adminClient.auth.resetPasswordForEmail(
      targetUser.email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?type=recovery`,
      }
    );

    if (resetError) {
      console.error('Error sending password reset email:', resetError);
      return errorResponse('Erreur lors de l\'envoi de l\'email', 500);
    }

    // Log in audit_logs
    const ipAddress = getClientIP(request);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient as any)
      .from('audit_logs')
      .insert({
        actor_id: user.id,
        actor_type: 'user',
        table_name: 'profiles',
        row_id: targetUserId,
        action: 'UPDATE',
        old_data: null,
        new_data: {
          action: 'resend_password_reset',
          target_email: targetUser.email,
        },
        ip_address: ipAddress,
      });

    // Return success
    const response = NextResponse.json<ResendPasswordResetResponse>(
      { success: true, emailSent: true },
      { status: 200 }
    );
    addSecurityHeaders(response);
    return response;

  } catch (error) {
    console.error('Unexpected error in POST /api/admin/users/[id]/resend-password-reset:', error);
    return errorResponse('Erreur interne du serveur', 500);
  }
}
