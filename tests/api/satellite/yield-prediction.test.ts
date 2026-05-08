/**
 * Integration tests for POST /api/satellite/yield-prediction endpoint
 * 
 * Tests:
 * - Successful yield prediction generation
 * - Authentication requirement
 * - Authorization (user can only access own parcelles)
 * - Request validation
 * - Error handling
 * 
 * Requirements: Task 5.5.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/satellite/yield-prediction/route';
import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { yieldPredictionService } from '@/lib/satellite/services/yield-prediction.service';
import type { YieldPrediction } from '@/lib/satellite/types';

// Mock dependencies
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/satellite/services/yield-prediction.service');

describe('POST /api/satellite/yield-prediction', () => {
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
    geometry: {
      type: 'MultiPolygon',
      coordinates: [[[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]],
    },
    surface_hectares: 5.2,
  };

  const mockPrediction: YieldPrediction = {
    id: '550e8400-e29b-41d4-a716-446655440004',
    parcelleId: '550e8400-e29b-41d4-a716-446655440002',
    predictionDate: new Date('2024-01-15T00:00:00Z'),
    harvestSeason: '2024-Q4',
    predictedYieldKgPerHa: 520.5,
    confidenceLevel: 'high',
    confidenceIntervalLower: 468.45,
    confidenceIntervalUpper: 572.55,
    modelVersion: 'v1.0.0-simple-regression',
    inputFeatures: {
      meanNDVI: 0.75,
      ndviTrend: 0.02,
      historicalYield: [450, 480, 520],
      surfaceHectares: 5.2,
    },
    actualYieldKgPerHa: null,
    createdAt: new Date('2024-01-15T00:00:00Z'),
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
    };

    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockSupabase);
  });

  // ============================================================================
  // Success Cases
  // ============================================================================

  it('should generate yield prediction successfully', async () => {
    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

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
    const parcelleAuthQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: mockParcelle,
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(parcelleAuthQuery);

    // Mock parcelle data query (for geometry and surface)
    const parcelleDataQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: mockParcelle,
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(parcelleDataQuery);

    // Mock yield prediction service
    vi.mocked(yieldPredictionService.predictYield).mockResolvedValue(mockPrediction);

    // Create request
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction', {
      method: 'POST',
      body: JSON.stringify({
        parcelleId: '550e8400-e29b-41d4-a716-446655440002',
        harvestSeason: '2024-Q4',
        historicalYield: [450, 480, 520],
        storePrediction: true,
      }),
    });

    // Call endpoint
    const response = await POST(request);
    const data = await response.json();

    // Assertions
    if (response.status !== 200) {
      console.log('Response data:', data);
    }
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    
    // Check prediction data (dates are serialized as strings in JSON)
    expect(data.data.prediction.id).toBe(mockPrediction.id);
    expect(data.data.prediction.parcelleId).toBe(mockPrediction.parcelleId);
    expect(data.data.prediction.predictedYieldKgPerHa).toBe(mockPrediction.predictedYieldKgPerHa);
    expect(data.data.prediction.confidenceLevel).toBe(mockPrediction.confidenceLevel);
    expect(data.data.prediction.harvestSeason).toBe(mockPrediction.harvestSeason);
    expect(data.data.stored).toBe(true);

    // Verify service was called correctly
    expect(yieldPredictionService.predictYield).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440002',
      mockParcelle.geometry,
      5.2,
      {
        harvestSeason: '2024-Q4',
        historicalYield: [450, 480, 520],
        storePrediction: true,
        supabase: mockSupabase,
      }
    );
  });

  it('should generate prediction with default values when optional fields omitted', async () => {
    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

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
    const parcelleAuthQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: mockParcelle,
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(parcelleAuthQuery);

    // Mock parcelle data query
    const parcelleDataQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: mockParcelle,
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(parcelleDataQuery);

    // Mock yield prediction service
    vi.mocked(yieldPredictionService.predictYield).mockResolvedValue(mockPrediction);

    // Create request with minimal body
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction', {
      method: 'POST',
      body: JSON.stringify({
        parcelleId: '550e8400-e29b-41d4-a716-446655440002',
      }),
    });

    // Call endpoint
    const response = await POST(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify service was called with defaults
    expect(yieldPredictionService.predictYield).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440002',
      mockParcelle.geometry,
      5.2,
      {
        harvestSeason: undefined,
        historicalYield: [],
        storePrediction: true,
        supabase: mockSupabase,
      }
    );
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
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction', {
      method: 'POST',
      body: JSON.stringify({
        parcelleId: '550e8400-e29b-41d4-a716-446655440002',
      }),
    });

    // Call endpoint
    const response = await POST(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.code).toBe('UNAUTHORIZED');
  });

  // ============================================================================
  // Authorization Tests
  // ============================================================================

  it('should return 403 when user does not have access to parcelle', async () => {
    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock profile query
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
    const parcelleAuthQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: mockParcelle,
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(parcelleAuthQuery);

    // Create request
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction', {
      method: 'POST',
      body: JSON.stringify({
        parcelleId: '550e8400-e29b-41d4-a716-446655440002',
      }),
    });

    // Call endpoint
    const response = await POST(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.code).toBe('FORBIDDEN');
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  it('should return 400 when parcelleId is invalid', async () => {
    // Create request with invalid parcelleId
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction', {
      method: 'POST',
      body: JSON.stringify({
        parcelleId: 'invalid-uuid',
      }),
    });

    // Call endpoint
    const response = await POST(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.error).toContain('Invalid parcelle ID format');
  });

  it('should return 400 when harvestSeason format is invalid', async () => {
    // Create request with invalid harvestSeason
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction', {
      method: 'POST',
      body: JSON.stringify({
        parcelleId: '550e8400-e29b-41d4-a716-446655440002',
        harvestSeason: '2024-Q5', // Invalid quarter
      }),
    });

    // Call endpoint
    const response = await POST(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.error).toContain('Invalid harvest season format');
  });

  it('should return 400 when historicalYield contains negative values', async () => {
    // Create request with negative historical yield
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction', {
      method: 'POST',
      body: JSON.stringify({
        parcelleId: '550e8400-e29b-41d4-a716-446655440002',
        historicalYield: [450, -100, 520],
      }),
    });

    // Call endpoint
    const response = await POST(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.error).toContain('Historical yield must be positive');
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  it('should return 404 when parcelle is not found', async () => {
    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

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

    // Mock parcelle query (not found)
    const parcelleAuthQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(parcelleAuthQuery);

    // Create request
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction', {
      method: 'POST',
      body: JSON.stringify({
        parcelleId: '550e8400-e29b-41d4-a716-446655440002',
      }),
    });

    // Call endpoint
    const response = await POST(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.code).toBe('FORBIDDEN');
  });

  it('should return 404 when parcelle has no geometry', async () => {
    // Mock authentication
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

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
    const parcelleAuthQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: mockParcelle,
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(parcelleAuthQuery);

    // Mock parcelle data query (no geometry)
    const parcelleDataQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { ...mockParcelle, geometry: null },
        error: null,
      }),
    };
    mockSupabase.from.mockReturnValueOnce(parcelleDataQuery);

    // Create request
    const request = new NextRequest('http://localhost:3000/api/satellite/yield-prediction', {
      method: 'POST',
      body: JSON.stringify({
        parcelleId: '550e8400-e29b-41d4-a716-446655440002',
      }),
    });

    // Call endpoint
    const response = await POST(request);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.code).toBe('PARCELLE_DATA_NOT_FOUND');
  });
});
