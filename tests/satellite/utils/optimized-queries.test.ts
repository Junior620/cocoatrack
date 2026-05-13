/**
 * Tests for optimized database queries
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import {
  getLatestNDVI,
  getNDVITrend,
  getParcellesByHealthStatus,
  getPendingDeforestationAlerts,
  getTemporalNDVIMonthly,
  getCachedQueryResult,
  setCachedQueryResult,
  invalidateQueryCache,
  executeWithCache,
  getLatestNDVIBatch,
  getParcelleHealthSummaryBatch,
} from '@/lib/satellite/utils/optimized-queries';

// Test configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('Optimized Queries', () => {
  let supabase: ReturnType<typeof createClient>;
  let testParcelleId: string;
  let testCooperativeId: string;

  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseKey);

    // Create test parcelle
    const { data: parcelleData } = await supabase
      .from('parcelles')
      .insert({
        nom: 'Test Parcelle for Optimized Queries',
        surface_hectares: 5.0,
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [10.0, 5.0],
              [10.1, 5.0],
              [10.1, 5.1],
              [10.0, 5.1],
              [10.0, 5.0],
            ],
          ],
        },
      })
      .select()
      .single();

    testParcelleId = parcelleData!.id;
    testCooperativeId = parcelleData!.cooperative_id;

    // Insert test NDVI data
    const ndviData = [
      {
        parcelle_id: testParcelleId,
        calculation_date: new Date('2024-01-01').toISOString(),
        mean_ndvi: 0.65,
        min_ndvi: 0.5,
        max_ndvi: 0.8,
        std_dev_ndvi: 0.1,
        health_status: 'good',
      },
      {
        parcelle_id: testParcelleId,
        calculation_date: new Date('2024-02-01').toISOString(),
        mean_ndvi: 0.55,
        min_ndvi: 0.4,
        max_ndvi: 0.7,
        std_dev_ndvi: 0.12,
        health_status: 'fair',
      },
      {
        parcelle_id: testParcelleId,
        calculation_date: new Date('2024-03-01').toISOString(),
        mean_ndvi: 0.45,
        min_ndvi: 0.3,
        max_ndvi: 0.6,
        std_dev_ndvi: 0.15,
        health_status: 'poor',
      },
    ];

    await supabase.from('ndvi_results').insert(ndviData);

    // Insert test deforestation event
    await supabase.from('deforestation_events').insert({
      parcelle_id: testParcelleId,
      baseline_date: new Date('2020-12-31').toISOString(),
      detection_date: new Date('2024-03-15').toISOString(),
      baseline_ndvi: 0.75,
      current_ndvi: 0.35,
      ndvi_change: -0.4,
      affected_area_hectares: 1.5,
      affected_area_percent: 30.0,
      status: 'pending',
    });

    // Wait for materialized views to refresh
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Clean up test data
    await supabase.from('parcelles').delete().eq('id', testParcelleId);
  });

  describe('getLatestNDVI', () => {
    it('should retrieve the latest NDVI result for a parcelle', async () => {
      const result = await getLatestNDVI(testParcelleId, supabase);

      expect(result).toBeDefined();
      expect(result?.mean_ndvi).toBe(0.45);
      expect(result?.health_status).toBe('poor');
      expect(result?.calculation_date).toContain('2024-03-01');
    });

    it('should return null for non-existent parcelle', async () => {
      const result = await getLatestNDVI(
        '00000000-0000-0000-0000-000000000000',
        supabase
      );

      expect(result).toBeNull();
    });
  });

  describe('getNDVITrend', () => {
    it('should retrieve NDVI trend with change calculations', async () => {
      const result = await getNDVITrend(
        testParcelleId,
        {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-03-31'),
        },
        supabase
      );

      expect(result).toHaveLength(3);
      expect(result[0].mean_ndvi).toBe(0.65);
      expect(result[0].change_from_previous).toBeNull(); // First point has no previous
      expect(result[1].mean_ndvi).toBe(0.55);
      expect(result[1].change_from_previous).toBe(-0.1);
      expect(result[2].mean_ndvi).toBe(0.45);
      expect(result[2].change_from_previous).toBe(-0.1);
    });

    it('should return empty array for parcelle with no NDVI data', async () => {
      const result = await getNDVITrend(
        '00000000-0000-0000-0000-000000000000',
        {},
        supabase
      );

      expect(result).toEqual([]);
    });
  });

  describe('getParcellesByHealthStatus', () => {
    it('should retrieve parcelles filtered by health status', async () => {
      const result = await getParcellesByHealthStatus(
        'poor',
        { limit: 10, offset: 0 },
        supabase
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // Find our test parcelle
      const testParcelle = result.find((p) => p.parcelle_id === testParcelleId);
      expect(testParcelle).toBeDefined();
      expect(testParcelle?.latest_health_status).toBe('poor');
      expect(testParcelle?.latest_mean_ndvi).toBe(0.45);
    });

    it('should support cooperative filtering', async () => {
      const result = await getParcellesByHealthStatus(
        'poor',
        { cooperativeId: testCooperativeId, limit: 10, offset: 0 },
        supabase
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // All results should belong to the specified cooperative
      result.forEach((p) => {
        expect(p.cooperative_id).toBe(testCooperativeId);
      });
    });

    it('should support pagination', async () => {
      const page1 = await getParcellesByHealthStatus(
        'poor',
        { limit: 1, offset: 0 },
        supabase
      );

      const page2 = await getParcellesByHealthStatus(
        'poor',
        { limit: 1, offset: 1 },
        supabase
      );

      expect(page1).toHaveLength(1);
      expect(page2).toHaveLength(1);

      // Pages should contain different parcelles
      if (page1.length > 0 && page2.length > 0) {
        expect(page1[0].parcelle_id).not.toBe(page2[0].parcelle_id);
      }
    });
  });

  describe('getPendingDeforestationAlerts', () => {
    it('should retrieve pending deforestation alerts', async () => {
      const result = await getPendingDeforestationAlerts(
        { limit: 10, offset: 0 },
        supabase
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // Find our test alert
      const testAlert = result.find((a) => a.parcelle_id === testParcelleId);
      expect(testAlert).toBeDefined();
      expect(testAlert?.baseline_ndvi).toBe(0.75);
      expect(testAlert?.current_ndvi).toBe(0.35);
      expect(testAlert?.ndvi_change).toBe(-0.4);
      expect(testAlert?.affected_area_hectares).toBe(1.5);
    });

    it('should support cooperative filtering', async () => {
      const result = await getPendingDeforestationAlerts(
        { cooperativeId: testCooperativeId, limit: 10, offset: 0 },
        supabase
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // Find our test alert
      const testAlert = result.find((a) => a.parcelle_id === testParcelleId);
      expect(testAlert).toBeDefined();
    });
  });

  describe('getTemporalNDVIMonthly', () => {
    it('should retrieve NDVI data aggregated by month', async () => {
      const result = await getTemporalNDVIMonthly(
        testParcelleId,
        {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-03-31'),
        },
        supabase
      );

      expect(result).toHaveLength(3);
      expect(result[0].month).toContain('2024-01');
      expect(result[0].avg_mean_ndvi).toBe(0.65);
      expect(result[0].data_points).toBe(1);

      expect(result[1].month).toContain('2024-02');
      expect(result[1].avg_mean_ndvi).toBe(0.55);

      expect(result[2].month).toContain('2024-03');
      expect(result[2].avg_mean_ndvi).toBe(0.45);
    });

    it('should return empty array for parcelle with no data', async () => {
      const result = await getTemporalNDVIMonthly(
        '00000000-0000-0000-0000-000000000000',
        {},
        supabase
      );

      expect(result).toEqual([]);
    });
  });

  describe('Query Caching', () => {
    const testCacheKey = 'test_query_cache_key';
    const testQueryType = 'temporal_ndvi';
    const testData = { mean_ndvi: 0.65, health_status: 'good' };
    const testParameters = { parcelleId: testParcelleId };

    it('should set and get cached query result', async () => {
      // Set cache
      await setCachedQueryResult(
        testCacheKey,
        testQueryType,
        testData,
        testParameters,
        3600,
        supabase
      );

      // Get cache
      const result = await getCachedQueryResult(
        testCacheKey,
        testQueryType,
        3600,
        supabase
      );

      expect(result).toEqual(testData);
    });

    it('should return null for non-existent cache key', async () => {
      const result = await getCachedQueryResult(
        'non_existent_key',
        testQueryType,
        3600,
        supabase
      );

      expect(result).toBeNull();
    });

    it('should invalidate cache by query type', async () => {
      // Set cache
      await setCachedQueryResult(
        testCacheKey,
        testQueryType,
        testData,
        testParameters,
        3600,
        supabase
      );

      // Invalidate
      const deletedCount = await invalidateQueryCache(
        { queryType: testQueryType },
        supabase
      );

      expect(deletedCount).toBeGreaterThan(0);

      // Verify cache is invalidated
      const result = await getCachedQueryResult(
        testCacheKey,
        testQueryType,
        3600,
        supabase
      );

      expect(result).toBeNull();
    });

    it('should execute query with automatic caching', async () => {
      const queryFn = async () => {
        return { mean_ndvi: 0.75, health_status: 'good' };
      };

      // First call - should execute query and cache result
      const result1 = await executeWithCache(
        testQueryType,
        testParameters,
        queryFn,
        { ttlSeconds: 3600 },
        supabase
      );

      expect(result1).toEqual({ mean_ndvi: 0.75, health_status: 'good' });

      // Second call - should return cached result
      const result2 = await executeWithCache(
        testQueryType,
        testParameters,
        queryFn,
        { ttlSeconds: 3600 },
        supabase
      );

      expect(result2).toEqual(result1);
    });

    it('should force refresh cached result', async () => {
      let callCount = 0;
      const queryFn = async () => {
        callCount++;
        return { mean_ndvi: 0.75 + callCount * 0.01, health_status: 'good' };
      };

      // First call
      const result1 = await executeWithCache(
        testQueryType,
        testParameters,
        queryFn,
        { ttlSeconds: 3600 },
        supabase
      );

      // Second call with force refresh
      const result2 = await executeWithCache(
        testQueryType,
        testParameters,
        queryFn,
        { ttlSeconds: 3600, forceRefresh: true },
        supabase
      );

      expect(result1.mean_ndvi).not.toBe(result2.mean_ndvi);
      expect(callCount).toBe(2);
    });
  });

  describe('Batch Queries', () => {
    it('should retrieve latest NDVI for multiple parcelles', async () => {
      const result = await getLatestNDVIBatch([testParcelleId], supabase);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(1);

      const ndvi = result.get(testParcelleId);
      expect(ndvi).toBeDefined();
      expect(ndvi?.mean_ndvi).toBe(0.45);
      expect(ndvi?.health_status).toBe('poor');
    });

    it('should retrieve health summary for multiple parcelles', async () => {
      const result = await getParcelleHealthSummaryBatch(
        [testParcelleId],
        supabase
      );

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(1);

      const summary = result.get(testParcelleId);
      expect(summary).toBeDefined();
      expect(summary?.latest_mean_ndvi).toBe(0.45);
      expect(summary?.latest_health_status).toBe('poor');
      expect(summary?.total_ndvi_calculations).toBe(3);
      expect(summary?.pending_deforestation_alerts).toBe(1);
    });
  });
});
