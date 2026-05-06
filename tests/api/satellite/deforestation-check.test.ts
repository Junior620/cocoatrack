/**
 * Integration tests for POST /api/satellite/deforestation/check endpoint
 * 
 * Tests:
 * - Successful deforestation detection
 * - No deforestation detected
 * - Authentication requirement
 * - Authorization (user can only check accessible parcelles)
 * - Validation errors
 * - Error handling (insufficient data, calculation errors)
 * 
 * Requirements: Task 4.2.2, Task 4.2.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/satellite/deforestation/check/route';
import { NextRequest } from 'next/server';
import type { MultiPolygon } from 'geojson';
import {
  NDVICalculationError,
  InsufficientDataError,
} from '@/lib/satellite/types';

// ============================================================================
// Mocks
// ============================================================================

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

// Mock createServerSupabaseClient
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock DeforestationService
vi.mock('@/lib/satellite/services/deforestation.service', () => ({
  deforestationService: {
    detectDeforestation: vi.fn(),
  },
}));

// Import the mocked service to get access to the mock function
import { deforestationService } from '@/lib/satellite/services/deforestation.service';
const mockDetectDeforestation = vi.mocked(deforestationService.detectDeforestation);

// ============================================================================
// Test Data
// ============================================================================

const mockUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
};

const mockProfile = {
  role: 'cooperative_manager',
  cooperative_id: '550e8400-e29b-41d4-a716-446655440001',
};

const mockParcelle = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  planteur_id: '550e8400-e29b-41d4-a716-446655440003',
  cooperative_id: '550e8400-e29b-41d4-a716-446655440001',
  geometry: {
    type: 'MultiPolygon',
    coordinates: [[[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]],
  } as MultiPolygon,
  surface_hectares: 5.0,
};

const mockDeforestationEvent = {
  id: '550e8400-e29b-41d4-a716-446655440004',
  parcelleId: '550e8400-e29b-41d4-a716-446655440002',
  baselineDate: new Date('2020-12-31'),
  detectionDate: new Date('2024-05-01'),
  baselineNDVI: 0.75,
  currentNDVI: 0.40,
  ndviChange: -0.35,
  affectedAreaHectares: 1.2,
  affectedAreaPercent: 24.0,
  status: 'pending',
  acknowledgedBy: null,
  acknowledgedAt: null,
  acknowledgmentNotes: null,
  disputedBy: null,
  disputedAt: null,
  disputeReason: null,
  createdAt: new Date('2024-05-01'),
  updatedAt: new Date('2024-05-01'),
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a mock NextRequest with JSON body
 */
function createMockRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/satellite/deforestation/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

/**
 * Setup successful authentication and authorization
 */
function setupSuccessfulAuth() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: mockUser },
    error: null,
  });

  // Mock profile query
  const profileQuery = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: mockProfile,
      error: null,
    }),
  };

  // Mock parcelle query
  const parcelleQuery = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: mockParcelle,
      error: null,
    }),
  };

  mockSupabaseClient.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return { select: vi.fn().mockReturnValue(profileQuery) };
    }
    if (table === 'parcelles') {
      return { select: vi.fn().mockReturnValue(parcelleQuery) };
    }
    return {};
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('POST /api/satellite/deforestation/check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Successful deforestation detection', () => {
    it('should detect deforestation and create alert', async () => {
      setupSuccessfulAuth();
      
      mockDetectDeforestation.mockResolvedValue({
        detected: true,
        baselineNDVI: 0.75,
        currentNDVI: 0.40,
        ndviChange: -0.35,
        affectedAreaHectares: 1.2,
        affectedAreaPercent: 24.0,
        event: mockDeforestationEvent,
      });

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201); // 201 Created when alert is created
      expect(data.success).toBe(true);
      expect(data.data.detected).toBe(true);
      expect(data.data.baselineNDVI).toBe(0.75);
      expect(data.data.currentNDVI).toBe(0.40);
      expect(data.data.ndviChange).toBe(-0.35);
      expect(data.data.affectedAreaHectares).toBe(1.2);
      expect(data.data.affectedAreaPercent).toBe(24.0);
      expect(data.data.alerts).toHaveLength(1);
      expect(data.data.alerts[0].id).toBe(mockDeforestationEvent.id);
      expect(data.data.message).toContain('Deforestation detected');
    });

    it('should use custom baseline and current dates', async () => {
      setupSuccessfulAuth();
      
      const baselineDate = new Date('2021-01-01');
      const currentDate = new Date('2024-06-01');

      mockDetectDeforestation.mockResolvedValue({
        detected: true,
        baselineNDVI: 0.70,
        currentNDVI: 0.35,
        ndviChange: -0.35,
        affectedAreaHectares: 2.5,
        affectedAreaPercent: 50.0,
        event: mockDeforestationEvent,
      });

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
        baselineDate: baselineDate.toISOString(),
        currentDate: currentDate.toISOString(),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.detected).toBe(true);

      // Verify service was called with correct dates
      expect(mockDetectDeforestation).toHaveBeenCalledWith(
        mockParcelle.id,
        mockParcelle.geometry,
        mockParcelle.surface_hectares,
        expect.objectContaining({
          baselineDate: expect.any(Date),
          currentDate: expect.any(Date),
          storeEvents: true,
        })
      );
    });
  });

  describe('No deforestation detected', () => {
    it('should return detected=false when no deforestation', async () => {
      setupSuccessfulAuth();
      
      mockDetectDeforestation.mockResolvedValue({
        detected: false,
        baselineNDVI: 0.75,
        currentNDVI: 0.72,
        ndviChange: -0.03,
        affectedAreaHectares: 0.0,
        affectedAreaPercent: 0.0,
      });

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200); // 200 OK when no deforestation
      expect(data.success).toBe(true);
      expect(data.data.detected).toBe(false);
      expect(data.data.alerts).toEqual([]);
      expect(data.data.message).toBe('No deforestation detected');
    });

    it('should return detected=false when NDVI increased', async () => {
      setupSuccessfulAuth();
      
      mockDetectDeforestation.mockResolvedValue({
        detected: false,
        baselineNDVI: 0.65,
        currentNDVI: 0.75,
        ndviChange: 0.10,
        affectedAreaHectares: 0.0,
        affectedAreaPercent: 0.0,
      });

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.detected).toBe(false);
      expect(data.data.ndviChange).toBe(0.10);
    });
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Authorization', () => {
    it('should allow admin to check any parcelle', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const profileQuery = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { role: 'admin', cooperative_id: null },
          error: null,
        }),
      };

      const parcelleQuery = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: mockParcelle,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnValue(profileQuery) };
        }
        if (table === 'parcelles') {
          return { select: vi.fn().mockReturnValue(parcelleQuery) };
        }
        return {};
      });

      mockDetectDeforestation.mockResolvedValue({
        detected: false,
        baselineNDVI: 0.75,
        currentNDVI: 0.72,
        ndviChange: -0.03,
        affectedAreaHectares: 0.0,
        affectedAreaPercent: 0.0,
      });

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should allow certification_auditor to check any parcelle', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const profileQuery = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { role: 'certification_auditor', cooperative_id: null },
          error: null,
        }),
      };

      const parcelleQuery = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: mockParcelle,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnValue(profileQuery) };
        }
        if (table === 'parcelles') {
          return { select: vi.fn().mockReturnValue(parcelleQuery) };
        }
        return {};
      });

      mockDetectDeforestation.mockResolvedValue({
        detected: false,
        baselineNDVI: 0.75,
        currentNDVI: 0.72,
        ndviChange: -0.03,
        affectedAreaHectares: 0.0,
        affectedAreaPercent: 0.0,
      });

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should allow cooperative_manager to check parcelles in their cooperative', async () => {
      setupSuccessfulAuth();
      
      mockDetectDeforestation.mockResolvedValue({
        detected: false,
        baselineNDVI: 0.75,
        currentNDVI: 0.72,
        ndviChange: -0.03,
        affectedAreaHectares: 0.0,
        affectedAreaPercent: 0.0,
      });

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should deny cooperative_manager access to parcelles outside their cooperative', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const profileQuery = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { role: 'cooperative_manager', cooperative_id: '550e8400-e29b-41d4-a716-446655440099' },
          error: null,
        }),
      };

      const parcelleQuery = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { ...mockParcelle, cooperative_id: '550e8400-e29b-41d4-a716-446655440001' },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnValue(profileQuery) };
        }
        if (table === 'parcelles') {
          return { select: vi.fn().mockReturnValue(parcelleQuery) };
        }
        return {};
      });

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.code).toBe('FORBIDDEN');
    });

    it('should allow planteur to check their own parcelles', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { ...mockUser, id: mockParcelle.planteur_id } },
        error: null,
      });

      const profileQuery = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { role: 'planteur', cooperative_id: null },
          error: null,
        }),
      };

      const parcelleQuery = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: mockParcelle,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnValue(profileQuery) };
        }
        if (table === 'parcelles') {
          return { select: vi.fn().mockReturnValue(parcelleQuery) };
        }
        return {};
      });

      mockDetectDeforestation.mockResolvedValue({
        detected: false,
        baselineNDVI: 0.75,
        currentNDVI: 0.72,
        ndviChange: -0.03,
        affectedAreaHectares: 0.0,
        affectedAreaPercent: 0.0,
      });

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('should deny planteur access to parcelles they do not own', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { ...mockUser, id: '550e8400-e29b-41d4-a716-446655440099' } },
        error: null,
      });

      const profileQuery = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { role: 'planteur', cooperative_id: null },
          error: null,
        }),
      };

      const parcelleQuery = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: mockParcelle,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnValue(profileQuery) };
        }
        if (table === 'parcelles') {
          return { select: vi.fn().mockReturnValue(parcelleQuery) };
        }
        return {};
      });

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.code).toBe('FORBIDDEN');
    });

    it('should allow agronomist to check any parcelle', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const profileQuery = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { role: 'agronomist', cooperative_id: null },
          error: null,
        }),
      };

      const parcelleQuery = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: mockParcelle,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnValue(profileQuery) };
        }
        if (table === 'parcelles') {
          return { select: vi.fn().mockReturnValue(parcelleQuery) };
        }
        return {};
      });

      mockDetectDeforestation.mockResolvedValue({
        detected: false,
        baselineNDVI: 0.75,
        currentNDVI: 0.72,
        ndviChange: -0.03,
        affectedAreaHectares: 0.0,
        affectedAreaPercent: 0.0,
      });

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Validation', () => {
    it('should reject missing parcelleId', async () => {
      const request = createMockRequest({});
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid parcelleId format', async () => {
      const request = createMockRequest({ parcelleId: 'invalid-uuid' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('Invalid parcelle ID format');
    });

    it('should reject invalid baselineDate format', async () => {
      const request = createMockRequest({
        parcelleId: mockParcelle.id,
        baselineDate: 'invalid-date',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('Invalid baseline date format');
    });

    it('should reject invalid currentDate format', async () => {
      const request = createMockRequest({
        parcelleId: mockParcelle.id,
        currentDate: 'invalid-date',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('Invalid current date format');
    });

    it('should reject invalid JSON body', async () => {
      const request = new NextRequest('http://localhost:3000/api/satellite/deforestation/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid-json{',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe('INVALID_JSON');
    });
  });

  describe('Error handling', () => {
    it('should handle parcelle not found', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const profileQuery = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        }),
      };

      const parcelleQuery = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnValue(profileQuery) };
        }
        if (table === 'parcelles') {
          return { select: vi.fn().mockReturnValue(parcelleQuery) };
        }
        return {};
      });

      const request = createMockRequest({
        parcelleId: '550e8400-e29b-41d4-a716-446655440099',
      });

      const response = await POST(request);
      const data = await response.json();

      // Note: The API returns 403 (FORBIDDEN) when parcelle is not found during authorization check
      // This is because the authorization check happens before the parcelle data retrieval
      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Parcelle not found');
    });

    it('should handle insufficient data error', async () => {
      setupSuccessfulAuth();
      
      mockDetectDeforestation.mockRejectedValue(
        new InsufficientDataError(
          'Baseline imagery not available',
          1,
          0
        )
      );

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503); // Service Unavailable
      expect(data.success).toBe(false);
      expect(data.code).toBe('INSUFFICIENT_DATA');
      expect(data.error).toContain('Baseline imagery not available');
    });

    it('should handle NDVI calculation error', async () => {
      setupSuccessfulAuth();
      
      mockDetectDeforestation.mockRejectedValue(
        new NDVICalculationError(
          'Failed to calculate NDVI',
          mockParcelle.id,
          'Calculation failed'
        )
      );

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Failed to calculate NDVI');
    });

    it('should handle unknown service errors', async () => {
      setupSuccessfulAuth();
      
      mockDetectDeforestation.mockRejectedValue(new Error('Unknown error'));

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.code).toBe('DETECTION_ERROR');
    });
  });

  describe('Service integration', () => {
    it('should call detectDeforestation with correct parameters', async () => {
      setupSuccessfulAuth();
      
      mockDetectDeforestation.mockResolvedValue({
        detected: false,
        baselineNDVI: 0.75,
        currentNDVI: 0.72,
        ndviChange: -0.03,
        affectedAreaHectares: 0.0,
        affectedAreaPercent: 0.0,
      });

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
      });

      await POST(request);

      expect(mockDetectDeforestation).toHaveBeenCalledWith(
        mockParcelle.id,
        mockParcelle.geometry,
        mockParcelle.surface_hectares,
        expect.objectContaining({
          storeEvents: true,
          supabase: expect.anything(),
        })
      );
    });

    it('should pass custom dates to detectDeforestation', async () => {
      setupSuccessfulAuth();
      
      const baselineDate = new Date('2021-01-01');
      const currentDate = new Date('2024-06-01');

      mockDetectDeforestation.mockResolvedValue({
        detected: false,
        baselineNDVI: 0.75,
        currentNDVI: 0.72,
        ndviChange: -0.03,
        affectedAreaHectares: 0.0,
        affectedAreaPercent: 0.0,
      });

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
        baselineDate: baselineDate.toISOString(),
        currentDate: currentDate.toISOString(),
      });

      await POST(request);

      const callArgs = mockDetectDeforestation.mock.calls[0];
      expect(callArgs[3]).toMatchObject({
        baselineDate: expect.any(Date),
        currentDate: expect.any(Date),
        storeEvents: true,
      });

      // Verify dates are correctly parsed
      const options = callArgs[3] as any;
      expect(options.baselineDate.toISOString()).toBe(baselineDate.toISOString());
      expect(options.currentDate.toISOString()).toBe(currentDate.toISOString());
    });
  });
});
