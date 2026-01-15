// CocoaTrack V2 - Service Worker Registration
// Requirements: REQ-SW-001, REQ-SW-002, REQ-CACHE-001, REQ-CACHE-002

import { Workbox } from 'workbox-window';

import { getSWUpdateManager } from './sw-update-manager';

let wb: Workbox | null = null;

/**
 * Registers the service worker and sets up update handling
 * Integrates with SWUpdateManager for safe updates
 */
export async function registerServiceWorker(): Promise<Workbox | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('Service Worker not supported');
    return null;
  }

  // Don't register in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Service Worker disabled in development');
    return null;
  }

  try {
    wb = new Workbox('/sw.js');

    // Initialize SWUpdateManager with the Workbox instance
    const updateManager = getSWUpdateManager();
    await updateManager.initialize(wb);

    // Handle waiting service worker
    wb.addEventListener('waiting', () => {
      console.log('New service worker waiting to activate');
      // Dispatch custom event for UI to handle
      window.dispatchEvent(
        new CustomEvent('sw-update-available', {
          detail: { wb, updateManager },
        })
      );
    });

    // Handle controlling service worker
    wb.addEventListener('controlling', () => {
      console.log('Service worker now controlling the page');
      // Reload to get fresh content
      window.location.reload();
    });

    // Handle activation
    wb.addEventListener('activated', (event) => {
      if (event.isUpdate) {
        console.log('Service worker updated');
      } else {
        console.log('Service worker activated for the first time');
      }
    });

    // Handle messages from service worker
    wb.addEventListener('message', (event) => {
      handleServiceWorkerMessage(event.data);
    });

    // Register the service worker
    await wb.register();
    console.log('Service Worker registered successfully');

    return wb;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Unregisters all service workers
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((reg) => reg.unregister()));
    console.log('Service Workers unregistered');
    return true;
  } catch (error) {
    console.error('Failed to unregister Service Workers:', error);
    return false;
  }
}

/**
 * Triggers the waiting service worker to activate
 */
export function skipWaiting(): void {
  if (wb) {
    wb.messageSkipWaiting();
  }
}

/**
 * Sends a message to the service worker
 */
export async function sendMessageToSW(
  message: Record<string, unknown>
): Promise<void> {
  if (!wb) {
    console.warn('Service Worker not registered');
    return;
  }

  try {
    await wb.messageSW(message);
  } catch (error) {
    console.error('Failed to send message to Service Worker:', error);
  }
}

/**
 * Requests the service worker to cache referential data
 */
export async function cacheReferentialData(urls: string[]): Promise<void> {
  await sendMessageToSW({
    type: 'CACHE_REFERENTIAL',
    urls,
  });
}

/**
 * Requests the service worker to clear all caches
 */
export async function clearAllCaches(): Promise<void> {
  await sendMessageToSW({
    type: 'CLEAR_CACHE',
  });
}

/**
 * Handles messages from the service worker
 */
function handleServiceWorkerMessage(data: Record<string, unknown>): void {
  switch (data.type) {
    case 'SYNC_TRIGGERED':
      console.log('Sync triggered by service worker');
      window.dispatchEvent(
        new CustomEvent('sw-sync-triggered', {
          detail: { timestamp: data.timestamp },
        })
      );
      break;

    case 'CACHE_COMPLETE':
      console.log('Referential data cached:', data.urls);
      window.dispatchEvent(
        new CustomEvent('sw-cache-complete', {
          detail: { urls: data.urls },
        })
      );
      break;

    default:
      console.log('Unknown message from service worker:', data);
  }
}

/**
 * Checks if the app is running as a PWA (installed)
 */
export function isPWA(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error - Safari specific
    window.navigator.standalone === true
  );
}

/**
 * Gets the current service worker registration
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/**
 * Requests background sync
 */
export async function requestBackgroundSync(tag: string = 'sync-operations'): Promise<boolean> {
  const registration = await getServiceWorkerRegistration();
  
  if (!registration) {
    console.warn('No service worker registration');
    return false;
  }

  // Check if Background Sync is supported
  if (!('sync' in registration)) {
    console.warn('Background Sync not supported');
    return false;
  }

  try {
    // @ts-expect-error - Background Sync API
    await registration.sync.register(tag);
    console.log('Background sync registered:', tag);
    return true;
  } catch (error) {
    console.error('Failed to register background sync:', error);
    return false;
  }
}
