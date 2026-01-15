// CocoaTrack V2 - Signed URL API Route
// GET /api/photos/signed?path=...
// Returns a signed URL for accessing delivery photos

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { applyRateLimit, addSecurityHeaders } from '@/lib/security/middleware';

const BUCKET_NAME = 'delivery-photos';
const SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const { allowed, result, response: rateLimitResponse } = applyRateLimit(request, 'api');
  if (!allowed && rateLimitResponse) {
    return rateLimitResponse;
  }

  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get('path');

  // Validate path parameter
  if (!path) {
    return NextResponse.json(
      { error: 'Missing path parameter' },
      { status: 400 }
    );
  }

  // Create Supabase client
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Get user profile to check cooperative_id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, cooperative_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'Profile not found' },
      { status: 403 }
    );
  }

  // Extract cooperative_id from path (first segment)
  // Path format: {cooperative_id}/{delivery_id}/{filename}
  const pathSegments = path.split('/');
  if (pathSegments.length < 3) {
    return NextResponse.json(
      { error: 'Invalid path format' },
      { status: 400 }
    );
  }

  const pathCooperativeId = pathSegments[0];

  // Security check: verify user can access this cooperative's photos
  // Admin can access all, others can only access their own cooperative
  if (profile.role !== 'admin' && profile.cooperative_id !== pathCooperativeId) {
    return NextResponse.json(
      { error: 'Access denied to this photo' },
      { status: 403 }
    );
  }

  // Generate signed URL
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, SIGNED_URL_EXPIRY);

  if (signedUrlError || !signedUrlData) {
    return NextResponse.json(
      { error: signedUrlError?.message || 'Failed to generate signed URL' },
      { status: 500 }
    );
  }

  // Return signed URL with cache headers
  return NextResponse.json(
    { 
      url: signedUrlData.signedUrl,
      expiresIn: SIGNED_URL_EXPIRY,
    },
    {
      headers: {
        // Cache for slightly less than expiry time
        'Cache-Control': `private, max-age=${SIGNED_URL_EXPIRY - 60}`,
      },
    }
  );
}
