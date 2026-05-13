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

// Mock useOnlineStatus hook
vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(() => ({
    isOnline: true,
    isOffline: false,
  })),
}));

// Import the mocked hook for manipulation in tests
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
const mockUseOnlineStatus = useOnlineStatus as ReturnType<typeof vi.fn>;

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
    
    // Reset online status to default (online)
    mockUseOnlineStatus.mockReturnValue({
      isOnline: true,
      isOffline: false,
    });
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

  // ==========================================================================
  // Offline Mode Tests
  // ==========================================================================

  describe('Offline Mode', () => {
    it('should prevent calculation when offline', async () => {
      // Mock offline status
      mockUseOnlineStatus.mockReturnValue({
        isOnline: false,
        isOffline: true,
      });

      const { result } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          autoCalculate: false,
        })
      );

      // Trigger calculation
      await result.current.calculate();

      // Should set error and not make API call
      expect(result.current.error).toContain('hors ligne');
      expect(result.current.loading).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should preserve existing NDVI data when going offline', async () => {
      // Start online and fetch data
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

      const { result, rerender } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          autoCalculate: false,
        })
      );

      // Calculate NDVI while online
      await result.current.calculate();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const onlineNDVI = result.current.ndvi;
      expect(onlineNDVI).not.toBeNull();

      // Go offline
      mockUseOnlineStatus.mockReturnValue({
        isOnline: false,
        isOffline: true,
      });

      // Rerender to apply offline status
      rerender();

      // Try to calculate again (should fail but preserve data)
      await result.current.calculate();

      // NDVI data should still be present
      expect(result.current.ndvi).toEqual(onlineNDVI);
      expect(result.current.error).toContain('hors ligne');
    });

    it('should handle network errors gracefully in offline mode', async () => {
      // Mock network error (simulating offline)
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const { result } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          autoCalculate: false,
        })
      );

      // Trigger calculation
      await result.current.calculate();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should show connection error
      expect(result.current.error).toContain('connexion');
    });

    it('should allow calculation when coming back online', async () => {
      // Start offline
      mockUseOnlineStatus.mockReturnValue({
        isOnline: false,
        isOffline: true,
      });

      const { result, rerender } = renderHook(() =>
        useNDVI({
          parcelleId: 'test-parcelle',
          autoCalculate: false,
        })
      );

      // Try to calculate while offline
      await result.current.calculate();
      expect(result.current.error).toContain('hors ligne');
      expect(mockFetch).not.toHaveBeenCalled();

      // Go back online
      mockUseOnlineStatus.mockReturnValue({
        isOnline: true,
        isOffline: false,
      });

      // Mock successful response
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

      // Rerender to apply online status
      rerender();

      // Calculate again (should succeed)
      await result.current.calculate();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have NDVI data and no error
      expect(result.current.ndvi).not.toBeNull();
      expect(result.current.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should show cached data indicator when offline', async () => {
      // Start online and fetch cached data
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

      // Calculate NDVI
      await result.current.calculate();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should indicate data is cached
      expect(result.current.cached).toBe(true);
      expect(result.current.ndvi).not.toBeNull();
    });
  });
});
