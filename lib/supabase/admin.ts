// CocoaTrack V2 - Supabase Admin Client
// This client uses the service role key for admin operations
// IMPORTANT: Only use this on the server side (API routes, server actions)
// NEVER expose the service key to the client

import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.gen';

/**
 * Creates a Supabase admin client using the service role key.
 * This client bypasses Row Level Security (RLS) and has full database access.
 * 
 * Use cases:
 * - Creating users via auth.admin.createUser()
 * - Administrative operations that need to bypass RLS
 * - Server-side operations that require elevated privileges
 * 
 * @throws Error if required environment variables are missing
 * @returns Supabase client with admin privileges
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL environment variable'
    );
  }

  if (!supabaseServiceKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_KEY environment variable. ' +
      'This key is required for admin operations and should only be used server-side.'
    );
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      // Don't persist sessions for admin client - it's stateless
      persistSession: false,
      // Auto refresh is not needed for service role
      autoRefreshToken: false,
      // Detect session from URL is not needed
      detectSessionInUrl: false,
    },
  });
}
