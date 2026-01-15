// CocoaTrack V2 - Smart Prefetch Utilities
// Task 24.3: Verify bundle size - Prefetch on Wi-Fi only
// Validates: Requirements REQ-PERF-003, NFR-005

'use client';

/**
 * Connection type from Network Information API
 */
type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';

/**
 * Network Information API interface (not fully standardized)
 */
interface NetworkInformation {
  type?: string;
  effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  onchange?: () => void;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

/**
 * Get the current network connection info
 */
export function getNetworkConnection(): NetworkInformation | null {
  if (typeof navigator === 'undefined') return null;
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}

/**
 * Get the current connection type
 */
export function getConnectionType(): ConnectionType {
  const connection = getNetworkConnection();
  if (!connection) return 'unknown';
  
  const type = connection.type?.toLowerCase();
  
  if (type === 'wifi') return 'wifi';
  if (type === 'ethernet') return 'ethernet';
  if (type === 'cellular') return 'cellular';
  if (type === 'none') return 'none';
  
  return 'unknown';
}

/**
 * Check if the user is on a fast connection (Wi-Fi or Ethernet)
 */
export function isOnFastConnection(): boolean {
  const connection = getNetworkConnection();
  
  // If Network Information API is not available, assume fast connection
  if (!connection) return true;
  
  // Check if user has enabled data saver mode
  if (connection.saveData) return false;
  
  // Check connection type
  const type = connection.type?.toLowerCase();
  if (type === 'wifi' || type === 'ethernet') return true;
  
  // Check effective type for cellular connections
  const effectiveType = connection.effectiveType;
  if (effectiveType === '4g') return true;
  
  // Check downlink speed (Mbps)
  if (connection.downlink && connection.downlink >= 5) return true;
  
  return false;
}

/**
 * Check if the user is on Wi-Fi specifically
 */
export function isOnWifi(): boolean {
  const connection = getNetworkConnection();
  if (!connection) return true; // Assume Wi-Fi if API not available
  
  return connection.type?.toLowerCase() === 'wifi';
}

/**
 * Check if data saver mode is enabled
 */
export function isDataSaverEnabled(): boolean {
  const connection = getNetworkConnection();
  return connection?.saveData ?? false;
}

/**
 * Prefetch a page only if on Wi-Fi or fast connection
 * Uses the native link prefetch mechanism
 */
export function smartPrefetch(href: string, options: { wifiOnly?: boolean } = {}): void {
  if (typeof window === 'undefined') return;
  
  const { wifiOnly = true } = options;
  
  // Check connection before prefetching
  if (wifiOnly && !isOnFastConnection()) {
    console.debug('[Prefetch] Skipped (not on fast connection):', href);
    return;
  }
  
  // Check if data saver is enabled
  if (isDataSaverEnabled()) {
    console.debug('[Prefetch] Skipped (data saver enabled):', href);
    return;
  }
  
  // Check if already prefetched
  const existingLink = document.querySelector(`link[rel="prefetch"][href="${href}"]`);
  if (existingLink) return;
  
  // Create prefetch link
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  link.as = 'document';
  document.head.appendChild(link);
  
  console.debug('[Prefetch] Prefetching:', href);
}

/**
 * Preload a critical resource (CSS, JS, font)
 */
export function preloadResource(
  href: string, 
  as: 'script' | 'style' | 'font' | 'image',
  options: { crossOrigin?: 'anonymous' | 'use-credentials' } = {}
): void {
  if (typeof window === 'undefined') return;
  
  // Check if already preloaded
  const existingLink = document.querySelector(`link[rel="preload"][href="${href}"]`);
  if (existingLink) return;
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  
  if (options.crossOrigin) {
    link.crossOrigin = options.crossOrigin;
  }
  
  // Fonts require crossorigin attribute
  if (as === 'font') {
    link.crossOrigin = 'anonymous';
  }
  
  document.head.appendChild(link);
}

/**
 * Prefetch multiple pages with smart connection detection
 */
export function smartPrefetchPages(hrefs: string[], options: { wifiOnly?: boolean } = {}): void {
  hrefs.forEach(href => smartPrefetch(href, options));
}

/**
 * Hook to get network connection status
 */
export function useNetworkStatus() {
  if (typeof window === 'undefined') {
    return {
      isOnline: true,
      connectionType: 'unknown' as ConnectionType,
      isOnFastConnection: true,
      isOnWifi: true,
      isDataSaverEnabled: false,
    };
  }
  
  return {
    isOnline: navigator.onLine,
    connectionType: getConnectionType(),
    isOnFastConnection: isOnFastConnection(),
    isOnWifi: isOnWifi(),
    isDataSaverEnabled: isDataSaverEnabled(),
  };
}

/**
 * React hook for smart prefetching with connection awareness
 */
import { useEffect, useCallback } from 'react';

export function useSmartPrefetch(hrefs: string[], options: { wifiOnly?: boolean } = {}) {
  const { wifiOnly = true } = options;
  
  const prefetch = useCallback(() => {
    if (wifiOnly && !isOnFastConnection()) return;
    if (isDataSaverEnabled()) return;
    
    hrefs.forEach(href => smartPrefetch(href, { wifiOnly }));
  }, [hrefs, wifiOnly]);
  
  useEffect(() => {
    // Prefetch after a short delay to not block initial render
    const timer = setTimeout(prefetch, 2000);
    return () => clearTimeout(timer);
  }, [prefetch]);
  
  return { prefetch };
}

/**
 * Prefetch routes that the user is likely to navigate to
 * Based on current route and common navigation patterns
 */
export function prefetchLikelyRoutes(currentPath: string): void {
  const routeMap: Record<string, string[]> = {
    '/dashboard': ['/planteurs', '/deliveries', '/sync'],
    '/planteurs': ['/planteurs/new', '/deliveries'],
    '/deliveries': ['/deliveries/new', '/planteurs'],
    '/parcelles': ['/parcelles/new', '/planteurs'],
    '/invoices': ['/invoices/generate', '/deliveries'],
  };
  
  const likelyRoutes = routeMap[currentPath] || [];
  smartPrefetchPages(likelyRoutes, { wifiOnly: true });
}
