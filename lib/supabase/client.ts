// CocoaTrack V2 - Supabase Browser Client
// This client is used in Client Components (browser)

import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/types/database.gen';

type BrowserClient = ReturnType<typeof createBrowserClient<Database>>;

let browserClient: BrowserClient | null = null;

/**
 * Creates a Supabase client for use in browser/client components.
 * Singleton in the browser to avoid re-creating clients on every hook call.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During build time, env vars may not be available
  // Return a dummy client that will be replaced at runtime
  if (!supabaseUrl || !supabaseAnonKey) {
    // This should only happen during static build
    // At runtime, these env vars must be set
    if (typeof window !== 'undefined') {
      throw new Error(
        'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
      );
    }
    // During SSR/build, return a placeholder that won't be used
    return createBrowserClient<Database>(
      'https://placeholder.supabase.co',
      'placeholder-key'
    );
  }

  if (typeof window === 'undefined') {
    return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
}
