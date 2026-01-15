// CocoaTrack V2 - Admin User Creation API Route
// POST /api/admin/users - Create a new user (admin only)

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyRateLimit, addSecurityHeaders, getClientIP } from '@/lib/security/middleware';
import { createUserSchema, type CreateUserInput } from '@/lib/validations/user';

/**
 * Response type for user creation
 */
interface CreateUserResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    full_name: string;
    role: string;
  };
  error?: string;
  emailSent?: boolean;
}

/**
 * Error response helper
 */
function errorResponse(
  message: string,
  status: number,
  code?: string
): NextResponse<CreateUserResponse> {
  const response = NextResponse.json(
    { success: false, error: message, ...(code && { code }) },
    { status }
  );
  addSecurityHeaders(response);
  return response;
}

/**
 * POST /api/admin/users
 * 
 * Create a new user with the following steps:
 * 1. Verify the requesting user is an admin
 * 2. Validate input data with Zod schema
 * 3. Create user in Supabase Auth using admin API
 * 4. Create profile in profiles table
 * 5. Send password reset email
 * 6. Log action in audit_logs
 * 
 * Requirements: 1.3, 1.4, 4.1, 5.1, 5.3
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const { allowed, response: rateLimitResponse } = applyRateLimit(request, 'api');
  if (!allowed && rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
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

    // Check if user is admin (Requirement 5.1, 5.4)
    if (profile.role !== 'admin') {
      return errorResponse('Accès non autorisé', 403);
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Le corps de la requête doit être un JSON valide', 400);
    }

    // Validate input with Zod schema (Requirement 6.1, 6.2, 6.3)
    const parseResult = createUserSchema.safeParse(body);
    
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return errorResponse(`Validation échouée: ${errors.join(', ')}`, 400);
    }

    const validatedInput: CreateUserInput = parseResult.data;

    // Create admin client for user creation
    const adminClient = createAdminClient();

    // Check if email already exists (Requirement 1.5)
    const { data: existingUser } = await adminClient.auth.admin.listUsers();
    const emailExists = existingUser?.users?.some(
      u => u.email?.toLowerCase() === validatedInput.email.toLowerCase()
    );

    if (emailExists) {
      return errorResponse('Cet email est déjà utilisé', 409);
    }

    // Create user in Supabase Auth (Requirement 1.3)
    const { data: authData, error: createAuthError } = await adminClient.auth.admin.createUser({
      email: validatedInput.email,
      email_confirm: true, // Auto-confirm email since admin is creating
      user_metadata: {
        full_name: validatedInput.full_name,
      },
    });

    if (createAuthError || !authData.user) {
      console.error('Error creating auth user:', createAuthError);
      return errorResponse('Erreur lors de la création du compte', 500);
    }

    const newUserId = authData.user.id;
    let profileCreated = false;
    let emailSent = false;

    try {
      // Create profile in profiles table (Requirement 1.4)
      const profileData = {
        id: newUserId,
        email: validatedInput.email,
        full_name: validatedInput.full_name,
        role: validatedInput.role,
        cooperative_id: validatedInput.cooperative_id ?? null,
        phone: validatedInput.phone ?? null,
        is_active: true,
        password_reset_required: true,
      } as const;

      const { error: profileInsertError } = await adminClient
        .from('profiles')
        .insert(profileData);

      if (profileInsertError) {
        console.error('Error creating profile:', profileInsertError);
        // Rollback: delete the auth user
        await adminClient.auth.admin.deleteUser(newUserId);
        return errorResponse('Erreur lors de la création du profil', 500);
      }

      profileCreated = true;

      // Send password reset email (Requirement 4.1)
      const { error: resetError } = await adminClient.auth.resetPasswordForEmail(
        validatedInput.email,
        {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?type=recovery`,
        }
      );

      if (resetError) {
        console.error('Error sending password reset email:', resetError);
        // Don't fail the operation, just log the warning (Requirement 4.4)
        emailSent = false;
      } else {
        emailSent = true;
      }

      // Log in audit_logs (Requirement 5.3)
      const ipAddress = getClientIP(request);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient as any)
        .from('audit_logs')
        .insert({
          actor_id: user.id,
          actor_type: 'user',
          table_name: 'profiles',
          row_id: newUserId,
          action: 'INSERT',
          old_data: null,
          new_data: {
            id: newUserId,
            email: validatedInput.email,
            full_name: validatedInput.full_name,
            role: validatedInput.role,
            cooperative_id: validatedInput.cooperative_id ?? null,
            created_by_admin: user.id,
          },
          ip_address: ipAddress,
        });

    } catch (error) {
      console.error('Error in user creation process:', error);
      
      // Rollback if profile wasn't created
      if (!profileCreated) {
        await adminClient.auth.admin.deleteUser(newUserId);
      }
      
      return errorResponse('Erreur lors de la création de l\'utilisateur', 500);
    }

    // Build success response
    const responseData: CreateUserResponse = {
      success: true,
      user: {
        id: newUserId,
        email: validatedInput.email,
        full_name: validatedInput.full_name,
        role: validatedInput.role,
      },
      emailSent,
    };

    const response = NextResponse.json(responseData, { status: 201 });
    addSecurityHeaders(response);
    return response;

  } catch (error) {
    console.error('Unexpected error in POST /api/admin/users:', error);
    return errorResponse('Erreur interne du serveur', 500);
  }
}
