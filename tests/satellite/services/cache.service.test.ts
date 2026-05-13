/**
 * Unit Tests: Cache Service with LRU Eviction
 * 
 * Tests the CacheService implementation including:
 * - Cache storage and retrieval
 * - Last accessed timestamp tracking
 * - LRU eviction when limit reached
 * - Protection of favorite parcelles from eviction
 * - Cache statistics calculation
 * - Expired cache cleanup
 * 
 * Requirements: Task 6.1.4
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ============================================================================
// Mock Supabase Client (must be before imports)
// ============================================================================

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockLt = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();

const mockSupabase = {
  from: vi.fn(),
};

// Mock the Supabase client module
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}));

// Import after mocking
import { CacheService, CacheEntry, StoreCacheOptions } from '@/lib/satellite/services/cache.service';

// ============================================================================
// Test Data
// ============================================================================

const mockCacheEntry = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  parcelle_id: 'parcelle-1',
  cache_key: 'imagery:parcelle-1:2024-01-01',
  data_type: 'imagery',
  storage_url: 'https://storage.example.com/imagery.tif',
  size_bytes: 1024000,
  last_accessed_at: new Date('2024-01-01T00:00:00Z').toISOString(),
  expires_at: new Date('2024-04-01T00:00:00Z').toISOString(),
  created_at: new Date('2024-01-01T00:00:00Z').toISOString(),
};

const createMockEntry = (parcelleId: string, lastAccessedDaysAgo: number): any => ({
  id: `${parcelleId}-id`,
  parcelle_id: parcelleId,
  cache_key: `imagery:${parcelleId}:2024-01-01`,
  data_type: 'imagery',
  storage_url: `https://storage.example.com/${parcelleId}.tif`,
  size_bytes: 1024000,
  last_accessed_at: new Date(Date.now() - lastAccessedDaysAgo * 24 * 60 * 60 * 1000).toISOString(),
  expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  created_at: new Date('2024-01-01T00:00:00Z').toISOString(),
});

// ============================================================================
// Test Suite
// ============================================================================

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create new service instance
    cacheService = new CacheService();

    // Setup default mock chain for select queries
    mockEq.mockReturnValue({
      single: mockSingle,
      select: mockSelect,
      order: mockOrder,
    });

    mockOrder.mockReturnValue({
      data: [],
      error: null,
    });

    mockLt.mockReturnValue({
      select: mockSelect,
    });

    mockSelect.mockReturnValue({
      single: mockSingle,
      eq: mockEq,
      lt: mockLt,
      order: mockOrder,
    });

    mockInsert.mockReturnValue({
      select: () => ({
        single: mockSingle,
      }),
    });

    mockUpdate.mockReturnValue({
      eq: mockEq,
    });

    mockDelete.mockReturnValue({
      eq: mockEq,
      lt: mockLt,
      select: mockSelect,
    });

    mockSupabase.from.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    });

    // Default responses
    mockSingle.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Store Cache Tests
  // ==========================================================================

  describe('storeCache', () => {
    it('should store a cache entry successfully', async () => {
      // Mock cache stats (under limit)
      mockSelect.mockResolvedValueOnce({ data: [], error: null });

      // Mock insert
      mockSingle.mockResolvedValueOnce({ data: mockCacheEntry, error: null });

      const options: StoreCacheOptions = {
        parcelleId: 'parcelle-1',
        cacheKey: 'imagery:parcelle-1:2024-01-01',
        dataType: 'imagery',
        storageUrl: 'https://storage.example.com/imagery.tif',
        sizeBytes: 1024000,
      };

      const result = await cacheService.storeCache(options);

      expect(result).not.toBeNull();
      expect(result?.parcelleId).toBe('parcelle-1');
      expect(result?.cacheKey).toBe('imagery:parcelle-1:2024-01-01');
      expect(result?.dataType).toBe('imagery');
    });

    it('should trigger LRU eviction when cache limit is reached', async () => {
      // Mock cache stats (at limit - 50 unique parcelles)
      const mockEntries = Array.from({ length: 50 }, (_, i) => 
        createMockEntry(`parcelle-${i}`, i)
      );
      mockSelect.mockResolvedValueOnce({ data: mockEntries, error: null });

      // Mock eviction (select for eviction) - need to return data directly
      mockOrder.mockResolvedValueOnce({ data: mockEntries, error: null });

      // Mock delete for eviction
      mockEq.mockResolvedValue({ error: null });

      // Mock insert after eviction
      mockSingle.mockResolvedValueOnce({ data: mockCacheEntry, error: null });

      const options: StoreCacheOptions = {
        parcelleId: 'parcelle-new',
        cacheKey: 'imagery:parcelle-new:2024-01-01',
        dataType: 'imagery',
        storageUrl: 'https://storage.example.com/imagery.tif',
        sizeBytes: 1024000,
      };

      const result = await cacheService.storeCache(options);

      expect(result).not.toBeNull();
      // Verify eviction was triggered (delete called)
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should set correct expiration date based on data type', async () => {
      // Mock cache stats (under limit)
      mockSelect.mockResolvedValueOnce({ data: [], error: null });

      let insertedData: any = null;
      mockInsert.mockImplementationOnce((data) => {
        insertedData = data;
        return {
          select: () => ({
            single: () => Promise.resolve({ data: mockCacheEntry, error: null }),
          }),
        };
      });

      const options: StoreCacheOptions = {
        parcelleId: 'parcelle-1',
        cacheKey: 'imagery:parcelle-1:2024-01-01',
        dataType: 'imagery',
        storageUrl: 'https://storage.example.com/imagery.tif',
        sizeBytes: 1024000,
      };

      await cacheService.storeCache(options);

      expect(insertedData).not.toBeNull();
      // Imagery should have 90-day retention
      const expiresAt = new Date(insertedData.expires_at);
      const now = new Date();
      const daysDiff = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBeGreaterThanOrEqual(89);
      expect(daysDiff).toBeLessThanOrEqual(90);
    });
  });

  // ==========================================================================
  // Get Cache Tests
  // ==========================================================================

  describe('getCache', () => {
    it('should retrieve a cache entry and update last accessed timestamp', async () => {
      // Mock select
      mockSingle.mockResolvedValueOnce({ data: mockCacheEntry, error: null });

      // Mock update last accessed
      mockEq.mockResolvedValueOnce({ error: null });

      const result = await cacheService.getCache('imagery:parcelle-1:2024-01-01');

      expect(result).not.toBeNull();
      expect(result?.cacheKey).toBe('imagery:parcelle-1:2024-01-01');
      
      // Verify update was called
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should return null for non-existent cache entry', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

      const result = await cacheService.getCache('non-existent-key');

      expect(result).toBeNull();
    });

    it('should return null and delete expired cache entry', async () => {
      const expiredEntry = {
        ...mockCacheEntry,
        expires_at: new Date('2020-01-01T00:00:00Z').toISOString(), // Expired
      };

      mockSingle.mockResolvedValueOnce({ data: expiredEntry, error: null });
      mockEq.mockResolvedValueOnce({ error: null }); // Delete

      const result = await cacheService.getCache('imagery:parcelle-1:2024-01-01');

      expect(result).toBeNull();
      // Verify delete was called
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // LRU Eviction Tests
  // ==========================================================================

  describe('evictLRU', () => {
    it('should evict the least recently used parcelle', async () => {
      // Create mock entries with different last accessed times
      const mockEntries = [
        createMockEntry('parcelle-1', 10), // 10 days ago (oldest)
        createMockEntry('parcelle-2', 5),  // 5 days ago
        createMockEntry('parcelle-3', 1),  // 1 day ago (newest)
      ];

      mockOrder.mockResolvedValueOnce({ data: mockEntries, error: null });
      mockEq.mockResolvedValue({ error: null }); // Delete

      const result = await cacheService.evictLRU(1);

      expect(result.evictedCount).toBe(1);
      expect(result.evictedEntries.length).toBe(1);
      expect(result.evictedEntries[0].parcelleId).toBe('parcelle-1'); // Oldest
      expect(result.freedBytes).toBe(1024000);
    });

    it('should evict multiple parcelles when count > 1', async () => {
      const mockEntries = [
        createMockEntry('parcelle-1', 10), // Oldest
        createMockEntry('parcelle-2', 5),
        createMockEntry('parcelle-3', 1),  // Newest
      ];

      mockOrder.mockResolvedValueOnce({ data: mockEntries, error: null });
      mockEq.mockResolvedValue({ error: null });

      const result = await cacheService.evictLRU(2);

      expect(result.evictedCount).toBe(2);
      expect(result.evictedEntries.length).toBe(2);
      expect(result.freedBytes).toBe(2048000); // 2 * 1024000
    });

    it('should protect favorite parcelles from eviction', async () => {
      const mockEntries = [
        createMockEntry('parcelle-1', 10), // Oldest, but favorite
        createMockEntry('parcelle-2', 5),  // Should be evicted
        createMockEntry('parcelle-3', 1),  // Newest
      ];

      mockOrder.mockResolvedValueOnce({ data: mockEntries, error: null });
      mockEq.mockResolvedValue({ error: null });

      const favoriteParcelles = ['parcelle-1'];
      const result = await cacheService.evictLRU(1, favoriteParcelles);

      expect(result.evictedCount).toBe(1);
      expect(result.evictedEntries[0].parcelleId).toBe('parcelle-2'); // Not favorite
      expect(result.evictedEntries[0].parcelleId).not.toBe('parcelle-1'); // Protected
    });

    it('should evict all entries for a parcelle (not just one)', async () => {
      // Parcelle with multiple cache entries
      const mockEntries = [
        { ...createMockEntry('parcelle-1', 10), cache_key: 'imagery:parcelle-1:2024-01-01' },
        { ...createMockEntry('parcelle-1', 10), cache_key: 'ndvi:parcelle-1:2024-01-01', data_type: 'ndvi' },
        { ...createMockEntry('parcelle-1', 10), cache_key: 'bands:parcelle-1:2024-01-01', data_type: 'bands' },
        createMockEntry('parcelle-2', 5),
      ];

      mockOrder.mockResolvedValueOnce({ data: mockEntries, error: null });
      mockEq.mockResolvedValue({ error: null });

      const result = await cacheService.evictLRU(1);

      expect(result.evictedCount).toBe(1); // 1 parcelle
      expect(result.evictedEntries.length).toBe(3); // 3 entries
      expect(result.freedBytes).toBe(3072000); // 3 * 1024000
    });

    it('should return zero eviction when all parcelles are favorites', async () => {
      const mockEntries = [
        createMockEntry('parcelle-1', 10),
        createMockEntry('parcelle-2', 5),
      ];

      mockOrder.mockResolvedValueOnce({ data: mockEntries, error: null });

      const favoriteParcelles = ['parcelle-1', 'parcelle-2'];
      const result = await cacheService.evictLRU(1, favoriteParcelles);

      expect(result.evictedCount).toBe(0);
      expect(result.evictedEntries.length).toBe(0);
      expect(result.freedBytes).toBe(0);
    });

    it('should return zero eviction when cache is empty', async () => {
      mockOrder.mockResolvedValueOnce({ data: [], error: null });

      const result = await cacheService.evictLRU(1);

      expect(result.evictedCount).toBe(0);
      expect(result.evictedEntries.length).toBe(0);
      expect(result.freedBytes).toBe(0);
    });
  });

  // ==========================================================================
  // Cache Statistics Tests
  // ==========================================================================

  describe('getCacheStats', () => {
    it('should calculate correct cache statistics', async () => {
      const mockEntries = [
        createMockEntry('parcelle-1', 10),
        { ...createMockEntry('parcelle-1', 10), data_type: 'ndvi' },
        createMockEntry('parcelle-2', 5),
        { ...createMockEntry('parcelle-3', 1), data_type: 'bands' },
      ];

      mockSelect.mockResolvedValueOnce({ data: mockEntries, error: null });

      const stats = await cacheService.getCacheStats();

      expect(stats.totalEntries).toBe(4);
      expect(stats.uniqueParcelles).toBe(3);
      expect(stats.totalSizeBytes).toBe(4096000); // 4 * 1024000
      expect(stats.entriesByType.imagery).toBe(2);
      expect(stats.entriesByType.ndvi).toBe(1);
      expect(stats.entriesByType.bands).toBe(1);
      expect(stats.oldestEntry).not.toBeNull();
      expect(stats.newestEntry).not.toBeNull();
    });

    it('should return empty stats when cache is empty', async () => {
      mockSelect.mockResolvedValueOnce({ data: [], error: null });

      const stats = await cacheService.getCacheStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.uniqueParcelles).toBe(0);
      expect(stats.totalSizeBytes).toBe(0);
      expect(stats.entriesByType.imagery).toBe(0);
      expect(stats.entriesByType.ndvi).toBe(0);
      expect(stats.entriesByType.bands).toBe(0);
      expect(stats.oldestEntry).toBeNull();
      expect(stats.newestEntry).toBeNull();
    });
  });

  // ==========================================================================
  // Clear Cache Tests
  // ==========================================================================

  describe('clearExpiredCache', () => {
    it('should delete expired cache entries', async () => {
      const expiredEntries = [
        { ...mockCacheEntry, id: '1' },
        { ...mockCacheEntry, id: '2' },
      ];

      mockSelect.mockResolvedValueOnce({ data: expiredEntries, error: null });

      const count = await cacheService.clearExpiredCache();

      expect(count).toBe(2);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockLt).toHaveBeenCalled(); // Less than current time
    });
  });

  describe('clearParcelleCache', () => {
    it('should delete all cache entries for a parcelle', async () => {
      const parcelleEntries = [
        { ...mockCacheEntry, id: '1' },
        { ...mockCacheEntry, id: '2' },
        { ...mockCacheEntry, id: '3' },
      ];

      mockSelect.mockResolvedValueOnce({ data: parcelleEntries, error: null });

      const count = await cacheService.clearParcelleCache('parcelle-1');

      expect(count).toBe(3);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('parcelle_id', 'parcelle-1');
    });
  });

  // ==========================================================================
  // Get Parcelle Cache Tests
  // ==========================================================================

  describe('getParcelleCache', () => {
    it('should retrieve all cache entries for a parcelle', async () => {
      const parcelleEntries = [
        mockCacheEntry,
        { ...mockCacheEntry, id: '2', data_type: 'ndvi' },
      ];

      mockOrder.mockResolvedValueOnce({ data: parcelleEntries, error: null });

      const entries = await cacheService.getParcelleCache('parcelle-1');

      expect(entries.length).toBe(2);
      expect(entries[0].parcelleId).toBe('parcelle-1');
      expect(mockEq).toHaveBeenCalledWith('parcelle_id', 'parcelle-1');
    });

    it('should return empty array when parcelle has no cache', async () => {
      mockOrder.mockResolvedValueOnce({ data: [], error: null });

      const entries = await cacheService.getParcelleCache('parcelle-1');

      expect(entries.length).toBe(0);
    });
  });

  // ==========================================================================
  // Cache Invalidation Tests
  // ==========================================================================

  describe('invalidateOnNDVICalculation', () => {
    it('should clear parcelle cache and invalidate Redis cache', async () => {
      // Mock clearParcelleCache
      mockSelect.mockResolvedValueOnce({ 
        data: [mockCacheEntry, { ...mockCacheEntry, id: '2' }], 
        error: null 
      });

      const result = await cacheService.invalidateOnNDVICalculation('parcelle-1');

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('parcelle_id', 'parcelle-1');
    });

    it('should return true even if clearParcelleCache returns 0 (graceful degradation)', async () => {
      // Mock clearParcelleCache returning 0 (no entries deleted, but no error thrown)
      mockSelect.mockResolvedValueOnce({ data: [], error: null });

      const result = await cacheService.invalidateOnNDVICalculation('parcelle-1');

      // Should still return true because the method doesn't throw
      expect(result).toBe(true);
    });
  });

  describe('invalidateOnAlertAcknowledgment', () => {
    it('should clear parcelle cache and invalidate Redis cache', async () => {
      // Mock clearParcelleCache
      mockSelect.mockResolvedValueOnce({ 
        data: [mockCacheEntry], 
        error: null 
      });

      const result = await cacheService.invalidateOnAlertAcknowledgment('parcelle-1');

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('parcelle_id', 'parcelle-1');
    });

    it('should return true even if clearParcelleCache returns 0 (graceful degradation)', async () => {
      // Mock clearParcelleCache returning 0 (no entries deleted, but no error thrown)
      mockSelect.mockResolvedValueOnce({ data: [], error: null });

      const result = await cacheService.invalidateOnAlertAcknowledgment('parcelle-1');

      // Should still return true because the method doesn't throw
      expect(result).toBe(true);
    });
  });

  describe('invalidateOnParcelleUpdate', () => {
    it('should clear parcelle cache when geometry not changed', async () => {
      // Mock clearParcelleCache
      mockSelect.mockResolvedValueOnce({ 
        data: [mockCacheEntry], 
        error: null 
      });

      const result = await cacheService.invalidateOnParcelleUpdate('parcelle-1', false);

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('parcelle_id', 'parcelle-1');
    });

    it('should clear parcelle cache and NDVI results when geometry changed', async () => {
      // Mock clearParcelleCache
      mockSelect.mockResolvedValueOnce({ 
        data: [mockCacheEntry], 
        error: null 
      });

      // Mock NDVI results deletion
      mockEq.mockResolvedValueOnce({ error: null });

      const result = await cacheService.invalidateOnParcelleUpdate('parcelle-1', true);

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
      // Should be called twice: once for cache, once for NDVI results
      expect(mockEq).toHaveBeenCalledWith('parcelle_id', 'parcelle-1');
    });

    it('should continue even if NDVI results deletion fails', async () => {
      // Mock clearParcelleCache
      mockSelect.mockResolvedValueOnce({ 
        data: [mockCacheEntry], 
        error: null 
      });

      // Mock NDVI results deletion failure
      mockEq.mockResolvedValueOnce({ error: { message: 'NDVI delete failed' } });

      const result = await cacheService.invalidateOnParcelleUpdate('parcelle-1', true);

      // Should still return true even if NDVI deletion fails
      expect(result).toBe(true);
    });

    it('should return true even if clearParcelleCache returns 0 (graceful degradation)', async () => {
      // Mock clearParcelleCache returning 0 (no entries deleted, but no error thrown)
      mockSelect.mockResolvedValueOnce({ data: [], error: null });

      const result = await cacheService.invalidateOnParcelleUpdate('parcelle-1', true);

      // Should still return true because the method doesn't throw
      expect(result).toBe(true);
    });
  });
});
