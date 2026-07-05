import type { NextRequest } from 'next/server';

/** True if the request carries a Supabase auth cookie (no network call). */
export function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    (cookie) =>
      cookie.name.includes('-auth-token') ||
      (cookie.name.startsWith('sb-') && cookie.name.includes('auth'))
  );
}

export function isPublicAppRoute(pathname: string): boolean {
  const publicRoutes = ['/login', '/auth/callback', '/forgot-password', '/reset-password', '/register', '/blocked'];
  return (
    pathname === '/' ||
    publicRoutes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    ) ||
    pathname.startsWith('/api/auth')
  );
}

/** Routes that never need a Supabase session refresh in middleware. */
export function shouldSkipSessionRefresh(pathname: string): boolean {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname.startsWith('/icons/')
  );
}
