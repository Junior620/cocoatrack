/**
 * Unit tests for DeforestationService
 * 
 * Tests the deforestation detection algorithm including:
 * - NDVI comparison between baseline and current dates
 * - Threshold validation (NDVI decrease > 0.3, area > 0.5 ha)
 * - Alert creation and management
 * - Edge cases and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeforestationService } from '../../../lib/satellite/services/deforestation.service';
import { ndviService } from '../../../lib/satellite/services/ndvi.service';
import type { NDVIResult } from '../../../lib/satellite/types';
import type { MultiPolygon } from 'geojson';

// Mock the ndviService
vi.mock('../../../lib/satellite/services/ndvi.service', () => ({
  ndviService: {
    getCachedNDVI: vi.fn(),
    calculateNDVI: vi.fn(),
  },
}));

// Mock the imageryService
vi.mock('../../../lib/satellite/services/imagery.service', () => ({
  imageryService: {
    getClosestDate: vi.fn(),
  },
}));

describe('DeforestationService', () => {
  let service: DeforestationService;
  let mockSupabase: any;

  // Sample test data
  const testParcelleId = 'test-parcelle-123';
  const testGeometry: MultiPolygon = {
    type: 'MultiPolygon',
    coordinates: [[[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]],
  };
  const testSurfaceHectares = 5.5;
  const baselineDate = new Date('2020-12-31T00:00:00Z');
  const currentDate = new Date('2024-05-05T00:00:00Z');

  beforeEach(() => {
    service = new DeforestationService();
    
    // Mock Supabase client
    mockSupabase = {
      from: vi.fn(() => mockSupabase),
      insert: vi.fn(() => mockSupabase),
      update: vi.fn(() => mockSupabase),
      select: vi.fn(() => mockSupabase),
      eq: vi.fn(() => mockSupabase),
      order: vi.fn(() => mockSupabase),
      single: vi.fn(() => mockSupabase),
    };

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectDeforestation', () => {
    it('should detect deforestation when NDVI decrease > 0.3 and area > 0.5 ha', async () => {
      // Arrange: Baseline NDVI = 0.7, Current NDVI = 0.35
      // NDVI change = 0.35 - 0.7 = -0.35 (decrease of 0.35 > threshold of 0.3)
      const baselineNDVI: NDVIResult = {
        id: 'baseline-1',
        parcelleId: testParcelleId,
        imageryId: null,
        calculationDate: baselineDate,
        meanNDVI: 0.7,
        minNDVI: 0.6,
        maxNDVI: 0.8,
        stdDevNDVI: 0.05,
        healthStatus: 'good',
        ndviRasterUrl: null,
        createdAt: new Date(),
      };

      const currentNDVI: NDVIResult = {
        id: 'current-1',
        parcelleId: testParcelleId,
        imageryId: null,
        calculationDate: currentDate,
        meanNDVI: 0.35,
        minNDVI: 0.25,
        maxNDVI: 0.45,
        stdDevNDVI: 0.05,
        healthStatus: 'poor',
        ndviRasterUrl: null,
        createdAt: new Date(),
      };

      vi.mocked(ndviService.getCachedNDVI)
        .mockResolvedValueOnce(baselineNDVI)
        .mockResolvedValueOnce(currentNDVI);

      // Mock database insert for event creation
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'event-1',
          parcelle_id: testParcelleId,
          baseline_date: baselineDate.toISOString(),
          detection_date: currentDate.toISOString(),
          baseline_ndvi: 0.7,
          current_ndvi: 0.35,
          ndvi_change: -0.35,
          affected_area_hectares: testSurfaceHectares,
          affected_area_percent: 100,
          status: 'pending',
          acknowledged_by: null,
          acknowledged_at: null,
          acknowledgment_notes: null,
          disputed_by: null,
          disputed_at: null,
          dispute_reason: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      // Act
      const result = await service.detectDeforestation(
        testParcelleId,
        testGeometry,
        testSurfaceHectares,
        { supabase: mockSupabase }
      );

      // Assert
      expect(result.detected).toBe(true);
      expect(result.baselineNDVI).toBe(0.7);
      expect(result.currentNDVI).toBe(0.35);
      expect(result.ndviChange).toBe(-0.35);
      expect(result.affectedAreaHectares).toBe(testSurfaceHectares);
      expect(result.affectedAreaPercent).toBe(100);
      expect(result.event).toBeDefined();
      expect(result.event?.status).toBe('pending');
    });

    it('should NOT detect deforestation when NDVI decrease < 0.3', async () => {
      // Arrange: Baseline NDVI = 0.7, Current NDVI = 0.5
      // NDVI change = 0.5 - 0.7 = -0.2 (decrease of 0.2 < threshold of 0.3)
      const baselineNDVI: NDVIResult = {
        id: 'baseline-2',
        parcelleId: testParcelleId,
        imageryId: null,
        calculationDate: baselineDate,
        meanNDVI: 0.7,
        minNDVI: 0.6,
        maxNDVI: 0.8,
        stdDevNDVI: 0.05,
        healthStatus: 'good',
        ndviRasterUrl: null,
        createdAt: new Date(),
      };

      const currentNDVI: NDVIResult = {
        id: 'current-2',
        parcelleId: testParcelleId,
        imageryId: null,
        calculationDate: currentDate,
        meanNDVI: 0.5,
        minNDVI: 0.4,
        maxNDVI: 0.6,
        stdDevNDVI: 0.05,
        healthStatus: 'fair',
        ndviRasterUrl: null,
        createdAt: new Date(),
      };

      vi.mocked(ndviService.getCachedNDVI)
        .mockResolvedValueOnce(baselineNDVI)
        .mockResolvedValueOnce(currentNDVI);

      // Act
      const result = await service.detectDeforestation(
        testParcelleId,
        testGeometry,
        testSurfaceHectares,
        { supabase: mockSupabase, storeEvents: false }
      );

      // Assert
      expect(result.detected).toBe(false);
      expect(result.ndviChange).toBeCloseTo(-0.2, 5);
      expect(result.event).toBeUndefined();
    });

    it('should NOT detect deforestation when NDVI increased', async () => {
      // Arrange: Baseline NDVI = 0.5, Current NDVI = 0.7
      // NDVI change = 0.7 - 0.5 = +0.2 (increase, not decrease)
      const baselineNDVI: NDVIResult = {
        id: 'baseline-3',
        parcelleId: testParcelleId,
        imageryId: null,
        calculationDate: baselineDate,
        meanNDVI: 0.5,
        minNDVI: 0.4,
        maxNDVI: 0.6,
        stdDevNDVI: 0.05,
        healthStatus: 'fair',
        ndviRasterUrl: null,
        createdAt: new Date(),
      };

      const currentNDVI: NDVIResult = {
        id: 'current-3',
        parcelleId: testParcelleId,
        imageryId: null,
        calculationDate: currentDate,
        meanNDVI: 0.7,
        minNDVI: 0.6,
        maxNDVI: 0.8,
        stdDevNDVI: 0.05,
        healthStatus: 'good',
        ndviRasterUrl: null,
        createdAt: new Date(),
      };

      vi.mocked(ndviService.getCachedNDVI)
        .mockResolvedValueOnce(baselineNDVI)
        .mockResolvedValueOnce(currentNDVI);

      // Act
      const result = await service.detectDeforestation(
        testParcelleId,
        testGeometry,
        testSurfaceHectares,
        { supabase: mockSupabase, storeEvents: false }
      );

      // Assert
      expect(result.detected).toBe(false);
      expect(result.ndviChange).toBeCloseTo(0.2, 5);
      expect(result.affectedAreaHectares).toBe(0);
      expect(result.affectedAreaPercent).toBe(0);
    });

    it('should NOT detect deforestation when affected area < 0.5 ha', async () => {
      // Arrange: Large NDVI decrease but small parcelle (< 0.5 ha)
      const smallSurfaceHectares = 0.3;
      
      const baselineNDVI: NDVIResult = {
        id: 'baseline-4',
        parcelleId: testParcelleId,
        imageryId: null,
        calculationDate: baselineDate,
        meanNDVI: 0.7,
        minNDVI: 0.6,
        maxNDVI: 0.8,
        stdDevNDVI: 0.05,
        healthStatus: 'good',
        ndviRasterUrl: null,
        createdAt: new Date(),
      };

      const currentNDVI: NDVIResult = {
        id: 'current-4',
        parcelleId: testParcelleId,
        imageryId: null,
        calculationDate: currentDate,
        meanNDVI: 0.3,
        minNDVI: 0.2,
        maxNDVI: 0.4,
        stdDevNDVI: 0.05,
        healthStatus: 'poor',
        ndviRasterUrl: null,
        createdAt: new Date(),
      };

      vi.mocked(ndviService.getCachedNDVI)
        .mockResolvedValueOnce(baselineNDVI)
        .mockResolvedValueOnce(currentNDVI);

      // Act
      const result = await service.detectDeforestation(
        testParcelleId,
        testGeometry,
        smallSurfaceHectares,
        { supabase: mockSupabase, storeEvents: false }
      );

      // Assert
      expect(result.detected).toBe(false);
      expect(result.ndviChange).toBeCloseTo(-0.4, 5);
      expect(result.affectedAreaHectares).toBe(smallSurfaceHectares);
      expect(result.affectedAreaHectares).toBeLessThan(0.5);
    });

    it('should calculate NDVI if not cached', async () => {
      // Arrange: No cached NDVI, need to calculate
      const baselineNDVI: NDVIResult = {
        id: 'baseline-5',
        parcelleId: testParcelleId,
        imageryId: null,
        calculationDate: baselineDate,
        meanNDVI: 0.7,
        minNDVI: 0.6,
        maxNDVI: 0.8,
        stdDevNDVI: 0.05,
        healthStatus: 'good',
        ndviRasterUrl: null,
        createdAt: new Date(),
      };

      const currentNDVI: NDVIResult = {
        id: 'current-5',
        parcelleId: testParcelleId,
        imageryId: null,
        calculationDate: currentDate,
        meanNDVI: 0.35,
        minNDVI: 0.25,
        maxNDVI: 0.45,
        stdDevNDVI: 0.05,
        healthStatus: 'poor',
        ndviRasterUrl: null,
        createdAt: new Date(),
      };

      // Mock: getCachedNDVI returns null (not cached)
      vi.mocked(ndviService.getCachedNDVI)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      // Mock: calculateNDVI returns NDVI results
      vi.mocked(ndviService.calculateNDVI)
        .mockResolvedValueOnce(baselineNDVI)
        .mockResolvedValueOnce(currentNDVI);

      // Mock database insert
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'event-5',
          parcelle_id: testParcelleId,
          baseline_date: baselineDate.toISOString(),
          detection_date: currentDate.toISOString(),
          baseline_ndvi: 0.7,
          current_ndvi: 0.35,
          ndvi_change: -0.35,
          affected_area_hectares: testSurfaceHectares,
          affected_area_percent: 100,
          status: 'pending',
          acknowledged_by: null,
          acknowledged_at: null,
          acknowledgment_notes: null,
          disputed_by: null,
          disputed_at: null,
          dispute_reason: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      // Act
      const result = await service.detectDeforestation(
        testParcelleId,
        testGeometry,
        testSurfaceHectares,
        { supabase: mockSupabase }
      );

      // Assert
      expect(result.detected).toBe(true);
      expect(ndviService.calculateNDVI).toHaveBeenCalledTimes(2);
      expect(ndviService.calculateNDVI).toHaveBeenCalledWith(
        testParcelleId,
        testGeometry,
        baselineDate,
        expect.objectContaining({
          storeResult: true,
          generateRaster: false,
        })
      );
    });

    it('should use custom baseline and current dates', async () => {
      // Arrange: Custom dates
      const customBaselineDate = new Date('2021-01-01T00:00:00Z');
      const customCurrentDate = new Date('2024-01-01T00:00:00Z');

      const baselineNDVI: NDVIResult = {
        id: 'baseline-6',
        parcelleId: testParcelleId,
        imageryId: null,
        calculationDate: customBaselineDate,
        meanNDVI: 0.7,
        minNDVI: 0.6,
        maxNDVI: 0.8,
        stdDevNDVI: 0.05,
        healthStatus: 'good',
        ndviRasterUrl: null,
        createdAt: new Date(),
      };

      const currentNDVI: NDVIResult = {
        id: 'current-6',
        parcelleId: testParcelleId,
        imageryId: null,
        calculationDate: customCurrentDate,
        meanNDVI: 0.5,
        minNDVI: 0.4,
        maxNDVI: 0.6,
        stdDevNDVI: 0.05,
        healthStatus: 'fair',
        ndviRasterUrl: null,
        createdAt: new Date(),
      };

      vi.mocked(ndviService.getCachedNDVI)
        .mockResolvedValueOnce(baselineNDVI)
        .mockResolvedValueOnce(currentNDVI);

      // Act
      const result = await service.detectDeforestation(
        testParcelleId,
        testGeometry,
        testSurfaceHectares,
        {
          baselineDate: customBaselineDate,
          currentDate: customCurrentDate,
          supabase: mockSupabase,
          storeEvents: false,
        }
      );

      // Assert
      expect(result.detected).toBe(false);
      expect(ndviService.getCachedNDVI).toHaveBeenCalledWith(
        testParcelleId,
        customBaselineDate,
        mockSupabase
      );
      expect(ndviService.getCachedNDVI).toHaveBeenCalledWith(
        testParcelleId,
        customCurrentDate,
        mockSupabase
      );
    });
  });

  describe('getAlerts', () => {
    it('should retrieve all alerts for a parcelle', async () => {
      // Arrange
      const mockAlerts = [
        {
          id: 'alert-1',
          parcelle_id: testParcelleId,
          baseline_date: '2020-12-31T00:00:00Z',
          detection_date: '2024-05-05T00:00:00Z',
          baseline_ndvi: 0.7,
          current_ndvi: 0.35,
          ndvi_change: -0.35,
          affected_area_hectares: 5.5,
          affected_area_percent: 100,
          status: 'pending',
          acknowledged_by: null,
          acknowledged_at: null,
          acknowledgment_notes: null,
          disputed_by: null,
          disputed_at: null,
          dispute_reason: null,
          created_at: '2024-05-05T10:00:00Z',
          updated_at: '2024-05-05T10:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.order.mockResolvedValue({ data: mockAlerts, error: null });

      // Act
      const alerts = await service.getAlerts(testParcelleId, undefined, mockSupabase);

      // Assert
      expect(alerts).toHaveLength(1);
      expect(alerts[0].id).toBe('alert-1');
      expect(alerts[0].parcelleId).toBe(testParcelleId);
      expect(alerts[0].status).toBe('pending');
      expect(mockSupabase.from).toHaveBeenCalledWith('deforestation_events');
      expect(mockSupabase.eq).toHaveBeenCalledWith('parcelle_id', testParcelleId);
    });

    it('should filter alerts by status', async () => {
      // Arrange
      const mockAlerts = [
        {
          id: 'alert-2',
          parcelle_id: testParcelleId,
          baseline_date: '2020-12-31T00:00:00Z',
          detection_date: '2024-05-05T00:00:00Z',
          baseline_ndvi: 0.7,
          current_ndvi: 0.35,
          ndvi_change: -0.35,
          affected_area_hectares: 5.5,
          affected_area_percent: 100,
          status: 'acknowledged',
          acknowledged_by: 'user-123',
          acknowledged_at: '2024-05-06T10:00:00Z',
          acknowledgment_notes: 'Verified',
          disputed_by: null,
          disputed_at: null,
          dispute_reason: null,
          created_at: '2024-05-05T10:00:00Z',
          updated_at: '2024-05-06T10:00:00Z',
        },
      ];

      // Create a mock that returns a promise-like object with data and error
      const mockQueryResult = Promise.resolve({ data: mockAlerts, error: null });
      
      // Create the mock chain - each method returns an object with the next method
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: mockQueryResult.then.bind(mockQueryResult),
        catch: mockQueryResult.catch.bind(mockQueryResult),
      };
      
      const mockClient = {
        from: vi.fn().mockReturnValue(mockChain),
      };

      // Act
      const alerts = await service.getAlerts(testParcelleId, 'acknowledged', mockClient as any);

      // Assert
      expect(alerts).toHaveLength(1);
      expect(alerts[0].status).toBe('acknowledged');
      expect(mockClient.from).toHaveBeenCalledWith('deforestation_events');
      expect(mockChain.eq).toHaveBeenCalledWith('parcelle_id', testParcelleId);
      expect(mockChain.eq).toHaveBeenCalledWith('status', 'acknowledged');
    });

    it('should return empty array when no alerts found', async () => {
      // Arrange
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.order.mockResolvedValue({ data: [], error: null });

      // Act
      const alerts = await service.getAlerts(testParcelleId, undefined, mockSupabase);

      // Assert
      expect(alerts).toHaveLength(0);
    });

    it('should handle database errors when retrieving alerts', async () => {
      // Arrange
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.order.mockResolvedValue({ data: null, error: new Error('Database error') });

      // Act & Assert
      await expect(
        service.getAlerts(testParcelleId, undefined, mockSupabase)
      ).rejects.toThrow('Failed to retrieve deforestation alerts');
    });

    it('should handle null data from database', async () => {
      // Arrange
      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.order.mockResolvedValue({ data: null, error: null });

      // Act
      const alerts = await service.getAlerts(testParcelleId, undefined, mockSupabase);

      // Assert
      expect(alerts).toHaveLength(0);
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge an alert', async () => {
      // Arrange
      const alertId = 'alert-1';
      const userId = 'user-123';
      const notes = 'Verified deforestation';

      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.update.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockResolvedValue({ error: null });

      // Act
      await service.acknowledgeAlert(alertId, userId, notes, mockSupabase);

      // Assert
      expect(mockSupabase.from).toHaveBeenCalledWith('deforestation_events');
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'acknowledged',
          acknowledged_by: userId,
          acknowledgment_notes: notes,
        })
      );
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', alertId);
    });

    it('should acknowledge an alert without notes', async () => {
      // Arrange
      const alertId = 'alert-2';
      const userId = 'user-456';

      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.update.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockResolvedValue({ error: null });

      // Act
      await service.acknowledgeAlert(alertId, userId, undefined, mockSupabase);

      // Assert
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'acknowledged',
          acknowledged_by: userId,
          acknowledgment_notes: null,
        })
      );
    });

    it('should handle database errors when acknowledging', async () => {
      // Arrange
      const alertId = 'alert-3';
      const userId = 'user-789';
      const notes = 'Test notes';

      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.update.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockResolvedValue({ error: new Error('Database error') });

      // Act & Assert
      await expect(
        service.acknowledgeAlert(alertId, userId, notes, mockSupabase)
      ).rejects.toThrow('Failed to acknowledge alert');
    });
  });

  describe('disputeAlert', () => {
    it('should dispute an alert', async () => {
      // Arrange
      const alertId = 'alert-1';
      const userId = 'user-123';
      const reason = 'False positive - seasonal leaf drop';

      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.update.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockResolvedValue({ error: null });

      // Act
      await service.disputeAlert(alertId, userId, reason, mockSupabase);

      // Assert
      expect(mockSupabase.from).toHaveBeenCalledWith('deforestation_events');
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'disputed',
          disputed_by: userId,
          dispute_reason: reason,
        })
      );
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', alertId);
    });

    it('should handle database errors when disputing', async () => {
      // Arrange
      const alertId = 'alert-2';
      const userId = 'user-456';
      const reason = 'Test reason';

      mockSupabase.from.mockReturnValue(mockSupabase);
      mockSupabase.update.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockResolvedValue({ error: new Error('Database error') });

      // Act & Assert
      await expect(
        service.disputeAlert(alertId, userId, reason, mockSupabase)
      ).rejects.toThrow('Failed to dispute alert');
    });
  });

  describe('Baseline Imagery Retrieval (Task 4.1.2)', () => {
    describe('getBaselineNDVI', () => {
      it('should return cached baseline NDVI if available', async () => {
        // Arrange: Cached baseline NDVI exists
        const cachedBaselineNDVI: NDVIResult = {
          id: 'baseline-cached',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: baselineDate,
          meanNDVI: 0.7,
          minNDVI: 0.6,
          maxNDVI: 0.8,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        vi.mocked(ndviService.getCachedNDVI).mockResolvedValueOnce(cachedBaselineNDVI);

        // Act: Detect deforestation (which calls getBaselineNDVI internally)
        const currentNDVI: NDVIResult = {
          id: 'current-1',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: currentDate,
          meanNDVI: 0.6,
          minNDVI: 0.5,
          maxNDVI: 0.7,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        vi.mocked(ndviService.getCachedNDVI).mockResolvedValueOnce(currentNDVI);

        const result = await service.detectDeforestation(
          testParcelleId,
          testGeometry,
          testSurfaceHectares,
          { storeEvents: false }
        );

        // Assert: Should use cached baseline without calculating
        expect(ndviService.getCachedNDVI).toHaveBeenCalledWith(
          testParcelleId,
          baselineDate,
          undefined
        );
        expect(ndviService.calculateNDVI).not.toHaveBeenCalled();
        expect(result.baselineNDVI).toBe(0.7);
      });

      it('should calculate baseline NDVI for exact date if not cached', async () => {
        // Arrange: No cached baseline, but exact date imagery is available
        const calculatedBaselineNDVI: NDVIResult = {
          id: 'baseline-calculated',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: baselineDate,
          meanNDVI: 0.72,
          minNDVI: 0.65,
          maxNDVI: 0.82,
          stdDevNDVI: 0.06,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        const currentNDVI: NDVIResult = {
          id: 'current-1',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: currentDate,
          meanNDVI: 0.65,
          minNDVI: 0.55,
          maxNDVI: 0.75,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        // Mock: No cache, but calculation succeeds for exact date
        vi.mocked(ndviService.getCachedNDVI)
          .mockResolvedValueOnce(null) // No cached baseline
          .mockResolvedValueOnce(currentNDVI); // Current NDVI

        vi.mocked(ndviService.calculateNDVI).mockResolvedValueOnce(calculatedBaselineNDVI);

        // Act
        const result = await service.detectDeforestation(
          testParcelleId,
          testGeometry,
          testSurfaceHectares,
          { storeEvents: false }
        );

        // Assert: Should calculate baseline for exact date
        expect(ndviService.calculateNDVI).toHaveBeenCalledWith(
          testParcelleId,
          testGeometry,
          baselineDate,
          expect.objectContaining({
            storeResult: true,
            generateRaster: false,
          })
        );
        expect(result.baselineNDVI).toBe(0.72);
      });

      it('should search for closest date within ±60 days if exact date unavailable', async () => {
        // Arrange: No cached baseline, exact date fails, but closest date is available
        const closestDate = new Date('2020-12-15T00:00:00Z'); // 16 days before baseline
        const closestDateNDVI: NDVIResult = {
          id: 'baseline-closest',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: closestDate,
          meanNDVI: 0.68,
          minNDVI: 0.60,
          maxNDVI: 0.78,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        const currentNDVI: NDVIResult = {
          id: 'current-1',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: currentDate,
          meanNDVI: 0.60,
          minNDVI: 0.50,
          maxNDVI: 0.70,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        // Mock: No cache, exact date fails, closest date succeeds
        vi.mocked(ndviService.getCachedNDVI)
          .mockResolvedValueOnce(null) // No cached baseline for exact date
          .mockResolvedValueOnce(null) // No cached baseline for closest date
          .mockResolvedValueOnce(currentNDVI); // Current NDVI

        vi.mocked(ndviService.calculateNDVI)
          .mockRejectedValueOnce(new Error('Imagery unavailable for exact date')) // Exact date fails
          .mockResolvedValueOnce(closestDateNDVI); // Closest date succeeds

        // Mock imageryService.getClosestDate
        const { imageryService } = await import('../../../lib/satellite/services/imagery.service');
        vi.spyOn(imageryService, 'getClosestDate').mockResolvedValueOnce({
          date: closestDate,
          cloudCoverPercent: 15,
          available: true,
        });

        // Act
        const result = await service.detectDeforestation(
          testParcelleId,
          testGeometry,
          testSurfaceHectares,
          { storeEvents: false }
        );

        // Assert: Should search for and use closest date
        expect(imageryService.getClosestDate).toHaveBeenCalledWith(
          testGeometry,
          baselineDate,
          60, // BASELINE_SEARCH_WINDOW_DAYS
          20  // Cloud cover threshold
        );
        expect(ndviService.calculateNDVI).toHaveBeenCalledWith(
          testParcelleId,
          testGeometry,
          closestDate,
          expect.objectContaining({
            storeResult: true,
            generateRaster: false,
          })
        );
        expect(result.baselineNDVI).toBe(0.68);
      });

      it('should use cached NDVI for closest date if available', async () => {
        // Arrange: No cached baseline for exact date, exact date fails, but closest date is cached
        const closestDate = new Date('2021-01-10T00:00:00Z'); // 10 days after baseline
        const cachedClosestDateNDVI: NDVIResult = {
          id: 'baseline-closest-cached',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: closestDate,
          meanNDVI: 0.71,
          minNDVI: 0.62,
          maxNDVI: 0.80,
          stdDevNDVI: 0.06,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        const currentNDVI: NDVIResult = {
          id: 'current-1',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: currentDate,
          meanNDVI: 0.62,
          minNDVI: 0.52,
          maxNDVI: 0.72,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        // Mock: No cache for exact date, exact date fails, closest date is cached
        vi.mocked(ndviService.getCachedNDVI)
          .mockResolvedValueOnce(null) // No cached baseline for exact date
          .mockResolvedValueOnce(cachedClosestDateNDVI) // Cached baseline for closest date
          .mockResolvedValueOnce(currentNDVI); // Current NDVI

        vi.mocked(ndviService.calculateNDVI)
          .mockRejectedValueOnce(new Error('Imagery unavailable for exact date')); // Exact date fails

        // Mock imageryService.getClosestDate
        const { imageryService } = await import('../../../lib/satellite/services/imagery.service');
        vi.spyOn(imageryService, 'getClosestDate').mockResolvedValueOnce({
          date: closestDate,
          cloudCoverPercent: 12,
          available: true,
        });

        // Act
        const result = await service.detectDeforestation(
          testParcelleId,
          testGeometry,
          testSurfaceHectares,
          { storeEvents: false }
        );

        // Assert: Should use cached closest date without recalculating
        expect(imageryService.getClosestDate).toHaveBeenCalled();
        expect(ndviService.getCachedNDVI).toHaveBeenCalledWith(
          testParcelleId,
          closestDate,
          undefined
        );
        // Should NOT calculate NDVI for closest date since it's cached
        expect(ndviService.calculateNDVI).toHaveBeenCalledTimes(1); // Only the failed exact date attempt
        expect(result.baselineNDVI).toBe(0.71);
      });

      it('should throw InsufficientDataError if no imagery available within ±60 days', async () => {
        // Arrange: No cached baseline, exact date fails, no closest date found
        // Mock: No cache, exact date fails, no closest date available
        vi.mocked(ndviService.getCachedNDVI)
          .mockResolvedValue(null); // Always return null for cache

        vi.mocked(ndviService.calculateNDVI)
          .mockRejectedValue(new Error('Imagery unavailable for exact date')); // Always fail

        // Mock imageryService.getClosestDate returns null (no imagery found)
        const { imageryService } = await import('../../../lib/satellite/services/imagery.service');
        vi.spyOn(imageryService, 'getClosestDate').mockResolvedValue(null);

        // Act & Assert: Should throw InsufficientDataError
        await expect(
          service.detectDeforestation(
            testParcelleId,
            testGeometry,
            testSurfaceHectares,
            { storeEvents: false }
          )
        ).rejects.toThrow('Baseline imagery not available');
        
        await expect(
          service.detectDeforestation(
            testParcelleId,
            testGeometry,
            testSurfaceHectares,
            { storeEvents: false }
          )
        ).rejects.toThrow('Searched within ±60 days');
      });

      it('should cache baseline NDVI after calculating for closest date', async () => {
        // Arrange: Calculate baseline for closest date and verify it's cached
        const closestDate = new Date('2020-12-20T00:00:00Z');
        const closestDateNDVI: NDVIResult = {
          id: 'baseline-closest',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: closestDate,
          meanNDVI: 0.69,
          minNDVI: 0.61,
          maxNDVI: 0.79,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        const currentNDVI: NDVIResult = {
          id: 'current-1',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: currentDate,
          meanNDVI: 0.61,
          minNDVI: 0.51,
          maxNDVI: 0.71,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        // Mock: No cache, exact date fails, closest date calculation succeeds
        vi.mocked(ndviService.getCachedNDVI)
          .mockResolvedValueOnce(null) // No cached baseline for exact date
          .mockResolvedValueOnce(null) // No cached baseline for closest date
          .mockResolvedValueOnce(currentNDVI); // Current NDVI

        vi.mocked(ndviService.calculateNDVI)
          .mockRejectedValueOnce(new Error('Imagery unavailable for exact date'))
          .mockResolvedValueOnce(closestDateNDVI); // Closest date calculation

        // Mock imageryService.getClosestDate
        const { imageryService } = await import('../../../lib/satellite/services/imagery.service');
        vi.spyOn(imageryService, 'getClosestDate').mockResolvedValueOnce({
          date: closestDate,
          cloudCoverPercent: 18,
          available: true,
        });

        // Act
        await service.detectDeforestation(
          testParcelleId,
          testGeometry,
          testSurfaceHectares,
          { storeEvents: false }
        );

        // Assert: Should calculate NDVI with storeResult: true to cache it
        expect(ndviService.calculateNDVI).toHaveBeenCalledWith(
          testParcelleId,
          testGeometry,
          closestDate,
          expect.objectContaining({
            storeResult: true, // This ensures the result is cached
            generateRaster: false,
          })
        );
      });
    });
  });

  describe('Alert Creation (Task 4.1.3)', () => {
    describe('createDeforestationEvent', () => {
      it('should create alert with all required fields', async () => {
        // Arrange: Set up NDVI values that trigger deforestation detection
        const baselineNDVI: NDVIResult = {
          id: 'baseline-alert-1',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: baselineDate,
          meanNDVI: 0.75,
          minNDVI: 0.65,
          maxNDVI: 0.85,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        const currentNDVI: NDVIResult = {
          id: 'current-alert-1',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: currentDate,
          meanNDVI: 0.40,
          minNDVI: 0.30,
          maxNDVI: 0.50,
          stdDevNDVI: 0.05,
          healthStatus: 'poor',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        vi.mocked(ndviService.getCachedNDVI)
          .mockResolvedValueOnce(baselineNDVI)
          .mockResolvedValueOnce(currentNDVI);

        const mockAlertId = 'alert-test-123';
        const mockCreatedAt = new Date('2024-05-05T10:00:00Z');
        const mockUpdatedAt = new Date('2024-05-05T10:00:00Z');

        // Mock database insert
        mockSupabase.single.mockResolvedValue({
          data: {
            id: mockAlertId,
            parcelle_id: testParcelleId,
            baseline_date: baselineDate.toISOString(),
            detection_date: currentDate.toISOString(),
            baseline_ndvi: 0.75,
            current_ndvi: 0.40,
            ndvi_change: -0.35,
            affected_area_hectares: testSurfaceHectares,
            affected_area_percent: 100,
            status: 'pending',
            acknowledged_by: null,
            acknowledged_at: null,
            acknowledgment_notes: null,
            disputed_by: null,
            disputed_at: null,
            dispute_reason: null,
            created_at: mockCreatedAt.toISOString(),
            updated_at: mockUpdatedAt.toISOString(),
          },
          error: null,
        });

        // Act
        const result = await service.detectDeforestation(
          testParcelleId,
          testGeometry,
          testSurfaceHectares,
          { supabase: mockSupabase, storeEvents: true }
        );

        // Assert: Verify alert was created with all required fields
        expect(result.event).toBeDefined();
        expect(result.event?.id).toBe(mockAlertId);
        expect(result.event?.parcelleId).toBe(testParcelleId);
        expect(result.event?.baselineDate).toEqual(baselineDate);
        expect(result.event?.detectionDate).toEqual(currentDate);
        expect(result.event?.baselineNDVI).toBe(0.75);
        expect(result.event?.currentNDVI).toBe(0.40);
        expect(result.event?.ndviChange).toBe(-0.35);
        expect(result.event?.affectedAreaHectares).toBe(testSurfaceHectares);
        expect(result.event?.affectedAreaPercent).toBe(100);
        expect(result.event?.status).toBe('pending');
        expect(result.event?.createdAt).toEqual(mockCreatedAt);
        expect(result.event?.updatedAt).toEqual(mockUpdatedAt);
      });

      it('should set status to pending by default', async () => {
        // Arrange
        const baselineNDVI: NDVIResult = {
          id: 'baseline-alert-2',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: baselineDate,
          meanNDVI: 0.70,
          minNDVI: 0.60,
          maxNDVI: 0.80,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        const currentNDVI: NDVIResult = {
          id: 'current-alert-2',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: currentDate,
          meanNDVI: 0.35,
          minNDVI: 0.25,
          maxNDVI: 0.45,
          stdDevNDVI: 0.05,
          healthStatus: 'poor',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        vi.mocked(ndviService.getCachedNDVI)
          .mockResolvedValueOnce(baselineNDVI)
          .mockResolvedValueOnce(currentNDVI);

        // Mock database insert
        mockSupabase.single.mockResolvedValue({
          data: {
            id: 'alert-pending-test',
            parcelle_id: testParcelleId,
            baseline_date: baselineDate.toISOString(),
            detection_date: currentDate.toISOString(),
            baseline_ndvi: 0.70,
            current_ndvi: 0.35,
            ndvi_change: -0.35,
            affected_area_hectares: testSurfaceHectares,
            affected_area_percent: 100,
            status: 'pending',
            acknowledged_by: null,
            acknowledged_at: null,
            acknowledgment_notes: null,
            disputed_by: null,
            disputed_at: null,
            dispute_reason: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        });

        // Act
        const result = await service.detectDeforestation(
          testParcelleId,
          testGeometry,
          testSurfaceHectares,
          { supabase: mockSupabase, storeEvents: true }
        );

        // Assert: Status should be 'pending'
        expect(result.event?.status).toBe('pending');
        expect(mockSupabase.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'pending',
          })
        );
      });

      it('should generate alert ID automatically (UUID)', async () => {
        // Arrange
        const baselineNDVI: NDVIResult = {
          id: 'baseline-alert-3',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: baselineDate,
          meanNDVI: 0.72,
          minNDVI: 0.62,
          maxNDVI: 0.82,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        const currentNDVI: NDVIResult = {
          id: 'current-alert-3',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: currentDate,
          meanNDVI: 0.38,
          minNDVI: 0.28,
          maxNDVI: 0.48,
          stdDevNDVI: 0.05,
          healthStatus: 'poor',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        vi.mocked(ndviService.getCachedNDVI)
          .mockResolvedValueOnce(baselineNDVI)
          .mockResolvedValueOnce(currentNDVI);

        // Mock database insert with generated UUID
        const generatedUUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        mockSupabase.single.mockResolvedValue({
          data: {
            id: generatedUUID,
            parcelle_id: testParcelleId,
            baseline_date: baselineDate.toISOString(),
            detection_date: currentDate.toISOString(),
            baseline_ndvi: 0.72,
            current_ndvi: 0.38,
            ndvi_change: -0.34,
            affected_area_hectares: testSurfaceHectares,
            affected_area_percent: 100,
            status: 'pending',
            acknowledged_by: null,
            acknowledged_at: null,
            acknowledgment_notes: null,
            disputed_by: null,
            disputed_at: null,
            dispute_reason: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        });

        // Act
        const result = await service.detectDeforestation(
          testParcelleId,
          testGeometry,
          testSurfaceHectares,
          { supabase: mockSupabase, storeEvents: true }
        );

        // Assert: Alert should have a UUID
        expect(result.event?.id).toBe(generatedUUID);
        expect(result.event?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });

      it('should store baseline NDVI correctly', async () => {
        // Arrange
        const testBaselineNDVI = 0.7823;
        const baselineNDVI: NDVIResult = {
          id: 'baseline-alert-4',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: baselineDate,
          meanNDVI: testBaselineNDVI,
          minNDVI: 0.70,
          maxNDVI: 0.85,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        const currentNDVI: NDVIResult = {
          id: 'current-alert-4',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: currentDate,
          meanNDVI: 0.40,
          minNDVI: 0.30,
          maxNDVI: 0.50,
          stdDevNDVI: 0.05,
          healthStatus: 'poor',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        vi.mocked(ndviService.getCachedNDVI)
          .mockResolvedValueOnce(baselineNDVI)
          .mockResolvedValueOnce(currentNDVI);

        // Mock database insert
        mockSupabase.single.mockResolvedValue({
          data: {
            id: 'alert-baseline-test',
            parcelle_id: testParcelleId,
            baseline_date: baselineDate.toISOString(),
            detection_date: currentDate.toISOString(),
            baseline_ndvi: testBaselineNDVI,
            current_ndvi: 0.40,
            ndvi_change: 0.40 - testBaselineNDVI,
            affected_area_hectares: testSurfaceHectares,
            affected_area_percent: 100,
            status: 'pending',
            acknowledged_by: null,
            acknowledged_at: null,
            acknowledgment_notes: null,
            disputed_by: null,
            disputed_at: null,
            dispute_reason: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        });

        // Act
        const result = await service.detectDeforestation(
          testParcelleId,
          testGeometry,
          testSurfaceHectares,
          { supabase: mockSupabase, storeEvents: true }
        );

        // Assert: Baseline NDVI should be stored correctly
        expect(result.event?.baselineNDVI).toBe(testBaselineNDVI);
        expect(mockSupabase.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            baseline_ndvi: testBaselineNDVI,
          })
        );
      });

      it('should store current NDVI correctly', async () => {
        // Arrange
        const testCurrentNDVI = 0.3456;
        const baselineNDVI: NDVIResult = {
          id: 'baseline-alert-5',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: baselineDate,
          meanNDVI: 0.75,
          minNDVI: 0.65,
          maxNDVI: 0.85,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        const currentNDVI: NDVIResult = {
          id: 'current-alert-5',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: currentDate,
          meanNDVI: testCurrentNDVI,
          minNDVI: 0.25,
          maxNDVI: 0.45,
          stdDevNDVI: 0.05,
          healthStatus: 'poor',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        vi.mocked(ndviService.getCachedNDVI)
          .mockResolvedValueOnce(baselineNDVI)
          .mockResolvedValueOnce(currentNDVI);

        // Mock database insert
        mockSupabase.single.mockResolvedValue({
          data: {
            id: 'alert-current-test',
            parcelle_id: testParcelleId,
            baseline_date: baselineDate.toISOString(),
            detection_date: currentDate.toISOString(),
            baseline_ndvi: 0.75,
            current_ndvi: testCurrentNDVI,
            ndvi_change: testCurrentNDVI - 0.75,
            affected_area_hectares: testSurfaceHectares,
            affected_area_percent: 100,
            status: 'pending',
            acknowledged_by: null,
            acknowledged_at: null,
            acknowledgment_notes: null,
            disputed_by: null,
            disputed_at: null,
            dispute_reason: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        });

        // Act
        const result = await service.detectDeforestation(
          testParcelleId,
          testGeometry,
          testSurfaceHectares,
          { supabase: mockSupabase, storeEvents: true }
        );

        // Assert: Current NDVI should be stored correctly
        expect(result.event?.currentNDVI).toBe(testCurrentNDVI);
        expect(mockSupabase.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            current_ndvi: testCurrentNDVI,
          })
        );
      });

      it('should store NDVI change correctly (negative for vegetation loss)', async () => {
        // Arrange
        const baselineValue = 0.75;
        const currentValue = 0.40;
        const expectedChange = currentValue - baselineValue; // -0.35

        const baselineNDVI: NDVIResult = {
          id: 'baseline-alert-6',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: baselineDate,
          meanNDVI: baselineValue,
          minNDVI: 0.65,
          maxNDVI: 0.85,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        const currentNDVI: NDVIResult = {
          id: 'current-alert-6',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: currentDate,
          meanNDVI: currentValue,
          minNDVI: 0.30,
          maxNDVI: 0.50,
          stdDevNDVI: 0.05,
          healthStatus: 'poor',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        vi.mocked(ndviService.getCachedNDVI)
          .mockResolvedValueOnce(baselineNDVI)
          .mockResolvedValueOnce(currentNDVI);

        // Mock database insert
        mockSupabase.single.mockResolvedValue({
          data: {
            id: 'alert-change-test',
            parcelle_id: testParcelleId,
            baseline_date: baselineDate.toISOString(),
            detection_date: currentDate.toISOString(),
            baseline_ndvi: baselineValue,
            current_ndvi: currentValue,
            ndvi_change: expectedChange,
            affected_area_hectares: testSurfaceHectares,
            affected_area_percent: 100,
            status: 'pending',
            acknowledged_by: null,
            acknowledged_at: null,
            acknowledgment_notes: null,
            disputed_by: null,
            disputed_at: null,
            dispute_reason: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        });

        // Act
        const result = await service.detectDeforestation(
          testParcelleId,
          testGeometry,
          testSurfaceHectares,
          { supabase: mockSupabase, storeEvents: true }
        );

        // Assert: NDVI change should be negative (vegetation loss)
        expect(result.event?.ndviChange).toBe(expectedChange);
        expect(result.event?.ndviChange).toBeLessThan(0);
        expect(mockSupabase.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            ndvi_change: expectedChange,
          })
        );
      });

      it('should store affected area in hectares', async () => {
        // Arrange
        const testAffectedArea = 7.25; // hectares
        const baselineNDVI: NDVIResult = {
          id: 'baseline-alert-7',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: baselineDate,
          meanNDVI: 0.75,
          minNDVI: 0.65,
          maxNDVI: 0.85,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        const currentNDVI: NDVIResult = {
          id: 'current-alert-7',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: currentDate,
          meanNDVI: 0.40,
          minNDVI: 0.30,
          maxNDVI: 0.50,
          stdDevNDVI: 0.05,
          healthStatus: 'poor',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        vi.mocked(ndviService.getCachedNDVI)
          .mockResolvedValueOnce(baselineNDVI)
          .mockResolvedValueOnce(currentNDVI);

        // Mock database insert
        mockSupabase.single.mockResolvedValue({
          data: {
            id: 'alert-area-test',
            parcelle_id: testParcelleId,
            baseline_date: baselineDate.toISOString(),
            detection_date: currentDate.toISOString(),
            baseline_ndvi: 0.75,
            current_ndvi: 0.40,
            ndvi_change: -0.35,
            affected_area_hectares: testAffectedArea,
            affected_area_percent: 100,
            status: 'pending',
            acknowledged_by: null,
            acknowledged_at: null,
            acknowledgment_notes: null,
            disputed_by: null,
            disputed_at: null,
            dispute_reason: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        });

        // Act
        const result = await service.detectDeforestation(
          testParcelleId,
          testGeometry,
          testAffectedArea,
          { supabase: mockSupabase, storeEvents: true }
        );

        // Assert: Affected area should be stored correctly
        expect(result.event?.affectedAreaHectares).toBe(testAffectedArea);
        expect(mockSupabase.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            affected_area_hectares: testAffectedArea,
          })
        );
      });

      it('should store affected area as percentage', async () => {
        // Arrange
        const baselineNDVI: NDVIResult = {
          id: 'baseline-alert-8',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: baselineDate,
          meanNDVI: 0.75,
          minNDVI: 0.65,
          maxNDVI: 0.85,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        const currentNDVI: NDVIResult = {
          id: 'current-alert-8',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: currentDate,
          meanNDVI: 0.40,
          minNDVI: 0.30,
          maxNDVI: 0.50,
          stdDevNDVI: 0.05,
          healthStatus: 'poor',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        vi.mocked(ndviService.getCachedNDVI)
          .mockResolvedValueOnce(baselineNDVI)
          .mockResolvedValueOnce(currentNDVI);

        // Mock database insert
        mockSupabase.single.mockResolvedValue({
          data: {
            id: 'alert-percent-test',
            parcelle_id: testParcelleId,
            baseline_date: baselineDate.toISOString(),
            detection_date: currentDate.toISOString(),
            baseline_ndvi: 0.75,
            current_ndvi: 0.40,
            ndvi_change: -0.35,
            affected_area_hectares: testSurfaceHectares,
            affected_area_percent: 100,
            status: 'pending',
            acknowledged_by: null,
            acknowledged_at: null,
            acknowledgment_notes: null,
            disputed_by: null,
            disputed_at: null,
            dispute_reason: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        });

        // Act
        const result = await service.detectDeforestation(
          testParcelleId,
          testGeometry,
          testSurfaceHectares,
          { supabase: mockSupabase, storeEvents: true }
        );

        // Assert: Affected area percentage should be stored
        expect(result.event?.affectedAreaPercent).toBe(100);
        expect(mockSupabase.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            affected_area_percent: 100,
          })
        );
      });

      it('should NOT create alert when storeEvents is false', async () => {
        // Arrange
        const baselineNDVI: NDVIResult = {
          id: 'baseline-alert-9',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: baselineDate,
          meanNDVI: 0.75,
          minNDVI: 0.65,
          maxNDVI: 0.85,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        const currentNDVI: NDVIResult = {
          id: 'current-alert-9',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: currentDate,
          meanNDVI: 0.40,
          minNDVI: 0.30,
          maxNDVI: 0.50,
          stdDevNDVI: 0.05,
          healthStatus: 'poor',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        vi.mocked(ndviService.getCachedNDVI)
          .mockResolvedValueOnce(baselineNDVI)
          .mockResolvedValueOnce(currentNDVI);

        // Act
        const result = await service.detectDeforestation(
          testParcelleId,
          testGeometry,
          testSurfaceHectares,
          { supabase: mockSupabase, storeEvents: false }
        );

        // Assert: No alert should be created
        expect(result.detected).toBe(true);
        expect(result.event).toBeUndefined();
        expect(mockSupabase.insert).not.toHaveBeenCalled();
      });

      it('should handle database errors gracefully', async () => {
        // Arrange
        const baselineNDVI: NDVIResult = {
          id: 'baseline-alert-10',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: baselineDate,
          meanNDVI: 0.75,
          minNDVI: 0.65,
          maxNDVI: 0.85,
          stdDevNDVI: 0.05,
          healthStatus: 'good',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        const currentNDVI: NDVIResult = {
          id: 'current-alert-10',
          parcelleId: testParcelleId,
          imageryId: null,
          calculationDate: currentDate,
          meanNDVI: 0.40,
          minNDVI: 0.30,
          maxNDVI: 0.50,
          stdDevNDVI: 0.05,
          healthStatus: 'poor',
          ndviRasterUrl: null,
          createdAt: new Date(),
        };

        vi.mocked(ndviService.getCachedNDVI)
          .mockResolvedValueOnce(baselineNDVI)
          .mockResolvedValueOnce(currentNDVI);

        // Mock database error
        mockSupabase.single.mockResolvedValue({
          data: null,
          error: new Error('Database connection failed'),
        });

        // Act & Assert: Should throw error
        await expect(
          service.detectDeforestation(
            testParcelleId,
            testGeometry,
            testSurfaceHectares,
            { supabase: mockSupabase, storeEvents: true }
          )
        ).rejects.toThrow('Failed to create deforestation event');
      });
    });
  });
});
