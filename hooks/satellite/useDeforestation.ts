/**
 * useDeforestation Hook
 * 
 * Manages deforestation alert state for a single parcelle.
 * Provides loading, error, and data states with methods to fetch alerts,
 * trigger detection checks, acknowledge alerts, and dispute alerts.
 * 
 * Requirements: Task 4.6.1
 */

import { useState, useEffect, useCallback } from 'react';
import type { DeforestationEvent } from '@/lib/satellite/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Hook options
 */
interface UseDeforestationOptions {
  /** Parcelle ID to fetch deforestation alerts for */
  parcelleId: string;
  /** Optional baseline date for EUDR compliance (defaults to Dec 31, 2020) */
  baselineDate?: Date;
  /** Optional filter by alert status */
  status?: 'pending' | 'acknowledged' | 'disputed' | 'resolved';
  /** Whether to automatically fetch alerts on mount and when dependencies change */
  autoFetch?: boolean;
}

/**
 * Deforestation check result
 */
interface DeforestationCheckResult {
  detected: boolean;
  baselineNDVI: number;
  currentNDVI: number;
  ndviChange: number;
  affectedAreaHectares: number;
  affectedAreaPercent: number;
  alerts: DeforestationEvent[];
  message: string;
}

/**
 * Alert summary statistics
 */
interface AlertSummary {
  totalAlerts: number;
  pendingAlerts: number;
  acknowledgedAlerts: number;
  disputedAlerts: number;
}

/**
 * Hook return value
 */
interface UseDeforestationReturn {
  /** List of deforestation alerts */
  alerts: DeforestationEvent[];
  /** Whether alerts are being fetched */
  loading: boolean;
  /** Error message (null if no error) */
  error: string | null;
  /** Whether the parcelle is EUDR compliant (no pending/disputed alerts) */
  compliant: boolean;
  /** Summary statistics of alerts */
  summary: AlertSummary;
  /** Manually trigger alert fetching */
  refetch: () => Promise<void>;
  /** Trigger deforestation detection check */
  checkForDeforestation: (options?: {
    baselineDate?: Date;
    currentDate?: Date;
  }) => Promise<DeforestationCheckResult | null>;
  /** Acknowledge a deforestation alert */
  acknowledgeAlert: (alertId: string, notes?: string) => Promise<void>;
  /** Dispute a deforestation alert */
  disputeAlert: (alertId: string, reason: string) => Promise<void>;
  /** Whether a detection check is in progress */
  checking: boolean;
  /** Whether an alert update (acknowledge/dispute) is in progress */
  updating: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate summary statistics from alerts
 */
function calculateSummary(alerts: DeforestationEvent[]): AlertSummary {
  return {
    totalAlerts: alerts.length,
    pendingAlerts: alerts.filter((a) => a.status === 'pending').length,
    acknowledgedAlerts: alerts.filter((a) => a.status === 'acknowledged').length,
    disputedAlerts: alerts.filter((a) => a.status === 'disputed').length,
  };
}

/**
 * Determine EUDR compliance status
 * A parcelle is compliant if no pending or disputed alerts exist
 */
function determineCompliance(alerts: DeforestationEvent[]): boolean {
  const pendingOrDisputed = alerts.filter(
    (a) => a.status === 'pending' || a.status === 'disputed'
  );
  return pendingOrDisputed.length === 0;
}

/**
 * Convert database row dates to Date objects
 */
function processAlert(alert: Record<string, unknown>): DeforestationEvent {
  return {
    id: alert.id as string,
    parcelleId: alert.parcelleId as string,
    baselineDate: new Date(alert.baselineDate as string),
    detectionDate: new Date(alert.detectionDate as string),
    baselineNDVI: alert.baselineNDVI as number,
    currentNDVI: alert.currentNDVI as number,
    ndviChange: alert.ndviChange as number,
    affectedAreaHectares: alert.affectedAreaHectares as number,
    affectedAreaPercent: alert.affectedAreaPercent as number,
    status: alert.status as DeforestationEvent['status'],
    acknowledgedBy: alert.acknowledgedBy as string | null,
    acknowledgedAt: alert.acknowledgedAt ? new Date(alert.acknowledgedAt as string) : null,
    acknowledgmentNotes: alert.acknowledgmentNotes as string | null,
    disputedBy: alert.disputedBy as string | null,
    disputedAt: alert.disputedAt ? new Date(alert.disputedAt as string) : null,
    disputeReason: alert.disputeReason as string | null,
    createdAt: new Date(alert.createdAt as string),
    updatedAt: new Date(alert.updatedAt as string),
  };
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * useDeforestation Hook
 * 
 * Fetches and manages deforestation alerts for a parcelle with methods to
 * trigger detection checks, acknowledge alerts, and dispute alerts.
 * 
 * @example
 * ```tsx
 * // Automatic fetch on mount
 * const {
 *   alerts,
 *   loading,
 *   compliant,
 *   checkForDeforestation,
 *   acknowledgeAlert
 * } = useDeforestation({
 *   parcelleId: 'abc-123',
 *   autoFetch: true,
 * });
 * 
 * // Manual fetch with status filter
 * const { alerts, loading, refetch } = useDeforestation({
 *   parcelleId: 'abc-123',
 *   status: 'pending',
 *   autoFetch: false,
 * });
 * 
 * // Trigger detection check
 * const result = await checkForDeforestation({
 *   baselineDate: new Date('2020-12-31'),
 *   currentDate: new Date(),
 * });
 * 
 * // Acknowledge an alert
 * await acknowledgeAlert('alert-id-123', 'Verified with field visit');
 * 
 * // Dispute an alert
 * await disputeAlert('alert-id-456', 'Cloud cover affected imagery');
 * ```
 */
export function useDeforestation({
  parcelleId,
  baselineDate,
  status,
  autoFetch = false,
}: UseDeforestationOptions): UseDeforestationReturn {
  // State management
  const [alerts, setAlerts] = useState<DeforestationEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch deforestation alerts by calling the API endpoint
   */
  const refetch = useCallback(async () => {
    // Validate parcelleId
    if (!parcelleId) {
      setError('Parcelle ID is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams({
        parcelleId,
      });

      // Add optional status filter
      if (status) {
        params.append('status', status);
      }

      // Call deforestation alerts API
      const response = await fetch(`/api/satellite/deforestation?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error || `Failed to fetch deforestation alerts: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      // Parse response
      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error('Invalid response format from deforestation API');
      }

      // Extract data from response
      const { alerts: alertsData } = result.data;

      // Convert date strings to Date objects
      const processedAlerts: DeforestationEvent[] = alertsData.map(processAlert);

      // Update state
      setAlerts(processedAlerts);
      setError(null);
    } catch (err) {
      // Handle errors
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setAlerts([]);

      // Log error for debugging
      console.error('Error fetching deforestation alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [parcelleId, status]);

  /**
   * Trigger deforestation detection check
   */
  const checkForDeforestation = useCallback(
    async (options?: {
      baselineDate?: Date;
      currentDate?: Date;
    }): Promise<DeforestationCheckResult | null> => {
      // Validate parcelleId
      if (!parcelleId) {
        setError('Parcelle ID is required');
        return null;
      }

      setChecking(true);
      setError(null);

      try {
        // Prepare request body
        const requestBody: {
          parcelleId: string;
          baselineDate?: string;
          currentDate?: string;
        } = {
          parcelleId,
        };

        // Add baseline date if provided (from options or hook options)
        const effectiveBaselineDate = options?.baselineDate || baselineDate;
        if (effectiveBaselineDate) {
          requestBody.baselineDate = effectiveBaselineDate.toISOString();
        }

        // Add current date if provided
        if (options?.currentDate) {
          requestBody.currentDate = options.currentDate.toISOString();
        }

        // Call deforestation check API
        const response = await fetch('/api/satellite/deforestation/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        // Handle non-OK responses
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage =
            errorData.error || `Failed to check for deforestation: ${response.statusText}`;
          throw new Error(errorMessage);
        }

        // Parse response
        const result = await response.json();

        if (!result.success || !result.data) {
          throw new Error('Invalid response format from deforestation check API');
        }

        // Extract data from response
        const checkResult: DeforestationCheckResult = {
          detected: result.data.detected,
          baselineNDVI: result.data.baselineNDVI,
          currentNDVI: result.data.currentNDVI,
          ndviChange: result.data.ndviChange,
          affectedAreaHectares: result.data.affectedAreaHectares,
          affectedAreaPercent: result.data.affectedAreaPercent,
          alerts: result.data.alerts.map(processAlert),
          message: result.data.message,
        };

        // If new alerts were created, refresh the alerts list
        if (checkResult.detected && checkResult.alerts.length > 0) {
          await refetch();
        }

        setError(null);
        return checkResult;
      } catch (err) {
        // Handle errors
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);

        // Log error for debugging
        console.error('Error checking for deforestation:', err);
        return null;
      } finally {
        setChecking(false);
      }
    },
    [parcelleId, baselineDate, refetch]
  );

  /**
   * Acknowledge a deforestation alert
   */
  const acknowledgeAlert = useCallback(
    async (alertId: string, notes?: string): Promise<void> => {
      // Validate alertId
      if (!alertId) {
        setError('Alert ID is required');
        return;
      }

      setUpdating(true);
      setError(null);

      try {
        // Prepare request body
        const requestBody: {
          action: 'acknowledge';
          notes?: string;
        } = {
          action: 'acknowledge',
        };

        // Add notes if provided
        if (notes) {
          requestBody.notes = notes;
        }

        // Call alert update API
        const response = await fetch(`/api/satellite/deforestation/${alertId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        // Handle non-OK responses
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage =
            errorData.error || `Failed to acknowledge alert: ${response.statusText}`;
          throw new Error(errorMessage);
        }

        // Parse response
        const result = await response.json();

        if (!result.success || !result.data) {
          throw new Error('Invalid response format from alert update API');
        }

        // Update the alert in the local state
        const updatedAlert = processAlert(result.data.alert);
        setAlerts((prevAlerts) =>
          prevAlerts.map((alert) => (alert.id === alertId ? updatedAlert : alert))
        );

        setError(null);
      } catch (err) {
        // Handle errors
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);

        // Log error for debugging
        console.error('Error acknowledging alert:', err);
        throw err; // Re-throw to allow caller to handle
      } finally {
        setUpdating(false);
      }
    },
    []
  );

  /**
   * Dispute a deforestation alert
   */
  const disputeAlert = useCallback(
    async (alertId: string, reason: string): Promise<void> => {
      // Validate alertId and reason
      if (!alertId) {
        setError('Alert ID is required');
        return;
      }

      if (!reason || reason.trim() === '') {
        setError('Reason is required when disputing an alert');
        return;
      }

      setUpdating(true);
      setError(null);

      try {
        // Prepare request body
        const requestBody = {
          action: 'dispute' as const,
          reason,
        };

        // Call alert update API
        const response = await fetch(`/api/satellite/deforestation/${alertId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        // Handle non-OK responses
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage =
            errorData.error || `Failed to dispute alert: ${response.statusText}`;
          throw new Error(errorMessage);
        }

        // Parse response
        const result = await response.json();

        if (!result.success || !result.data) {
          throw new Error('Invalid response format from alert update API');
        }

        // Update the alert in the local state
        const updatedAlert = processAlert(result.data.alert);
        setAlerts((prevAlerts) =>
          prevAlerts.map((alert) => (alert.id === alertId ? updatedAlert : alert))
        );

        setError(null);
      } catch (err) {
        // Handle errors
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);

        // Log error for debugging
        console.error('Error disputing alert:', err);
        throw err; // Re-throw to allow caller to handle
      } finally {
        setUpdating(false);
      }
    },
    []
  );

  /**
   * Auto-fetch alerts when autoFetch is enabled
   */
  useEffect(() => {
    if (autoFetch && parcelleId) {
      refetch();
    }
  }, [autoFetch, refetch, parcelleId]);

  /**
   * Calculate summary statistics and compliance status
   */
  const summary = calculateSummary(alerts);
  const compliant = determineCompliance(alerts);

  return {
    alerts,
    loading,
    error,
    compliant,
    summary,
    refetch,
    checkForDeforestation,
    acknowledgeAlert,
    disputeAlert,
    checking,
    updating,
  };
}
