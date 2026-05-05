/**
 * Unit tests for NDVIService temporal data retrieval
 * 
 * Tests the getTemporalData() method which retrieves NDVI results
 * for a date range with support for different intervals and gap filling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NDVIService } from '../../../lib/satellite/services/ndvi.service';
import type { NDVIResult, HealthStatus } from '../../../lib/satellite/types';

describe('NDVIService - Temporal Data Retrieval', () => {
  let service: NDVIService;
  let mockSupabase: any;

  beforeEach(() => {
    service = new NDVIService();
    
    // Mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    };
  });

  describe('getTemporalData', () => {
    it('should retrieve temporal data for monthly interval', async () => {
      // Arrange
      const parcelleId = 'test-parcelle-123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-03-31');
      const interval = 'monthly';

      // Mock database response with 3 months of data
      const mockData = [
        {
          id: 'ndvi-1',
          parcelle_id: parcelleId,
          imagery_id: null,
          calculation_date: '2024-01-01T00:00:00.000Z',
          mean_ndvi: 0.65,
          min_ndvi: 0.50,
          max_ndvi: 0.80,
          std_dev_ndvi: 0.10,
          health_status: 'excellent',
          ndvi_raster_url: null,
          created_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'ndvi-2',
          parcelle_id: parcelleId,
          imagery_id: null,
          calculation_date: '2024-02-01T00:00:00.000Z',
          mean_ndvi: 0.60,
          min_ndvi: 0.45,
          max_ndvi: 0.75,
          std_dev_ndvi: 0.12,
          health_status: 'good',
          ndvi_raster_url: null,
          created_at: '2024-02-01T00:00:00.000Z',
        },
        {
          id: 'ndvi-3',
          parcelle_id: parcelleId,
          imagery_id: null,
          calculation_date: '2024-03-01T00:00:00.000Z',
          mean_ndvi: 0.55,
          min_ndvi: 0.40,
          max_ndvi: 0.70,
          std_dev_ndvi: 0.11,
          health_status: 'good',
          ndvi_raster_url: null,
          created_at: '2024-03-01T00:00:00.000Z',
        },
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      // Act
      const timeline = await service.getTemporalData(
        parcelleId,
        startDate,
        endDate,
        interval,
        { supabase: mockSupabase }
      );

      // Assert
      expect(timeline).toHaveLength(3); // Jan, Feb, Mar
      expect(timeline[0].date.toISOString()).toBe('2024-01-01T00:00:00.000Z');
      expect(timeline[0].ndvi).toBe(0.65);
      expect(timeline[0].healthStatus).toBe('excellent');
      expect(timeline[0].hasSignificantChange).toBe(false); // First data point

      expect(timeline[1].date.toISOString()).toBe('2024-02-01T00:00:00.000Z');
      expect(timeline[1].ndvi).toBe(0.60);
      expect(timeline[1].healthStatus).toBe('good');
      expect(timeline[1].hasSignificantChange).toBe(false); // Change is 0.05, not > 0.15

      expect(timeline[2].date.toISOString()).toBe('2024-03-01T00:00:00.000Z');
      expect(timeline[2].ndvi).toBe(0.55);
      expect(timeline[2].healthStatus).toBe('good');
      expect(timeline[2].hasSignificantChange).toBe(false); // Change is 0.05, not > 0.15
    });

    it('should retrieve temporal data for weekly interval', async () => {
      // Arrange
      const parcelleId = 'test-parcelle-123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-21');
      const interval = 'weekly';

      // Mock database response with 3 weeks of data
      const mockData = [
        {
          id: 'ndvi-1',
          parcelle_id: parcelleId,
          imagery_id: null,
          calculation_date: '2024-01-01T00:00:00.000Z',
          mean_ndvi: 0.65,
          min_ndvi: 0.50,
          max_ndvi: 0.80,
          std_dev_ndvi: 0.10,
          health_status: 'excellent',
          ndvi_raster_url: null,
          created_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'ndvi-2',
          parcelle_id: parcelleId,
          imagery_id: null,
          calculation_date: '2024-01-08T00:00:00.000Z',
          mean_ndvi: 0.60,
          min_ndvi: 0.45,
          max_ndvi: 0.75,
          std_dev_ndvi: 0.12,
          health_status: 'good',
          ndvi_raster_url: null,
          created_at: '2024-01-08T00:00:00.000Z',
        },
        {
          id: 'ndvi-3',
          parcelle_id: parcelleId,
          imagery_id: null,
          calculation_date: '2024-01-15T00:00:00.000Z',
          mean_ndvi: 0.55,
          min_ndvi: 0.40,
          max_ndvi: 0.70,
          std_dev_ndvi: 0.11,
          health_status: 'good',
          ndvi_raster_url: null,
          created_at: '2024-01-15T00:00:00.000Z',
        },
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      // Act
      const timeline = await service.getTemporalData(
        parcelleId,
        startDate,
        endDate,
        interval,
        { supabase: mockSupabase }
      );

      // Assert
      expect(timeline).toHaveLength(3); // Week 1, 2, 3
      expect(timeline[0].date.toISOString()).toBe('2024-01-01T00:00:00.000Z');
      expect(timeline[1].date.toISOString()).toBe('2024-01-08T00:00:00.000Z');
      expect(timeline[2].date.toISOString()).toBe('2024-01-15T00:00:00.000Z');
    });

    it('should retrieve temporal data for daily interval', async () => {
      // Arrange
      const parcelleId = 'test-parcelle-123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-03');
      const interval = 'daily';

      // Mock database response with 3 days of data
      const mockData = [
        {
          id: 'ndvi-1',
          parcelle_id: parcelleId,
          imagery_id: null,
          calculation_date: '2024-01-01T00:00:00.000Z',
          mean_ndvi: 0.65,
          min_ndvi: 0.50,
          max_ndvi: 0.80,
          std_dev_ndvi: 0.10,
          health_status: 'excellent',
          ndvi_raster_url: null,
          created_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'ndvi-2',
          parcelle_id: parcelleId,
          imagery_id: null,
          calculation_date: '2024-01-02T00:00:00.000Z',
          mean_ndvi: 0.60,
          min_ndvi: 0.45,
          max_ndvi: 0.75,
          std_dev_ndvi: 0.12,
          health_status: 'good',
          ndvi_raster_url: null,
          created_at: '2024-01-02T00:00:00.000Z',
        },
        {
          id: 'ndvi-3',
          parcelle_id: parcelleId,
          imagery_id: null,
          calculation_date: '2024-01-03T00:00:00.000Z',
          mean_ndvi: 0.55,
          min_ndvi: 0.40,
          max_ndvi: 0.70,
          std_dev_ndvi: 0.11,
          health_status: 'good',
          ndvi_raster_url: null,
          created_at: '2024-01-03T00:00:00.000Z',
        },
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      // Act
      const timeline = await service.getTemporalData(
        parcelleId,
        startDate,
        endDate,
        interval,
        { supabase: mockSupabase }
      );

      // Assert
      expect(timeline).toHaveLength(3); // 3 days
      expect(timeline[0].date.toISOString()).toBe('2024-01-01T00:00:00.000Z');
      expect(timeline[1].date.toISOString()).toBe('2024-01-02T00:00:00.000Z');
      expect(timeline[2].date.toISOString()).toBe('2024-01-03T00:00:00.000Z');
    });

    it('should fill gaps with null values when interpolation is disabled', async () => {
      // Arrange
      const parcelleId = 'test-parcelle-123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-03-01');
      const interval = 'monthly';

      // Mock database response with only Jan and Mar data (Feb missing)
      const mockData = [
        {
          id: 'ndvi-1',
          parcelle_id: parcelleId,
          imagery_id: null,
          calculation_date: '2024-01-01T00:00:00.000Z',
          mean_ndvi: 0.65,
          min_ndvi: 0.50,
          max_ndvi: 0.80,
          std_dev_ndvi: 0.10,
          health_status: 'excellent',
          ndvi_raster_url: null,
          created_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'ndvi-3',
          parcelle_id: parcelleId,
          imagery_id: null,
          calculation_date: '2024-03-01T00:00:00.000Z',
          mean_ndvi: 0.55,
          min_ndvi: 0.40,
          max_ndvi: 0.70,
          std_dev_ndvi: 0.11,
          health_status: 'good',
          ndvi_raster_url: null,
          created_at: '2024-03-01T00:00:00.000Z',
        },
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      // Act
      const timeline = await service.getTemporalData(
        parcelleId,
        startDate,
        endDate,
        interval,
        { supabase: mockSupabase, interpolateGaps: false }
      );

      // Assert
      expect(timeline).toHaveLength(3); // Jan, Feb, Mar
      expect(timeline[0].ndvi).toBe(0.65); // Jan has data
      expect(timeline[1].ndvi).toBeNaN(); // Feb is missing (NaN)
      expect(timeline[1].healthStatus).toBe('critical'); // Default for missing data
      expect(timeline[2].ndvi).toBe(0.55); // Mar has data
    });

    it('should interpolate gaps when interpolation is enabled', async () => {
      // Arrange
      const parcelleId = 'test-parcelle-123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-03-01');
      const interval = 'monthly';

      // Mock database response with only Jan and Mar data (Feb missing)
      const mockData = [
        {
          id: 'ndvi-1',
          parcelle_id: parcelleId,
          imagery_id: null,
          calculation_date: '2024-01-01T00:00:00.000Z',
          mean_ndvi: 0.60,
          min_ndvi: 0.50,
          max_ndvi: 0.70,
          std_dev_ndvi: 0.10,
          health_status: 'good',
          ndvi_raster_url: null,
          created_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'ndvi-3',
          parcelle_id: parcelleId,
          imagery_id: null,
          calculation_date: '2024-03-01T00:00:00.000Z',
          mean_ndvi: 0.50,
          min_ndvi: 0.40,
          max_ndvi: 0.60,
          std_dev_ndvi: 0.11,
          health_status: 'fair',
          ndvi_raster_url: null,
          created_at: '2024-03-01T00:00:00.000Z',
        },
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      // Act
      const timeline = await service.getTemporalData(
        parcelleId,
        startDate,
        endDate,
        interval,
        { supabase: mockSupabase, interpolateGaps: true }
      );

      // Assert
      expect(timeline).toHaveLength(3); // Jan, Feb, Mar
      expect(timeline[0].ndvi).toBe(0.60); // Jan has data
      expect(timeline[1].ndvi).toBe(0.55); // Feb is interpolated (0.60 + 0.50) / 2
      expect(timeline[1].healthStatus).toBe('good'); // Calculated from interpolated NDVI
      expect(timeline[2].ndvi).toBe(0.50); // Mar has data
    });

    it('should detect significant changes (> 0.15)', async () => {
      // Arrange
      const parcelleId = 'test-parcelle-123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-03-01');
      const interval = 'monthly';

      // Mock database response with significant NDVI drop in Feb
      const mockData = [
        {
          id: 'ndvi-1',
          parcelle_id: parcelleId,
          imagery_id: null,
          calculation_date: '2024-01-01T00:00:00.000Z',
          mean_ndvi: 0.70,
          min_ndvi: 0.60,
          max_ndvi: 0.80,
          std_dev_ndvi: 0.10,
          health_status: 'excellent',
          ndvi_raster_url: null,
          created_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'ndvi-2',
          parcelle_id: parcelleId,
          imagery_id: null,
          calculation_date: '2024-02-01T00:00:00.000Z',
          mean_ndvi: 0.50, // Drop of 0.20 (significant)
          min_ndvi: 0.40,
          max_ndvi: 0.60,
          std_dev_ndvi: 0.12,
          health_status: 'fair',
          ndvi_raster_url: null,
          created_at: '2024-02-01T00:00:00.000Z',
        },
        {
          id: 'ndvi-3',
          parcelle_id: parcelleId,
          imagery_id: null,
          calculation_date: '2024-03-01T00:00:00.000Z',
          mean_ndvi: 0.48, // Drop of 0.02 (not significant)
          min_ndvi: 0.38,
          max_ndvi: 0.58,
          std_dev_ndvi: 0.11,
          health_status: 'fair',
          ndvi_raster_url: null,
          created_at: '2024-03-01T00:00:00.000Z',
        },
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      // Act
      const timeline = await service.getTemporalData(
        parcelleId,
        startDate,
        endDate,
        interval,
        { supabase: mockSupabase }
      );

      // Assert
      expect(timeline).toHaveLength(3);
      expect(timeline[0].hasSignificantChange).toBe(false); // First data point
      expect(timeline[1].hasSignificantChange).toBe(true); // Change of 0.20 > 0.15
      expect(timeline[2].hasSignificantChange).toBe(false); // Change of 0.02 < 0.15
    });

    it('should handle empty database response', async () => {
      // Arrange
      const parcelleId = 'test-parcelle-123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-03-01');
      const interval = 'monthly';

      mockSupabase.order.mockResolvedValue({ data: [], error: null });

      // Act
      const timeline = await service.getTemporalData(
        parcelleId,
        startDate,
        endDate,
        interval,
        { supabase: mockSupabase }
      );

      // Assert
      expect(timeline).toHaveLength(3); // Jan, Feb, Mar (all with null data)
      expect(timeline[0].ndvi).toBeNaN();
      expect(timeline[1].ndvi).toBeNaN();
      expect(timeline[2].ndvi).toBeNaN();
    });

    it('should throw error on database failure', async () => {
      // Arrange
      const parcelleId = 'test-parcelle-123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-03-01');
      const interval = 'monthly';

      mockSupabase.order.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      // Act & Assert
      await expect(
        service.getTemporalData(parcelleId, startDate, endDate, interval, {
          supabase: mockSupabase,
        })
      ).rejects.toThrow('Failed to retrieve temporal data');
    });

    it('should handle monthly interval with month-end dates correctly', async () => {
      // Arrange
      const parcelleId = 'test-parcelle-123';
      const startDate = new Date('2024-01-31'); // Jan 31
      const endDate = new Date('2024-03-31'); // Mar 31
      const interval = 'monthly';

      // Mock database response
      const mockData = [
        {
          id: 'ndvi-1',
          parcelle_id: parcelleId,
          imagery_id: null,
          calculation_date: '2024-01-31T00:00:00.000Z',
          mean_ndvi: 0.65,
          min_ndvi: 0.50,
          max_ndvi: 0.80,
          std_dev_ndvi: 0.10,
          health_status: 'excellent',
          ndvi_raster_url: null,
          created_at: '2024-01-31T00:00:00.000Z',
        },
        {
          id: 'ndvi-2',
          parcelle_id: parcelleId,
          imagery_id: null,
          calculation_date: '2024-02-29T00:00:00.000Z', // Feb 29 (leap year)
          mean_ndvi: 0.60,
          min_ndvi: 0.45,
          max_ndvi: 0.75,
          std_dev_ndvi: 0.12,
          health_status: 'good',
          ndvi_raster_url: null,
          created_at: '2024-02-29T00:00:00.000Z',
        },
        {
          id: 'ndvi-3',
          parcelle_id: parcelleId,
          imagery_id: null,
          calculation_date: '2024-03-31T00:00:00.000Z',
          mean_ndvi: 0.55,
          min_ndvi: 0.40,
          max_ndvi: 0.70,
          std_dev_ndvi: 0.11,
          health_status: 'good',
          ndvi_raster_url: null,
          created_at: '2024-03-31T00:00:00.000Z',
        },
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      // Act
      const timeline = await service.getTemporalData(
        parcelleId,
        startDate,
        endDate,
        interval,
        { supabase: mockSupabase }
      );

      // Assert
      expect(timeline).toHaveLength(3);
      // Dates should be adjusted to last day of month when day doesn't exist
      expect(timeline[0].date.getUTCDate()).toBe(31); // Jan 31
      expect(timeline[1].date.getUTCDate()).toBe(29); // Feb 29 (leap year)
      expect(timeline[2].date.getUTCDate()).toBe(31); // Mar 31
    });
  });
});
