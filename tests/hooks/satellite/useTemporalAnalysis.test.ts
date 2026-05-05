/**
 * Tests for useTemporalAnalysis Hook
 * 
 * Requirements: Task 3.5.2
 * - Test temporal data fetching
 * - Test date selection
 * - Test change calculation
 */

import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTemporalAnalysis } from '@/hooks/satellite/useTemporalAnalysis';
import type { TemporalDataPoint } from '@/lib/satellite/types';

// Mock fetch globally
global.fetch = vi.fn();

const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

describe('useTemporalAnalysis', () => {
  const mockParcelleId = 'test-parcelle-123';
  const mockStartDate = new Date('2024-01-01');
  const mockEndDate = new Date('2024-12-31');

  // Mock temporal data response
  const mockTemporalData = {
    success: true,
    data: {
      parcelleId: mockParcelleId,
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: '2024-12-31T00:00:00.000Z',
      interval: 'monthly',
      summary: {
        timeline: [
          {
            date: '2024-01-01T00:00:00.000Z',
            ndvi: 0.6,
            cloudCover: 15,
            healthStatus: 'good',
            hasSignificantChange: false,
          },
          {
            date: '2024-02-01T00:00:00.000Z',
            ndvi: 0.65,
            cloudCover: 10,
            healthStatus: 'good',
            hasSignificantChange: false,
          },
          {
            date: '2024-03-01T00:00:00.000Z',
            ndvi: 0.5,
            cloudCover: 20,
            healthStatus: 'fair',
            hasSignificantChange: true,
          },
          {
            date: '2024-04-01T00:00:00.000Z',
            ndvi: 0.7,
            cloudCover: 5,
            healthStatus: 'excellent',
            hasSignificantChange: true,
          },
        ],
        trend: {
          trend: 'improving',
          changeRate: 0.02,
          dataPoints: 4,
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-04-01T00:00:00.000Z',
          startNDVI: 0.6,
          endNDVI: 0.7,
        },
        significantChanges: 2,
        averageNDVI: 0.6125,
        averageCloudCover: 12.5,
      },
    },
    cached: false,
  };

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockTemporalData,
    });
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'monthly',
          autoFetch: false,
        })
      );

      expect(result.current.timeline).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.selectedDate).toBe(null);
      expect(result.current.ndviChange).toBe(0);
      expect(result.current.trend).toBe(null);
      expect(result.current.significantChanges).toBe(0);
      expect(result.current.averageNDVI).toBe(0);
      expect(result.current.averageCloudCover).toBe(0);
      expect(result.current.cached).toBe(false);
      expect(result.current.cachedAt).toBe(null);
      expect(result.current.selectedDataPoint).toBe(null);
    });

    it('should not fetch data when autoFetch is false', () => {
      renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'monthly',
          autoFetch: false,
        })
      );

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch data automatically when autoFetch is true', async () => {
      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'monthly',
          autoFetch: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/satellite/temporal'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });

  describe('Temporal Data Fetching', () => {
    it('should fetch temporal data successfully', async () => {
      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'monthly',
          autoFetch: false,
        })
      );

      // Trigger manual fetch
      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify timeline data
      expect(result.current.timeline).toHaveLength(4);
      expect(result.current.timeline[0].ndvi).toBe(0.6);
      expect(result.current.timeline[0].healthStatus).toBe('good');
      expect(result.current.timeline[0].date).toBeInstanceOf(Date);

      // Verify trend data
      expect(result.current.trend).not.toBe(null);
      expect(result.current.trend?.trend).toBe('improving');
      expect(result.current.trend?.changeRate).toBe(0.02);
      expect(result.current.trend?.dataPoints).toBe(4);

      // Verify statistics
      expect(result.current.significantChanges).toBe(2);
      expect(result.current.averageNDVI).toBe(0.6125);
      expect(result.current.averageCloudCover).toBe(12.5);

      // Verify no error
      expect(result.current.error).toBe(null);
    });

    it('should build correct API URL with query parameters', async () => {
      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'weekly',
          autoFetch: false,
        })
      );

      await act(async () => {
        await result.current.refetch();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('parcelleId=test-parcelle-123'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('startDate=2024-01-01'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('endDate=2024-12-31'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('interval=weekly'),
        expect.any(Object)
      );
    });

    it('should handle API errors gracefully', async () => {
      const errorMessage = 'Failed to fetch temporal data';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: async () => ({ error: errorMessage }),
      } as Response);

      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'monthly',
          autoFetch: false,
        })
      );

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.timeline).toEqual([]);
      expect(result.current.trend).toBe(null);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'monthly',
          autoFetch: false,
        })
      );

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.timeline).toEqual([]);
    });

    it('should validate required parameters', async () => {
      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: '',
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'monthly',
          autoFetch: false,
        })
      );

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBe('Parcelle ID is required');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should validate date range', async () => {
      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockEndDate, // End date as start
          endDate: mockStartDate, // Start date as end (invalid)
          interval: 'monthly',
          autoFetch: false,
        })
      );

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBe('Start date must be before or equal to end date');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle cached data', async () => {
      const cachedResponse = {
        ...mockTemporalData,
        cached: true,
        cachedAt: '2024-05-01T12:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => cachedResponse,
      } as Response);

      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'monthly',
          autoFetch: false,
        })
      );

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.cached).toBe(true);
      expect(result.current.cachedAt).toBeInstanceOf(Date);
      expect(result.current.cachedAt?.toISOString()).toBe('2024-05-01T12:00:00.000Z');
    });
  });

  describe('Date Selection', () => {
    it('should auto-select the most recent date after fetching', async () => {
      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'monthly',
          autoFetch: false,
        })
      );

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should auto-select the last date in timeline
      expect(result.current.selectedDate).not.toBe(null);
      expect(result.current.selectedDate?.toISOString()).toBe('2024-04-01T00:00:00.000Z');
    });

    it('should allow manual date selection', async () => {
      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'monthly',
          autoFetch: false,
        })
      );

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Select a specific date
      const targetDate = new Date('2024-02-01T00:00:00.000Z');
      act(() => {
        result.current.setSelectedDate(targetDate);
      });

      expect(result.current.selectedDate?.toISOString()).toBe(targetDate.toISOString());
    });

    it('should return selected data point details', async () => {
      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'monthly',
          autoFetch: false,
        })
      );

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Select a specific date
      const targetDate = new Date('2024-03-01T00:00:00.000Z');
      act(() => {
        result.current.setSelectedDate(targetDate);
      });

      // Verify selected data point
      expect(result.current.selectedDataPoint).not.toBe(null);
      expect(result.current.selectedDataPoint?.ndvi).toBe(0.5);
      expect(result.current.selectedDataPoint?.healthStatus).toBe('fair');
      expect(result.current.selectedDataPoint?.hasSignificantChange).toBe(true);
    });

    it('should return null for selectedDataPoint when no date is selected', async () => {
      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'monthly',
          autoFetch: false,
        })
      );

      expect(result.current.selectedDataPoint).toBe(null);
    });
  });

  describe('NDVI Change Calculation', () => {
    it('should calculate NDVI change from baseline', async () => {
      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'monthly',
          autoFetch: false,
        })
      );

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Select the last date (NDVI = 0.7)
      // Baseline is first date (NDVI = 0.6)
      // Change = ((0.7 - 0.6) / 0.6) * 100 = 16.67%
      const targetDate = new Date('2024-04-01T00:00:00.000Z');
      act(() => {
        result.current.setSelectedDate(targetDate);
      });

      expect(result.current.ndviChange).toBeCloseTo(16.67, 1);
    });

    it('should calculate negative NDVI change', async () => {
      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'monthly',
          autoFetch: false,
        })
      );

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Select date with lower NDVI (0.5)
      // Baseline is first date (NDVI = 0.6)
      // Change = ((0.5 - 0.6) / 0.6) * 100 = -16.67%
      const targetDate = new Date('2024-03-01T00:00:00.000Z');
      act(() => {
        result.current.setSelectedDate(targetDate);
      });

      expect(result.current.ndviChange).toBeCloseTo(-16.67, 1);
    });

    it('should return 0 when no date is selected', async () => {
      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'monthly',
          autoFetch: false,
        })
      );

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Clear selected date
      act(() => {
        result.current.setSelectedDate(null as any);
      });

      expect(result.current.ndviChange).toBe(0);
    });

    it('should return 0 when timeline is empty', () => {
      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'monthly',
          autoFetch: false,
        })
      );

      expect(result.current.ndviChange).toBe(0);
    });
  });

  describe('Loading States', () => {
    it('should set loading to true during fetch', async () => {
      let resolvePromise: (value: any) => void;
      const fetchPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(fetchPromise);

      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'monthly',
          autoFetch: false,
        })
      );

      act(() => {
        result.current.refetch();
      });

      // Should be loading
      expect(result.current.loading).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolvePromise!({
          ok: true,
          json: async () => mockTemporalData,
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should set loading to false after successful fetch', async () => {
      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'monthly',
          autoFetch: false,
        })
      );

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should set loading to false after error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useTemporalAnalysis({
          parcelleId: mockParcelleId,
          startDate: mockStartDate,
          endDate: mockEndDate,
          interval: 'monthly',
          autoFetch: false,
        })
      );

      await act(async () => {
        await result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });
});
