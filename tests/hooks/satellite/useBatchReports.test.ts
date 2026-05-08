/**
 * Unit tests for useBatchReports hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBatchReports } from '@/hooks/satellite/useBatchReports';
import type { ReportOptions } from '@/lib/satellite/types';

// Mock fetch
global.fetch = vi.fn();

describe('useBatchReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockReportOptions: ReportOptions = {
    includeBeforeAfter: true,
    includeNDVITrend: true,
    includeYieldPrediction: false,
    baselineDate: new Date('2020-12-31'),
    language: 'fr',
  };

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useBatchReports());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.progress).toBe(null);
    expect(result.current.zipUrl).toBe(null);
    expect(result.current.reportCount).toBe(null);
  });

  it('should set loading state during report generation', async () => {
    (global.fetch as any).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({
                  success: true,
                  zipUrl: '/storage/reports/batch-123.zip',
                  reportCount: 3,
                }),
              }),
            100
          )
        )
    );

    const { result } = renderHook(() => useBatchReports());

    act(() => {
      result.current.generateBatchReports(
        ['parcelle-1', 'parcelle-2', 'parcelle-3'],
        mockReportOptions
      );
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should update progress during generation', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        zipUrl: '/storage/reports/batch-123.zip',
        reportCount: 3,
      }),
    });

    const { result } = renderHook(() => useBatchReports());

    await act(async () => {
      await result.current.generateBatchReports(
        ['parcelle-1', 'parcelle-2', 'parcelle-3'],
        mockReportOptions
      );
    });

    expect(result.current.progress).toEqual({
      current: 3,
      total: 3,
      percentage: 100,
    });
  });

  it('should set zipUrl and reportCount on success', async () => {
    const mockResponse = {
      success: true,
      zipUrl: '/storage/reports/batch-123.zip',
      reportCount: 5,
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useBatchReports());

    await act(async () => {
      await result.current.generateBatchReports(
        ['p1', 'p2', 'p3', 'p4', 'p5'],
        mockReportOptions
      );
    });

    expect(result.current.zipUrl).toBe(mockResponse.zipUrl);
    expect(result.current.reportCount).toBe(mockResponse.reportCount);
    expect(result.current.error).toBe(null);
  });

  it('should handle API errors', async () => {
    const errorMessage = 'Failed to generate reports';
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ error: errorMessage }),
    });

    const { result } = renderHook(() => useBatchReports());

    await act(async () => {
      await result.current.generateBatchReports(
        ['parcelle-1'],
        mockReportOptions
      );
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe(errorMessage);
    expect(result.current.zipUrl).toBe(null);
  });

  it('should handle network errors', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useBatchReports());

    await act(async () => {
      await result.current.generateBatchReports(
        ['parcelle-1'],
        mockReportOptions
      );
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('Network error');
  });

  it('should call onSuccess callback', async () => {
    const mockResponse = {
      success: true,
      zipUrl: '/storage/reports/batch-123.zip',
      reportCount: 2,
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useBatchReports({ onSuccess }));

    await act(async () => {
      await result.current.generateBatchReports(
        ['parcelle-1', 'parcelle-2'],
        mockReportOptions
      );
    });

    expect(onSuccess).toHaveBeenCalledWith(
      mockResponse.zipUrl,
      mockResponse.reportCount
    );
  });

  it('should call onError callback', async () => {
    const errorMessage = 'Test error';
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ error: errorMessage }),
    });

    const onError = vi.fn();
    const { result } = renderHook(() => useBatchReports({ onError }));

    await act(async () => {
      await result.current.generateBatchReports(['parcelle-1'], mockReportOptions);
    });

    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('should reset state correctly', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        zipUrl: '/storage/reports/batch-123.zip',
        reportCount: 2,
      }),
    });

    const { result } = renderHook(() => useBatchReports());

    await act(async () => {
      await result.current.generateBatchReports(
        ['parcelle-1', 'parcelle-2'],
        mockReportOptions
      );
    });

    expect(result.current.zipUrl).toBeTruthy();

    act(() => {
      result.current.reset();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.progress).toBe(null);
    expect(result.current.zipUrl).toBe(null);
    expect(result.current.reportCount).toBe(null);
  });

  it('should send correct request body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        zipUrl: '/storage/reports/batch-123.zip',
        reportCount: 2,
      }),
    });
    global.fetch = fetchSpy;

    const { result } = renderHook(() => useBatchReports());
    const parcelleIds = ['parcelle-1', 'parcelle-2'];

    await act(async () => {
      await result.current.generateBatchReports(parcelleIds, mockReportOptions);
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/satellite/reports/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parcelleIds,
        options: {
          ...mockReportOptions,
          baselineDate: mockReportOptions.baselineDate.toISOString(),
        },
      }),
    });
  });

  it('should handle empty parcelle array', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        zipUrl: '/storage/reports/batch-123.zip',
        reportCount: 0,
      }),
    });

    const { result } = renderHook(() => useBatchReports());

    await act(async () => {
      await result.current.generateBatchReports([], mockReportOptions);
    });

    expect(result.current.reportCount).toBe(0);
  });
});
