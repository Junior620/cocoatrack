// CocoaTrack V2 - Supabase Middleware Client
// This client is used in Next.js middleware for session refresh

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import type { Database } from '@/types/database.gen';
import {
  hasSupabaseAuthCookie,
  isPublicAppRoute,
  shouldSkipSessionRefresh,
} from '@/lib/supabase/auth-cookies';
import {
  MODULE_COOKIE,
  getDefaultRouteForModule,
  resolveModulePreference,
  type CocoaTrackModule,
} from '@/lib/utils/cocoatrack-module';

function isFactoryHost(hostname: string): boolean {
  const factoryHost = process.env.NEXT_PUBLIC_FACTORY_HOST;
  if (factoryHost && hostname === factoryHost) return true;
  return hostname.startsWith('transformation.');
}

function getModuleFromRequest(request: NextRequest): CocoaTrackModule {
  return resolveModulePreference(
    request.nextUrl.searchParams.get('module'),
    request.cookies.get(MODULE_COOKIE)?.value,
    request.nextUrl.hostname
  );
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('redirectTo', request.nextUrl.pathname);
  const module = getModuleFromRequest(request);
  if (request.nextUrl.pathname.startsWith('/factory') || module === 'factory') {
    url.searchParams.set('module', 'factory');
  }
  return NextResponse.redirect(url);
}

function copySupabaseCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value);
  });
}

/**
 * Updates the Supabase session in middleware.
 * Minimizes Auth API calls to avoid rate limits (429).
 */
export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (shouldSkipSessionRefresh(pathname)) {
    return NextResponse.next({ request });
  }

  const isPublicRoute = isPublicAppRoute(pathname);
  const hasAuthCookie = hasSupabaseAuthCookie(request);

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const isCronAuthenticated = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isTileProxy = pathname.startsWith('/api/satellite/tiles/');

  // No cookie on protected route → redirect without hitting Auth API
  if (!hasAuthCookie && !isPublicRoute && !isCronAuthenticated && !isTileProxy) {
    return redirectToLogin(request);
  }

  // Public page, visitor not logged in → skip getUser entirely
  if (isPublicRoute && !hasAuthCookie) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          );
        },
      },
    }
  );

  let user = null;

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError && (userError as { status?: number }).status === 429) {
    // Rate limited — use local session instead of failing open to login
    const { data: sessionData } = await supabase.auth.getSession();
    user = sessionData.session?.user ?? null;
  } else {
    user = userData.user;
  }

  if (!user && !isPublicRoute && !isCronAuthenticated && !isTileProxy) {
    return redirectToLogin(request);
  }

  if (user && isFactoryHost(request.nextUrl.hostname) && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/factory';
    const response = NextResponse.redirect(url);
    copySupabaseCookies(supabaseResponse, response);
    response.cookies.set(MODULE_COOKIE, 'factory', { path: '/', maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  if (user && pathname === '/login') {
    const module = getModuleFromRequest(request);
    const redirectTo =
      request.nextUrl.searchParams.get('redirectTo') ||
      getDefaultRouteForModule(module);
    const url = request.nextUrl.clone();
    url.pathname = redirectTo;
    url.searchParams.delete('redirectTo');
    url.searchParams.delete('module');
    const response = NextResponse.redirect(url);
    copySupabaseCookies(supabaseResponse, response);
    response.cookies.set(MODULE_COOKIE, module, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  // Logged-in user picks a module on landing → honor ?module= and redirect
  if (user && pathname === '/' && request.nextUrl.searchParams.has('module')) {
    const module = getModuleFromRequest(request);
    const url = request.nextUrl.clone();
    url.pathname = getDefaultRouteForModule(module);
    url.searchParams.delete('module');
    const response = NextResponse.redirect(url);
    copySupabaseCookies(supabaseResponse, response);
    response.cookies.set(MODULE_COOKIE, module, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  return supabaseResponse;
}
