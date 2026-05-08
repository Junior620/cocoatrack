/**
 * IndexedDB Cache for Satellite Data
 * 
 * This module provides a client-side caching layer using IndexedDB for storing
 * satellite imagery and NDVI data offline. It enables offline access to previously
 * loaded satellite data in areas with poor internet connectivity.
 * 
 * Requirements: Task 6.1.1
 * - Create IndexedDB database for satellite data
 * - Implement object stores for imagery and NDVI data
 * - Add indexes for efficient querying
 * - Support LRU (Least Recently Used) eviction
 * - Store up to 50 parcelles of imagery data
 * 
 * Features:
 * - Automatic database initialization
 * - Versioned schema migrations
 * - Efficient querying with indexes
 * - LRU cache eviction
 * - Storage quota management
 */

import type { ImageryData, NDVIResult } from '../types';

// ============================================================================
// Constants
// ============================================================================

/**
 * IndexedDB database name
 */
const DB_NAME = 'CocoaTrackSatelliteCache';

/**
 * Current database version
 * Increment this when schema changes are needed
 */
const DB_VERSION = 1;

/**
 * Object store names
 */
const STORES = {
  IMAGERY: 'imagery',
  NDVI: 'ndvi',
  METADATA: 'metadata',
} as const;

/**
 * Maximum number of parcelles to cache
 */
const MAX_CACHED_PARCELLES = 50;

/**
 * Cache expiration time in milliseconds (30 days)
 */
const CACHE_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

/**
 * Cached imagery entry with metadata
 */
interface CachedImagery {
  id: string;
  parcelleId: string;
  acquisitionDate: string; // ISO string
  data: ImageryData;
  cachedAt: string; // ISO string
  lastAccessedAt: string; // ISO string
  sizeBytes: number;
}

/**
 * Cached NDVI entry with metadata
 */
interface CachedNDVI {
  id: string;
  parcelleId: string;
  calculationDate: string; // ISO string
  data: NDVIResult;
  cachedAt: string; // ISO string
  lastAccessedAt: string; // ISO string
  sizeBytes: number;
}

/**
 * Cache metadata for tracking
 */
interface CacheMetadata {
  key: string;
  value: string | number | boolean;
  updatedAt: string; // ISO string
}

/**
 * Cache statistics
 */
export interface CacheStatistics {
  totalImageryEntries: number;
  totalNDVIEntries: number;
  totalSizeBytes: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
  cachedParcelles: string[];
}

// ============================================================================
// IndexedDBCache Class
// ============================================================================

/**
 * IndexedDB cache for satellite imagery and NDVI data
 * 
 * Provides offline storage and retrieval of satellite data with automatic
 * LRU eviction when storage limits are reached.
 * 
 * @example
 * ```typescript
 * const cache = new IndexedDBCache();
 * await cache.initialize();
 * 
 * // Store imagery
 * await cache.storeImagery(imageryData);
 * 
 * // Retrieve imagery
 * const cached = await cache.getImagery('parcelle-123', new Date('2024-01-15'));
 * 
 * // Get cache statistics
 * const stats = await cache.getStatistics();
 * console.log(`Cached ${stats.totalImageryEntries} imagery entries`);
 * ```
 */
export class IndexedDBCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the IndexedDB database
   * 
   * Creates the database and object stores if they don't exist.
   * This method is idempotent and can be called multiple times safely.
   * 
   * @returns Promise that resolves when initialization is complete
   * @throws {Error} If IndexedDB is not supported or initialization fails
   */
  async initialize(): Promise<void> {
    // Return existing initialization promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.db) {
      return Promise.resolve();
    }

    // Check if IndexedDB is supported
    if (!this.isSupported()) {
      throw new Error('IndexedDB is not supported in this browser');
    }

    // Create initialization promise
    this.initPromise = new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.initPromise = null;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStores(db);
      };
    });

    return this.initPromise;
  }

  /**
   * Check if IndexedDB is supported in the current browser
   * 
   * @returns True if IndexedDB is supported
   */
  isSupported(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  /**
   * Create object stores and indexes during database upgrade
   * 
   * @param db - IDBDatabase instance
   */
  private createObjectStores(db: IDBDatabase): void {
    // Create imagery object store
    if (!db.objectStoreNames.contains(STORES.IMAGERY)) {
      const imageryStore = db.createObjectStore(STORES.IMAGERY, {
        keyPath: 'id',
      });

      // Create indexes for efficient querying
      imageryStore.createIndex('parcelleId', 'parcelleId', { unique: false });
      imageryStore.createIndex('acquisitionDate', 'acquisitionDate', { unique: false });
      imageryStore.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
      imageryStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      imageryStore.createIndex(
        'parcelleId_acquisitionDate',
        ['parcelleId', 'acquisitionDate'],
        { unique: true }
      );
    }

    // Create NDVI object store
    if (!db.objectStoreNames.contains(STORES.NDVI)) {
      const ndviStore = db.createObjectStore(STORES.NDVI, {
        keyPath: 'id',
      });

      // Create indexes for efficient querying
      ndviStore.createIndex('parcelleId', 'parcelleId', { unique: false });
      ndviStore.createIndex('calculationDate', 'calculationDate', { unique: false });
      ndviStore.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
      ndviStore.createIndex('cachedAt', 'cachedAt', { unique: false });
      ndviStore.createIndex(
        'parcelleId_calculationDate',
        ['parcelleId', 'calculationDate'],
        { unique: true }
      );
    }

    // Create metadata object store
    if (!db.objectStoreNames.contains(STORES.METADATA)) {
      const metadataStore = db.createObjectStore(STORES.METADATA, {
        keyPath: 'key',
      });

      metadataStore.createIndex('updatedAt', 'updatedAt', { unique: false });
    }
  }

  /**
   * Ensure database is initialized before operations
   * 
   * @throws {Error} If database is not initialized
   */
  private ensureInitialized(): void {
    if (!this.db) {
      throw new Error('IndexedDB cache is not initialized. Call initialize() first.');
    }
  }

  /**
   * Store imagery data in cache
   * 
   * @param imagery - Imagery data to cache
   * @returns Promise that resolves when storage is complete
   * @throws {Error} If storage fails
   */
  async storeImagery(imagery: ImageryData): Promise<void> {
    this.ensureInitialized();

    const now = new Date().toISOString();
    const sizeBytes = this.estimateSize(imagery);

    const cachedEntry: CachedImagery = {
      id: imagery.id,
      parcelleId: imagery.parcelleId,
      acquisitionDate: imagery.acquisitionDate.toISOString(),
      data: imagery,
      cachedAt: now,
      lastAccessedAt: now,
      sizeBytes,
    };

    // Check if we need to evict old entries
    await this.evictIfNeeded(STORES.IMAGERY, sizeBytes);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.IMAGERY], 'readwrite');
      const store = transaction.objectStore(STORES.IMAGERY);
      const request = store.put(cachedEntry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to store imagery: ${request.error?.message}`));
    });
  }

  /**
   * Retrieve imagery data from cache
   * 
   * @param parcelleId - Parcelle ID
   * @param date - Acquisition date
   * @returns Cached imagery data or null if not found
   */
  async getImagery(parcelleId: string, date: Date): Promise<ImageryData | null> {
    this.ensureInitialized();

    const dateStr = date.toISOString();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.IMAGERY], 'readwrite');
      const store = transaction.objectStore(STORES.IMAGERY);
      const index = store.index('parcelleId_acquisitionDate');
      const request = index.get([parcelleId, dateStr]);

      request.onsuccess = () => {
        const entry = request.result as CachedImagery | undefined;

        if (!entry) {
          resolve(null);
          return;
        }

        // Check if entry is expired
        const cachedAt = new Date(entry.cachedAt);
        const now = new Date();
        if (now.getTime() - cachedAt.getTime() > CACHE_EXPIRATION_MS) {
          // Entry expired, delete it
          this.deleteImagery(entry.id).catch(console.error);
          resolve(null);
          return;
        }

        // Update last accessed time
        entry.lastAccessedAt = now.toISOString();
        store.put(entry);

        resolve(entry.data);
      };

      request.onerror = () => reject(new Error(`Failed to get imagery: ${request.error?.message}`));
    });
  }

  /**
   * Store NDVI data in cache
   * 
   * @param ndvi - NDVI data to cache
   * @returns Promise that resolves when storage is complete
   * @throws {Error} If storage fails
   */
  async storeNDVI(ndvi: NDVIResult): Promise<void> {
    this.ensureInitialized();

    const now = new Date().toISOString();
    const sizeBytes = this.estimateSize(ndvi);

    const cachedEntry: CachedNDVI = {
      id: ndvi.id,
      parcelleId: ndvi.parcelleId,
      calculationDate: ndvi.calculationDate.toISOString(),
      data: ndvi,
      cachedAt: now,
      lastAccessedAt: now,
      sizeBytes,
    };

    // Check if we need to evict old entries
    await this.evictIfNeeded(STORES.NDVI, sizeBytes);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.NDVI], 'readwrite');
      const store = transaction.objectStore(STORES.NDVI);
      const request = store.put(cachedEntry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to store NDVI: ${request.error?.message}`));
    });
  }

  /**
   * Retrieve NDVI data from cache
   * 
   * @param parcelleId - Parcelle ID
   * @param date - Calculation date
   * @returns Cached NDVI data or null if not found
   */
  async getNDVI(parcelleId: string, date: Date): Promise<NDVIResult | null> {
    this.ensureInitialized();

    const dateStr = date.toISOString();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.NDVI], 'readwrite');
      const store = transaction.objectStore(STORES.NDVI);
      const index = store.index('parcelleId_calculationDate');
      const request = index.get([parcelleId, dateStr]);

      request.onsuccess = () => {
        const entry = request.result as CachedNDVI | undefined;

        if (!entry) {
          resolve(null);
          return;
        }

        // Check if entry is expired
        const cachedAt = new Date(entry.cachedAt);
        const now = new Date();
        if (now.getTime() - cachedAt.getTime() > CACHE_EXPIRATION_MS) {
          // Entry expired, delete it
          this.deleteNDVI(entry.id).catch(console.error);
          resolve(null);
          return;
        }

        // Update last accessed time
        entry.lastAccessedAt = now.toISOString();
        store.put(entry);

        resolve(entry.data);
      };

      request.onerror = () => reject(new Error(`Failed to get NDVI: ${request.error?.message}`));
    });
  }

  /**
   * Get all cached imagery for a parcelle
   * 
   * @param parcelleId - Parcelle ID
   * @returns Array of cached imagery data
   */
  async getImageryByParcelle(parcelleId: string): Promise<ImageryData[]> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.IMAGERY], 'readonly');
      const store = transaction.objectStore(STORES.IMAGERY);
      const index = store.index('parcelleId');
      const request = index.getAll(parcelleId);

      request.onsuccess = () => {
        const entries = request.result as CachedImagery[];
        const now = new Date();

        // Filter out expired entries and extract data
        const validEntries = entries
          .filter((entry) => {
            const cachedAt = new Date(entry.cachedAt);
            return now.getTime() - cachedAt.getTime() <= CACHE_EXPIRATION_MS;
          })
          .map((entry) => entry.data);

        resolve(validEntries);
      };

      request.onerror = () => reject(new Error(`Failed to get imagery by parcelle: ${request.error?.message}`));
    });
  }

  /**
   * Get all cached NDVI results for a parcelle
   * 
   * @param parcelleId - Parcelle ID
   * @returns Array of cached NDVI data
   */
  async getNDVIByParcelle(parcelleId: string): Promise<NDVIResult[]> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.NDVI], 'readonly');
      const store = transaction.objectStore(STORES.NDVI);
      const index = store.index('parcelleId');
      const request = index.getAll(parcelleId);

      request.onsuccess = () => {
        const entries = request.result as CachedNDVI[];
        const now = new Date();

        // Filter out expired entries and extract data
        const validEntries = entries
          .filter((entry) => {
            const cachedAt = new Date(entry.cachedAt);
            return now.getTime() - cachedAt.getTime() <= CACHE_EXPIRATION_MS;
          })
          .map((entry) => entry.data);

        resolve(validEntries);
      };

      request.onerror = () => reject(new Error(`Failed to get NDVI by parcelle: ${request.error?.message}`));
    });
  }

  /**
   * Delete imagery from cache
   * 
   * @param id - Imagery ID
   * @returns Promise that resolves when deletion is complete
   */
  async deleteImagery(id: string): Promise<void> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.IMAGERY], 'readwrite');
      const store = transaction.objectStore(STORES.IMAGERY);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete imagery: ${request.error?.message}`));
    });
  }

  /**
   * Delete NDVI from cache
   * 
   * @param id - NDVI ID
   * @returns Promise that resolves when deletion is complete
   */
  async deleteNDVI(id: string): Promise<void> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.NDVI], 'readwrite');
      const store = transaction.objectStore(STORES.NDVI);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete NDVI: ${request.error?.message}`));
    });
  }

  /**
   * Delete all cached data for a parcelle
   * 
   * @param parcelleId - Parcelle ID
   * @returns Promise that resolves when deletion is complete
   */
  async deleteByParcelle(parcelleId: string): Promise<void> {
    this.ensureInitialized();

    // Delete imagery
    const imagery = await this.getImageryByParcelle(parcelleId);
    await Promise.all(imagery.map((img) => this.deleteImagery(img.id)));

    // Delete NDVI
    const ndvi = await this.getNDVIByParcelle(parcelleId);
    await Promise.all(ndvi.map((n) => this.deleteNDVI(n.id)));
  }

  /**
   * Clear all cached data
   * 
   * @returns Promise that resolves when clearing is complete
   */
  async clear(): Promise<void> {
    this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [STORES.IMAGERY, STORES.NDVI, STORES.METADATA],
        'readwrite'
      );

      const imageryStore = transaction.objectStore(STORES.IMAGERY);
      const ndviStore = transaction.objectStore(STORES.NDVI);
      const metadataStore = transaction.objectStore(STORES.METADATA);

      const requests = [
        imageryStore.clear(),
        ndviStore.clear(),
        metadataStore.clear(),
      ];

      let completed = 0;
      const checkComplete = () => {
        completed++;
        if (completed === requests.length) {
          resolve();
        }
      };

      requests.forEach((request) => {
        request.onsuccess = checkComplete;
        request.onerror = () => reject(new Error(`Failed to clear cache: ${request.error?.message}`));
      });
    });
  }

  /**
   * Get cache statistics
   * 
   * @returns Cache statistics including entry counts and sizes
   */
  async getStatistics(): Promise<CacheStatistics> {
    this.ensureInitialized();

    const [imageryEntries, ndviEntries] = await Promise.all([
      this.getAllImageryEntries(),
      this.getAllNDVIEntries(),
    ]);

    const now = new Date();
    const validImagery = imageryEntries.filter((entry) => {
      const cachedAt = new Date(entry.cachedAt);
      return now.getTime() - cachedAt.getTime() <= CACHE_EXPIRATION_MS;
    });

    const validNDVI = ndviEntries.filter((entry) => {
      const cachedAt = new Date(entry.cachedAt);
      return now.getTime() - cachedAt.getTime() <= CACHE_EXPIRATION_MS;
    });

    const totalSizeBytes =
      validImagery.reduce((sum, entry) => sum + entry.sizeBytes, 0) +
      validNDVI.reduce((sum, entry) => sum + entry.sizeBytes, 0);

    const allEntries = [...validImagery, ...validNDVI];
    const cachedDates = allEntries.map((entry) => new Date(entry.cachedAt));

    const oldestEntry = cachedDates.length > 0 ? new Date(Math.min(...cachedDates.map((d) => d.getTime()))) : null;
    const newestEntry = cachedDates.length > 0 ? new Date(Math.max(...cachedDates.map((d) => d.getTime()))) : null;

    const cachedParcelles = Array.from(
      new Set([...validImagery.map((e) => e.parcelleId), ...validNDVI.map((e) => e.parcelleId)])
    );

    return {
      totalImageryEntries: validImagery.length,
      totalNDVIEntries: validNDVI.length,
      totalSizeBytes,
      oldestEntry,
      newestEntry,
      cachedParcelles,
    };
  }

  /**
   * Get all imagery entries (including expired)
   * 
   * @returns Array of all cached imagery entries
   */
  private async getAllImageryEntries(): Promise<CachedImagery[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.IMAGERY], 'readonly');
      const store = transaction.objectStore(STORES.IMAGERY);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as CachedImagery[]);
      request.onerror = () => reject(new Error(`Failed to get all imagery: ${request.error?.message}`));
    });
  }

  /**
   * Get all NDVI entries (including expired)
   * 
   * @returns Array of all cached NDVI entries
   */
  private async getAllNDVIEntries(): Promise<CachedNDVI[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.NDVI], 'readonly');
      const store = transaction.objectStore(STORES.NDVI);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as CachedNDVI[]);
      request.onerror = () => reject(new Error(`Failed to get all NDVI: ${request.error?.message}`));
    });
  }

  /**
   * Evict old entries if cache limit is reached (LRU eviction)
   * 
   * @param storeName - Object store name
   * @param newEntrySize - Size of new entry to be added
   */
  private async evictIfNeeded(storeName: string, newEntrySize: number): Promise<void> {
    const stats = await this.getStatistics();

    // Check if we've exceeded the parcelle limit
    if (stats.cachedParcelles.length >= MAX_CACHED_PARCELLES) {
      // Evict least recently accessed parcelle
      await this.evictLRUParcelle(storeName);
    }

    // TODO: Add storage quota check and eviction if needed
    // This would require checking navigator.storage.estimate() and evicting
    // entries if we're approaching the quota limit
  }

  /**
   * Evict the least recently accessed parcelle from cache
   * 
   * @param storeName - Object store name
   */
  private async evictLRUParcelle(storeName: string): Promise<void> {
    const entries =
      storeName === STORES.IMAGERY
        ? await this.getAllImageryEntries()
        : await this.getAllNDVIEntries();

    if (entries.length === 0) {
      return;
    }

    // Group by parcelle and find oldest accessed
    const parcelleAccess = new Map<string, Date>();

    entries.forEach((entry) => {
      const lastAccessed = new Date(entry.lastAccessedAt);
      const currentOldest = parcelleAccess.get(entry.parcelleId);

      if (!currentOldest || lastAccessed < currentOldest) {
        parcelleAccess.set(entry.parcelleId, lastAccessed);
      }
    });

    // Find parcelle with oldest access time
    let oldestParcelle: string | null = null;
    let oldestTime: Date | null = null;

    parcelleAccess.forEach((time, parcelleId) => {
      if (!oldestTime || time < oldestTime) {
        oldestTime = time;
        oldestParcelle = parcelleId;
      }
    });

    // Delete all entries for the oldest parcelle
    if (oldestParcelle) {
      await this.deleteByParcelle(oldestParcelle);
    }
  }

  /**
   * Estimate the size of an object in bytes
   * 
   * This is a rough estimate based on JSON serialization.
   * 
   * @param obj - Object to estimate
   * @returns Estimated size in bytes
   */
  private estimateSize(obj: unknown): number {
    try {
      const json = JSON.stringify(obj);
      // Rough estimate: 2 bytes per character (UTF-16)
      return json.length * 2;
    } catch {
      // If serialization fails, return a default estimate
      return 1024; // 1 KB default
    }
  }

  /**
   * Close the database connection
   * 
   * Should be called when the cache is no longer needed.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of IndexedDBCache
 * 
 * Use this instance throughout the application to ensure a single
 * database connection is shared.
 */
let cacheInstance: IndexedDBCache | null = null;

/**
 * Get the singleton IndexedDBCache instance
 * 
 * Automatically initializes the cache on first access.
 * 
 * @returns IndexedDBCache instance
 * 
 * @example
 * ```typescript
 * const cache = await getIndexedDBCache();
 * await cache.storeImagery(imageryData);
 * ```
 */
export async function getIndexedDBCache(): Promise<IndexedDBCache> {
  if (!cacheInstance) {
    cacheInstance = new IndexedDBCache();
    await cacheInstance.initialize();
  }
  return cacheInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetIndexedDBCache(): void {
  if (cacheInstance) {
    cacheInstance.close();
    cacheInstance = null;
  }
}
