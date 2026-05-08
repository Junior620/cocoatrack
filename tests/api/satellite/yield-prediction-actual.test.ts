/**
 * Integration tests for PATCH /api/satellite/yield-prediction/actual endpoint
 * 
 * Tests:
 * - Successful actual yield update
 * - Authentication requirement
 * - Authorization (user can only update predictions for parcelles they have access to)
 * - Request validation
 * - Error handling
 * 
 * Requirements: Task 5.5.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PATCH } from '@/app/api/satellite/yield-prediction/actual/route';
import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Mock dependencies
vi.mock('@/lib/supabase/server');

describe('PATCH /api/satellite/yield-prediction/actual', () => {
  // Mock data with valid UUIDs
  const mockUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
  };

  const mockProfile = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    role: 'cooperative_manager',
    cooperative_id: '550e8400-e29b-41d4-a716-446655440001',
  };

  const mockParcelle = {
    id: '550e8400-e29b-41d4-a716-446655440002',
    planteur_id: '550e8400-e29b-41d4-a716-446655440003',
    cooperative_id: '550e8400-e29b-41d4-a716-446655440001',
  };

  const mockPrediction = {
    id: '550e8400-e29b-41d4-a716-446655440004',
    parcelle_id: '550e8400-e29b-41d4-a716-446655440002',
    prediction_date: '2024-01-15T00:00:00Z',
    harvest_season: '2024-Q4',
    predicted_yield_kg_per_ha: 520.5,
    confidence_level: 'high',
    confidence_interval_lower: 468.45,
    confidence_interval_upper: 572.55,
    model_version: 'v1.0.0-simple-regression',
    input_features: {
      meanNDVI: 0.75,
      ndviTrend: 0.02,
      historicalYield: [450, 480, 520],
      surfaceHectares: 5.2,
    },
    actual_yield_kg_per_ha: null,
    created_at: '2024-01-15T00:00:00Z',
  };

  const mockUpdatedPrediction = {
    ...mockPrediction,
    actual_yield_kg_per_ha: 530.0,
  };

  let mockSupabase: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(),
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };

    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockSupabase);
  });

  // ============================================================================
  // Success Cases
  // ============================================================================

  it('should update actual yield successfully', async () => {
    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock prediction query (for access check)
    const predictionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { parcelle_id: mockParcelle.id },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(predictionQuery);

    // Mock profile query
    const profileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(profileQuery);

    // Mock parcelle query (for authorization)
    const parcelleQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: mockParcelle,
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(parcelleQuery);

    // Mock update query
    const updateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockUpdatedPrediction,
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(updateQuery);

    // Create request
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction/actual', {
      method: 'PATCH',
      body: JSON.stringify({
        predictionId: '550e8400-e29b-41d4-a716-446655440004',
        actualYieldKgPerHa: 530.0,
      }),
    });

    // Call endpoint
    const response = await PATCH(request);
    const data = await response.json();

    // Assertions
    if (response.status !== 200) {
      console.log('Response data:', data);
    }
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.prediction.actualYieldKgPerHa).toBe(530.0);
    expect(data.data.prediction.id).toBe(mockPrediction.id);

    // Verify update was called correctly
    expect(updateQuery.update).toHaveBeenCalledWith({
      actual_yield_kg_per_ha: 530.0,
    });
    expect(updateQuery.eq).toHaveBeenCalledWith('id', '550e8400-e29b-41d4-a716-446655440004');
  });

  it('should allow admin to update any prediction', async () => {
    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock prediction query
    const predictionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { parcelle_id: mockParcelle.id },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(predictionQuery);

    // Mock profile query (admin role)
    const profileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { ...mockProfile, role: 'admin' },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(profileQuery);

    // Mock update query
    const updateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockUpdatedPrediction,
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(updateQuery);

    // Create request
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction/actual', {
      method: 'PATCH',
      body: JSON.stringify({
        predictionId: '550e8400-e29b-41d4-a716-446655440004',
        actualYieldKgPerHa: 530.0,
      }),
    });

    // Call endpoint
    const response = await PATCH(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should allow planteur to update their own parcelle prediction', async () => {
    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock prediction query
    const predictionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { parcelle_id: mockParcelle.id },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(predictionQuery);

    // Mock profile query (planteur role)
    const profileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { ...mockProfile, role: 'planteur' },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(profileQuery);

    // Mock parcelle query (planteur owns the parcelle)
    const parcelleQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { ...mockParcelle, planteur_id: mockUser.id },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(parcelleQuery);

    // Mock update query
    const updateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockUpdatedPrediction,
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(updateQuery);

    // Create request
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction/actual', {
      method: 'PATCH',
      body: JSON.stringify({
        predictionId: '550e8400-e29b-41d4-a716-446655440004',
        actualYieldKgPerHa: 530.0,
      }),
    });

    // Call endpoint
    const response = await PATCH(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  // ============================================================================
  // Authentication Tests
  // ============================================================================

  it('should return 401 when user is not authenticated', async () => {
    // Mock authentication failure
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Not authenticated'),
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction/actual', {
      method: 'PATCH',
      body: JSON.stringify({
        predictionId: '550e8400-e29b-41d4-a716-446655440004',
        actualYieldKgPerHa: 530.0,
      }),
    });

    // Call endpoint
    const response = await PATCH(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.code).toBe('UNAUTHORIZED');
  });

  // ============================================================================
  // Authorization Tests
  // ============================================================================

  it('should return 403 when prediction does not exist', async () => {
    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock prediction query (not found)
    const predictionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(predictionQuery);

    // Create request
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction/actual', {
      method: 'PATCH',
      body: JSON.stringify({
        predictionId: '550e8400-e29b-41d4-a716-446655440004',
        actualYieldKgPerHa: 530.0,
      }),
    });

    // Call endpoint
    const response = await PATCH(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.code).toBe('FORBIDDEN');
    expect(data.error).toContain('Prediction not found');
  });

  it('should return 403 when user does not have access to parcelle', async () => {
    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock prediction query
    const predictionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { parcelle_id: mockParcelle.id },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(predictionQuery);

    // Mock profile query (different cooperative)
    const profileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { ...mockProfile, cooperative_id: 'different-coop' },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(profileQuery);

    // Mock parcelle query (different cooperative)
    const parcelleQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: mockParcelle,
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(parcelleQuery);

    // Create request
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction/actual', {
      method: 'PATCH',
      body: JSON.stringify({
        predictionId: '550e8400-e29b-41d4-a716-446655440004',
        actualYieldKgPerHa: 530.0,
      }),
    });

    // Call endpoint
    const response = await PATCH(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.code).toBe('FORBIDDEN');
  });

  it('should return 403 when planteur does not own the parcelle', async () => {
    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock prediction query
    const predictionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { parcelle_id: mockParcelle.id },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(predictionQuery);

    // Mock profile query (planteur role)
    const profileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { ...mockProfile, role: 'planteur' },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(profileQuery);

    // Mock parcelle query (different planteur)
    const parcelleQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { ...mockParcelle, planteur_id: 'different-planteur-id' },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(parcelleQuery);

    // Create request
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction/actual', {
      method: 'PATCH',
      body: JSON.stringify({
        predictionId: '550e8400-e29b-41d4-a716-446655440004',
        actualYieldKgPerHa: 530.0,
      }),
    });

    // Call endpoint
    const response = await PATCH(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.code).toBe('FORBIDDEN');
    expect(data.error).toContain('You do not own this parcelle');
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  it('should return 400 when predictionId is invalid', async () => {
    // Create request with invalid predictionId
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction/actual', {
      method: 'PATCH',
      body: JSON.stringify({
        predictionId: 'invalid-uuid',
        actualYieldKgPerHa: 530.0,
      }),
    });

    // Call endpoint
    const response = await PATCH(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.error).toContain('Invalid prediction ID format');
  });

  it('should return 400 when actualYieldKgPerHa is missing', async () => {
    // Create request without actualYieldKgPerHa
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction/actual', {
      method: 'PATCH',
      body: JSON.stringify({
        predictionId: '550e8400-e29b-41d4-a716-446655440004',
      }),
    });

    // Call endpoint
    const response = await PATCH(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when actualYieldKgPerHa is negative', async () => {
    // Create request with negative actualYieldKgPerHa
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction/actual', {
      method: 'PATCH',
      body: JSON.stringify({
        predictionId: '550e8400-e29b-41d4-a716-446655440004',
        actualYieldKgPerHa: -100,
      }),
    });

    // Call endpoint
    const response = await PATCH(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.error).toContain('Actual yield must be positive');
  });

  it('should return 400 when actualYieldKgPerHa is zero', async () => {
    // Create request with zero actualYieldKgPerHa
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction/actual', {
      method: 'PATCH',
      body: JSON.stringify({
        predictionId: '550e8400-e29b-41d4-a716-446655440004',
        actualYieldKgPerHa: 0,
      }),
    });

    // Call endpoint
    const response = await PATCH(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.error).toContain('Actual yield must be positive');
  });

  it('should return 400 when actualYieldKgPerHa is not a number', async () => {
    // Create request with string actualYieldKgPerHa
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction/actual', {
      method: 'PATCH',
      body: JSON.stringify({
        predictionId: '550e8400-e29b-41d4-a716-446655440004',
        actualYieldKgPerHa: 'not-a-number',
      }),
    });

    // Call endpoint
    const response = await PATCH(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  it('should return 500 when database update fails', async () => {
    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock prediction query
    const predictionQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { parcelle_id: mockParcelle.id },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(predictionQuery);

    // Mock profile query
    const profileQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(profileQuery);

    // Mock parcelle query
    const parcelleQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: mockParcelle,
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(parcelleQuery);

    // Mock update query (database error)
    const updateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      }),
    };
    mockSupabase.from.mockReturnValueOnce(updateQuery);

    // Create request
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction/actual', {
      method: 'PATCH',
      body: JSON.stringify({
        predictionId: '550e8400-e29b-41d4-a716-446655440004',
        actualYieldKgPerHa: 530.0,
      }),
    });

    // Call endpoint
    const response = await PATCH(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.code).toBe('UPDATE_ERROR');
    expect(data.error).toContain('Failed to update actual yield');
  });
});
