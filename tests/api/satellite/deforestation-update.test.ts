/**
 * Integration tests for PATCH /api/satellite/deforestation/:alertId endpoint
 * 
 * Tests:
 * - Successful alert acknowledgment
 * - Successful alert dispute
 * - Authentication requirement
 * - Authorization (user can only update alerts for accessible parcelles)
 * - Validation errors
 * - Audit logging
 * 
 * Requirements: Task 4.2.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH } from '@/app/api/satellite/deforestation/[alertId]/route';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { deforestationService } from '@/lib/satellite/services/deforestation.service';

// Mock dependencies
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/satellite/services/deforestation.service');

// ============================================================================
// Helper Functions
// ============================================================================

function createRequest(body: unknown, alertId: string = '123e4567-e89b-12d3-a456-426614174000', headers?: Record<string, string>): NextRequest {
  return new NextRequest(`http://localhost:3000/api/satellite/deforestation/${alertId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '192.168.1.1',
      'user-agent': 'Mozilla/5.0',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/satellite/deforestation/:alertId', () => {
  let mockSupabase: any;
  let mockUser: any;
  let mockAlert: any;
  let mockParcelle: any;
  let mockProfile: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock user
    mockUser = {
      id: 'user-123',
      email: 'manager@example.com',
    };

    // Mock alert
    mockAlert = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      parcelle_id: 'parcelle-789',
      baseline_date: '2020-12-31T00:00:00Z',
      detection_date: '2024-05-01T00:00:00Z',
      baseline_ndvi: 0.75,
      current_ndvi: 0.40,
      ndvi_change: -0.35,
      affected_area_hectares: 1.5,
      affected_area_percent: 30.0,
      status: 'pending',
      acknowledged_by: null,
      acknowledged_at: null,
      acknowledgment_notes: null,
      disputed_by: null,
      disputed_at: null,
      dispute_reason: null,
      created_at: '2024-05-01T10:00:00Z',
      updated_at: '2024-05-01T10:00:00Z',
    };

    // Mock parcelle
    mockParcelle = {
      id: 'parcelle-789',
      planteur_id: 'planteur-123',
      cooperative_id: 'coop-456',
    };

    // Mock profile
    mockProfile = {
      id: 'user-123',
      role: 'cooperative_manager',
      cooperative_id: 'coop-456',
    };

    // Mock Supabase client
    mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'deforestation_events') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockAlert,
              error: null,
            }),
          };
        }
        if (table === 'parcelles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockParcelle,
              error: null,
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          };
        }
        if (table === 'satellite_audit_logs') {
          return {
            insert: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        };
      }),
    };

    (createServerSupabaseClient as any).mockResolvedValue(mockSupabase);
  });

  describe('Successful Operations', () => {
    it('should acknowledge an alert successfully', async () => {
      // Mock acknowledgeAlert service method
      (deforestationService.acknowledgeAlert as any) = vi.fn().mockResolvedValue(undefined);

      // Mock updated alert retrieval
      const updatedAlert = {
        ...mockAlert,
        status: 'acknowledged',
        acknowledged_by: mockUser.id,
        acknowledged_at: new Date().toISOString(),
        acknowledgment_notes: 'Verified deforestation',
        updated_at: new Date().toISOString(),
      };

      // Setup mock to return different values on subsequent calls
      let callCount = 0;
      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'deforestation_events') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return Promise.resolve({ data: mockAlert, error: null });
              }
              return Promise.resolve({ data: updatedAlert, error: null });
            }),
          };
        }
        if (table === 'parcelles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockParcelle,
              error: null,
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          };
        }
        if (table === 'satellite_audit_logs') {
          return {
            insert: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        };
      });

      const request = createRequest({
        action: 'acknowledge',
        notes: 'Verified deforestation',
      }, '123e4567-e89b-12d3-a456-426614174000');

      const response = await PATCH(request, {
        params: { alertId: '123e4567-e89b-12d3-a456-426614174000' },
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.alert).toBeDefined();
      expect(data.data.alert.status).toBe('acknowledged');
      expect(data.data.alert.acknowledgedBy).toBe(mockUser.id);
      expect(data.data.alert.acknowledgmentNotes).toBe('Verified deforestation');

      // Verify service method was called
      expect(deforestationService.acknowledgeAlert).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        mockUser.id,
        'Verified deforestation',
        mockSupabase
      );
    });

    it('should dispute an alert successfully', async () => {
      // Mock disputeAlert service method
      (deforestationService.disputeAlert as any) = vi.fn().mockResolvedValue(undefined);

      // Mock updated alert retrieval
      const updatedAlert = {
        ...mockAlert,
        status: 'disputed',
        disputed_by: mockUser.id,
        disputed_at: new Date().toISOString(),
        dispute_reason: 'False positive - seasonal leaf drop',
        updated_at: new Date().toISOString(),
      };

      // Setup mock to return different values on subsequent calls
      let callCount = 0;
      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'deforestation_events') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return Promise.resolve({ data: mockAlert, error: null });
              }
              return Promise.resolve({ data: updatedAlert, error: null });
            }),
          };
        }
        if (table === 'parcelles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockParcelle,
              error: null,
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          };
        }
        if (table === 'satellite_audit_logs') {
          return {
            insert: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        };
      });

      const request = createRequest({
        action: 'dispute',
        reason: 'False positive - seasonal leaf drop',
      });

      const response = await PATCH(request, {
        params: { alertId: '123e4567-e89b-12d3-a456-426614174000' },
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.alert).toBeDefined();
      expect(data.data.alert.status).toBe('disputed');
      expect(data.data.alert.disputedBy).toBe(mockUser.id);
      expect(data.data.alert.disputeReason).toBe('False positive - seasonal leaf drop');

      // Verify service method was called
      expect(deforestationService.disputeAlert).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        mockUser.id,
        'False positive - seasonal leaf drop',
        mockSupabase
      );
    });
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const request = createRequest({
        action: 'acknowledge',
        notes: 'Test',
      });

      const response = await PATCH(request, {
        params: { alertId: '123e4567-e89b-12d3-a456-426614174000' },
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Authorization', () => {
    it('should return 403 when user does not have access to the alert', async () => {
      // Mock profile with different cooperative
      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'deforestation_events') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockAlert,
              error: null,
            }),
          };
        }
        if (table === 'parcelles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockParcelle,
              error: null,
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                ...mockProfile,
                cooperative_id: 'different-coop',
              },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        };
      });

      const request = createRequest({
        action: 'acknowledge',
        notes: 'Test',
      });

      const response = await PATCH(request, {
        params: { alertId: '123e4567-e89b-12d3-a456-426614174000' },
      });

      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.code).toBe('FORBIDDEN');
    });
  });

  describe('Validation', () => {
    it('should return 400 when alertId is not a valid UUID', async () => {
      const request = createRequest({
        action: 'acknowledge',
      });

      const response = await PATCH(request, {
        params: { alertId: 'invalid-uuid' },
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when action is invalid', async () => {
      const request = createRequest({
        action: 'invalid-action',
      });

      const response = await PATCH(request, {
        params: { alertId: '123e4567-e89b-12d3-a456-426614174000' },
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when disputing without reason', async () => {
      const request = createRequest({
        action: 'dispute',
        // Missing reason
      });

      const response = await PATCH(request, {
        params: { alertId: '123e4567-e89b-12d3-a456-426614174000' },
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('Reason is required');
    });
  });

  describe('Audit Logging', () => {
    it('should log acknowledgment action in audit log', async () => {
      // Mock acknowledgeAlert service method
      (deforestationService.acknowledgeAlert as any) = vi.fn().mockResolvedValue(undefined);

      const mockInsert = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      // Mock updated alert retrieval
      const updatedAlert = {
        ...mockAlert,
        status: 'acknowledged',
        acknowledged_by: mockUser.id,
        acknowledged_at: new Date().toISOString(),
        acknowledgment_notes: 'Verified',
        updated_at: new Date().toISOString(),
      };

      let callCount = 0;
      mockSupabase.from = vi.fn((table: string) => {
        if (table === 'deforestation_events') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return Promise.resolve({ data: mockAlert, error: null });
              }
              return Promise.resolve({ data: updatedAlert, error: null });
            }),
          };
        }
        if (table === 'parcelles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockParcelle,
              error: null,
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockProfile,
              error: null,
            }),
          };
        }
        if (table === 'satellite_audit_logs') {
          return {
            insert: mockInsert,
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        };
      });

      const request = createRequest({
        action: 'acknowledge',
        notes: 'Verified',
      });

      await PATCH(request, {
        params: { alertId: '123e4567-e89b-12d3-a456-426614174000' },
      });

      // Verify audit log was created
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
          parcelle_id: mockParcelle.id,
          event_type: 'deforestation_acknowledged',
          event_description: expect.stringContaining('acknowledged'),
          event_metadata: expect.objectContaining({
            alert_id: '123e4567-e89b-12d3-a456-426614174000',
            action: 'acknowledge',
            notes: 'Verified',
          }),
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
        })
      );
    });
  });
});
