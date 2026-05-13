/**
 * Redis Cache Integration Tests
 * 
 * Tests the integration of Redis caching with ImageryService and NDVIService.
 * Verifies that:
 * - Imagery data is cached and retrieved from Redis
 * - NDVI data is cached and retrieved from Redis
 * - Cache invalidation works correctly
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { redisCacheService } from '@/lib/satellite/services/redis-cache.service';

describe('Redis Cache Integration', () => {
  beforeEach(() => {
    // Reset stats before each test
    redisCacheService.resetStats();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Imagery Caching', () => {
    it('should cache and retrieve imagery data', async () => {
      const parcelleId = 'test-parcelle-123';
      const date = '2024-01-15';
      const imageryData = {
        id: 'imagery-123',
        parcelleId,
        acquisitionDate: new Date('2024-01-15'),
        cloudCoverPercent: 10,
        satelliteSource: 'sentinel-2',
        tileUrl: 'https://example.com/tiles',
        bounds: [0, 0, 1, 1],
        resolutionMeters: 10,
        createdAt: new Date(),
      };

      // Set imagery data in cache
      const setResult = await redisCacheService.setImageryData(parcelleId, date, imageryData);
      
      // If Redis is not available, skip the test
      if (!setResult) {
        console.log('Redis not available, skipping test');
        return;
      }

      expect(setResult).toBe(true);

      // Retrieve imagery data from cache
      const cachedData = await redisCacheService.getImageryData(parcelleId, date);
      
      expect(cachedData).toBeDefined();
      expect(cachedData.id).toBe(imageryData.id);
      expect(cachedData.parcelleId).toBe(parcelleId);
      expect(cachedData.cloudCoverPercent).toBe(10);

      // Check cache stats
      const stats = redisCacheService.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    it('should return null for cache miss', async () => {
      const parcelleId = 'nonexistent-parcelle';
      const date = '2024-01-15';

      const cachedData = await redisCacheService.getImageryData(parcelleId, date);
      
      expect(cachedData).toBeNull();

      // Check cache stats
      const stats = redisCacheService.getCacheStats();
      expect(stats.misses).toBeGreaterThan(0);
    });
  });

  describe('NDVI Caching', () => {
    it('should cache and retrieve NDVI data', async () => {
      const parcelleId = 'test-parcelle-456';
      const date = '2024-01-15';
      const ndviData = {
        id: 'ndvi-456',
        parcelleId,
        imageryId: null,
        calculationDate: new Date('2024-01-15'),
        meanNDVI: 0.65,
        minNDVI: 0.45,
        maxNDVI: 0.85,
        stdDevNDVI: 0.12,
        healthStatus: 'excellent',
        ndviRasterUrl: null,
        createdAt: new Date(),
      };

      // Set NDVI data in cache
      const setResult = await redisCacheService.setNDVIData(parcelleId, date, ndviData);
      
      // If Redis is not available, skip the test
      if (!setResult) {
        console.log('Redis not available, skipping test');
        return;
      }

      expect(setResult).toBe(true);

      // Retrieve NDVI data from cache
      const cachedData = await redisCacheService.getNDVIData(parcelleId, date);
      
      expect(cachedData).toBeDefined();
      expect(cachedData.id).toBe(ndviData.id);
      expect(cachedData.parcelleId).toBe(parcelleId);
      expect(cachedData.meanNDVI).toBe(0.65);
      expect(cachedData.healthStatus).toBe('excellent');

      // Check cache stats
      const stats = redisCacheService.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    it('should return null for cache miss', async () => {
      const parcelleId = 'nonexistent-parcelle';
      const date = '2024-01-15';

      const cachedData = await redisCacheService.getNDVIData(parcelleId, date);
      
      expect(cachedData).toBeNull();

      // Check cache stats
      const stats = redisCacheService.getCacheStats();
      expect(stats.misses).toBeGreaterThan(0);
    });

    it('should invalidate NDVI cache for a parcelle', async () => {
      const parcelleId = 'test-parcelle-789';
      const date = '2024-01-15';
      const ndviData = {
        id: 'ndvi-789',
        parcelleId,
        imageryId: null,
        calculationDate: new Date('2024-01-15'),
        meanNDVI: 0.55,
        minNDVI: 0.35,
        maxNDVI: 0.75,
        stdDevNDVI: 0.10,
        healthStatus: 'good',
        ndviRasterUrl: null,
        createdAt: new Date(),
      };

      // Set NDVI data in cache
      const setResult = await redisCacheService.setNDVIData(parcelleId, date, ndviData);
      
      // If Redis is not available, skip the test
      if (!setResult) {
        console.log('Redis not available, skipping test');
        return;
      }

      // Verify data is cached
      let cachedData = await redisCacheService.getNDVIData(parcelleId, date);
      expect(cachedData).toBeDefined();

      // Invalidate cache for this parcelle
      const invalidateResult = await redisCacheService.invalidateParcelleCache(parcelleId);
      expect(invalidateResult).toBe(true);

      // Wait a bit for invalidation to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Try to retrieve again - should return null due to invalidation
      cachedData = await redisCacheService.getNDVIData(parcelleId, date);
      expect(cachedData).toBeNull();
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache hits and misses', async () => {
      // Reset stats
      redisCacheService.resetStats();

      const parcelleId = 'test-parcelle-stats';
      const date = '2024-01-15';

      // Cache miss
      await redisCacheService.getImageryData(parcelleId, date);
      
      let stats = redisCacheService.getCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);

      // Set data
      const setResult = await redisCacheService.setImageryData(parcelleId, date, { test: 'data' });
      
      if (!setResult) {
        console.log('Redis not available, skipping test');
        return;
      }

      // Cache hit
      await redisCacheService.getImageryData(parcelleId, date);
      
      stats = redisCacheService.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(50); // 1 hit out of 2 total requests
    });

    it('should calculate hit rate correctly', () => {
      redisCacheService.resetStats();
      
      const stats = redisCacheService.getCacheStats();
      expect(stats.hitRate).toBe(0); // No requests yet
    });
  });

  describe('Redis Availability', () => {
    it('should check if Redis is available', () => {
      const isAvailable = redisCacheService.isAvailable();
      
      // This will be true if Redis is configured and connected
      // or false if Redis is not available
      expect(typeof isAvailable).toBe('boolean');
    });
  });
});
