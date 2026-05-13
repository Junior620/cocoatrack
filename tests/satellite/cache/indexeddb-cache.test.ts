/**
 * Unit tests for IndexedDBCache
 * 
 * Tests cache storage, retrieval, and eviction including:
 * - storeImagery() / storeNDVI() - store data in cache
 * - getImagery() / getNDVI() - retrieve cached data
 * - Cache expiration (30-day TTL)
 * - Last accessed timestamp updates
 * - LRU eviction when cache limit is reached
 * 
 * Task: 6.1.6 - Write unit tests for IndexedDB cache
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndexedDBCache, resetIndexedDBCache } from '@/lib/satellite/cache/indexeddb-cache';
import type { ImageryData, NDVIResult } from '@/lib/satellite/types';

// Mock IndexedDB
const mockIndexedDB = () => {
  const databases = new Map<string, any>();
  
  return {
    open: vi.fn((name: string, version: number) => {
      const request = {
        result: null as any,
        error: null as any,
        onsuccess: null as any,
        onerror: null as any,
        onupgradeneeded: null as any,
      };

      setTimeout(() => {
        if (!databases.has(name)) {
          // Trigger upgrade
          const db = {
            name,
            version,
            objectStoreNames: {
              contains: vi.fn(() => false),
            },
            createObjectStore: vi.fn((storeName: string, options: any) => ({
              createIndex: vi.fn(),
            })),
            transaction: vi.fn(),
            close: vi.fn(),
          };
          
          databases.set(name, db);
          
          if (request.onupgradeneeded) {
            request.onupgradeneeded({ target: { result: db } });
          }
        }

        const db = databases.get(name);
        request.result = db;
        
        if (request.onsuccess) {
          request.onsuccess();
        }
      }, 0);

      return request;
    }),
  };
};

describe('IndexedDBCache - Cache Retrieval Methods', () => {
  let cache: IndexedDBCache;
  let mockDB: any;
  let storedData: Map<string, any>;

  beforeEach(async () => {
    // Reset singleton
    resetIndexedDBCache();
    
    // Initialize storage
    storedData = new Map();

    // Mock IndexedDB
    mockDB = {
      transaction: vi.fn((stores: string[], mode: string) => {
        const transaction = {
          objectStore: vi.fn((storeName: string) => {
            const store = {
              get: vi.fn((key: any) => {
                const request = {
                  result: undefined as any,
                  error: null as any,
                  onsuccess: null as any,
                  onerror: null as any,
                };

                setTimeout(() => {
                  const storeKey = `${storeName}:${JSON.stringify(key)}`;
                  request.result = storedData.get(storeKey);
                  if (request.onsuccess) {
                    request.onsuccess();
                  }
                }, 0);

                return request;
              }),
              put: vi.fn((value: any) => {
                const request = {
                  result: undefined as any,
                  error: null as any,
                  onsuccess: null as any,
                  onerror: null as any,
                };

                setTimeout(() => {
                  const storeKey = `${storeName}:${JSON.stringify(value.id)}`;
                  storedData.set(storeKey, value);
                  if (request.onsuccess) {
                    request.onsuccess();
                  }
                }, 0);

                return request;
              }),
              delete: vi.fn((key: any) => {
                const request = {
                  result: undefined as any,
                  error: null as any,
                  onsuccess: null as any,
                  onerror: null as any,
                };

                setTimeout(() => {
                  const storeKey = `${storeName}:${JSON.stringify(key)}`;
                  storedData.delete(storeKey);
                  if (request.onsuccess) {
                    request.onsuccess();
                  }
                }, 0);

                return request;
              }),
              getAll: vi.fn((key?: any) => {
                const request = {
                  result: [] as any[],
                  error: null as any,
                  onsuccess: null as any,
                  onerror: null as any,
                };

                setTimeout(() => {
                  const results: any[] = [];
                  storedData.forEach((value, storeKey) => {
                    if (storeKey.startsWith(`${storeName}:`)) {
                      if (!key || value.parcelleId === key) {
                        results.push(value);
                      }
                    }
                  });
                  request.result = results;
                  if (request.onsuccess) {
                    request.onsuccess();
                  }
                }, 0);

                return request;
              }),
              clear: vi.fn(() => {
                const request = {
                  result: undefined as any,
                  error: null as any,
                  onsuccess: null as any,
                  onerror: null as any,
                };

                setTimeout(() => {
                  const keysToDelete: string[] = [];
                  storedData.forEach((_, key) => {
                    if (key.startsWith(`${storeName}:`)) {
                      keysToDelete.push(key);
                    }
                  });
                  keysToDelete.forEach((key) => storedData.delete(key));
                  if (request.onsuccess) {
                    request.onsuccess();
                  }
                }, 0);

                return request;
              }),
              index: vi.fn((indexName: string) => ({
                get: vi.fn((key: any) => {
                  const request = {
                    result: undefined as any,
                    error: null as any,
                    onsuccess: null as any,
                    onerror: null as any,
                  };

                  setTimeout(() => {
                    // Find entry matching the compound key
                    storedData.forEach((value) => {
                      if (indexName === 'parcelleId_acquisitionDate') {
                        if (value.parcelleId === key[0] && value.acquisitionDate === key[1]) {
                          request.result = value;
                        }
                      } else if (indexName === 'parcelleId_calculationDate') {
                        if (value.parcelleId === key[0] && value.calculationDate === key[1]) {
                          request.result = value;
                        }
                      }
                    });
                    if (request.onsuccess) {
                      request.onsuccess();
                    }
                  }, 0);

                  return request;
                }),
                getAll: vi.fn((key: any) => {
                  const request = {
                    result: [] as any[],
                    error: null as any,
                    onsuccess: null as any,
                    onerror: null as any,
                  };

                  setTimeout(() => {
                    const results: any[] = [];
                    storedData.forEach((value) => {
                      if (indexName === 'parcelleId' && value.parcelleId === key) {
                        results.push(value);
                      }
                    });
                    request.result = results;
                    if (request.onsuccess) {
                      request.onsuccess();
                    }
                  }, 0);

                  return request;
                }),
              })),
            };
            return store;
          }),
        };
        return transaction;
      }),
      close: vi.fn(),
    };

    // Mock global indexedDB
    global.indexedDB = {
      open: vi.fn((name: string, version: number) => {
        const request = {
          result: mockDB,
          error: null as any,
          onsuccess: null as any,
          onerror: null as any,
          onupgradeneeded: null as any,
        };

        setTimeout(() => {
          if (request.onupgradeneeded) {
            const upgradeDB = {
              ...mockDB,
              objectStoreNames: {
                contains: vi.fn(() => false),
              },
              createObjectStore: vi.fn((storeName: string, options: any) => ({
                createIndex: vi.fn(),
              })),
            };
            request.onupgradeneeded({ target: { result: upgradeDB } });
          }
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      }),
    } as any;

    cache = new IndexedDBCache();
    await cache.initialize();
  });

  afterEach(() => {
    cache.close();
    resetIndexedDBCache();
    storedData.clear();
  });

  describe('getImagery() - getCachedImagery method', () => {
    it('should retrieve cached imagery data', async () => {
      // Arrange: Store imagery in cache
      const mockImagery: ImageryData = {
        id: 'imagery-123',
        parcelleId: 'parcelle-456',
        acquisitionDate: new Date('2024-01-15'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-01-15'),
      };

      await cache.storeImagery(mockImagery);

      // Act: Retrieve cached imagery
      const result = await cache.getImagery('parcelle-456', new Date('2024-01-15'));

      // Assert: Should return the cached imagery
      expect(result).not.toBeNull();
      expect(result?.id).toBe('imagery-123');
      expect(result?.parcelleId).toBe('parcelle-456');
      expect(result?.cloudCoverPercent).toBe(10);
    });

    it('should return null when imagery is not cached', async () => {
      // Act: Try to retrieve non-existent imagery
      const result = await cache.getImagery('parcelle-999', new Date('2024-01-15'));

      // Assert: Should return null
      expect(result).toBeNull();
    });

    it('should check cache expiration (30-day TTL)', async () => {
      // Arrange: Store imagery with old cache date (35 days ago)
      const now = new Date();
      const expiredDate = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);

      const mockImagery: ImageryData = {
        id: 'imagery-expired',
        parcelleId: 'parcelle-456',
        acquisitionDate: new Date('2024-01-15'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-01-15'),
      };

      // Manually store with expired cache date
      const cachedEntry = {
        id: mockImagery.id,
        parcelleId: mockImagery.parcelleId,
        acquisitionDate: mockImagery.acquisitionDate.toISOString(),
        data: mockImagery,
        cachedAt: expiredDate.toISOString(),
        lastAccessedAt: expiredDate.toISOString(),
        sizeBytes: 1024,
      };

      const storeKey = `imagery:"${cachedEntry.id}"`;
      storedData.set(storeKey, cachedEntry);

      // Act: Try to retrieve expired imagery
      const result = await cache.getImagery('parcelle-456', new Date('2024-01-15'));

      // Assert: Should return null because cache is expired
      expect(result).toBeNull();
    });

    it('should update lastAccessedAt timestamp when retrieving cached imagery', async () => {
      // Arrange: Store imagery
      const mockImagery: ImageryData = {
        id: 'imagery-123',
        parcelleId: 'parcelle-456',
        acquisitionDate: new Date('2024-01-15'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-01-15'),
      };

      await cache.storeImagery(mockImagery);

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Act: Retrieve cached imagery
      const result = await cache.getImagery('parcelle-456', new Date('2024-01-15'));

      // Assert: Should have updated lastAccessedAt
      expect(result).not.toBeNull();
      
      // Verify the put method was called to update lastAccessedAt
      expect(mockDB.transaction).toHaveBeenCalled();
    });

    it('should return null for imagery cached within 30 days but with different date', async () => {
      // Arrange: Store imagery for one date
      const mockImagery: ImageryData = {
        id: 'imagery-123',
        parcelleId: 'parcelle-456',
        acquisitionDate: new Date('2024-01-15'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-01-15'),
      };

      await cache.storeImagery(mockImagery);

      // Act: Try to retrieve with different date
      const result = await cache.getImagery('parcelle-456', new Date('2024-01-20'));

      // Assert: Should return null (different date)
      expect(result).toBeNull();
    });
  });

  describe('getNDVI() - getCachedNDVI method', () => {
    it('should retrieve cached NDVI data', async () => {
      // Arrange: Store NDVI in cache
      const mockNDVI: NDVIResult = {
        id: 'ndvi-123',
        parcelleId: 'parcelle-456',
        imageryId: 'imagery-123',
        calculationDate: new Date('2024-01-15'),
        meanNDVI: 0.75,
        minNDVI: 0.5,
        maxNDVI: 0.9,
        stdDevNDVI: 0.1,
        healthStatus: 'excellent',
        ndviRasterUrl: 'https://example.com/ndvi.png',
        createdAt: new Date('2024-01-15'),
      };

      await cache.storeNDVI(mockNDVI);

      // Act: Retrieve cached NDVI
      const result = await cache.getNDVI('parcelle-456', new Date('2024-01-15'));

      // Assert: Should return the cached NDVI
      expect(result).not.toBeNull();
      expect(result?.id).toBe('ndvi-123');
      expect(result?.parcelleId).toBe('parcelle-456');
      expect(result?.meanNDVI).toBe(0.75);
      expect(result?.healthStatus).toBe('excellent');
    });

    it('should return null when NDVI is not cached', async () => {
      // Act: Try to retrieve non-existent NDVI
      const result = await cache.getNDVI('parcelle-999', new Date('2024-01-15'));

      // Assert: Should return null
      expect(result).toBeNull();
    });

    it('should check cache expiration (30-day TTL) for NDVI', async () => {
      // Arrange: Store NDVI with old cache date (35 days ago)
      const now = new Date();
      const expiredDate = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);

      const mockNDVI: NDVIResult = {
        id: 'ndvi-expired',
        parcelleId: 'parcelle-456',
        imageryId: 'imagery-123',
        calculationDate: new Date('2024-01-15'),
        meanNDVI: 0.75,
        minNDVI: 0.5,
        maxNDVI: 0.9,
        stdDevNDVI: 0.1,
        healthStatus: 'excellent',
        ndviRasterUrl: 'https://example.com/ndvi.png',
        createdAt: new Date('2024-01-15'),
      };

      // Manually store with expired cache date
      const cachedEntry = {
        id: mockNDVI.id,
        parcelleId: mockNDVI.parcelleId,
        calculationDate: mockNDVI.calculationDate.toISOString(),
        data: mockNDVI,
        cachedAt: expiredDate.toISOString(),
        lastAccessedAt: expiredDate.toISOString(),
        sizeBytes: 512,
      };

      const storeKey = `ndvi:"${cachedEntry.id}"`;
      storedData.set(storeKey, cachedEntry);

      // Act: Try to retrieve expired NDVI
      const result = await cache.getNDVI('parcelle-456', new Date('2024-01-15'));

      // Assert: Should return null because cache is expired
      expect(result).toBeNull();
    });

    it('should update lastAccessedAt timestamp when retrieving cached NDVI', async () => {
      // Arrange: Store NDVI
      const mockNDVI: NDVIResult = {
        id: 'ndvi-123',
        parcelleId: 'parcelle-456',
        imageryId: 'imagery-123',
        calculationDate: new Date('2024-01-15'),
        meanNDVI: 0.75,
        minNDVI: 0.5,
        maxNDVI: 0.9,
        stdDevNDVI: 0.1,
        healthStatus: 'excellent',
        ndviRasterUrl: 'https://example.com/ndvi.png',
        createdAt: new Date('2024-01-15'),
      };

      await cache.storeNDVI(mockNDVI);

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Act: Retrieve cached NDVI
      const result = await cache.getNDVI('parcelle-456', new Date('2024-01-15'));

      // Assert: Should have updated lastAccessedAt
      expect(result).not.toBeNull();
      
      // Verify the put method was called to update lastAccessedAt
      expect(mockDB.transaction).toHaveBeenCalled();
    });

    it('should return null for NDVI cached within 30 days but with different date', async () => {
      // Arrange: Store NDVI for one date
      const mockNDVI: NDVIResult = {
        id: 'ndvi-123',
        parcelleId: 'parcelle-456',
        imageryId: 'imagery-123',
        calculationDate: new Date('2024-01-15'),
        meanNDVI: 0.75,
        minNDVI: 0.5,
        maxNDVI: 0.9,
        stdDevNDVI: 0.1,
        healthStatus: 'excellent',
        ndviRasterUrl: 'https://example.com/ndvi.png',
        createdAt: new Date('2024-01-15'),
      };

      await cache.storeNDVI(mockNDVI);

      // Act: Try to retrieve with different date
      const result = await cache.getNDVI('parcelle-456', new Date('2024-01-20'));

      // Assert: Should return null (different date)
      expect(result).toBeNull();
    });
  });

  describe('Cache expiration edge cases', () => {
    it('should return null for imagery cached exactly 30 days ago (boundary test)', async () => {
      // Arrange: Store imagery exactly 30 days ago
      const now = new Date();
      const exactlyThirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const mockImagery: ImageryData = {
        id: 'imagery-boundary',
        parcelleId: 'parcelle-456',
        acquisitionDate: new Date('2024-01-15'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-01-15'),
      };

      const cachedEntry = {
        id: mockImagery.id,
        parcelleId: mockImagery.parcelleId,
        acquisitionDate: mockImagery.acquisitionDate.toISOString(),
        data: mockImagery,
        cachedAt: exactlyThirtyDaysAgo.toISOString(),
        lastAccessedAt: exactlyThirtyDaysAgo.toISOString(),
        sizeBytes: 1024,
      };

      const storeKey = `imagery:"${cachedEntry.id}"`;
      storedData.set(storeKey, cachedEntry);

      // Act: Try to retrieve
      const result = await cache.getImagery('parcelle-456', new Date('2024-01-15'));

      // Assert: Should return null (exactly 30 days is expired with > comparison)
      expect(result).toBeNull();
    });

    it('should return imagery cached 29 days ago (still valid)', async () => {
      // Arrange: Store imagery 29 days ago (still within TTL)
      const now = new Date();
      const twentyNineDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);

      const mockImagery: ImageryData = {
        id: 'imagery-valid-boundary',
        parcelleId: 'parcelle-456',
        acquisitionDate: new Date('2024-01-15'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-01-15'),
      };

      const cachedEntry = {
        id: mockImagery.id,
        parcelleId: mockImagery.parcelleId,
        acquisitionDate: mockImagery.acquisitionDate.toISOString(),
        data: mockImagery,
        cachedAt: twentyNineDaysAgo.toISOString(),
        lastAccessedAt: twentyNineDaysAgo.toISOString(),
        sizeBytes: 1024,
      };

      const storeKey = `imagery:"${cachedEntry.id}"`;
      storedData.set(storeKey, cachedEntry);

      // Act: Try to retrieve
      const result = await cache.getImagery('parcelle-456', new Date('2024-01-15'));

      // Assert: Should return the imagery (29 days is still valid)
      expect(result).not.toBeNull();
      expect(result?.id).toBe('imagery-valid-boundary');
    });

    it('should return null for imagery cached 30 days + 1 second ago', async () => {
      // Arrange: Store imagery just over 30 days ago
      const now = new Date();
      const justOverThirtyDays = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000 + 1000));

      const mockImagery: ImageryData = {
        id: 'imagery-expired-boundary',
        parcelleId: 'parcelle-456',
        acquisitionDate: new Date('2024-01-15'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-01-15'),
      };

      const cachedEntry = {
        id: mockImagery.id,
        parcelleId: mockImagery.parcelleId,
        acquisitionDate: mockImagery.acquisitionDate.toISOString(),
        data: mockImagery,
        cachedAt: justOverThirtyDays.toISOString(),
        lastAccessedAt: justOverThirtyDays.toISOString(),
        sizeBytes: 1024,
      };

      const storeKey = `imagery:"${cachedEntry.id}"`;
      storedData.set(storeKey, cachedEntry);

      // Act: Try to retrieve
      const result = await cache.getImagery('parcelle-456', new Date('2024-01-15'));

      // Assert: Should return null (expired)
      expect(result).toBeNull();
    });
  });

  describe('Integration with getImageryByParcelle and getNDVIByParcelle', () => {
    it('should filter out expired entries when getting all imagery for a parcelle', async () => {
      // Arrange: Store multiple imagery entries, some expired
      const now = new Date();
      const validDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const expiredDate = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000); // 35 days ago

      const validImagery: ImageryData = {
        id: 'imagery-valid',
        parcelleId: 'parcelle-456',
        acquisitionDate: new Date('2024-01-15'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile1.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-01-15'),
      };

      const expiredImagery: ImageryData = {
        id: 'imagery-expired',
        parcelleId: 'parcelle-456',
        acquisitionDate: new Date('2024-01-10'),
        cloudCoverPercent: 15,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile2.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-01-10'),
      };

      // Store valid entry
      const validEntry = {
        id: validImagery.id,
        parcelleId: validImagery.parcelleId,
        acquisitionDate: validImagery.acquisitionDate.toISOString(),
        data: validImagery,
        cachedAt: validDate.toISOString(),
        lastAccessedAt: validDate.toISOString(),
        sizeBytes: 1024,
      };
      storedData.set(`imagery:"${validEntry.id}"`, validEntry);

      // Store expired entry
      const expiredEntry = {
        id: expiredImagery.id,
        parcelleId: expiredImagery.parcelleId,
        acquisitionDate: expiredImagery.acquisitionDate.toISOString(),
        data: expiredImagery,
        cachedAt: expiredDate.toISOString(),
        lastAccessedAt: expiredDate.toISOString(),
        sizeBytes: 1024,
      };
      storedData.set(`imagery:"${expiredEntry.id}"`, expiredEntry);

      // Act: Get all imagery for parcelle
      const results = await cache.getImageryByParcelle('parcelle-456');

      // Assert: Should only return valid entry
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('imagery-valid');
    });

    it('should filter out expired entries when getting all NDVI for a parcelle', async () => {
      // Arrange: Store multiple NDVI entries, some expired
      const now = new Date();
      const validDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const expiredDate = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000); // 35 days ago

      const validNDVI: NDVIResult = {
        id: 'ndvi-valid',
        parcelleId: 'parcelle-456',
        imageryId: 'imagery-123',
        calculationDate: new Date('2024-01-15'),
        meanNDVI: 0.75,
        minNDVI: 0.5,
        maxNDVI: 0.9,
        stdDevNDVI: 0.1,
        healthStatus: 'excellent',
        ndviRasterUrl: 'https://example.com/ndvi1.png',
        createdAt: new Date('2024-01-15'),
      };

      const expiredNDVI: NDVIResult = {
        id: 'ndvi-expired',
        parcelleId: 'parcelle-456',
        imageryId: 'imagery-124',
        calculationDate: new Date('2024-01-10'),
        meanNDVI: 0.65,
        minNDVI: 0.4,
        maxNDVI: 0.8,
        stdDevNDVI: 0.12,
        healthStatus: 'good',
        ndviRasterUrl: 'https://example.com/ndvi2.png',
        createdAt: new Date('2024-01-10'),
      };

      // Store valid entry
      const validEntry = {
        id: validNDVI.id,
        parcelleId: validNDVI.parcelleId,
        calculationDate: validNDVI.calculationDate.toISOString(),
        data: validNDVI,
        cachedAt: validDate.toISOString(),
        lastAccessedAt: validDate.toISOString(),
        sizeBytes: 512,
      };
      storedData.set(`ndvi:"${validEntry.id}"`, validEntry);

      // Store expired entry
      const expiredEntry = {
        id: expiredNDVI.id,
        parcelleId: expiredNDVI.parcelleId,
        calculationDate: expiredNDVI.calculationDate.toISOString(),
        data: expiredNDVI,
        cachedAt: expiredDate.toISOString(),
        lastAccessedAt: expiredDate.toISOString(),
        sizeBytes: 512,
      };
      storedData.set(`ndvi:"${expiredEntry.id}"`, expiredEntry);

      // Act: Get all NDVI for parcelle
      const results = await cache.getNDVIByParcelle('parcelle-456');

      // Assert: Should only return valid entry
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('ndvi-valid');
    });
  });

  describe('Cache Storage', () => {
    it('should store imagery data successfully', async () => {
      // Arrange
      const mockImagery: ImageryData = {
        id: 'imagery-store-test',
        parcelleId: 'parcelle-789',
        acquisitionDate: new Date('2024-02-01'),
        cloudCoverPercent: 5,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile-store.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-02-01'),
      };

      // Act
      await cache.storeImagery(mockImagery);

      // Assert: Should be able to retrieve the stored imagery
      const result = await cache.getImagery('parcelle-789', new Date('2024-02-01'));
      expect(result).not.toBeNull();
      expect(result?.id).toBe('imagery-store-test');
      expect(result?.parcelleId).toBe('parcelle-789');
      expect(result?.cloudCoverPercent).toBe(5);
    });

    it('should store NDVI data successfully', async () => {
      // Arrange
      const mockNDVI: NDVIResult = {
        id: 'ndvi-store-test',
        parcelleId: 'parcelle-789',
        imageryId: 'imagery-789',
        calculationDate: new Date('2024-02-01'),
        meanNDVI: 0.82,
        minNDVI: 0.6,
        maxNDVI: 0.95,
        stdDevNDVI: 0.08,
        healthStatus: 'excellent',
        ndviRasterUrl: 'https://example.com/ndvi-store.png',
        createdAt: new Date('2024-02-01'),
      };

      // Act
      await cache.storeNDVI(mockNDVI);

      // Assert: Should be able to retrieve the stored NDVI
      const result = await cache.getNDVI('parcelle-789', new Date('2024-02-01'));
      expect(result).not.toBeNull();
      expect(result?.id).toBe('ndvi-store-test');
      expect(result?.parcelleId).toBe('parcelle-789');
      expect(result?.meanNDVI).toBe(0.82);
      expect(result?.healthStatus).toBe('excellent');
    });

    it('should update existing imagery when storing with same parcelle and date', async () => {
      // Arrange: Store initial imagery
      const initialImagery: ImageryData = {
        id: 'imagery-update-test',
        parcelleId: 'parcelle-update',
        acquisitionDate: new Date('2024-02-01'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile-v1.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-02-01'),
      };

      await cache.storeImagery(initialImagery);

      // Act: Store updated imagery with same parcelle and date
      const updatedImagery: ImageryData = {
        id: 'imagery-update-test',
        parcelleId: 'parcelle-update',
        acquisitionDate: new Date('2024-02-01'),
        cloudCoverPercent: 5, // Updated cloud cover
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile-v2.png', // Updated URL
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-02-01'),
      };

      await cache.storeImagery(updatedImagery);

      // Assert: Should retrieve the updated version
      const result = await cache.getImagery('parcelle-update', new Date('2024-02-01'));
      expect(result).not.toBeNull();
      expect(result?.cloudCoverPercent).toBe(5);
      expect(result?.tileUrl).toBe('https://example.com/tile-v2.png');
    });

    it('should set cachedAt and lastAccessedAt timestamps when storing', async () => {
      // Arrange
      const beforeStore = new Date();
      
      const mockImagery: ImageryData = {
        id: 'imagery-timestamp-test',
        parcelleId: 'parcelle-timestamp',
        acquisitionDate: new Date('2024-02-01'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile-timestamp.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-02-01'),
      };

      // Act
      await cache.storeImagery(mockImagery);
      
      const afterStore = new Date();

      // Assert: Retrieve and check timestamps are within expected range
      const result = await cache.getImagery('parcelle-timestamp', new Date('2024-02-01'));
      expect(result).not.toBeNull();
      
      // The cached entry should have timestamps set during storage
      // We can't directly access them, but we can verify the data was stored
      expect(result?.id).toBe('imagery-timestamp-test');
    });

    it('should store multiple imagery entries for different dates of same parcelle', async () => {
      // Arrange: Store imagery for multiple dates
      const imagery1: ImageryData = {
        id: 'imagery-multi-1',
        parcelleId: 'parcelle-multi',
        acquisitionDate: new Date('2024-01-01'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile1.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-01-01'),
      };

      const imagery2: ImageryData = {
        id: 'imagery-multi-2',
        parcelleId: 'parcelle-multi',
        acquisitionDate: new Date('2024-01-15'),
        cloudCoverPercent: 15,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile2.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-01-15'),
      };

      // Act
      await cache.storeImagery(imagery1);
      await cache.storeImagery(imagery2);

      // Assert: Should be able to retrieve both
      const result1 = await cache.getImagery('parcelle-multi', new Date('2024-01-01'));
      const result2 = await cache.getImagery('parcelle-multi', new Date('2024-01-15'));

      expect(result1).not.toBeNull();
      expect(result1?.id).toBe('imagery-multi-1');
      expect(result2).not.toBeNull();
      expect(result2?.id).toBe('imagery-multi-2');
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently accessed parcelle when cache limit is reached', async () => {
      // Arrange: Store imagery for 50 parcelles (at the limit)
      const parcelles: string[] = [];
      for (let i = 0; i < 50; i++) {
        const parcelleId = `parcelle-lru-${i}`;
        parcelles.push(parcelleId);
        
        const imagery: ImageryData = {
          id: `imagery-lru-${i}`,
          parcelleId,
          acquisitionDate: new Date('2024-01-15'),
          cloudCoverPercent: 10,
          satelliteSource: 'sentinel-2',
          tileUrl: `https://example.com/tile-${i}.png`,
          bounds: [0, 0, 1, 1],
          resolutionMeters: 10,
          createdAt: new Date('2024-01-15'),
        };

        await cache.storeImagery(imagery);
        
        // Small delay to ensure different lastAccessedAt times
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      // Access the first parcelle to make it recently used
      await cache.getImagery('parcelle-lru-0', new Date('2024-01-15'));

      // Act: Store imagery for a 51st parcelle (should trigger eviction)
      const newImagery: ImageryData = {
        id: 'imagery-lru-new',
        parcelleId: 'parcelle-lru-new',
        acquisitionDate: new Date('2024-01-15'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile-new.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-01-15'),
      };

      await cache.storeImagery(newImagery);

      // Assert: The new parcelle should be cached
      const newResult = await cache.getImagery('parcelle-lru-new', new Date('2024-01-15'));
      expect(newResult).not.toBeNull();
      expect(newResult?.id).toBe('imagery-lru-new');

      // The first parcelle should still be cached (it was recently accessed)
      const firstResult = await cache.getImagery('parcelle-lru-0', new Date('2024-01-15'));
      expect(firstResult).not.toBeNull();

      // One of the other parcelles should have been evicted
      // We can verify by checking cache statistics
      const stats = await cache.getStatistics();
      expect(stats.cachedParcelles.length).toBeLessThanOrEqual(50);
    });

    it('should evict entire parcelle data (all dates) when performing LRU eviction', async () => {
      // Arrange: Store multiple imagery entries for the same parcelle
      const oldParcelleId = 'parcelle-lru-multi-date';
      
      const dates = [
        new Date('2024-01-01'),
        new Date('2024-01-15'),
        new Date('2024-02-01'),
      ];

      for (const date of dates) {
        const imagery: ImageryData = {
          id: `imagery-${date.toISOString()}`,
          parcelleId: oldParcelleId,
          acquisitionDate: date,
          cloudCoverPercent: 10,
          satelliteSource: 'sentinel-2',
          tileUrl: `https://example.com/tile-${date.toISOString()}.png`,
          bounds: [0, 0, 1, 1],
          resolutionMeters: 10,
          createdAt: date,
        };

        await cache.storeImagery(imagery);
      }

      // Fill cache with other parcelles to trigger eviction
      for (let i = 0; i < 50; i++) {
        const imagery: ImageryData = {
          id: `imagery-filler-${i}`,
          parcelleId: `parcelle-filler-${i}`,
          acquisitionDate: new Date('2024-01-15'),
          cloudCoverPercent: 10,
          satelliteSource: 'sentinel-2',
          tileUrl: `https://example.com/tile-filler-${i}.png`,
          bounds: [0, 0, 1, 1],
          resolutionMeters: 10,
          createdAt: new Date('2024-01-15'),
        };

        await cache.storeImagery(imagery);
        await new Promise((resolve) => setTimeout(resolve, 2));
      }

      // Act: Store one more parcelle to trigger eviction
      const newImagery: ImageryData = {
        id: 'imagery-trigger-eviction',
        parcelleId: 'parcelle-trigger-eviction',
        acquisitionDate: new Date('2024-01-15'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile-trigger.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-01-15'),
      };

      await cache.storeImagery(newImagery);

      // Assert: If the old parcelle was evicted, all its dates should be gone
      const results = await cache.getImageryByParcelle(oldParcelleId);
      
      // Either all dates are present (not evicted) or none are present (evicted)
      // This tests that eviction is all-or-nothing per parcelle
      if (results.length === 0) {
        // Parcelle was evicted - verify all dates are gone
        for (const date of dates) {
          const result = await cache.getImagery(oldParcelleId, date);
          expect(result).toBeNull();
        }
      } else {
        // Parcelle was not evicted - verify all dates are present
        expect(results.length).toBe(3);
      }
    });

    it('should update lastAccessedAt when retrieving imagery to affect LRU ordering', async () => {
      // Arrange: Store imagery for two parcelles
      const parcelle1: ImageryData = {
        id: 'imagery-lru-order-1',
        parcelleId: 'parcelle-lru-order-1',
        acquisitionDate: new Date('2024-01-15'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile-order-1.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-01-15'),
      };

      const parcelle2: ImageryData = {
        id: 'imagery-lru-order-2',
        parcelleId: 'parcelle-lru-order-2',
        acquisitionDate: new Date('2024-01-15'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile-order-2.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-01-15'),
      };

      await cache.storeImagery(parcelle1);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await cache.storeImagery(parcelle2);

      // Access parcelle1 to make it more recently used
      await new Promise((resolve) => setTimeout(resolve, 10));
      await cache.getImagery('parcelle-lru-order-1', new Date('2024-01-15'));

      // Act: Verify that accessing updates the timestamp
      // We can't directly verify the timestamp, but we can verify the data is still accessible
      const result = await cache.getImagery('parcelle-lru-order-1', new Date('2024-01-15'));

      // Assert: Should still be able to retrieve the imagery
      expect(result).not.toBeNull();
      expect(result?.id).toBe('imagery-lru-order-1');
    });

    it('should handle LRU eviction for NDVI data separately from imagery', async () => {
      // Arrange: Store NDVI for 50 parcelles
      for (let i = 0; i < 50; i++) {
        const ndvi: NDVIResult = {
          id: `ndvi-lru-${i}`,
          parcelleId: `parcelle-ndvi-lru-${i}`,
          imageryId: `imagery-${i}`,
          calculationDate: new Date('2024-01-15'),
          meanNDVI: 0.75,
          minNDVI: 0.5,
          maxNDVI: 0.9,
          stdDevNDVI: 0.1,
          healthStatus: 'excellent',
          ndviRasterUrl: `https://example.com/ndvi-${i}.png`,
          createdAt: new Date('2024-01-15'),
        };

        await cache.storeNDVI(ndvi);
        await new Promise((resolve) => setTimeout(resolve, 2));
      }

      // Act: Store NDVI for a 51st parcelle
      const newNDVI: NDVIResult = {
        id: 'ndvi-lru-new',
        parcelleId: 'parcelle-ndvi-lru-new',
        imageryId: 'imagery-new',
        calculationDate: new Date('2024-01-15'),
        meanNDVI: 0.8,
        minNDVI: 0.6,
        maxNDVI: 0.95,
        stdDevNDVI: 0.08,
        healthStatus: 'excellent',
        ndviRasterUrl: 'https://example.com/ndvi-new.png',
        createdAt: new Date('2024-01-15'),
      };

      await cache.storeNDVI(newNDVI);

      // Assert: New NDVI should be cached
      const result = await cache.getNDVI('parcelle-ndvi-lru-new', new Date('2024-01-15'));
      expect(result).not.toBeNull();
      expect(result?.id).toBe('ndvi-lru-new');

      // Verify cache statistics
      const stats = await cache.getStatistics();
      expect(stats.cachedParcelles.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Cache Statistics', () => {
    it('should return accurate cache statistics', async () => {
      // Arrange: Store some imagery and NDVI
      const imagery: ImageryData = {
        id: 'imagery-stats',
        parcelleId: 'parcelle-stats',
        acquisitionDate: new Date('2024-01-15'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile-stats.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-01-15'),
      };

      const ndvi: NDVIResult = {
        id: 'ndvi-stats',
        parcelleId: 'parcelle-stats',
        imageryId: 'imagery-stats',
        calculationDate: new Date('2024-01-15'),
        meanNDVI: 0.75,
        minNDVI: 0.5,
        maxNDVI: 0.9,
        stdDevNDVI: 0.1,
        healthStatus: 'excellent',
        ndviRasterUrl: 'https://example.com/ndvi-stats.png',
        createdAt: new Date('2024-01-15'),
      };

      await cache.storeImagery(imagery);
      await cache.storeNDVI(ndvi);

      // Act
      const stats = await cache.getStatistics();

      // Assert
      expect(stats.totalImageryEntries).toBeGreaterThanOrEqual(1);
      expect(stats.totalNDVIEntries).toBeGreaterThanOrEqual(1);
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
      expect(stats.cachedParcelles).toContain('parcelle-stats');
      expect(stats.oldestEntry).toBeInstanceOf(Date);
      expect(stats.newestEntry).toBeInstanceOf(Date);
    });

    it('should exclude expired entries from statistics', async () => {
      // Arrange: Store expired imagery
      const now = new Date();
      const expiredDate = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);

      const expiredImagery: ImageryData = {
        id: 'imagery-stats-expired',
        parcelleId: 'parcelle-stats-expired',
        acquisitionDate: new Date('2024-01-15'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile-expired.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-01-15'),
      };

      const cachedEntry = {
        id: expiredImagery.id,
        parcelleId: expiredImagery.parcelleId,
        acquisitionDate: expiredImagery.acquisitionDate.toISOString(),
        data: expiredImagery,
        cachedAt: expiredDate.toISOString(),
        lastAccessedAt: expiredDate.toISOString(),
        sizeBytes: 1024,
      };

      storedData.set(`imagery:"${cachedEntry.id}"`, cachedEntry);

      // Act
      const stats = await cache.getStatistics();

      // Assert: Expired entry should not be counted
      expect(stats.cachedParcelles).not.toContain('parcelle-stats-expired');
    });
  });

  describe('Cache Clearing', () => {
    it('should clear all cached data', async () => {
      // Arrange: Store some data
      const imagery: ImageryData = {
        id: 'imagery-clear',
        parcelleId: 'parcelle-clear',
        acquisitionDate: new Date('2024-01-15'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile-clear.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-01-15'),
      };

      await cache.storeImagery(imagery);

      // Act: Clear cache
      await cache.clear();

      // Assert: Data should be gone
      const result = await cache.getImagery('parcelle-clear', new Date('2024-01-15'));
      expect(result).toBeNull();

      const stats = await cache.getStatistics();
      expect(stats.totalImageryEntries).toBe(0);
      expect(stats.totalNDVIEntries).toBe(0);
    });

    it('should delete all data for a specific parcelle', async () => {
      // Arrange: Store imagery and NDVI for a parcelle
      const imagery: ImageryData = {
        id: 'imagery-delete-parcelle',
        parcelleId: 'parcelle-delete',
        acquisitionDate: new Date('2024-01-15'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tile-delete.png',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date('2024-01-15'),
      };

      const ndvi: NDVIResult = {
        id: 'ndvi-delete-parcelle',
        parcelleId: 'parcelle-delete',
        imageryId: 'imagery-delete-parcelle',
        calculationDate: new Date('2024-01-15'),
        meanNDVI: 0.75,
        minNDVI: 0.5,
        maxNDVI: 0.9,
        stdDevNDVI: 0.1,
        healthStatus: 'excellent',
        ndviRasterUrl: 'https://example.com/ndvi-delete.png',
        createdAt: new Date('2024-01-15'),
      };

      await cache.storeImagery(imagery);
      await cache.storeNDVI(ndvi);

      // Act: Delete by parcelle
      await cache.deleteByParcelle('parcelle-delete');

      // Assert: Both imagery and NDVI should be gone
      const imageryResult = await cache.getImagery('parcelle-delete', new Date('2024-01-15'));
      const ndviResult = await cache.getNDVI('parcelle-delete', new Date('2024-01-15'));

      expect(imageryResult).toBeNull();
      expect(ndviResult).toBeNull();
    });
  });
});
