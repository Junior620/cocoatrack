// CocoaTrack V2 - Service Worker
// Handles offline caching for assets and referential data
// Requirements: REQ-CACHE-001, REQ-CACHE-002, REQ-PERF-004, REQ-SW-001, REQ-SW-002

// Import Workbox from CDN
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

// ============================================================================
// SERVICE WORKER VERSION
// REQ-SW-002: Track SW version for diagnostics
// ============================================================================
const SW_VERSION = '2.0.0';

// ============================================================================
// CACHE NAMES (Versioned)
// REQ-CACHE-002: Cache versioning for cleanup
// ============================================================================
const CACHE_VERSION = 'v2';
const CACHE_NAMES = {
  PRECACHE: `cocoatrack-precache-${CACHE_VERSION}`,
  STATIC: `cocoatrack-static-${CACHE_VERSION}`,
  IMAGES: `cocoatrack-images-${CACHE_VERSION}`,
  API: `cocoatrack-api-${CACHE_VERSION}`,
  REFERENTIAL: `cocoatrack-referential-${CACHE_VERSION}`,
  PAGES: `cocoatrack-pages-${CACHE_VERSION}`,
  OFFLINE: `cocoatrack-offline-${CACHE_VERSION}`,
};

// List of current caches to keep during cleanup
const CURRENT_CACHES = Object.values(CACHE_NAMES);

// ============================================================================
// CACHE CONFIGURATION
// REQ-CACHE-001: Cache Strategy Per Resource Type
// ============================================================================
const CACHE_CONFIG = {
  // HTML documents: NetworkFirst with 10s timeout
  html: {
    networkTimeoutSeconds: 10,
    maxAgeSeconds: 24 * 60 * 60, // 24 hours
  },
  // CSS/JS with hashed filenames: StaleWhileRevalidate
  assets: {
    maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
    maxEntries: 100,
  },
  // Static assets and images: CacheFirst
  images: {
    maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
    maxEntries: 60,
  },
  // API transactional: NetworkFirst with 10s timeout
  api: {
    networkTimeoutSeconds: 10,
    maxAgeSeconds: 5 * 60, // 5 minutes
    maxEntries: 100,
  },
  // Referential data: StaleWhileRevalidate
  referential: {
    maxAgeSeconds: 24 * 60 * 60, // 24 hours
    maxEntries: 500,
  },
};

// ============================================================================
// WORKBOX CONFIGURATION
// ============================================================================
if (workbox) {
  console.log(`[SW] Workbox loaded - Version ${SW_VERSION}`);

  // Precache and route setup
  workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);
  workbox.precaching.cleanupOutdatedCaches();

  // ============================================================================
  // HTML DOCUMENTS
  // Strategy: NetworkFirst with 10s timeout
  // REQ-CACHE-001: API transactionnelles : network-first avec timeout 10s
  // ============================================================================
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
      cacheName: CACHE_NAMES.PAGES,
      networkTimeoutSeconds: CACHE_CONFIG.html.networkTimeoutSeconds,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxAgeSeconds: CACHE_CONFIG.html.maxAgeSeconds,
        }),
      ],
    })
  );

  // ============================================================================
  // CSS/JS WITH HASHED FILENAMES
  // Strategy: StaleWhileRevalidate
  // REQ-CACHE-001: App Shell (HTML, CSS, JS core) : cache-first avec versioning
  // Using StaleWhileRevalidate for hashed assets for better UX
  // ============================================================================
  workbox.routing.registerRoute(
    ({ request, url }) => {
      // Match CSS and JS files with hash patterns (e.g., main.abc123.js)
      const isHashedAsset = /\.[a-f0-9]{8,}\.(js|css)$/i.test(url.pathname);
      const isAsset = request.destination === 'script' || request.destination === 'style';
      return isAsset || isHashedAsset;
    },
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: CACHE_NAMES.STATIC,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: CACHE_CONFIG.assets.maxEntries,
          maxAgeSeconds: CACHE_CONFIG.assets.maxAgeSeconds,
        }),
      ],
    })
  );

  // ============================================================================
  // FONTS
  // Strategy: CacheFirst (fonts rarely change)
  // ============================================================================
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'font',
    new workbox.strategies.CacheFirst({
      cacheName: CACHE_NAMES.STATIC,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 30,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        }),
      ],
    })
  );

  // ============================================================================
  // IMAGES
  // Strategy: CacheFirst with size limit
  // REQ-CACHE-001: Images : cache-first avec maxEntries=60, maxAge=7j
  // ============================================================================
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: CACHE_NAMES.IMAGES,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: CACHE_CONFIG.images.maxEntries,
          maxAgeSeconds: CACHE_CONFIG.images.maxAgeSeconds,
          purgeOnQuotaError: true,
        }),
      ],
    })
  );

  // ============================================================================
  // REFERENTIAL DATA (planteurs, chef_planteurs, warehouses)
  // Strategy: StaleWhileRevalidate
  // REQ-CACHE-001: Données Tier_1 référentielles : stale-while-revalidate
  // ============================================================================
  const REFERENTIAL_ENDPOINTS = [
    '/rest/v1/planteurs',
    '/rest/v1/chef_planteurs',
    '/rest/v1/warehouses',
    '/rest/v1/cooperatives',
    '/rest/v1/regions',
  ];

  workbox.routing.registerRoute(
    ({ url }) => {
      return REFERENTIAL_ENDPOINTS.some((endpoint) =>
        url.pathname.includes(endpoint)
      );
    },
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: CACHE_NAMES.REFERENTIAL,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: CACHE_CONFIG.referential.maxEntries,
          maxAgeSeconds: CACHE_CONFIG.referential.maxAgeSeconds,
          purgeOnQuotaError: true,
        }),
      ],
    })
  );

  // ============================================================================
  // API REQUESTS (transactional)
  // Strategy: NetworkFirst with 10s timeout
  // REQ-CACHE-001: API transactionnelles : network-first avec timeout 10s
  // ============================================================================
  workbox.routing.registerRoute(
    ({ url }) =>
      url.pathname.includes('/rest/v1/') ||
      url.pathname.includes('/auth/v1/'),
    new workbox.strategies.NetworkFirst({
      cacheName: CACHE_NAMES.API,
      networkTimeoutSeconds: CACHE_CONFIG.api.networkTimeoutSeconds,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: CACHE_CONFIG.api.maxEntries,
          maxAgeSeconds: CACHE_CONFIG.api.maxAgeSeconds,
        }),
      ],
    })
  );
} else {
  console.error('[SW] Workbox failed to load');
}

// ============================================================================
// INSTALL EVENT
// REQ-PERF-004: Precache offline fallback page
// ============================================================================
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${SW_VERSION}`);
  
  event.waitUntil(
    caches.open(CACHE_NAMES.OFFLINE).then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.json',
        '/offline.html',
      ]);
    })
  );
  
  // Don't skip waiting automatically - let SWUpdateManager control this
  // REQ-SW-001: Safe Service Worker Update
});

// ============================================================================
// ACTIVATE EVENT
// REQ-CACHE-002: Delete old versioned caches on activation
// ============================================================================
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version ${SW_VERSION}`);
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches - keep only CURRENT_CACHES
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Delete caches that start with 'cocoatrack-' but are not in CURRENT_CACHES
              return (
                cacheName.startsWith('cocoatrack-') &&
                !CURRENT_CACHES.includes(cacheName)
              );
            })
            .map((cacheName) => {
              console.log(`[SW] Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            })
        );
      }),
      // Take control of all clients
      self.clients.claim(),
    ])
  );
});

// ============================================================================
// FETCH EVENT - OFFLINE FALLBACK
// REQ-PERF-004: Offline Fallback Pages
// ============================================================================
self.addEventListener('fetch', (event) => {
  // Only handle navigation requests for offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Network failed, try to serve offline page
          return caches.match('/offline.html');
        })
    );
  }
});

// ============================================================================
// BACKGROUND SYNC (for offline operations)
// ============================================================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-operations') {
    event.waitUntil(syncOfflineOperations());
  }
});

async function syncOfflineOperations() {
  // This will be handled by the sync engine in the main app
  // The service worker just triggers the sync event
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_TRIGGERED',
      timestamp: Date.now(),
    });
  });
}

// ============================================================================
// PUSH NOTIFICATIONS
// ============================================================================
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Nouvelle notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      ...data,
    },
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'CocoaTrack', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// ============================================================================
// MESSAGE HANDLING
// REQ-SW-001: Safe Service Worker Update - controlled skipWaiting
// ============================================================================
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      // Only skip waiting when explicitly requested by SWUpdateManager
      console.log('[SW] Skip waiting requested');
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      // Return SW version for diagnostics
      event.ports[0]?.postMessage({ version: SW_VERSION });
      break;

    case 'CACHE_REFERENTIAL':
      // Pre-cache referential data
      event.waitUntil(cacheReferentialData(data?.urls || []));
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(clearAllCaches());
      break;

    case 'GET_CACHE_SIZES':
      // Return cache sizes for diagnostics
      event.waitUntil(getCacheSizes().then((sizes) => {
        event.ports[0]?.postMessage({ sizes });
      }));
      break;

    default:
      console.log('[SW] Unknown message type:', type);
  }
});

async function cacheReferentialData(urls) {
  if (!urls || urls.length === 0) return;
  
  const cache = await caches.open(CACHE_NAMES.REFERENTIAL);
  try {
    await cache.addAll(urls);
    // Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'CACHE_COMPLETE',
        urls,
      });
    });
  } catch (error) {
    console.error('[SW] Failed to cache referential data:', error);
  }
}

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((name) => name.startsWith('cocoatrack-'))
      .map((name) => caches.delete(name))
  );
  console.log('[SW] All caches cleared');
}

async function getCacheSizes() {
  const sizes = {};
  const cacheNames = await caches.keys();
  
  for (const name of cacheNames) {
    if (name.startsWith('cocoatrack-')) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      sizes[name] = keys.length;
    }
  }
  
  return sizes;
}
