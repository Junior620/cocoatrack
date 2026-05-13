/**
 * Cache Warming Service Tests
 * 
 * Tests for the cache warming background job service.
 * 
 * Requirements: Task 6.2.4
 * - Test favorite parcelle identification
 * - Test cache warming operations
 * - Test concurrency control
 * - Test error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MultiPolygon } from 'geojson';

// Mock Supabase client - must be defined before mocks
const mockFrom = vi.fn();
const mockSupabase = {
  from: mockFrom,
};

// Mock services
vi.mock('@/lib/satellite/services/imagery.service', () => ({
  imageryService: {
    getImagery: vi.fn(),
  },
}));

vi.mock('@/lib/satellite/services/ndvi.service', () => ({
  ndviService: {
    calculateNDVI: vi.fn(),
  },
}));

vi.mock('@/lib/satellite/services/redis-cache.service', () => ({
  redisCacheService: {
    set: vi.fn(),
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// Import after mocks are set up
const { CacheWarmingService } = await import('@/lib/satellite/services/cache-warming.service');

describe('CacheWarmingService', () => {
  let service: CacheWarmingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CacheWarmingService();
  });

  describe('runCacheWarmingJob', () => {
    it('should return empty result when no favorite parcelles found', async () => {
      // Mock empty cache metadata
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const result = await service.runCacheWarmingJob();

      expect(result.totalParcelles).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.results).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      // Mock error in cache metadata query
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Database error'),
            }),
          }),
        }),
      });

      const result = await service.runCacheWarmingJob();

      expect(result.totalParcelles).toBe(0);
      expect(result.successCount).toBe(0);
    });
  });

  describe('Cache Warming Operations', () => {
    it('should cache recent imagery successfully', async () => {
      const { imageryService } = await import('@/lib/satellite/services/imagery.service');
      vi.mocked(imageryService.getImagery).mockResolvedValue({
        id: 'imagery-1',
        parcelleId: 'parcelle-1',
        acquisitionDate: new Date(),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tiles',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date(),
      });

      const parcelle = {
        id: 'parcelle-1',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]],
        } as MultiPolygon,
        lastAccessedAt: new Date(),
      };

      const result = await (service as any).cacheRecentImagery(parcelle);

      expect(result).toBe(true);
      expect(imageryService.getImagery).toHaveBeenCalledWith(
        'parcelle-1',
        parcelle.geometry,
        expect.any(Date),
        20
      );
    });

    it('should cache recent NDVI successfully', async () => {
      const { ndviService } = await import('@/lib/satellite/services/ndvi.service');
      vi.mocked(ndviService.calculateNDVI).mockResolvedValue({
        id: 'ndvi-1',
        parcelleId: 'parcelle-1',
        imageryId: null,
        calculationDate: new Date(),
        meanNDVI: 0.65,
        minNDVI: 0.4,
        maxNDVI: 0.8,
        stdDevNDVI: 0.1,
        healthStatus: 'good',
        ndviRasterUrl: null,
        createdAt: new Date(),
      });

      const parcelle = {
        id: 'parcelle-1',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]],
        } as MultiPolygon,
        lastAccessedAt: new Date(),
      };

      const result = await (service as any).cacheRecentNDVI(parcelle);

      expect(result).toBe(true);
      expect(ndviService.calculateNDVI).toHaveBeenCalledWith(
        'parcelle-1',
        parcelle.geometry,
        expect.any(Date),
        {
          forceRecalculate: false,
          storeResult: true,
          generateRaster: false,
        }
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle imagery caching errors', async () => {
      const { imageryService } = await import('@/lib/satellite/services/imagery.service');
      vi.mocked(imageryService.getImagery).mockRejectedValue(new Error('Imagery unavailable'));

      const parcelle = {
        id: 'parcelle-1',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]],
        } as MultiPolygon,
        lastAccessedAt: new Date(),
      };

      const result = await (service as any).cacheRecentImagery(parcelle);

      expect(result).toBe(false);
    });

    it('should handle NDVI calculation errors', async () => {
      const { ndviService } = await import('@/lib/satellite/services/ndvi.service');
      vi.mocked(ndviService.calculateNDVI).mockRejectedValue(new Error('NDVI calculation failed'));

      const parcelle = {
        id: 'parcelle-1',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]],
        } as MultiPolygon,
        lastAccessedAt: new Date(),
      };

      const result = await (service as any).cacheRecentNDVI(parcelle);

      expect(result).toBe(false);
    });
  });
});
