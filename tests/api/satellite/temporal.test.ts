// CocoaTrack V2 - Satellite Temporal API Integration Tests
// Tests for GET /api/satellite/temporal endpoint

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/satellite/temporal/route';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => ({
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          cooperative_id: 'coop-123',
          geometry: {
            type: 'MultiPolygon',
            coordinates: [[[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]],
          },
        },
        error: null,
      })),
    })),
  })),
}));

// Mock Redis cache service
vi.mock('@/lib/satellite/services/redis-cache.service', () => ({
  redisCacheService: {
    getTemporalData: vi.fn(() => Promise.resolve(null)),
    setTemporalData: vi.fn(() => Promise.resolve()),
  },
}));

// Mock NDVI service
vi.mock('@/lib/satellite/services/ndvi.service', () => ({
  ndviService: {
    calculateTemporalStatistics: vi.fn(() =>
      Promise.resolve({
        timeline: [
          {
            date: new Date('2024-01-01'),
            ndvi: 0.65,
            cloudCover: 10,
            healthStatus: 'good',
            hasSignificantChange: false,
          },
          {
            date: new Date('2024-02-01'),
            ndvi: 0.70,
            cloudCover: 15,
            healthStatus: 'excellent',
            hasSignificantChange: false,
          },
        ],
        trend: {
          trend: 'improving',
          changeRate: 0.05,
          dataPoints: 2,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-02-01'),
          startNDVI: 0.65,
          endNDVI: 0.70,
        },
        significantChanges: [],
        averageNDVI: 0.675,
        averageCloudCover: 12.5,
      })
    ),
  },
}));

describe('GET /api/satellite/temporal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Request validation', () => {
    it('should reject request with missing parcelleId', async () => {
      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-12-31');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('parcelleId');
      expect(data.code).toBe('MISSING_PARCELLE_ID');
    });

    it('should reject request with missing startDate', async () => {
      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('endDate', '2024-12-31');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('startDate');
      expect(data.code).toBe('MISSING_START_DATE');
    });

    it('should reject request with missing endDate', async () => {
      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('endDate');
      expect(data.code).toBe('MISSING_END_DATE');
    });

    it('should reject request with invalid interval', async () => {
      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-12-31');
      url.searchParams.set('interval', 'yearly');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid interval');
      expect(data.code).toBe('INVALID_INTERVAL');
    });

    it('should reject request with invalid startDate format', async () => {
      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', 'not-a-date');
      url.searchParams.set('endDate', '2024-12-31');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid startDate format');
      expect(data.code).toBe('INVALID_START_DATE');
    });

    it('should reject request with invalid endDate format', async () => {
      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', 'not-a-date');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid endDate format');
      expect(data.code).toBe('INVALID_END_DATE');
    });

    it('should reject request with startDate after endDate', async () => {
      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-12-31');
      url.searchParams.set('endDate', '2024-01-01');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('startDate must be before or equal to endDate');
      expect(data.code).toBe('INVALID_DATE_RANGE');
    });

    it('should reject request with date range exceeding 2 years', async () => {
      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2020-01-01');
      url.searchParams.set('endDate', '2023-01-01');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Date range exceeds maximum');
      expect(data.code).toBe('DATE_RANGE_TOO_LARGE');
    });
  });

  describe('Interval tests', () => {
    it('should accept daily interval', async () => {
      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-01-31');
      url.searchParams.set('interval', 'daily');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.interval).toBe('daily');
    });

    it('should accept weekly interval', async () => {
      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-03-31');
      url.searchParams.set('interval', 'weekly');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.interval).toBe('weekly');
    });

    it('should accept monthly interval', async () => {
      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-12-31');
      url.searchParams.set('interval', 'monthly');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.interval).toBe('monthly');
    });

    it('should default to monthly interval when not specified', async () => {
      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-12-31');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.interval).toBe('monthly');
    });
  });

  describe('Caching tests', () => {
    it('should return cached data when available', async () => {
      const { redisCacheService } = await import(
        '@/lib/satellite/services/redis-cache.service'
      );

      const cachedData = {
        data: {
          parcelleId: '123e4567-e89b-12d3-a456-426614174000',
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-12-31T00:00:00.000Z',
          interval: 'monthly',
          summary: {
            timeline: [],
            trend: {},
            significantChanges: [],
            averageNDVI: 0.65,
            averageCloudCover: 10,
          },
        },
        cachedAt: Date.now(),
      };

      vi.mocked(redisCacheService.getTemporalData).mockResolvedValueOnce(cachedData);

      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-12-31');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.cached).toBe(true);
      expect(data.cachedAt).toBeDefined();
      expect(redisCacheService.getTemporalData).toHaveBeenCalled();
    });

    it('should fetch fresh data on cache miss', async () => {
      const { redisCacheService } = await import(
        '@/lib/satellite/services/redis-cache.service'
      );
      const { ndviService } = await import('@/lib/satellite/services/ndvi.service');

      vi.mocked(redisCacheService.getTemporalData).mockResolvedValueOnce(null);

      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-12-31');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.cached).toBe(false);
      expect(ndviService.calculateTemporalStatistics).toHaveBeenCalled();
      expect(redisCacheService.setTemporalData).toHaveBeenCalled();
    });

    it('should include cachedAt timestamp in cached responses', async () => {
      const { redisCacheService } = await import(
        '@/lib/satellite/services/redis-cache.service'
      );

      const cachedTimestamp = Date.now();
      const cachedData = {
        data: {
          parcelleId: '123e4567-e89b-12d3-a456-426614174000',
          summary: { timeline: [], averageNDVI: 0.65 },
        },
        cachedAt: cachedTimestamp,
      };

      vi.mocked(redisCacheService.getTemporalData).mockResolvedValueOnce(cachedData);

      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-12-31');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.cachedAt).toBeDefined();
      expect(new Date(data.cachedAt).getTime()).toBeCloseTo(cachedTimestamp, -2);
    });

    it('should use different cache keys for different parameters', async () => {
      const { redisCacheService } = await import(
        '@/lib/satellite/services/redis-cache.service'
      );

      // First request
      const url1 = new URL('http://localhost:3000/api/satellite/temporal');
      url1.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url1.searchParams.set('startDate', '2024-01-01');
      url1.searchParams.set('endDate', '2024-06-30');
      url1.searchParams.set('interval', 'monthly');

      const request1 = new NextRequest(url1);
      await GET(request1);

      const firstCallArgs = vi.mocked(redisCacheService.getTemporalData).mock.calls[0][0];

      // Second request with different parameters
      const url2 = new URL('http://localhost:3000/api/satellite/temporal');
      url2.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url2.searchParams.set('startDate', '2024-01-01');
      url2.searchParams.set('endDate', '2024-06-30');
      url2.searchParams.set('interval', 'weekly');

      const request2 = new NextRequest(url2);
      await GET(request2);

      const secondCallArgs = vi.mocked(redisCacheService.getTemporalData).mock.calls[1][0];

      // Cache keys should be different due to different intervals
      expect(firstCallArgs.interval).toBe('monthly');
      expect(secondCallArgs.interval).toBe('weekly');
    });
  });

  describe('Authentication tests', () => {
    it('should reject unauthenticated requests', async () => {
      const { createServerSupabaseClient } = await import('@/lib/supabase/server');
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(() => ({
            data: { user: null },
            error: { message: 'Not authenticated' },
          })),
        },
      } as any);

      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-12-31');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Authentication required');
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should allow authenticated users to access endpoint', async () => {
      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-12-31');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Authorization tests', () => {
    it('should return 404 when parcelle not found', async () => {
      const { createServerSupabaseClient } = await import('@/lib/supabase/server');
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(() => ({
            data: { user: { id: 'test-user', email: 'test@example.com' } },
            error: null,
          })),
        },
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn(() => ({
            data: null,
            error: { code: 'PGRST116' },
          })),
        })),
      } as any);

      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-12-31');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Parcelle not found');
      expect(data.code).toBe('PARCELLE_NOT_FOUND');
    });

    it('should return 403 when user lacks permission', async () => {
      const { createServerSupabaseClient } = await import('@/lib/supabase/server');
      vi.mocked(createServerSupabaseClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn(() => ({
            data: { user: { id: 'test-user', email: 'test@example.com' } },
            error: null,
          })),
        },
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn(() => ({
            data: null,
            error: { code: 'PERMISSION_DENIED' },
          })),
        })),
      } as any);

      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-12-31');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('permission');
      expect(data.code).toBe('FORBIDDEN');
    });

    it('should allow users with access to retrieve temporal data', async () => {
      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-12-31');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Success response tests', () => {
    it('should return timeline data in response', async () => {
      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-12-31');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.summary.timeline).toBeDefined();
      expect(Array.isArray(data.data.summary.timeline)).toBe(true);
    });

    it('should return trend analysis in response', async () => {
      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-12-31');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.summary.trend).toBeDefined();
      expect(data.data.summary.trend.trend).toBeDefined();
      expect(data.data.summary.trend.changeRate).toBeDefined();
    });

    it('should return significant changes in response', async () => {
      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-12-31');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.summary.significantChanges).toBeDefined();
      expect(Array.isArray(data.data.summary.significantChanges)).toBe(true);
    });

    it('should include timeline data points with correct format', async () => {
      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-12-31');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      const timeline = data.data.summary.timeline;

      expect(timeline.length).toBeGreaterThan(0);
      timeline.forEach((point: any) => {
        expect(point.date).toBeDefined();
        expect(point.ndvi).toBeDefined();
        expect(point.cloudCover).toBeDefined();
        expect(point.healthStatus).toBeDefined();
        expect(point.hasSignificantChange).toBeDefined();
      });
    });
  });

  describe('Error handling tests', () => {
    it('should return 422 for InsufficientDataError', async () => {
      const { ndviService } = await import('@/lib/satellite/services/ndvi.service');
      const { InsufficientDataError } = await import('@/lib/satellite/types');

      vi.mocked(ndviService.calculateTemporalStatistics).mockRejectedValueOnce(
        new InsufficientDataError('Not enough data points', 10, 3)
      );

      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-12-31');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.code).toBe('INSUFFICIENT_DATA');
      expect(data.details.requiredDataPoints).toBe(10);
      expect(data.details.availableDataPoints).toBe(3);
    });

    it('should return 500 for NDVICalculationError', async () => {
      const { ndviService } = await import('@/lib/satellite/services/ndvi.service');
      const { NDVICalculationError } = await import('@/lib/satellite/types');

      vi.mocked(ndviService.calculateTemporalStatistics).mockRejectedValueOnce(
        new NDVICalculationError(
          'Failed to calculate NDVI',
          '123e4567-e89b-12d3-a456-426614174000',
          'Invalid band data'
        )
      );

      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-12-31');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.code).toBe('NDVI_CALCULATION_FAILED');
      expect(data.details.parcelleId).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should return 500 for unknown errors with user-friendly message', async () => {
      const { ndviService } = await import('@/lib/satellite/services/ndvi.service');

      vi.mocked(ndviService.calculateTemporalStatistics).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const url = new URL('http://localhost:3000/api/satellite/temporal');
      url.searchParams.set('parcelleId', '123e4567-e89b-12d3-a456-426614174000');
      url.searchParams.set('startDate', '2024-01-01');
      url.searchParams.set('endDate', '2024-12-31');

      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Failed to retrieve temporal data');
      expect(data.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });
});
