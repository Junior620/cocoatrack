/**
 * Tests for useSatelliteImagery Hook
 * 
 * Tests hook state management, loading states, error handling, and data fetching.
 * 
 * Requirements: Task 2.5.3
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useSatelliteImagery } from '@/hooks/satellite/useSatelliteImagery';
import type { ImageryData } from '@/lib/satellite/types';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock fetch globally
global.fetch = vi.fn();

const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

// Mock imagery result
const mockImageryResult: ImageryData = {
  id: 'imagery-123',
  parcelleId: 'parcelle-456',
  acquisitionDate: new Date('2024-01-15T00:00:00Z'),
  cloudCoverPercent: 12.5,
  satelliteSource: 'sentinel-2',
  tileUrl: 'https://example.com/tiles/imagery-123',
  bounds: [-10.5, 5.2, -10.3, 5.4],
  resolutionMeters: 10,
  createdAt: new Date('2024-01-15T10:30:00Z'),
};

// ============================================================================
// Test Suite
// ============================================================================

describe('useSatelliteImagery Hook', () => {
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
    it('should initialize with null data and no loading state when autoFetch is false', () => {
      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      expect(result.current.imagery).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.cloudCover).toBeNull();
      expect(result.current.acquisitionDate).toBeNull();
      expect(result.current.cached).toBe(false);
      expect(result.current.cacheAge).toBeNull();
    });

    it('should provide a refetch function', () => {
      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      expect(typeof result.current.refetch).toBe('function');
    });
  });

  // ==========================================================================
  // Manual Fetch Tests
  // ==========================================================================

  describe('Manual Fetch', () => {
    it('should successfully fetch imagery when refetch() is called', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          imagery: mockImageryResult,
          cached: false,
        }),
      } as Response);

      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      // Initially no data
      expect(result.current.imagery).toBeNull();
      expect(result.current.loading).toBe(false);

      // Trigger fetch
      await result.current.refetch();

      // Wait for state updates
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.imagery).not.toBeNull();
      });

      // Verify state after fetch
      expect(result.current.imagery).not.toBeNull();
      expect(result.current.imagery?.id).toBe('imagery-123');
      expect(result.current.imagery?.parcelleId).toBe('parcelle-456');
      expect(result.current.cloudCover).toBe(12.5);
      expect(result.current.acquisitionDate).toEqual(new Date('2024-01-15T00:00:00Z'));
      expect(result.current.cached).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should set loading state during fetch', async () => {
      // Mock API response with delay
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({
                  imagery: mockImageryResult,
                  cached: false,
                }),
              } as Response);
            }, 100);
          })
      );

      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      // Trigger fetch
      const refetchPromise = result.current.refetch();

      // Check loading state immediately
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      // Wait for completion
      await refetchPromise;

      // Loading should be false after completion
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should handle API errors gracefully', async () => {
      // Mock API error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          error: 'IMAGERY_UNAVAILABLE',
          message: 'Satellite imagery is unavailable for the requested date',
        }),
      } as Response);

      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      // Trigger fetch
      await result.current.refetch();

      // Wait for state updates
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).not.toBeNull();
      });

      // Verify error state
      expect(result.current.error).not.toBeNull();
      expect(result.current.error).toContain('Satellite imagery is unavailable');
      expect(result.current.imagery).toBeNull();
      expect(result.current.cloudCover).toBeNull();
    });

    it('should handle network errors', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      // Trigger fetch
      await result.current.refetch();

      // Wait for state updates
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).not.toBeNull();
      });

      // Verify error state
      expect(result.current.error).toBe('Network error');
      expect(result.current.imagery).toBeNull();
    });

    it('should validate parcelleId before making request', async () => {
      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: '',
          autoFetch: false,
        })
      );

      // Trigger fetch with empty parcelleId
      await result.current.refetch();

      // Wait for state updates
      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Should set error without making API call
      expect(result.current.error).toBe('Parcelle ID is required');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Automatic Fetch Tests
  // ==========================================================================

  describe('Automatic Fetch', () => {
    it('should automatically fetch imagery when autoFetch is true', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          imagery: mockImageryResult,
          cached: false,
        }),
      } as Response);

      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: true,
        })
      );

      // Wait for automatic fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify data was fetched
      expect(result.current.imagery).not.toBeNull();
      expect(result.current.imagery?.id).toBe('imagery-123');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not fetch automatically when autoFetch is false', async () => {
      renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      // Wait a bit to ensure no automatic call
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify no API call was made
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Query Parameter Tests
  // ==========================================================================

  describe('Query Parameters', () => {
    it('should include date in query when provided', async () => {
      const testDate = new Date('2024-01-15T00:00:00Z');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          imagery: mockImageryResult,
          cached: false,
        }),
      } as Response);

      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          date: testDate,
          autoFetch: false,
        })
      );

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify fetch was called with date in query params
      const callArgs = mockFetch.mock.calls[0];
      const url = callArgs[0] as string;
      expect(url).toContain('date=' + encodeURIComponent(testDate.toISOString()));
    });

    it('should include cloudCoverThreshold in query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          imagery: mockImageryResult,
          cached: false,
        }),
      } as Response);

      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          cloudCoverThreshold: 15,
          autoFetch: false,
        })
      );

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify fetch was called with cloudCoverThreshold
      const callArgs = mockFetch.mock.calls[0];
      const url = callArgs[0] as string;
      expect(url).toContain('cloudCoverThreshold=15');
    });

    it('should use default cloudCoverThreshold of 20 when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          imagery: mockImageryResult,
          cached: false,
        }),
      } as Response);

      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify fetch was called with default threshold
      const callArgs = mockFetch.mock.calls[0];
      const url = callArgs[0] as string;
      expect(url).toContain('cloudCoverThreshold=20');
    });

    it('should include daysOffset in query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          imagery: mockImageryResult,
          cached: false,
        }),
      } as Response);

      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          daysOffset: 45,
          autoFetch: false,
        })
      );

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify fetch was called with daysOffset
      const callArgs = mockFetch.mock.calls[0];
      const url = callArgs[0] as string;
      expect(url).toContain('daysOffset=45');
    });

    it('should use default daysOffset of 30 when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          imagery: mockImageryResult,
          cached: false,
        }),
      } as Response);

      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify fetch was called with default daysOffset
      const callArgs = mockFetch.mock.calls[0];
      const url = callArgs[0] as string;
      expect(url).toContain('daysOffset=30');
    });
  });

  // ==========================================================================
  // Cached Result Tests
  // ==========================================================================

  describe('Cached Results', () => {
    it('should indicate when result is from cache', async () => {
      const cacheAge = 3600000; // 1 hour in milliseconds

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          imagery: mockImageryResult,
          cached: true,
          cacheAge,
        }),
      } as Response);

      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.cached).toBe(true);
      expect(result.current.cacheAge).toBe(cacheAge);
    });

    it('should indicate when result is not from cache', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          imagery: mockImageryResult,
          cached: false,
        }),
      } as Response);

      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.cached).toBe(false);
      expect(result.current.cacheAge).toBeNull();
    });
  });

  // ==========================================================================
  // Cloud Cover Tests
  // ==========================================================================

  describe('Cloud Cover', () => {
    it('should extract cloud cover from imagery result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          imagery: { ...mockImageryResult, cloudCoverPercent: 8.3 },
          cached: false,
        }),
      } as Response);

      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.cloudCover).not.toBeNull();
      });

      expect(result.current.cloudCover).toBe(8.3);
    });

    it('should return null cloud cover when no imagery data', () => {
      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      expect(result.current.cloudCover).toBeNull();
    });
  });

  // ==========================================================================
  // Acquisition Date Tests
  // ==========================================================================

  describe('Acquisition Date', () => {
    it('should extract acquisition date from imagery result', async () => {
      const acquisitionDate = new Date('2024-01-20T12:00:00Z');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          imagery: { ...mockImageryResult, acquisitionDate },
          cached: false,
        }),
      } as Response);

      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.acquisitionDate).not.toBeNull();
      });

      expect(result.current.acquisitionDate).toEqual(acquisitionDate);
    });

    it('should return null acquisition date when no imagery data', () => {
      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      expect(result.current.acquisitionDate).toBeNull();
    });
  });

  // ==========================================================================
  // Date Conversion Tests
  // ==========================================================================

  describe('Date Conversion', () => {
    it('should convert date strings to Date objects', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          imagery: {
            ...mockImageryResult,
            acquisitionDate: '2024-01-15T00:00:00Z',
            createdAt: '2024-01-15T10:30:00Z',
          },
          cached: false,
        }),
      } as Response);

      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.imagery).not.toBeNull();
      });

      expect(result.current.imagery?.acquisitionDate).toBeInstanceOf(Date);
      expect(result.current.imagery?.createdAt).toBeInstanceOf(Date);
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle invalid response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          // Missing imagery field
          cached: false,
        }),
      } as Response);

      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error).not.toBeNull();
      if (result.current.error) {
        expect(result.current.error).toContain('Invalid response format');
      }
      expect(result.current.imagery).toBeNull();
    });

    it('should handle JSON parse errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as Response);

      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error).not.toBeNull();
      if (result.current.error) {
        expect(result.current.error).toContain('Failed to fetch satellite imagery');
      }
    });

    it('should clear previous error on successful refetch', async () => {
      // First call fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          error: 'NOT_FOUND',
          message: 'Imagery not found',
        }),
      } as Response);

      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      // First fetch fails
      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          imagery: mockImageryResult,
          cached: false,
        }),
      } as Response);

      // Refetch
      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Error should be cleared
      expect(result.current.error).toBeNull();
      expect(result.current.imagery).not.toBeNull();
    });
  });

  // ==========================================================================
  // Multiple Refetch Tests
  // ==========================================================================

  describe('Multiple Refetch', () => {
    it('should handle multiple refetch calls', async () => {
      // First fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          imagery: mockImageryResult,
          cached: false,
        }),
      } as Response);

      const { result } = renderHook(() =>
        useSatelliteImagery({
          parcelleId: 'test-parcelle',
          autoFetch: false,
        })
      );

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.imagery).not.toBeNull();
      });

      expect(result.current.imagery?.id).toBe('imagery-123');

      // Second fetch with different data
      const updatedImagery = { ...mockImageryResult, id: 'imagery-456' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          imagery: updatedImagery,
          cached: false,
        }),
      } as Response);

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.imagery?.id).toBe('imagery-456');
      });

      expect(result.current.imagery?.id).toBe('imagery-456');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
