/**
 * Tests for useCacheManagement Hook
 * 
 * Requirements: Task 6.1.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCacheManagement } from '@/hooks/satellite/useCacheManagement';
import { getCacheService } from '@/lib/satellite/services/cache.service';

// Mock the cache service
vi.mock('@/lib/satellite/services/cache.service');

const mockCacheService = {
  getCacheStats: vi.fn(),
  clearParcelleCache: vi.fn(),
  clearExpiredCache: vi.fn(),
  evictLRU: vi.fn(),
  getParcelleCache: vi.fn(),
};

(getCacheService as any).mockReturnValue(mockCacheService);

describe('useCacheManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cache Statistics', () => {
    it('should fetch cache stats on mount when autoFetch is true', async () => {
      const mockStats = {
        totalEntries: 10,
        totalSizeBytes: 1024000,
        uniqueParcelles: 5,
        entriesByType: {
          imagery: 5,
          ndvi: 3,
          bands: 2,
        },
        oldestEntry: new Date('2024-01-01'),
        newestEntry: new Date('2024-01-10'),
      };

      mockCacheService.getCacheStats.mockResolvedValue(mockStats);

      const { result } = renderHook(() =>
        useCacheManagement({ autoFetch: true })
      );

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats).toEqual(mockStats);
      expect(result.current.error).toBeNull();
      expect(mockCacheService.getCacheStats).toHaveBeenCalledTimes(1);
    });

    it('should not fetch cache stats on mount when autoFetch is false', () => {
      const { result } = renderHook(() =>
        useCacheManagement({ autoFetch: false })
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.stats).toBeNull();
      expect(mockCacheService.getCacheStats).not.toHaveBeenCalled();
    });

    it('should handle errors when fetching cache stats', async () => {
      const errorMessage = 'Failed to fetch cache stats';
      mockCacheService.getCacheStats.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() =>
        useCacheManagement({ autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.stats).toBeNull();
    });

    it('should calculate cache hit rate based on unique parcelles', async () => {
      const mockStats = {
        totalEntries: 10,
        totalSizeBytes: 1024000,
        uniqueParcelles: 25, // 50% of max (50)
        entriesByType: {
          imagery: 5,
          ndvi: 3,
          bands: 2,
        },
        oldestEntry: new Date('2024-01-01'),
        newestEntry: new Date('2024-01-10'),
      };

      mockCacheService.getCacheStats.mockResolvedValue(mockStats);

      const { result } = renderHook(() =>
        useCacheManagement({ autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.cacheHitRate).toBe(50);
    });
  });

  describe('Clear Operations', () => {
    it('should clear all cache entries', async () => {
      const mockStats = {
        totalEntries: 10,
        totalSizeBytes: 1024000,
        uniqueParcelles: 5,
        entriesByType: { imagery: 5, ndvi: 3, bands: 2 },
        oldestEntry: new Date(),
        newestEntry: new Date(),
      };

      mockCacheService.getCacheStats.mockResolvedValue(mockStats);
      mockCacheService.evictLRU.mockResolvedValue({
        evictedCount: 5,
        freedBytes: 1024000,
        evictedEntries: [],
      });

      // Mock window.confirm
      global.confirm = jest.fn(() => true);

      const { result } = renderHook(() =>
        useCacheManagement({ autoFetch: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const success = await result.current.clearAllCache();

      expect(success).toBe(true);
      expect(mockCacheService.evictLRU).toHaveBeenCalledWith(5);
      expect(mockCacheService.getCacheStats).toHaveBeenCalledTimes(2); // Initial + after clear
    });

    it('should not clear cache if user cancels confirmation', async () => {
      global.confirm = jest.fn(() => false);

      const { result } = renderHook(() =>
        useCacheManagement({ autoFetch: false })
      );

      const success = await result.current.clearAllCache();

      expect(success).toBeUndefined();
      expect(mockCacheService.evictLRU).not.toHaveBeenCalled();
    });

    it('should clear cache for specific parcelle', async () => {
      mockCacheService.clearParcelleCache.mockResolvedValue(3);
      mockCacheService.getCacheStats.mockResolvedValue({
        totalEntries: 7,
        totalSizeBytes: 700000,
        uniqueParcelles: 4,
        entriesByType: { imagery: 4, ndvi: 2, bands: 1 },
        oldestEntry: new Date(),
        newestEntry: new Date(),
      });

      global.confirm = jest.fn(() => true);

      const { result } = renderHook(() =>
        useCacheManagement({ autoFetch: false })
      );

      const success = await result.current.clearParcelleCache('parcelle-123');

      expect(success).toBe(true);
      expect(mockCacheService.clearParcelleCache).toHaveBeenCalledWith('parcelle-123');
      expect(mockCacheService.getCacheStats).toHaveBeenCalledTimes(1); // After clear
    });

    it('should clear expired cache entries', async () => {
      mockCacheService.clearExpiredCache.mockResolvedValue(2);
      mockCacheService.getCacheStats.mockResolvedValue({
        totalEntries: 8,
        totalSizeBytes: 800000,
        uniqueParcelles: 5,
        entriesByType: { imagery: 5, ndvi: 2, bands: 1 },
        oldestEntry: new Date(),
        newestEntry: new Date(),
      });

      const { result } = renderHook(() =>
        useCacheManagement({ autoFetch: false })
      );

      const count = await result.current.clearExpiredCache();

      expect(count).toBe(2);
      expect(mockCacheService.clearExpiredCache).toHaveBeenCalledTimes(1);
      expect(mockCacheService.getCacheStats).toHaveBeenCalledTimes(1); // After clear
    });
  });

  describe('Cache Status', () => {
    it('should get cache status for parcelle with fresh cache', async () => {
      const now = new Date();
      const recentAccess = new Date(now.getTime() - 1000 * 60 * 30); // 30 minutes ago

      mockCacheService.getParcelleCache.mockResolvedValue([
        {
          id: '1',
          parcelleId: 'parcelle-123',
          cacheKey: 'key-1',
          dataType: 'imagery',
          storageUrl: 'url-1',
          sizeBytes: 1024,
          lastAccessedAt: recentAccess,
          expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24), // 24 hours from now
          createdAt: recentAccess,
        },
      ]);

      const { result } = renderHook(() =>
        useCacheManagement({ autoFetch: false })
      );

      const status = await result.current.getCacheStatus('parcelle-123');

      expect(status).toBe('cached');
    });

    it('should get cache status for parcelle with stale cache', async () => {
      const now = new Date();
      const oldAccess = new Date(now.getTime() - 1000 * 60 * 60 * 25); // 25 hours ago

      mockCacheService.getParcelleCache.mockResolvedValue([
        {
          id: '1',
          parcelleId: 'parcelle-123',
          cacheKey: 'key-1',
          dataType: 'imagery',
          storageUrl: 'url-1',
          sizeBytes: 1024,
          lastAccessedAt: oldAccess,
          expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24), // 24 hours from now
          createdAt: oldAccess,
        },
      ]);

      const { result } = renderHook(() =>
        useCacheManagement({ autoFetch: false })
      );

      const status = await result.current.getCacheStatus('parcelle-123');

      expect(status).toBe('stale');
    });

    it('should get cache status for parcelle with no cache', async () => {
      mockCacheService.getParcelleCache.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useCacheManagement({ autoFetch: false })
      );

      const status = await result.current.getCacheStatus('parcelle-123');

      expect(status).toBe('not-cached');
    });

    it('should get parcelle cache info with correct totals', async () => {
      const now = new Date();
      const entries = [
        {
          id: '1',
          parcelleId: 'parcelle-123',
          cacheKey: 'key-1',
          dataType: 'imagery',
          storageUrl: 'url-1',
          sizeBytes: 1024,
          lastAccessedAt: new Date(now.getTime() - 1000 * 60 * 10),
          expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24),
          createdAt: now,
        },
        {
          id: '2',
          parcelleId: 'parcelle-123',
          cacheKey: 'key-2',
          dataType: 'ndvi',
          storageUrl: 'url-2',
          sizeBytes: 512,
          lastAccessedAt: new Date(now.getTime() - 1000 * 60 * 5),
          expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24),
          createdAt: now,
        },
      ];

      mockCacheService.getParcelleCache.mockResolvedValue(entries);

      const { result } = renderHook(() =>
        useCacheManagement({ autoFetch: false })
      );

      const info = await result.current.getParcelleCacheInfo('parcelle-123');

      expect(info.parcelleId).toBe('parcelle-123');
      expect(info.entries).toHaveLength(2);
      expect(info.totalSize).toBe(1536); // 1024 + 512
      expect(info.status).toBe('cached');
    });
  });

  describe('Refresh Interval', () => {
    it('should refresh stats at specified interval', async () => {
      vi.useFakeTimers();

      const mockStats = {
        totalEntries: 10,
        totalSizeBytes: 1024000,
        uniqueParcelles: 5,
        entriesByType: { imagery: 5, ndvi: 3, bands: 2 },
        oldestEntry: new Date(),
        newestEntry: new Date(),
      };

      mockCacheService.getCacheStats.mockResolvedValue(mockStats);

      renderHook(() =>
        useCacheManagement({
          autoFetch: true,
          refreshInterval: 5000, // 5 seconds
        })
      );

      await waitFor(() => {
        expect(mockCacheService.getCacheStats).toHaveBeenCalledTimes(1);
      });

      // Fast-forward 5 seconds
      vi.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(mockCacheService.getCacheStats).toHaveBeenCalledTimes(2);
      });

      // Fast-forward another 5 seconds
      vi.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(mockCacheService.getCacheStats).toHaveBeenCalledTimes(3);
      });

      vi.useRealTimers();
    });
  });
});
