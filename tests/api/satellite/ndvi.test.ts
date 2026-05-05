/**
 * Integration tests for POST /api/satellite/ndvi endpoint
 * 
 * Tests:
 * - Request validation
 * - Authentication requirement
 * - Authorization (user can only access own parcelles)
 * - NDVI calculation
 * - Caching behavior
 * - Error responses
 * 
 * Requirements: Task 2.2.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/satellite/ndvi/route';
import type { MultiPolygon } from 'geojson';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ndviService } from '@/lib/satellite/services/ndvi.service';

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
    calculateNDVI: vi.fn(),
    getCachedNDVI: vi.fn(),
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
const validDate = '2024-05-03T00:00:00Z';

const mockParcelleGeometry: MultiPolygon = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [10.0, 10.0],
        [10.0, 11.0],
        [11.0, 11.0],
        [11.0, 10.0],
        [10.0, 10.0],
      ],
    ],
  ],
};

const mockNDVIResult = {
  id: 'ndvi-123',
  parcelleId: validParcelleId,
  imageryId: null,
  calculationDate: new Date(validDate),
  meanNDVI: 0.65,
  minNDVI: 0.45,
  maxNDVI: 0.85,
  stdDevNDVI: 0.12,
  healthStatus: 'good' as const,
  ndviRasterUrl: null,
  createdAt: new Date(),
};

// ============================================================================
// Helper Functions
// ============================================================================

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/satellite/ndvi', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function setupAuthenticatedUser(role: string = 'planteur', cooperativeId?: string) {
  const mockSupabaseClient = mockCreateServerSupabaseClient.getMockImplementation()?.() as any;
  
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
              geometry: mockParcelleGeometry,
            },
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

describe('POST /api/satellite/ndvi', () => {
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

    it('should accept valid request with all parameters', async () => {
      mockNDVIService.getCachedNDVI.mockResolvedValue(null);
      mockNDVIService.calculateNDVI.mockResolvedValue(mockNDVIResult);

      const request = createRequest({
        parcelleId: validParcelleId,
        date: validDate,
        forceRecalculate: false,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.ndvi).toBeDefined();
      expect(data.data.cached).toBe(false);
      expect(data.data.recommendation).toBeDefined();
    });

    it('should accept valid request with only required parameters', async () => {
      mockNDVIService.getCachedNDVI.mockResolvedValue(null);
      mockNDVIService.calculateNDVI.mockResolvedValue(mockNDVIResult);

      const request = createRequest({
        parcelleId: validParcelleId,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.ndvi.parcelleId).toBe(validParcelleId);
    });

    it('should reject request with invalid parcelleId format', async () => {
      const request = createRequest({
        parcelleId: 'not-a-uuid',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('Invalid parcelle ID format');
    });

    it('should reject request with missing parcelleId', async () => {
      const request = createRequest({
        date: validDate,
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should reject request with invalid date format', async () => {
      const request = createRequest({
        parcelleId: validParcelleId,
        date: 'not-a-date',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('Invalid date format');
    });

    it('should default date to current date when not provided', async () => {
      mockNDVIService.getCachedNDVI.mockResolvedValue(null);
      mockNDVIService.calculateNDVI.mockResolvedValue(mockNDVIResult);

      const request = createRequest({
        parcelleId: validParcelleId,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify calculateNDVI was called with a date
      expect(mockNDVIService.calculateNDVI).toHaveBeenCalled();
      const callArgs = mockNDVIService.calculateNDVI.mock.calls[0];
      expect(callArgs[2]).toBeInstanceOf(Date);
    });

    it('should default forceRecalculate to false when not provided', async () => {
      mockNDVIService.getCachedNDVI.mockResolvedValue(mockNDVIResult);

      const request = createRequest({
        parcelleId: validParcelleId,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify getCachedNDVI was called (because forceRecalculate is false)
      expect(mockNDVIService.getCachedNDVI).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Authentication Tests
  // ==========================================================================

  describe('Authentication', () => {
    it('should reject unauthenticated requests', async () => {
      setupUnauthenticatedUser();

      const request = createRequest({
        parcelleId: validParcelleId,
      });

      const response = await POST(request);
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
      mockNDVIService.getCachedNDVI.mockResolvedValue(null);
      mockNDVIService.calculateNDVI.mockResolvedValue(mockNDVIResult);

      const request = createRequest({
        parcelleId: validParcelleId,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should allow planteur to access their own parcelle', async () => {
      setupAuthenticatedUser('planteur');
      mockNDVIService.getCachedNDVI.mockResolvedValue(null);
      mockNDVIService.calculateNDVI.mockResolvedValue(mockNDVIResult);

      const request = createRequest({
        parcelleId: validParcelleId,
      });

      const response = await POST(request);
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
                  geometry: mockParcelleGeometry,
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      } as any);

      const request = createRequest({
        parcelleId: validParcelleId,
      });

      const response = await POST(request);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.code).toBe('FORBIDDEN');
    });

    it('should allow cooperative manager to access parcelles in their cooperative', async () => {
      setupAuthenticatedUser('cooperative_manager', 'coop-123');
      mockNDVIService.getCachedNDVI.mockResolvedValue(null);
      mockNDVIService.calculateNDVI.mockResolvedValue(mockNDVIResult);

      const request = createRequest({
        parcelleId: validParcelleId,
      });

      const response = await POST(request);
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
                  geometry: mockParcelleGeometry,
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      } as any);

      const request = createRequest({
        parcelleId: validParcelleId,
      });

      const response = await POST(request);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.code).toBe('FORBIDDEN');
    });

    it('should allow agronomist to access parcelles', async () => {
      setupAuthenticatedUser('agronomist');
      mockNDVIService.getCachedNDVI.mockResolvedValue(null);
      mockNDVIService.calculateNDVI.mockResolvedValue(mockNDVIResult);

      const request = createRequest({
        parcelleId: validParcelleId,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  // ==========================================================================
  // NDVI Calculation Tests
  // ==========================================================================

  describe('NDVI calculation', () => {
    beforeEach(() => {
      setupAuthenticatedUser();
    });

    it('should calculate NDVI when not cached', async () => {
      mockNDVIService.getCachedNDVI.mockResolvedValue(null);
      mockNDVIService.calculateNDVI.mockResolvedValue(mockNDVIResult);

      const request = createRequest({
        parcelleId: validParcelleId,
        date: validDate,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.ndvi.parcelleId).toBe(mockNDVIResult.parcelleId);
      expect(data.data.ndvi.meanNDVI).toBe(mockNDVIResult.meanNDVI);
      expect(data.data.ndvi.healthStatus).toBe(mockNDVIResult.healthStatus);
      expect(data.data.cached).toBe(false);

      // Verify calculateNDVI was called with correct parameters
      expect(mockNDVIService.calculateNDVI).toHaveBeenCalledWith(
        validParcelleId,
        mockParcelleGeometry,
        expect.any(Date),
        {
          forceRecalculate: false,
          storeResult: true,
          generateRaster: false,
        }
      );
    });

    it('should return cached NDVI when available', async () => {
      mockNDVIService.getCachedNDVI.mockResolvedValue(mockNDVIResult);

      const request = createRequest({
        parcelleId: validParcelleId,
        date: validDate,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.ndvi.parcelleId).toBe(mockNDVIResult.parcelleId);
      expect(data.data.ndvi.meanNDVI).toBe(mockNDVIResult.meanNDVI);
      expect(data.data.ndvi.healthStatus).toBe(mockNDVIResult.healthStatus);
      expect(data.data.cached).toBe(true);

      // Verify calculateNDVI was NOT called
      expect(mockNDVIService.calculateNDVI).not.toHaveBeenCalled();
    });

    it('should force recalculation when forceRecalculate is true', async () => {
      mockNDVIService.getCachedNDVI.mockResolvedValue(mockNDVIResult);
      mockNDVIService.calculateNDVI.mockResolvedValue(mockNDVIResult);

      const request = createRequest({
        parcelleId: validParcelleId,
        date: validDate,
        forceRecalculate: true,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.cached).toBe(false);

      // Verify getCachedNDVI was NOT called
      expect(mockNDVIService.getCachedNDVI).not.toHaveBeenCalled();

      // Verify calculateNDVI was called
      expect(mockNDVIService.calculateNDVI).toHaveBeenCalled();
    });

    it('should include recommendation in response', async () => {
      mockNDVIService.getCachedNDVI.mockResolvedValue(null);
      mockNDVIService.calculateNDVI.mockResolvedValue(mockNDVIResult);
      mockNDVIService.getRecommendation.mockReturnValue('Test recommendation');

      const request = createRequest({
        parcelleId: validParcelleId,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.data.recommendation).toBe('Test recommendation');
      expect(mockNDVIService.getRecommendation).toHaveBeenCalledWith('good');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error handling', () => {
    beforeEach(() => {
      setupAuthenticatedUser();
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
                data: { role: 'admin', cooperative_id: null }, // Admin can access any parcelle
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
          return {};
        }),
      } as any);

      const request = createRequest({
        parcelleId: validParcelleId,
      });

      const response = await POST(request);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.code).toBe('GEOMETRY_NOT_FOUND');
    });

    it('should return 404 when parcelle has no geometry', async () => {
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
                  geometry: null, // No geometry
                },
                error: null,
              }),
            };
          }
          return {};
        }),
      } as any);

      const request = createRequest({
        parcelleId: validParcelleId,
      });

      const response = await POST(request);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.code).toBe('GEOMETRY_NOT_FOUND');
      expect(data.error).toContain('no geometry');
    });

    it('should handle NDVI calculation errors', async () => {
      mockNDVIService.getCachedNDVI.mockResolvedValue(null);
      mockNDVIService.calculateNDVI.mockRejectedValue(
        new Error('Calculation failed')
      );

      const request = createRequest({
        parcelleId: validParcelleId,
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.code).toBe('CALCULATION_ERROR');
    });
  });
});
