// CocoaTrack V2 - Supabase Browser Client
// This client is used in Client Components (browser)

import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/types/database.gen';
import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout';

type BrowserClient = ReturnType<typeof createBrowserClient<Database>>;

let browserClient: BrowserClient | null = null;

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * Timeout court pour auth/API, long pour Storage (import shapefile, téléchargements).
 * Un timeout unique de 15s coupait le parse des gros fichiers.
 */
const supabaseFetch: typeof fetch = (input, init) => {
  const url = getRequestUrl(input);
  let timeoutMs = 15_000;

  if (url.includes('/storage/v1/')) {
    timeoutMs = 5 * 60_000; // uploads / downloads jusqu'à 50 Mo
  } else if (url.includes('/auth/v1/')) {
    timeoutMs = 20_000;
  }

  return fetchWithTimeout(input, init, timeoutMs);
};

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
    browserClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: {
        fetch: supabaseFetch,
      },
    });
  }
  return browserClient;
}
