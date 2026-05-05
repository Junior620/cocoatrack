/**
 * Tests for useNDVI Hook
 * 
 * Tests hook state management, loading states, error handling, and data fetching.
 * 
 * Requirements: Task 2.5.3
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useNDVI } from '@/hooks/satellite/useNDVI';
import type { NDVIResult } from '@/lib/satellite/types';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock fetch globally
global.fetch = vi.fn();

const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

// Mock NDVI result
const mockNDVIResult: NDVIResult = {
  id: 'ndvi-123',
  parcelleId: 'parcelle-456',
  imageryId: 'imagery-789',
  calculationDate: new Date('2024-01-15T00:00:00Z'),
  meanNDVI: 0.65,
  minNDVI: 0.45,
  maxNDVI: 0.85,
  stdDevNDVI: 0.12,
  healthStatus: 'good',
  ndviRasterUrl: 'https://example.com/raster.tif',
  createdAt: new Date('2024-01-15T10:30:00Z'),
};

// ============================================================================
// Test Suite
// ============================================================================

describe('useNDVI Hook', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset fetch mock
    mockFetch.mockReset();
  });

  // ==========================================================================
  // Initial State Tests
  // ==========================================================================

  describe('Initial State', () => {
    it('should initialize with null data and no loading state when autoCalculate is false', () => {
      const { result } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          autoCalculate: false,
        })
      );

      expect(result.current.ndvi).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.healthStatus).toBeNull();
      expect(result.current.cached).toBe(false);
      expect(result.current.recommendation).toBeNull();
    });

    it('should provide a calculate function', () => {
      const { result } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          autoCalculate: false,
        })
      );

      expect(typeof result.current.calculate).toBe('function');
    });
  });

  // ==========================================================================
  // Manual Calculation Tests
  // ==========================================================================

  describe('Manual Calculation', () => {
    it('should successfully calculate NDVI when calculate() is called', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ndvi: mockNDVIResult,
            cached: false,
            recommendation: 'Vegetation health is good. Continue current practices.',
          },
        }),
      } as Response);

      const { result } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          autoCalculate: false,
        })
      );

      // Initially no data
      expect(result.current.ndvi).toBeNull();
      expect(result.current.loading).toBe(false);

      // Trigger calculation
      await result.current.calculate();

      // Wait for state updates
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify state after calculation
      expect(result.current.ndvi).not.toBeNull();
      expect(result.current.ndvi?.id).toBe('ndvi-123');
      expect(result.current.ndvi?.meanNDVI).toBe(0.65);
      expect(result.current.healthStatus).toBe('good');
      expect(result.current.cached).toBe(false);
      expect(result.current.recommendation).toContain('good');
      expect(result.current.error).toBeNull();
    });

    it('should set loading state during calculation', async () => {
      // Mock API response with delay
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({
                  success: true,
                  data: {
                    ndvi: mockNDVIResult,
                    cached: false,
                    recommendation: 'Good health',
                  },
                }),
              } as Response);
            }, 100);
          })
      );

      const { result } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          autoCalculate: false,
        })
      );

      // Trigger calculation
      const calculatePromise = result.current.calculate();

      // Check loading state immediately
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      // Wait for completion
      await calculatePromise;

      // Loading should be false after completion
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should handle API errors gracefully', async () => {
      // Mock API error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({
          success: false,
          error: 'Failed to calculate NDVI',
          code: 'CALCULATION_ERROR',
        }),
      } as Response);

      const { result } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          autoCalculate: false,
        })
      );

      // Trigger calculation
      await result.current.calculate();

      // Wait for state updates
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify error state
      expect(result.current.error).not.toBeNull();
      expect(result.current.error).toContain('Failed to calculate NDVI');
      expect(result.current.ndvi).toBeNull();
      expect(result.current.healthStatus).toBeNull();
    });

    it('should handle network errors', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          autoCalculate: false,
        })
      );

      // Trigger calculation
      await result.current.calculate();

      // Wait for state updates
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify error state
      expect(result.current.error).toBe('Network error');
      expect(result.current.ndvi).toBeNull();
    });

    it('should validate parcelleId before making request', async () => {
      const { result } = renderHook(() =>
        useNDVI({
          parcelleId: '',
          autoCalculate: false,
        })
      );

      // Trigger calculation with empty parcelleId
      await result.current.calculate();

      // Should set error without making API call
      expect(result.current.error).toBe('Parcelle ID is required');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Automatic Calculation Tests
  // ==========================================================================

  describe('Automatic Calculation', () => {
    it('should automatically calculate NDVI when autoCalculate is true', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ndvi: mockNDVIResult,
            cached: false,
            recommendation: 'Good health',
          },
        }),
      } as Response);

      const { result } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          autoCalculate: true,
        })
      );

      // Wait for automatic calculation to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify data was fetched
      expect(result.current.ndvi).not.toBeNull();
      expect(result.current.ndvi?.id).toBe('ndvi-123');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not calculate automatically when autoCalculate is false', async () => {
      renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          autoCalculate: false,
        })
      );

      // Wait a bit to ensure no automatic call
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify no API call was made
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Date Parameter Tests
  // ==========================================================================

  describe('Date Parameter', () => {
    it('should include date in request when provided', async () => {
      const testDate = new Date('2024-01-15T00:00:00Z');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ndvi: mockNDVIResult,
            cached: false,
            recommendation: 'Good health',
          },
        }),
      } as Response);

      const { result } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          date: testDate,
          autoCalculate: false,
        })
      );

      await result.current.calculate();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify fetch was called with date
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/satellite/ndvi',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(testDate.toISOString()),
        })
      );
    });

    it('should not include date in request when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ndvi: mockNDVIResult,
            cached: false,
            recommendation: 'Good health',
          },
        }),
      } as Response);

      const { result } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          autoCalculate: false,
        })
      );

      await result.current.calculate();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify fetch was called without date
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]?.body as string);
      expect(requestBody.date).toBeUndefined();
    });
  });

  // ==========================================================================
  // Force Recalculate Tests
  // ==========================================================================

  describe('Force Recalculate', () => {
    it('should include forceRecalculate flag in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ndvi: mockNDVIResult,
            cached: false,
            recommendation: 'Good health',
          },
        }),
      } as Response);

      const { result } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          forceRecalculate: true,
          autoCalculate: false,
        })
      );

      await result.current.calculate();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify fetch was called with forceRecalculate
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1]?.body as string);
      expect(requestBody.forceRecalculate).toBe(true);
    });
  });

  // ==========================================================================
  // Cached Result Tests
  // ==========================================================================

  describe('Cached Results', () => {
    it('should indicate when result is from cache', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ndvi: mockNDVIResult,
            cached: true,
            recommendation: 'Good health',
          },
        }),
      } as Response);

      const { result } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          autoCalculate: false,
        })
      );

      await result.current.calculate();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.cached).toBe(true);
    });

    it('should indicate when result is not from cache', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ndvi: mockNDVIResult,
            cached: false,
            recommendation: 'Good health',
          },
        }),
      } as Response);

      const { result } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          autoCalculate: false,
        })
      );

      await result.current.calculate();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.cached).toBe(false);
    });
  });

  // ==========================================================================
  // Health Status Tests
  // ==========================================================================

  describe('Health Status', () => {
    it('should derive health status from NDVI result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ndvi: { ...mockNDVIResult, healthStatus: 'excellent' },
            cached: false,
            recommendation: 'Excellent health',
          },
        }),
      } as Response);

      const { result } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          autoCalculate: false,
        })
      );

      await result.current.calculate();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.healthStatus).toBe('excellent');
    });

    it('should return null health status when no NDVI data', () => {
      const { result } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          autoCalculate: false,
        })
      );

      expect(result.current.healthStatus).toBeNull();
    });
  });

  // ==========================================================================
  // Recommendation Tests
  // ==========================================================================

  describe('Recommendation', () => {
    it('should include recommendation from API response', async () => {
      const testRecommendation = 'Consider irrigation for improved health';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ndvi: mockNDVIResult,
            cached: false,
            recommendation: testRecommendation,
          },
        }),
      } as Response);

      const { result } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          autoCalculate: false,
        })
      );

      await result.current.calculate();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.recommendation).toBe(testRecommendation);
    });

    it('should handle missing recommendation gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ndvi: mockNDVIResult,
            cached: false,
            // No recommendation provided
          },
        }),
      } as Response);

      const { result } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          autoCalculate: false,
        })
      );

      await result.current.calculate();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.recommendation).toBeNull();
    });
  });
});
