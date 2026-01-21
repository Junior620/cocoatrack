// CocoaTrack V2 - Auth Callback Route
// Handles OAuth callback and email confirmation

import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';

      // If this is a password recovery, redirect to reset password page
      if (type === 'recovery') {
        if (isLocalEnv) {
          return NextResponse.redirect(`${origin}/reset-password`);
        } else if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}/reset-password`);
        } else {
          return NextResponse.redirect(`${origin}/reset-password`);
        }
      }

      // Normal login flow
      if (isLocalEnv) {
        // In development, redirect to localhost
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        // In production with a proxy, use the forwarded host
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
