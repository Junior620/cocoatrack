/** CocoaTrack product module selection (traceability vs factory) */

export type CocoaTrackModule = 'traceability' | 'factory';

export const MODULE_COOKIE = 'cocoatrack_module';
export const MODULE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function getDefaultRouteForModule(module: CocoaTrackModule): string {
  return module === 'factory' ? '/factory' : '/dashboard';
}

export function parseModule(value: string | null | undefined): CocoaTrackModule | null {
  if (value === 'traceability' || value === 'factory') return value;
  return null;
}

/** URL ?module= wins over cookie (explicit user choice on landing/login). */
export function resolveModulePreference(
  queryModule: string | null | undefined,
  cookieModule: string | null | undefined,
  hostname?: string
): CocoaTrackModule {
  if (hostname && isFactoryHost(hostname)) return 'factory';
  return parseModule(queryModule) ?? parseModule(cookieModule) ?? 'traceability';
}

export function isFactoryHost(hostname: string): boolean {
  const factoryHost = process.env.NEXT_PUBLIC_FACTORY_HOST;
  if (factoryHost && hostname === factoryHost) return true;
  return hostname.startsWith('transformation.');
}

export function setModuleCookie(module: CocoaTrackModule): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${MODULE_COOKIE}=${module}; path=/; max-age=${MODULE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function getModuleCookie(): CocoaTrackModule | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${MODULE_COOKIE}=([^;]*)`));
  return parseModule(match?.[1] ? decodeURIComponent(match[1]) : null);
}

export function resolvePostLoginRoute(
  module: CocoaTrackModule | null,
  redirectTo: string | null
): string {
  if (redirectTo && redirectTo.startsWith('/')) return redirectTo;
  return getDefaultRouteForModule(module ?? 'traceability');
}
