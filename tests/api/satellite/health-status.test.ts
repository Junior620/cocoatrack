/**
 * Integration tests for GET /api/satellite/health-status/:parcelleId endpoint
 * 
 * Tests:
 * - Request validation
 * - Authentication requirement
 * - Authorization (user can only access own parcelles)
 * - Health status retrieval
 * - NDVI trend calculation
 * - Caching behavior (24-hour TTL)
 * - Error responses
 * 
 * Requirements: Task 2.2.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/satellite/health-status/[parcelleId]/route';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ndviService } from '@/lib/satellite/services/ndvi.service';
import type { NDVITrend } from '@/lib/satellite/types';

// ============================================================================
// Mocks
// ============================================================================

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  })),
}));

// Mock NDVIService
vi.mock('@/lib/satellite/services/ndvi.service', () => ({
  ndviService: {
    getNDVITrend: vi.fn(),
    getRecommendation: vi.fn(),
  },
}));

// Get mocked instances
const mockCreateServerSupabaseClient = vi.mocked(createServerSupabaseClient);
const mockNDVIService = vi.mocked(ndviService);

// ============================================================================
// Test Data
// ============================================================================

const validParcelleId = '123e4567-e89b-12d3-a456-426614174000';
const validUserId = 'user-123';

const mockNDVIData = {
  mean_ndvi: 0.65,
  health_status: 'good',
  calculation_date: '2024-05-03T00:00:00Z',
};

const mockNDVITrend: NDVITrend = {
  trend: 'improving',
  changeRate: 0.02,
  dataPoints: 5,
  startDate: new Date('2024-02-03T00:00:00Z'),
  endDate: new Date('2024-05-03T00:00:00Z'),
  startNDVI: 0.60,
  endNDVI: 0.65,
};

// ============================================================================
// Helper Functions
// ============================================================================

function createRequest(parcelleId: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/satellite/health-status/${parcelleId}`,
    {
      method: 'GET',
    }
  );
}

function setupAuthenticatedUser(role: string = 'planteur', cooperativeId?: string) {
  mockCreateServerSupabaseClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: validUserId, email: 'test@example.com' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { role, cooperative_id: cooperativeId },
            error: null,
          }),
        };
      }
      if (table === 'parcelles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: validParcelleId,
              planteur_id: validUserId,
              cooperative_id: cooperativeId,
            },
            error: null,
          }),
        };
      }
      if (table === 'ndvi_results') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockNDVIData,
            error: null,
          }),
        };
      }
      return {};
    }),
  } as any);
}

function setupUnauthenticatedUser() {
  mockCreateServerSupabaseClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      }),
    },
    from: vi.fn(),
  } as any);
}

// ============================================================================
// Tests
// ============================================================================

describe('GET /api/satellite/health-status/:parcelleId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNDVIService.getRecommendation.mockReturnValue(
      'Vegetation is healthy. Monitor regularly and maintain current practices.'
    );
  });

  // ==========================================================================
  // Request Validation Tests
  // ==========================================================================

  describe('Request validation', () => {
    beforeEach(() => {
      setupAuthenticatedUser();
    });

    it('should accept valid UUID parcelleId', async () => {
      mockNDVIService.getNDVITrend.mockResolvedValue(mockNDVITrend);

      const request = createRequest(validParcelleId);
      const response = await GET(request, { params: { parcelleId: validParcelleId } });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.parcelleId).toBe(validParcelleId);
      expect(data.data.healthStatus).toBe('good');
      expect(data.data.meanNDVI).toBe(0.65);
    });

    it('should reject invalid UUID format', async () => {
      const invalidId = 'not-a-uuid';
      const request = createRequest(invalidId);
      const response = await GET(request, { params: { parcelleId: invalidId } });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('Invalid parcelle ID format');
    });
  });

  // ==========================================================================
  // Authentication Tests
  // ==========================================================================

  describe('Authentication', () => {
    it('should reject unauthenticated requests', async () => {
      setupUnauthenticatedUser();

      const request = createRequest(validParcelleId);
      const response = await GET(request, { params: { parcelleId: validParcelleId } });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.code).toBe('UNAUTHORIZED');
      expect(data.error).toContain('Authentication required');
    });
  });

  // ==========================================================================
  // Authorization Tests
  // ==========================================================================

  describe('Authorization', () => {
    it('should allow admin to access any parcelle', async () => {
      setupAuthenticatedUser('admin');
      mockNDVIService.getNDVITrend.mockResolvedValue(mockNDVITrend);

      const request = createRequest(validParcelleId);
      const response = await GET(request, { params: { parcelleId: validParcelleId } });

      expect(response.status).toBe(200);
    });

    it('should allow planteur to access their own parcelle', async () => {
      setupAuthenticatedUser('planteur');
      mockNDVIService.getNDVITrend.mockResolvedValue(mockNDVITrend);

      const request = createRequest(validParcelleId);
      const response = await GET(request, { params: { parcelleId: validParcelleId } });

      expect(response.status).toBe(200);
    });

    it('should deny planteur access to another planteur\'s parcelle', async () => {
      // Mock parcelle owned by different user
      mockCreateServerSupabaseClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: validUserId, email: 'test@example.com' } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { role: 'planteur', cooperative_id: null },
                error: null,
              }),
            };
          }
          if (table === 'parcelles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  id: validParcelleId,
                  planteur_id: 'different-user-id', // Different owner
                  cooperative_id: null,
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      } as any);

      const request = createRequest(validParcelleId);
      const response = await GET(request, { params: { parcelleId: validParcelleId } });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.code).toBe('FORBIDDEN');
    });

    it('should allow cooperative manager to access parcelles in their cooperative', async () => {
      setupAuthenticatedUser('cooperative_manager', 'coop-123');
      mockNDVIService.getNDVITrend.mockResolvedValue(mockNDVITrend);

      const request = createRequest(validParcelleId);
      const response = await GET(request, { params: { parcelleId: validParcelleId } });

      expect(response.status).toBe(200);
    });

    it('should deny cooperative manager access to parcelles outside their cooperative', async () => {
      // Mock parcelle in different cooperative
      mockCreateServerSupabaseClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: validUserId, email: 'test@example.com' } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { role: 'cooperative_manager', cooperative_id: 'coop-123' },
                error: null,
              }),
            };
          }
          if (table === 'parcelles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  id: validParcelleId,
                  planteur_id: validUserId,
                  cooperative_id: 'coop-456', // Different cooperative
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      } as any);

      const request = createRequest(validParcelleId);
      const response = await GET(request, { params: { parcelleId: validParcelleId } });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.code).toBe('FORBIDDEN');
    });

    it('should allow agronomist to access parcelles', async () => {
      setupAuthenticatedUser('agronomist');
      mockNDVIService.getNDVITrend.mockResolvedValue(mockNDVITrend);

      const request = createRequest(validParcelleId);
      const response = await GET(request, { params: { parcelleId: validParcelleId } });

      expect(response.status).toBe(200);
    });
  });

  // ==========================================================================
  // Health Status Retrieval Tests
  // ==========================================================================

  describe('Health status retrieval', () => {
    beforeEach(() => {
      setupAuthenticatedUser();
    });

    it('should return health status with NDVI value', async () => {
      mockNDVIService.getNDVITrend.mockResolvedValue(mockNDVITrend);

      const request = createRequest(validParcelleId);
      const response = await GET(request, { params: { parcelleId: validParcelleId } });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.parcelleId).toBe(validParcelleId);
      expect(data.data.healthStatus).toBe('good');
      expect(data.data.meanNDVI).toBe(0.65);
      expect(data.data.lastCalculationDate).toBeDefined();
      expect(data.data.cached).toBe(true);
    });

    it('should include NDVI trend when available', async () => {
      mockNDVIService.getNDVITrend.mockResolvedValue(mockNDVITrend);

      const request = createRequest(validParcelleId);
      const response = await GET(request, { params: { parcelleId: validParcelleId } });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.trend).toBeDefined();
      expect(data.data.trend.direction).toBe('improving');
      expect(data.data.trend.changeRate).toBe(0.02);
      expect(data.data.trend.dataPoints).toBe(5);

      // Verify getNDVITrend was called with correct parcelleId
      expect(mockNDVIService.getNDVITrend).toHaveBeenCalledWith(validParcelleId);
    });

    it('should handle missing trend data gracefully', async () => {
      mockNDVIService.getNDVITrend.mockResolvedValue(null);

      const request = createRequest(validParcelleId);
      const response = await GET(request, { params: { parcelleId: validParcelleId } });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.trend).toBeNull();
      expect(data.data.healthStatus).toBe('good');
      expect(data.data.meanNDVI).toBe(0.65);
    });

    it('should include recommendation based on health status', async () => {
      mockNDVIService.getNDVITrend.mockResolvedValue(mockNDVITrend);
      mockNDVIService.getRecommendation.mockReturnValue('Test recommendation for good health');

      const request = createRequest(validParcelleId);
      const response = await GET(request, { params: { parcelleId: validParcelleId } });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.recommendation).toBe('Test recommendation for good health');
      expect(mockNDVIService.getRecommendation).toHaveBeenCalledWith('good');
    });

    it('should return all health status levels correctly', async () => {
      const healthStatuses = ['excellent', 'good', 'fair', 'poor', 'critical'];

      for (const status of healthStatuses) {
        vi.clearAllMocks();

        mockCreateServerSupabaseClient.mockResolvedValue({
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: validUserId, email: 'test@example.com' } },
              error: null,
            }),
          },
          from: vi.fn((table: string) => {
            if (table === 'profiles') {
              return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: { role: 'planteur', cooperative_id: null },
                  error: null,
                }),
              };
            }
            if (table === 'parcelles') {
              return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: validParcelleId,
                    planteur_id: validUserId,
                    cooperative_id: null,
                  },
                  error: null,
                }),
              };
            }
            if (table === 'ndvi_results') {
              return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: {
                    mean_ndvi: 0.5,
                    health_status: status,
                    calculation_date: '2024-05-03T00:00:00Z',
                  },
                  error: null,
                }),
              };
            }
            return {};
          }),
        } as any);

        mockNDVIService.getNDVITrend.mockResolvedValue(null);

        const request = createRequest(validParcelleId);
        const response = await GET(request, { params: { parcelleId: validParcelleId } });

        expect(response.status).toBe(200);

        const data = await response.json();
        expect(data.data.healthStatus).toBe(status);
      }
    });
  });

  // ==========================================================================
  // Caching Tests
  // ==========================================================================

  describe('Caching behavior', () => {
    beforeEach(() => {
      setupAuthenticatedUser();
      mockNDVIService.getNDVITrend.mockResolvedValue(mockNDVITrend);
    });

    it('should include 24-hour cache headers', async () => {
      const request = createRequest(validParcelleId);
      const response = await GET(request, { params: { parcelleId: validParcelleId } });

      expect(response.status).toBe(200);

      // Verify cache headers
      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toContain('public');
      expect(cacheControl).toContain('max-age=86400'); // 24 hours in seconds
      expect(cacheControl).toContain('s-maxage=86400');

      // Verify CDN cache headers
      const cdnCacheControl = response.headers.get('CDN-Cache-Control');
      expect(cdnCacheControl).toContain('public');
      expect(cdnCacheControl).toContain('max-age=86400');

      const vercelCacheControl = response.headers.get('Vercel-CDN-Cache-Control');
      expect(vercelCacheControl).toContain('public');
      expect(vercelCacheControl).toContain('max-age=86400');
    });

    it('should mark response as cached', async () => {
      const request = createRequest(validParcelleId);
      const response = await GET(request, { params: { parcelleId: validParcelleId } });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.cached).toBe(true);
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error handling', () => {
    beforeEach(() => {
      setupAuthenticatedUser();
    });

    it('should return 404 when no NDVI data exists for parcelle', async () => {
      mockCreateServerSupabaseClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: validUserId, email: 'test@example.com' } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { role: 'planteur', cooperative_id: null },
                error: null,
              }),
            };
          }
          if (table === 'parcelles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: {
                  id: validParcelleId,
                  planteur_id: validUserId,
                  cooperative_id: null,
                },
                error: null,
              }),
            };
          }
          if (table === 'ndvi_results') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows found' },
              }),
            };
          }
          return {};
        }),
      } as any);

      const request = createRequest(validParcelleId);
      const response = await GET(request, { params: { parcelleId: validParcelleId } });

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.code).toBe('NDVI_NOT_FOUND');
      expect(data.error).toContain('No NDVI data available');
    });

    it('should return 404 when parcelle not found', async () => {
      mockCreateServerSupabaseClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: validUserId, email: 'test@example.com' } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { role: 'admin', cooperative_id: null },
                error: null,
              }),
            };
          }
          if (table === 'parcelles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' },
              }),
            };
          }
          if (table === 'ndvi_results') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows found' },
              }),
            };
          }
          return {};
        }),
      } as any);

      const request = createRequest(validParcelleId);
      const response = await GET(request, { params: { parcelleId: validParcelleId } });

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.code).toBe('NDVI_NOT_FOUND');
    });

    it('should handle trend calculation errors gracefully', async () => {
      mockNDVIService.getNDVITrend.mockRejectedValue(
        new Error('Trend calculation failed')
      );

      const request = createRequest(validParcelleId);
      const response = await GET(request, { params: { parcelleId: validParcelleId } });

      // Should still return 200 with null trend
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.trend).toBeNull();
      expect(data.data.healthStatus).toBe('good');
      expect(data.data.meanNDVI).toBe(0.65);
    });
  });
});
