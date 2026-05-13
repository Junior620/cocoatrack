// CocoaTrack V2 - Supabase Server Client
// This client is used in Server Components, Route Handlers, and Server Actions

import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import type { Database } from '@/types/database.gen';

/**
 * Common typed Supabase client type used across server-side code.
 * Both createServerSupabaseClient and createServiceRoleSupabaseClient
 * return this type, avoiding union incompatibility issues.
 */
export type SupabaseServerClient = SupabaseClient<Database>;

/**
 * Creates a Supabase client for use in server components and route handlers.
 * This client reads and writes cookies for session management.
 */
export async function createServerSupabaseClient(): Promise<SupabaseServerClient> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During build time, env vars may not be available
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  }) as any as SupabaseServerClient;
}

/**
 * Creates a Supabase client with the service role key.
 * Bypasses RLS — use only in trusted server-side contexts (cron jobs, admin routes).
 */
export function createServiceRoleSupabaseClient(): SupabaseServerClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'Missing Supabase service role environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY'
    );
  }

  return createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}

/**
 * Gets the current authenticated user from the server.
 * Returns null if not authenticated.
 */
export async function getUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Gets the current user's profile from the database.
 * Returns null if not authenticated or profile doesn't exist.
 */
export async function getUserProfile() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile;
}
