/**
 * Tests for useDeforestation Hook
 * 
 * Tests the deforestation alert management hook including:
 * - Alert fetching
 * - Detection check triggering
 * - Alert acknowledgment
 * - Alert dispute
 * - Summary statistics calculation
 * - Compliance status determination
 * 
 * Requirements: Task 4.6.1
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDeforestation } from '@/hooks/satellite/useDeforestation';
import type { DeforestationEvent } from '@/lib/satellite/types';

// ============================================================================
// Mock Data
// ============================================================================

const mockAlert: DeforestationEvent = {
  id: 'alert-123',
  parcelleId: 'parcelle-456',
  baselineDate: new Date('2020-12-31'),
  detectionDate: new Date('2024-06-15'),
  baselineNDVI: 0.75,
  currentNDVI: 0.42,
  ndviChange: -0.33,
  affectedAreaHectares: 1.2,
  affectedAreaPercent: 15.5,
  status: 'pending',
  acknowledgedBy: null,
  acknowledgedAt: null,
  acknowledgmentNotes: null,
  disputedBy: null,
  disputedAt: null,
  disputeReason: null,
  createdAt: new Date('2024-06-15T10:00:00Z'),
  updatedAt: new Date('2024-06-15T10:00:00Z'),
};

const mockAcknowledgedAlert: DeforestationEvent = {
  ...mockAlert,
  id: 'alert-789',
  status: 'acknowledged',
  acknowledgedBy: 'user-123',
  acknowledgedAt: new Date('2024-06-16T14:30:00Z'),
  acknowledgmentNotes: 'Verified with field visit',
  updatedAt: new Date('2024-06-16T14:30:00Z'),
};

const mockCheckResult = {
  detected: true,
  baselineNDVI: 0.75,
  currentNDVI: 0.42,
  ndviChange: -0.33,
  affectedAreaHectares: 1.2,
  affectedAreaPercent: 15.5,
  alerts: [mockAlert],
  message: 'Deforestation detected: NDVI decreased by 0.3300 (15.5% of parcelle area affected)',
};

// ============================================================================
// Mock fetch
// ============================================================================

global.fetch = vi.fn();

const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

function mockFetchSuccess(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, data }),
  } as Response);
}

function mockFetchError(message: string, status = 500) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Error',
    json: async () => ({ success: false, error: message }),
  } as Response);
}

// ============================================================================
// Tests
// ============================================================================

describe('useDeforestation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Alert Fetching', () => {
    it('should fetch alerts on mount when autoFetch is true', async () => {
      mockFetchSuccess({
        alerts: [mockAlert],
        compliant: false,
        summary: {
          totalAlerts: 1,
          pendingAlerts: 1,
          acknowledgedAlerts: 0,
          disputedAlerts: 0,
        },
      });

      const { result } = renderHook(() =>
        useDeforestation({
          parcelleId: 'parcelle-456',
          autoFetch: true,
        })
      );

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.alerts).toEqual([]);

      // Wait for fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Check results
      expect(result.current.alerts).toHaveLength(1);
      expect(result.current.alerts[0].id).toBe('alert-123');
      expect(result.current.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/satellite/deforestation?parcelleId=parcelle-456'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should not fetch alerts on mount when autoFetch is false', () => {
      const { result } = renderHook(() =>
        useDeforestation({
          parcelleId: 'parcelle-456',
          autoFetch: false,
        })
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.alerts).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should include status filter in query parameters', async () => {
      mockFetchSuccess({
        alerts: [mockAlert],
        compliant: false,
        summary: {
          totalAlerts: 1,
          pendingAlerts: 1,
          acknowledgedAlerts: 0,
          disputedAlerts: 0,
        },
      });

      const { result } = renderHook(() =>
        useDeforestation({
          parcelleId: 'parcelle-456',
          status: 'pending',
          autoFetch: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=pending'),
        expect.any(Object)
      );
    });

    it('should handle fetch errors gracefully', async () => {
      mockFetchError('Failed to fetch alerts', 500);

      const { result } = renderHook(() =>
        useDeforestation({
          parcelleId: 'parcelle-456',
          autoFetch: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to fetch alerts');
      expect(result.current.alerts).toEqual([]);
    });

    it('should manually refetch alerts', async () => {
      mockFetchSuccess({
        alerts: [mockAlert, mockAcknowledgedAlert],
        compliant: false,
        summary: {
          totalAlerts: 2,
          pendingAlerts: 1,
          acknowledgedAlerts: 1,
          disputedAlerts: 0,
        },
      });

      const { result } = renderHook(() =>
        useDeforestation({
          parcelleId: 'parcelle-456',
          autoFetch: false,
        })
      );

      // Manually trigger refetch
      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.alerts).toHaveLength(2);
    });
  });

  describe('Deforestation Detection Check', () => {
    it('should trigger deforestation detection check', async () => {
      // Mock the check API call
      mockFetchSuccess(mockCheckResult);

      // Mock the refetch call (triggered after detection)
      mockFetchSuccess({
        alerts: [mockAlert],
        compliant: false,
        summary: {
          totalAlerts: 1,
          pendingAlerts: 1,
          acknowledgedAlerts: 0,
          disputedAlerts: 0,
        },
      });

      const { result } = renderHook(() =>
        useDeforestation({
          parcelleId: 'parcelle-456',
          autoFetch: false,
        })
      );

      const checkResult = await result.current.checkForDeforestation();

      await waitFor(() => {
        expect(result.current.checking).toBe(false);
      });

      expect(checkResult).toEqual(mockCheckResult);
      expect(result.current.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/satellite/deforestation/check',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('parcelle-456'),
        })
      );
    });

    it('should include baseline and current dates in check request', async () => {
      mockFetchSuccess(mockCheckResult);
      mockFetchSuccess({ alerts: [], compliant: true, summary: {} });

      const { result } = renderHook(() =>
        useDeforestation({
          parcelleId: 'parcelle-456',
          autoFetch: false,
        })
      );

      const baselineDate = new Date('2020-12-31');
      const currentDate = new Date('2024-06-15');

      await result.current.checkForDeforestation({
        baselineDate,
        currentDate,
      });

      await waitFor(() => {
        expect(result.current.checking).toBe(false);
      });

      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.baselineDate).toBe(baselineDate.toISOString());
      expect(requestBody.currentDate).toBe(currentDate.toISOString());
    });

    it('should handle detection check errors', async () => {
      mockFetchError('Insufficient data for analysis', 503);

      const { result } = renderHook(() =>
        useDeforestation({
          parcelleId: 'parcelle-456',
          autoFetch: false,
        })
      );

      const checkResult = await result.current.checkForDeforestation();

      await waitFor(() => {
        expect(result.current.checking).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Insufficient data for analysis');
      });

      expect(checkResult).toBeNull();
    });
  });

  describe('Alert Acknowledgment', () => {
    it('should acknowledge an alert', async () => {
      // Mock initial fetch
      mockFetchSuccess({
        alerts: [mockAlert],
        compliant: false,
        summary: { totalAlerts: 1, pendingAlerts: 1, acknowledgedAlerts: 0, disputedAlerts: 0 },
      });

      // Mock acknowledge API call - return the same alert ID but with acknowledged status
      const acknowledgedVersion = {
        ...mockAlert,
        status: 'acknowledged',
        acknowledgedBy: 'user-123',
        acknowledgedAt: new Date('2024-06-16T14:30:00Z'),
        acknowledgmentNotes: 'Verified with field visit',
        updatedAt: new Date('2024-06-16T14:30:00Z'),
      };

      mockFetchSuccess({
        alert: acknowledgedVersion,
      });

      const { result } = renderHook(() =>
        useDeforestation({
          parcelleId: 'parcelle-456',
          autoFetch: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Acknowledge the alert
      await result.current.acknowledgeAlert('alert-123', 'Verified with field visit');

      await waitFor(() => {
        expect(result.current.updating).toBe(false);
      });

      expect(result.current.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/satellite/deforestation/alert-123',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('acknowledge'),
        })
      );

      // Check that the alert was updated in state
      const updatedAlert = result.current.alerts.find((a) => a.id === 'alert-123');
      expect(updatedAlert?.status).toBe('acknowledged');
    });

    it('should handle acknowledgment errors', async () => {
      mockFetchSuccess({
        alerts: [mockAlert],
        compliant: false,
        summary: { totalAlerts: 1, pendingAlerts: 1, acknowledgedAlerts: 0, disputedAlerts: 0 },
      });

      mockFetchError('Failed to acknowledge alert', 500);

      const { result } = renderHook(() =>
        useDeforestation({
          parcelleId: 'parcelle-456',
          autoFetch: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      try {
        await result.current.acknowledgeAlert('alert-123', 'Test notes');
      } catch (err) {
        // Expected to throw
      }

      await waitFor(() => {
        expect(result.current.updating).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to acknowledge alert');
      });
    });
  });

  describe('Alert Dispute', () => {
    it('should dispute an alert', async () => {
      const mockDisputedAlert: DeforestationEvent = {
        ...mockAlert,
        status: 'disputed',
        disputedBy: 'user-123',
        disputedAt: new Date('2024-06-16T15:00:00Z'),
        disputeReason: 'Cloud cover affected imagery',
        updatedAt: new Date('2024-06-16T15:00:00Z'),
      };

      // Mock initial fetch
      mockFetchSuccess({
        alerts: [mockAlert],
        compliant: false,
        summary: { totalAlerts: 1, pendingAlerts: 1, acknowledgedAlerts: 0, disputedAlerts: 0 },
      });

      // Mock dispute API call
      mockFetchSuccess({
        alert: mockDisputedAlert,
      });

      const { result } = renderHook(() =>
        useDeforestation({
          parcelleId: 'parcelle-456',
          autoFetch: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Dispute the alert
      await result.current.disputeAlert('alert-123', 'Cloud cover affected imagery');

      await waitFor(() => {
        expect(result.current.updating).toBe(false);
      });

      expect(result.current.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/satellite/deforestation/alert-123',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('dispute'),
        })
      );

      // Check that the alert was updated in state
      const updatedAlert = result.current.alerts.find((a) => a.id === 'alert-123');
      expect(updatedAlert?.status).toBe('disputed');
    });

    it('should require reason when disputing', async () => {
      const { result } = renderHook(() =>
        useDeforestation({
          parcelleId: 'parcelle-456',
          autoFetch: false,
        })
      );

      await result.current.disputeAlert('alert-123', '');

      await waitFor(() => {
        expect(result.current.error).toBe('Reason is required when disputing an alert');
      });
    });
  });

  describe('Summary Statistics', () => {
    it('should calculate summary statistics correctly', async () => {
      const alerts = [
        { ...mockAlert, id: 'alert-1', status: 'pending' as const },
        { ...mockAlert, id: 'alert-2', status: 'pending' as const },
        { ...mockAlert, id: 'alert-3', status: 'acknowledged' as const },
        { ...mockAlert, id: 'alert-4', status: 'disputed' as const },
      ];

      mockFetchSuccess({
        alerts,
        compliant: false,
        summary: {
          totalAlerts: 4,
          pendingAlerts: 2,
          acknowledgedAlerts: 1,
          disputedAlerts: 1,
        },
      });

      const { result } = renderHook(() =>
        useDeforestation({
          parcelleId: 'parcelle-456',
          autoFetch: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.summary).toEqual({
        totalAlerts: 4,
        pendingAlerts: 2,
        acknowledgedAlerts: 1,
        disputedAlerts: 1,
      });
    });
  });

  describe('Compliance Status', () => {
    it('should be compliant when no pending or disputed alerts exist', async () => {
      const alerts = [
        { ...mockAlert, id: 'alert-1', status: 'acknowledged' as const },
        { ...mockAlert, id: 'alert-2', status: 'resolved' as const },
      ];

      mockFetchSuccess({
        alerts,
        compliant: true,
        summary: {
          totalAlerts: 2,
          pendingAlerts: 0,
          acknowledgedAlerts: 1,
          disputedAlerts: 0,
        },
      });

      const { result } = renderHook(() =>
        useDeforestation({
          parcelleId: 'parcelle-456',
          autoFetch: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.compliant).toBe(true);
    });

    it('should be non-compliant when pending alerts exist', async () => {
      mockFetchSuccess({
        alerts: [mockAlert],
        compliant: false,
        summary: {
          totalAlerts: 1,
          pendingAlerts: 1,
          acknowledgedAlerts: 0,
          disputedAlerts: 0,
        },
      });

      const { result } = renderHook(() =>
        useDeforestation({
          parcelleId: 'parcelle-456',
          autoFetch: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.compliant).toBe(false);
    });

    it('should be non-compliant when disputed alerts exist', async () => {
      const alerts = [
        { ...mockAlert, id: 'alert-1', status: 'disputed' as const },
      ];

      mockFetchSuccess({
        alerts,
        compliant: false,
        summary: {
          totalAlerts: 1,
          pendingAlerts: 0,
          acknowledgedAlerts: 0,
          disputedAlerts: 1,
        },
      });

      const { result } = renderHook(() =>
        useDeforestation({
          parcelleId: 'parcelle-456',
          autoFetch: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.compliant).toBe(false);
    });
  });
});
