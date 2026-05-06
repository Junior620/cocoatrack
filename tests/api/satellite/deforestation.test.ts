/**
 * Integration tests for GET /api/satellite/deforestation endpoint
 * 
 * Tests:
 * - Successful alert retrieval
 * - Authentication requirement
 * - Authorization (user can only access own parcelles)
 * - Status filtering
 * - Summary statistics calculation
 * - Compliance status determination
 * - Error responses
 * 
 * Requirements: Task 4.2.1
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/satellite/deforestation/route';
import { NextRequest } from 'next/server';
import type { DeforestationEvent } from '@/lib/satellite/types';

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
    getAlerts: vi.fn(),
  },
}));

// Import the mocked service to get access to the mock function
import { deforestationService } from '@/lib/satellite/services/deforestation.service';
const mockGetAlerts = vi.mocked(deforestationService.getAlerts);

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
};

const mockDeforestationEvent: DeforestationEvent = {
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

const mockAcknowledgedEvent: DeforestationEvent = {
  ...mockDeforestationEvent,
  id: '550e8400-e29b-41d4-a716-446655440005',
  status: 'acknowledged',
  acknowledgedBy: '550e8400-e29b-41d4-a716-446655440000',
  acknowledgedAt: new Date('2024-05-02'),
  acknowledgmentNotes: 'Verified and intervention planned',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a mock NextRequest with query parameters
 */
function createMockRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/satellite/deforestation');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return new NextRequest(url);
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

describe('GET /api/satellite/deforestation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Successful alert retrieval', () => {
    it('should return all alerts for a parcelle', async () => {
      setupSuccessfulAuth();
      mockGetAlerts.mockResolvedValue([mockDeforestationEvent, mockAcknowledgedEvent]);

      const request = createMockRequest({ parcelleId: mockParcelle.id });
      const response = await GET(request);
      const data = await response.json();

      // Debug: log the error if status is not 200
      if (response.status !== 200) {
        console.log('Error response:', data);
      }

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.alerts).toHaveLength(2);
      expect(data.data.alerts[0].id).toBe(mockDeforestationEvent.id);
      expect(data.data.alerts[1].id).toBe(mockAcknowledgedEvent.id);
    });

    it('should return summary statistics', async () => {
      setupSuccessfulAuth();
      mockGetAlerts.mockResolvedValue([mockDeforestationEvent, mockAcknowledgedEvent]);

      const request = createMockRequest({ parcelleId: mockParcelle.id });
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.summary).toEqual({
        totalAlerts: 2,
        pendingAlerts: 1,
        acknowledgedAlerts: 1,
        disputedAlerts: 0,
      });
    });

    it('should return compliant=false when pending alerts exist', async () => {
      setupSuccessfulAuth();
      mockGetAlerts.mockResolvedValue([mockDeforestationEvent]);

      const request = createMockRequest({ parcelleId: mockParcelle.id });
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.compliant).toBe(false);
    });

    it('should return compliant=true when no pending/disputed alerts exist', async () => {
      setupSuccessfulAuth();
      mockGetAlerts.mockResolvedValue([mockAcknowledgedEvent]);

      const request = createMockRequest({ parcelleId: mockParcelle.id });
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.compliant).toBe(true);
    });

    it('should return empty array when no alerts exist', async () => {
      setupSuccessfulAuth();
      mockGetAlerts.mockResolvedValue([]);

      const request = createMockRequest({ parcelleId: mockParcelle.id });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.alerts).toEqual([]);
      expect(data.data.summary.totalAlerts).toBe(0);
      expect(data.data.compliant).toBe(true);
    });
  });

  describe('Status filtering', () => {
    it('should filter alerts by status=pending', async () => {
      setupSuccessfulAuth();
      mockGetAlerts.mockResolvedValue([mockDeforestationEvent]);

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
        status: 'pending',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockGetAlerts).toHaveBeenCalledWith(
        mockParcelle.id,
        'pending',
        expect.anything()
      );
      expect(data.data.alerts).toHaveLength(1);
      expect(data.data.alerts[0].status).toBe('pending');
    });

    it('should filter alerts by status=acknowledged', async () => {
      setupSuccessfulAuth();
      mockGetAlerts.mockResolvedValue([mockAcknowledgedEvent]);

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
        status: 'acknowledged',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockGetAlerts).toHaveBeenCalledWith(
        mockParcelle.id,
        'acknowledged',
        expect.anything()
      );
      expect(data.data.alerts[0].status).toBe('acknowledged');
    });

    it('should reject invalid status values', async () => {
      setupSuccessfulAuth();

      const request = createMockRequest({
        parcelleId: mockParcelle.id,
        status: 'invalid-status',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const request = createMockRequest({ parcelleId: mockParcelle.id });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Authorization', () => {
    it('should allow admin to access any parcelle', async () => {
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

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnValue(profileQuery) };
        }
        return {};
      });

      mockGetAlerts.mockResolvedValue([]);

      const request = createMockRequest({ parcelleId: mockParcelle.id });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should allow certification_auditor to access any parcelle', async () => {
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

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnValue(profileQuery) };
        }
        return {};
      });

      mockGetAlerts.mockResolvedValue([]);

      const request = createMockRequest({ parcelleId: mockParcelle.id });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should allow cooperative_manager to access parcelles in their cooperative', async () => {
      setupSuccessfulAuth();
      mockGetAlerts.mockResolvedValue([]);

      const request = createMockRequest({ parcelleId: mockParcelle.id });
      const response = await GET(request);

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

      const request = createMockRequest({ parcelleId: mockParcelle.id });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.code).toBe('FORBIDDEN');
    });

    it('should allow planteur to access their own parcelles', async () => {
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

      mockGetAlerts.mockResolvedValue([]);

      const request = createMockRequest({ parcelleId: mockParcelle.id });
      const response = await GET(request);

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

      const request = createMockRequest({ parcelleId: mockParcelle.id });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.code).toBe('FORBIDDEN');
    });
  });

  describe('Validation', () => {
    it('should reject missing parcelleId', async () => {
      const request = createMockRequest({});
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid parcelleId format', async () => {
      const request = createMockRequest({ parcelleId: 'invalid-uuid' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('Invalid parcelle ID format');
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      setupSuccessfulAuth();
      mockGetAlerts.mockRejectedValue(new Error('Database connection failed'));

      const request = createMockRequest({ parcelleId: mockParcelle.id });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.code).toBe('RETRIEVAL_ERROR');
    });

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

      const request = createMockRequest({ parcelleId: '550e8400-e29b-41d4-a716-446655440099' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Parcelle not found');
    });
  });
});
