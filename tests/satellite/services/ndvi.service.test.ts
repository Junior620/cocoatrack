/**
 * Unit tests for NDVIService
 * 
 * Tests NDVI calculation logic, statistics computation, health status classification,
 * and edge case handling.
 * 
 * Requirements: Task 2.1.1
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NDVIService } from '@/lib/satellite/services/ndvi.service';
import { imageryService } from '@/lib/satellite/services/imagery.service';
import type { BandData } from '@/lib/satellite/types';
import type { MultiPolygon } from 'geojson';

// Mock the imagery service
vi.mock('@/lib/satellite/services/imagery.service', () => ({
  imageryService: {
    getBands: vi.fn(),
  },
}));

// Mock the storage service
vi.mock('@/lib/satellite/services/storage.service', () => ({
  storageService: {
    uploadNDVIRaster: vi.fn().mockResolvedValue({
      publicUrl: 'https://example.com/raster.png',
    }),
  },
}));

// Mock the raster generator service
vi.mock('@/lib/satellite/services/raster-generator.service', () => ({
  rasterGeneratorService: {
    generateRaster: vi.fn().mockResolvedValue({
      buffer: Buffer.from('mock-raster-data'),
      width: 512,
      height: 512,
    }),
  },
}));

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn(),
  upsert: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

describe('NDVIService', () => {
  let service: NDVIService;
  let mockGeometry: MultiPolygon;

  beforeEach(() => {
    service = new NDVIService();
    mockGeometry = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [10.0, 5.0],
            [10.1, 5.0],
            [10.1, 5.1],
            [10.0, 5.1],
            [10.0, 5.0],
          ],
        ],
      ],
    };
    vi.clearAllMocks();
    
    // Reset Supabase mock to default behavior
    mockSupabaseClient.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116' }, // No rows found
    });
    mockSupabaseClient.upsert.mockResolvedValue({
      error: null,
    });
  });

  describe('calculatePixelNDVI', () => {
    it('should calculate NDVI correctly using formula (NIR - Red) / (NIR + Red)', () => {
      // Access private method via type assertion for testing
      const calculatePixelNDVI = (service as any).calculatePixelNDVI.bind(service);

      // Test case 1: NIR=300, Red=100
      // Expected: (300-100)/(300+100) = 200/400 = 0.5
      expect(calculatePixelNDVI(300, 100)).toBeCloseTo(0.5, 5);

      // Test case 2: NIR=400, Red=200
      // Expected: (400-200)/(400+200) = 200/600 = 0.333...
      expect(calculatePixelNDVI(400, 200)).toBeCloseTo(0.333, 3);

      // Test case 3: NIR=800, Red=200
      // Expected: (800-200)/(800+200) = 600/1000 = 0.6
      expect(calculatePixelNDVI(800, 200)).toBeCloseTo(0.6, 5);

      // Test case 4: NIR=100, Red=300 (Red > NIR, negative NDVI)
      // Expected: (100-300)/(100+300) = -200/400 = -0.5
      expect(calculatePixelNDVI(100, 300)).toBeCloseTo(-0.5, 5);
    });

    it('should handle division by zero when NIR + Red = 0', () => {
      const calculatePixelNDVI = (service as any).calculatePixelNDVI.bind(service);

      // When both NIR and Red are 0, should return 0 (not NaN or Infinity)
      expect(calculatePixelNDVI(0, 0)).toBe(0);

      // When NIR + Red is very close to 0 (within epsilon)
      expect(calculatePixelNDVI(1e-11, -1e-11)).toBe(0);
    });

    it('should handle NaN inputs', () => {
      const calculatePixelNDVI = (service as any).calculatePixelNDVI.bind(service);

      // NaN inputs should return NaN
      expect(calculatePixelNDVI(NaN, 100)).toBeNaN();
      expect(calculatePixelNDVI(100, NaN)).toBeNaN();
      expect(calculatePixelNDVI(NaN, NaN)).toBeNaN();
    });

    it('should clamp values to [-1, 1] range', () => {
      const calculatePixelNDVI = (service as any).calculatePixelNDVI.bind(service);

      // Normal values should be within range
      const ndvi1 = calculatePixelNDVI(300, 100);
      expect(ndvi1).toBeGreaterThanOrEqual(-1);
      expect(ndvi1).toBeLessThanOrEqual(1);

      // Edge case: NIR >> Red should approach 1
      const ndvi2 = calculatePixelNDVI(1000, 1);
      expect(ndvi2).toBeGreaterThanOrEqual(-1);
      expect(ndvi2).toBeLessThanOrEqual(1);
      expect(ndvi2).toBeCloseTo(0.998, 3);

      // Edge case: Red >> NIR should approach -1
      const ndvi3 = calculatePixelNDVI(1, 1000);
      expect(ndvi3).toBeGreaterThanOrEqual(-1);
      expect(ndvi3).toBeLessThanOrEqual(1);
      expect(ndvi3).toBeCloseTo(-0.998, 3);
    });
  });

  describe('calculatePixelWiseNDVI', () => {
    it('should calculate NDVI for all pixels in 2D arrays', () => {
      const calculatePixelWiseNDVI = (service as any).calculatePixelWiseNDVI.bind(service);

      const redBand = [
        [100, 150],
        [200, 250],
      ];

      const nirBand = [
        [300, 350],
        [400, 450],
      ];

      const ndviValues = calculatePixelWiseNDVI(redBand, nirBand);

      // Should have 4 values (2x2 array)
      expect(ndviValues).toHaveLength(4);

      // Verify each calculation
      // Pixel [0,0]: (300-100)/(300+100) = 0.5
      expect(ndviValues[0]).toBeCloseTo(0.5, 5);

      // Pixel [0,1]: (350-150)/(350+150) = 0.4
      expect(ndviValues[1]).toBeCloseTo(0.4, 5);

      // Pixel [1,0]: (400-200)/(400+200) = 0.333...
      expect(ndviValues[2]).toBeCloseTo(0.333, 3);

      // Pixel [1,1]: (450-250)/(450+250) = 0.286
      expect(ndviValues[3]).toBeCloseTo(0.286, 3);
    });

    it('should handle empty arrays', () => {
      const calculatePixelWiseNDVI = (service as any).calculatePixelWiseNDVI.bind(service);

      const redBand: number[][] = [];
      const nirBand: number[][] = [];

      const ndviValues = calculatePixelWiseNDVI(redBand, nirBand);

      expect(ndviValues).toHaveLength(0);
    });

    it('should skip invalid rows with mismatched dimensions', () => {
      const calculatePixelWiseNDVI = (service as any).calculatePixelWiseNDVI.bind(service);

      const redBand = [
        [100, 150],
        [200], // Invalid: only 1 element
      ];

      const nirBand = [
        [300, 350],
        [400, 450], // Has 2 elements
      ];

      const ndviValues = calculatePixelWiseNDVI(redBand, nirBand);

      // Should only process first row (2 pixels)
      expect(ndviValues).toHaveLength(2);
      expect(ndviValues[0]).toBeCloseTo(0.5, 5);
      expect(ndviValues[1]).toBeCloseTo(0.4, 5);
    });

    it('should preserve NaN values for filtering', () => {
      const calculatePixelWiseNDVI = (service as any).calculatePixelWiseNDVI.bind(service);

      const redBand = [
        [100, NaN],
        [200, 250],
      ];

      const nirBand = [
        [300, 350],
        [NaN, 450],
      ];

      const ndviValues = calculatePixelWiseNDVI(redBand, nirBand);

      expect(ndviValues).toHaveLength(4);
      expect(ndviValues[0]).toBeCloseTo(0.5, 5); // Valid
      expect(ndviValues[1]).toBeNaN(); // NaN in Red
      expect(ndviValues[2]).toBeNaN(); // NaN in NIR
      expect(ndviValues[3]).toBeCloseTo(0.286, 3); // Valid
    });
  });

  describe('calculateStatistics', () => {
    it('should calculate mean, min, max, and standard deviation correctly', () => {
      const calculateStatistics = (service as any).calculateStatistics.bind(service);

      const ndviValues = [0.5, 0.6, 0.7, 0.8, 0.9];

      const stats = calculateStatistics(ndviValues);

      // Mean: (0.5 + 0.6 + 0.7 + 0.8 + 0.9) / 5 = 3.5 / 5 = 0.7
      expect(stats.mean).toBeCloseTo(0.7, 5);

      // Min: 0.5
      expect(stats.min).toBe(0.5);

      // Max: 0.9
      expect(stats.max).toBe(0.9);

      // Standard deviation
      // Variance = [(0.5-0.7)^2 + (0.6-0.7)^2 + (0.7-0.7)^2 + (0.8-0.7)^2 + (0.9-0.7)^2] / 5
      //          = [0.04 + 0.01 + 0 + 0.01 + 0.04] / 5 = 0.1 / 5 = 0.02
      // Std Dev = sqrt(0.02) ≈ 0.1414
      expect(stats.stdDev).toBeCloseTo(0.1414, 4);

      // Valid pixel count
      expect(stats.validPixelCount).toBe(5);
    });

    it('should filter out NaN values before calculating statistics', () => {
      const calculateStatistics = (service as any).calculateStatistics.bind(service);

      const ndviValues = [0.5, NaN, 0.7, NaN, 0.9];

      const stats = calculateStatistics(ndviValues);

      // Should only use valid values: [0.5, 0.7, 0.9]
      // Mean: (0.5 + 0.7 + 0.9) / 3 = 2.1 / 3 = 0.7
      expect(stats.mean).toBeCloseTo(0.7, 5);
      expect(stats.min).toBe(0.5);
      expect(stats.max).toBe(0.9);
      expect(stats.validPixelCount).toBe(3);
    });

    it('should throw InsufficientDataError when no valid values exist', () => {
      const calculateStatistics = (service as any).calculateStatistics.bind(service);

      const ndviValues = [NaN, NaN, NaN];

      expect(() => calculateStatistics(ndviValues)).toThrow('No valid NDVI values found');
    });

    it('should handle single valid value', () => {
      const calculateStatistics = (service as any).calculateStatistics.bind(service);

      const ndviValues = [0.75];

      const stats = calculateStatistics(ndviValues);

      expect(stats.mean).toBe(0.75);
      expect(stats.min).toBe(0.75);
      expect(stats.max).toBe(0.75);
      expect(stats.stdDev).toBe(0); // No variance with single value
      expect(stats.validPixelCount).toBe(1);
    });
  });

  describe('calculateHealthStatus', () => {
    it('should classify NDVI as excellent (0.65-1.0) for cocoa', () => {
      expect(service.calculateHealthStatus(0.65)).toBe('excellent');
      expect(service.calculateHealthStatus(0.75)).toBe('excellent');
      expect(service.calculateHealthStatus(1.0)).toBe('excellent');
    });

    it('should classify NDVI as good (0.55-0.65) for cocoa', () => {
      expect(service.calculateHealthStatus(0.55)).toBe('good');
      expect(service.calculateHealthStatus(0.60)).toBe('good');
      expect(service.calculateHealthStatus(0.64)).toBe('good');
    });

    it('should classify NDVI as fair (0.45-0.55) for cocoa', () => {
      expect(service.calculateHealthStatus(0.45)).toBe('fair');
      expect(service.calculateHealthStatus(0.50)).toBe('fair');
      expect(service.calculateHealthStatus(0.54)).toBe('fair');
    });

    it('should classify NDVI as poor (0.30-0.45) for cocoa', () => {
      expect(service.calculateHealthStatus(0.30)).toBe('poor');
      expect(service.calculateHealthStatus(0.37)).toBe('poor');
      expect(service.calculateHealthStatus(0.44)).toBe('poor');
    });

    it('should classify NDVI as critical (0.0-0.30) for cocoa', () => {
      expect(service.calculateHealthStatus(0.0)).toBe('critical');
      expect(service.calculateHealthStatus(0.15)).toBe('critical');
      expect(service.calculateHealthStatus(0.29)).toBe('critical');
    });

    it('should handle negative NDVI values as critical', () => {
      expect(service.calculateHealthStatus(-0.5)).toBe('critical');
      expect(service.calculateHealthStatus(-1.0)).toBe('critical');
    });
  });

  describe('calculateNDVI', () => {
    it('should calculate NDVI successfully with valid band data', async () => {
      // Mock band data with at least 10 pixels (MIN_PIXEL_COUNT)
      const mockBandData: BandData = {
        red: [
          [100, 150, 200],
          [250, 300, 350],
          [400, 450, 500],
          [550, 600, 650],
        ],
        nir: [
          [300, 350, 400],
          [450, 500, 550],
          [600, 650, 700],
          [750, 800, 850],
        ],
        bounds: [10.0, 5.0, 10.1, 5.1],
        resolution: 10,
      };

      vi.mocked(imageryService.getBands).mockResolvedValue(mockBandData);

      const result = await service.calculateNDVI(
        'parcelle-123',
        mockGeometry,
        new Date('2024-01-15')
      );

      // Verify result structure
      expect(result.parcelleId).toBe('parcelle-123');
      expect(result.calculationDate).toEqual(new Date('2024-01-15'));

      // Verify NDVI statistics are calculated
      expect(result.meanNDVI).toBeGreaterThan(0);
      expect(result.minNDVI).toBeLessThanOrEqual(result.meanNDVI);
      expect(result.maxNDVI).toBeGreaterThanOrEqual(result.meanNDVI);
      expect(result.stdDevNDVI).toBeGreaterThanOrEqual(0);

      // Health status should be defined
      expect(result.healthStatus).toBeDefined();
      expect(['excellent', 'good', 'fair', 'poor', 'critical']).toContain(result.healthStatus);

      // Verify getBands was called correctly
      expect(imageryService.getBands).toHaveBeenCalledWith(
        mockGeometry,
        new Date('2024-01-15'),
        ['B4', 'B8']
      );
    });

    it('should throw InsufficientDataError when pixel count is below minimum', async () => {
      // Mock band data with very few pixels
      const mockBandData: BandData = {
        red: [[100]],
        nir: [[300]],
        bounds: [10.0, 5.0, 10.1, 5.1],
        resolution: 10,
      };

      vi.mocked(imageryService.getBands).mockResolvedValue(mockBandData);

      await expect(
        service.calculateNDVI('parcelle-123', mockGeometry, new Date('2024-01-15'))
      ).rejects.toThrow('Insufficient valid pixels');
    });

    it('should throw NDVICalculationError when band retrieval fails', async () => {
      vi.mocked(imageryService.getBands).mockRejectedValue(
        new Error('GEE API error')
      );

      await expect(
        service.calculateNDVI('parcelle-123', mockGeometry, new Date('2024-01-15'))
      ).rejects.toThrow('Failed to retrieve bands');
    });

    it('should handle band data with NaN values', async () => {
      // Mock band data with some NaN values but enough valid pixels (>10)
      const mockBandData: BandData = {
        red: [
          [100, NaN, 150, 200],
          [250, 300, NaN, 350],
          [400, 450, 500, 550],
          [600, 650, 700, 750],
        ],
        nir: [
          [300, 350, NaN, 400],
          [NaN, 500, 550, 600],
          [650, 700, 750, 800],
          [850, 900, 950, 1000],
        ],
        bounds: [10.0, 5.0, 10.1, 5.1],
        resolution: 10,
      };

      vi.mocked(imageryService.getBands).mockResolvedValue(mockBandData);

      const result = await service.calculateNDVI(
        'parcelle-123',
        mockGeometry,
        new Date('2024-01-15')
      );

      // Should successfully calculate with valid pixels only
      // Valid pixels: 16 total - 4 NaN = 12 valid pixels (> minimum of 10 required)
      expect(result.meanNDVI).toBeDefined();
      expect(result.healthStatus).toBeDefined();
    });
  });

  describe('isValidNDVI', () => {
    it('should return true for valid NDVI values', () => {
      expect(service.isValidNDVI(0.5)).toBe(true);
      expect(service.isValidNDVI(-0.5)).toBe(true);
      expect(service.isValidNDVI(1.0)).toBe(true);
      expect(service.isValidNDVI(-1.0)).toBe(true);
      expect(service.isValidNDVI(0.0)).toBe(true);
    });

    it('should return false for invalid NDVI values', () => {
      expect(service.isValidNDVI(NaN)).toBe(false);
      expect(service.isValidNDVI(1.5)).toBe(false);
      expect(service.isValidNDVI(-1.5)).toBe(false);
      expect(service.isValidNDVI(Infinity)).toBe(false);
      expect(service.isValidNDVI(-Infinity)).toBe(false);
    });
  });

  describe('getHealthStatusColor', () => {
    it('should return correct colors for each health status', () => {
      expect(service.getHealthStatusColor('excellent')).toBe('#2d5016');
      expect(service.getHealthStatusColor('good')).toBe('#6FAF3D');
      expect(service.getHealthStatusColor('fair')).toBe('#fbbf24');
      expect(service.getHealthStatusColor('poor')).toBe('#E68A1F');
      expect(service.getHealthStatusColor('critical')).toBe('#ef4444');
    });
  });

  describe('getNDVIColor', () => {
    it('should return correct colors for NDVI ranges', () => {
      // Red (0.0-0.2)
      expect(service.getNDVIColor(0.1)).toBe('#ef4444');

      // Yellow (0.2-0.4)
      expect(service.getNDVIColor(0.3)).toBe('#fbbf24');

      // Light Green (0.4-0.6)
      expect(service.getNDVIColor(0.5)).toBe('#84cc16');

      // Green (0.6-0.8)
      expect(service.getNDVIColor(0.7)).toBe('#22c55e');

      // Dark Green (0.8-1.0)
      expect(service.getNDVIColor(0.9)).toBe('#15803d');
    });
  });

  describe('getRecommendation', () => {
    it('should return appropriate recommendations in French for each health status', () => {
      const excellentRec = service.getRecommendation('excellent');
      expect(excellentRec).toContain('excellente santé');

      const goodRec = service.getRecommendation('good');
      expect(goodRec).toContain('bonne santé');

      const fairRec = service.getRecommendation('fair');
      expect(fairRec).toContain('acceptable');

      const poorRec = service.getRecommendation('poor');
      expect(poorRec).toContain('déclin');

      const criticalRec = service.getRecommendation('critical');
      expect(criticalRec).toContain('critique');
      expect(criticalRec).toContain('Intervention immédiate');
    });
  });

  describe('getCachedNDVI', () => {
    it('should return cached NDVI result when available and fresh', async () => {
      // Mock fresh cached data
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'ndvi-123',
          parcelle_id: 'parcelle-123',
          imagery_id: null,
          calculation_date: '2024-01-15T00:00:00.000Z',
          mean_ndvi: 0.75,
          min_ndvi: 0.65,
          max_ndvi: 0.85,
          std_dev_ndvi: 0.05,
          health_status: 'excellent',
          ndvi_raster_url: null,
          created_at: new Date().toISOString(), // Fresh cache (just created)
        },
        error: null,
      });

      const result = await service.getCachedNDVI(
        'parcelle-123',
        new Date('2024-01-15')
      );

      expect(result).not.toBeNull();
      expect(result?.parcelleId).toBe('parcelle-123');
      expect(result?.meanNDVI).toBe(0.75);
      expect(result?.healthStatus).toBe('excellent');
    });

    it('should return null when cache is stale (> 24 hours)', async () => {
      // Mock stale cached data
      const staleDate = new Date();
      staleDate.setHours(staleDate.getHours() - 25); // 25 hours ago

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'ndvi-123',
          parcelle_id: 'parcelle-123',
          imagery_id: null,
          calculation_date: '2024-01-15T00:00:00.000Z',
          mean_ndvi: 0.75,
          min_ndvi: 0.65,
          max_ndvi: 0.85,
          std_dev_ndvi: 0.05,
          health_status: 'excellent',
          ndvi_raster_url: null,
          created_at: staleDate.toISOString(), // Stale cache
        },
        error: null,
      });

      const result = await service.getCachedNDVI(
        'parcelle-123',
        new Date('2024-01-15')
      );

      // Should return null for stale cache
      expect(result).toBeNull();
    });

    it('should return null when no cached result exists', async () => {
      // Mock no data found (default behavior)
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' }, // No rows found
      });

      const result = await service.getCachedNDVI(
        'parcelle-123',
        new Date('2024-01-15')
      );

      expect(result).toBeNull();
    });

    it('should normalize date to midnight UTC for consistent cache lookups', async () => {
      // Call with date that has time component
      await service.getCachedNDVI(
        'parcelle-123',
        new Date('2024-01-15T14:30:00.000Z')
      );

      // Verify eq was called with normalized date (midnight UTC)
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith(
        'calculation_date',
        '2024-01-15T00:00:00.000Z'
      );
    });

    it('should return null and log error on database failure', async () => {
      // Mock console.error to verify error logging
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock database error
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST500', message: 'Database error' },
      });

      const result = await service.getCachedNDVI(
        'parcelle-123',
        new Date('2024-01-15')
      );

      // Should return null on error (graceful degradation)
      expect(result).toBeNull();

      // Should log error
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('cacheNDVI', () => {
    it('should store NDVI result in database', async () => {
      mockSupabaseClient.upsert.mockResolvedValueOnce({
        error: null,
      });

      const ndviResult = {
        id: 'ndvi-123',
        parcelleId: 'parcelle-123',
        imageryId: null,
        calculationDate: new Date('2024-01-15T14:30:00.000Z'),
        meanNDVI: 0.75,
        minNDVI: 0.65,
        maxNDVI: 0.85,
        stdDevNDVI: 0.05,
        healthStatus: 'excellent' as const,
        ndviRasterUrl: null,
        createdAt: new Date(),
      };

      await service.cacheNDVI(ndviResult);

      // Verify upsert was called
      expect(mockSupabaseClient.upsert).toHaveBeenCalled();

      // Verify upsert was called with correct data structure
      const upsertCall = mockSupabaseClient.upsert.mock.calls[0];
      const row = upsertCall[0];

      expect(row.parcelle_id).toBe('parcelle-123');
      expect(row.mean_ndvi).toBe(0.75);
      expect(row.health_status).toBe('excellent');

      // Verify date was normalized to midnight UTC
      expect(row.calculation_date).toBe('2024-01-15T00:00:00.000Z');

      // Verify onConflict option
      expect(upsertCall[1]).toEqual({
        onConflict: 'parcelle_id,calculation_date',
      });
    });

    it('should throw NDVICalculationError on database failure', async () => {
      mockSupabaseClient.upsert.mockResolvedValueOnce({
        error: { message: 'Database error' },
      });

      const ndviResult = {
        id: 'ndvi-123',
        parcelleId: 'parcelle-123',
        imageryId: null,
        calculationDate: new Date('2024-01-15'),
        meanNDVI: 0.75,
        minNDVI: 0.65,
        maxNDVI: 0.85,
        stdDevNDVI: 0.05,
        healthStatus: 'excellent' as const,
        ndviRasterUrl: null,
        createdAt: new Date(),
      };

      await expect(service.cacheNDVI(ndviResult)).rejects.toThrow(
        'Failed to cache NDVI result'
      );
    });

    it('should normalize date to midnight UTC for consistent cache storage', async () => {
      mockSupabaseClient.upsert.mockResolvedValueOnce({
        error: null,
      });

      const ndviResult = {
        id: 'ndvi-123',
        parcelleId: 'parcelle-123',
        imageryId: null,
        calculationDate: new Date('2024-01-15T14:30:00.000Z'), // Has time component
        meanNDVI: 0.75,
        minNDVI: 0.65,
        maxNDVI: 0.85,
        stdDevNDVI: 0.05,
        healthStatus: 'excellent' as const,
        ndviRasterUrl: null,
        createdAt: new Date(),
      };

      await service.cacheNDVI(ndviResult);

      // Verify date was normalized
      const upsertCall = mockSupabaseClient.upsert.mock.calls[0];
      const row = upsertCall[0];

      expect(row.calculation_date).toBe('2024-01-15T00:00:00.000Z');
    });
  });

  describe('calculateNDVI with caching', () => {
    it('should return cached result when available and not forcing recalculation', async () => {
      // Mock cached result
      const cachedResult = {
        id: 'ndvi-cached',
        parcelleId: 'parcelle-123',
        imageryId: null,
        calculationDate: new Date('2024-01-15'),
        meanNDVI: 0.75,
        minNDVI: 0.65,
        maxNDVI: 0.85,
        stdDevNDVI: 0.05,
        healthStatus: 'excellent' as const,
        ndviRasterUrl: null,
        createdAt: new Date(),
      };

      // Spy on getCachedNDVI
      const getCachedSpy = vi.spyOn(service, 'getCachedNDVI').mockResolvedValue(cachedResult);

      const result = await service.calculateNDVI(
        'parcelle-123',
        mockGeometry,
        new Date('2024-01-15'),
        { forceRecalculate: false }
      );

      // Should return cached result
      expect(result).toEqual(cachedResult);

      // Should have called getCachedNDVI
      expect(getCachedSpy).toHaveBeenCalled();

      // Should NOT have called getBands (no recalculation)
      expect(imageryService.getBands).not.toHaveBeenCalled();

      getCachedSpy.mockRestore();
    });

    it('should bypass cache when forceRecalculate is true', async () => {
      // Mock band data
      const mockBandData: BandData = {
        red: [
          [100, 150, 200],
          [250, 300, 350],
          [400, 450, 500],
          [550, 600, 650],
        ],
        nir: [
          [300, 350, 400],
          [450, 500, 550],
          [600, 650, 700],
          [750, 800, 850],
        ],
        bounds: [10.0, 5.0, 10.1, 5.1],
        resolution: 10,
      };

      vi.mocked(imageryService.getBands).mockResolvedValue(mockBandData);

      // Spy on getCachedNDVI
      const getCachedSpy = vi.spyOn(service, 'getCachedNDVI');

      await service.calculateNDVI(
        'parcelle-123',
        mockGeometry,
        new Date('2024-01-15'),
        { forceRecalculate: true }
      );

      // Should NOT have called getCachedNDVI
      expect(getCachedSpy).not.toHaveBeenCalled();

      // Should have called getBands (recalculation)
      expect(imageryService.getBands).toHaveBeenCalled();

      getCachedSpy.mockRestore();
    });

    it('should store result in cache when storeResult is true', async () => {
      // Mock band data
      const mockBandData: BandData = {
        red: [
          [100, 150, 200],
          [250, 300, 350],
          [400, 450, 500],
          [550, 600, 650],
        ],
        nir: [
          [300, 350, 400],
          [450, 500, 550],
          [600, 650, 700],
          [750, 800, 850],
        ],
        bounds: [10.0, 5.0, 10.1, 5.1],
        resolution: 10,
      };

      vi.mocked(imageryService.getBands).mockResolvedValue(mockBandData);

      // Spy on cacheNDVI
      const cacheNDVISpy = vi.spyOn(service, 'cacheNDVI').mockResolvedValue();

      await service.calculateNDVI(
        'parcelle-123',
        mockGeometry,
        new Date('2024-01-15'),
        { storeResult: true }
      );

      // Should have called cacheNDVI
      expect(cacheNDVISpy).toHaveBeenCalled();

      cacheNDVISpy.mockRestore();
    });

    it('should not store result in cache when storeResult is false', async () => {
      // Mock band data
      const mockBandData: BandData = {
        red: [
          [100, 150, 200],
          [250, 300, 350],
          [400, 450, 500],
          [550, 600, 650],
        ],
        nir: [
          [300, 350, 400],
          [450, 500, 550],
          [600, 650, 700],
          [750, 800, 850],
        ],
        bounds: [10.0, 5.0, 10.1, 5.1],
        resolution: 10,
      };

      vi.mocked(imageryService.getBands).mockResolvedValue(mockBandData);

      // Spy on cacheNDVI
      const cacheNDVISpy = vi.spyOn(service, 'cacheNDVI');

      await service.calculateNDVI(
        'parcelle-123',
        mockGeometry,
        new Date('2024-01-15'),
        { storeResult: false }
      );

      // Should NOT have called cacheNDVI
      expect(cacheNDVISpy).not.toHaveBeenCalled();

      cacheNDVISpy.mockRestore();
    });
  });

  describe('getNDVITrend', () => {
    it('should calculate trend as improving when NDVI increases significantly', async () => {
      // Mock historical NDVI data showing improvement
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.lte.mockReturnThis();
      mockSupabaseClient.order.mockResolvedValueOnce({
        data: [
          { calculation_date: '2024-01-01T00:00:00.000Z', mean_ndvi: 0.5 },
          { calculation_date: '2024-02-01T00:00:00.000Z', mean_ndvi: 0.6 },
          { calculation_date: '2024-03-01T00:00:00.000Z', mean_ndvi: 0.7 },
        ],
        error: null,
      });

      const trend = await service.getNDVITrend('parcelle-123');

      expect(trend.trend).toBe('improving');
      expect(trend.changeRate).toBeGreaterThan(0.05); // Significant positive change
      expect(trend.dataPoints).toBe(3);
      expect(trend.startNDVI).toBe(0.5);
      expect(trend.endNDVI).toBe(0.7);
    });

    it('should calculate trend as declining when NDVI decreases significantly', async () => {
      // Mock historical NDVI data showing decline
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.lte.mockReturnThis();
      mockSupabaseClient.order.mockResolvedValueOnce({
        data: [
          { calculation_date: '2024-01-01T00:00:00.000Z', mean_ndvi: 0.7 },
          { calculation_date: '2024-02-01T00:00:00.000Z', mean_ndvi: 0.6 },
          { calculation_date: '2024-03-01T00:00:00.000Z', mean_ndvi: 0.5 },
        ],
        error: null,
      });

      const trend = await service.getNDVITrend('parcelle-123');

      expect(trend.trend).toBe('declining');
      expect(trend.changeRate).toBeLessThan(-0.05); // Significant negative change
      expect(trend.dataPoints).toBe(3);
      expect(trend.startNDVI).toBe(0.7);
      expect(trend.endNDVI).toBe(0.5);
    });

    it('should calculate trend as stable when NDVI changes minimally', async () => {
      // Mock historical NDVI data showing stability
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.lte.mockReturnThis();
      mockSupabaseClient.order.mockResolvedValueOnce({
        data: [
          { calculation_date: '2024-01-01T00:00:00.000Z', mean_ndvi: 0.6 },
          { calculation_date: '2024-02-01T00:00:00.000Z', mean_ndvi: 0.61 },
          { calculation_date: '2024-03-01T00:00:00.000Z', mean_ndvi: 0.62 },
        ],
        error: null,
      });

      const trend = await service.getNDVITrend('parcelle-123');

      expect(trend.trend).toBe('stable');
      expect(trend.changeRate).toBeGreaterThanOrEqual(-0.05);
      expect(trend.changeRate).toBeLessThanOrEqual(0.05);
      expect(trend.dataPoints).toBe(3);
    });

    it('should default to past 3 months when dates not specified', async () => {
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.lte.mockReturnThis();
      mockSupabaseClient.order.mockResolvedValueOnce({
        data: [
          { calculation_date: '2024-01-01T00:00:00.000Z', mean_ndvi: 0.6 },
          { calculation_date: '2024-02-01T00:00:00.000Z', mean_ndvi: 0.65 },
        ],
        error: null,
      });

      const trend = await service.getNDVITrend('parcelle-123');

      // Verify gte was called with a date approximately 90 days ago
      expect(mockSupabaseClient.gte).toHaveBeenCalled();
      const gteCall = mockSupabaseClient.gte.mock.calls[0];
      expect(gteCall[0]).toBe('calculation_date');
      
      // Verify lte was called with current date
      expect(mockSupabaseClient.lte).toHaveBeenCalled();
      const lteCall = mockSupabaseClient.lte.mock.calls[0];
      expect(lteCall[0]).toBe('calculation_date');
    });

    it('should use custom date range when specified', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-03-31');

      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.lte.mockReturnThis();
      mockSupabaseClient.order.mockResolvedValueOnce({
        data: [
          { calculation_date: '2024-01-01T00:00:00.000Z', mean_ndvi: 0.6 },
          { calculation_date: '2024-03-31T00:00:00.000Z', mean_ndvi: 0.7 },
        ],
        error: null,
      });

      const trend = await service.getNDVITrend('parcelle-123', startDate, endDate);

      expect(trend.startDate).toEqual(startDate);
      expect(trend.endDate).toEqual(endDate);
    });

    it('should throw InsufficientDataError when less than 2 data points', async () => {
      // Mock insufficient data
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.lte.mockReturnThis();
      mockSupabaseClient.order.mockResolvedValueOnce({
        data: [
          { calculation_date: '2024-01-01T00:00:00.000Z', mean_ndvi: 0.6 },
        ],
        error: null,
      });

      await expect(
        service.getNDVITrend('parcelle-123')
      ).rejects.toThrow('Insufficient data points for trend analysis');
    });

    it('should throw InsufficientDataError when no data available', async () => {
      // Mock no data
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.lte.mockReturnThis();
      mockSupabaseClient.order.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await expect(
        service.getNDVITrend('parcelle-123')
      ).rejects.toThrow('Insufficient data points for trend analysis');
    });

    it('should throw NDVICalculationError on database failure', async () => {
      // Mock database error
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.gte.mockReturnThis();
      mockSupabaseClient.lte.mockReturnThis();
      mockSupabaseClient.order.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(
        service.getNDVITrend('parcelle-123')
      ).rejects.toThrow('Failed to calculate NDVI trend');
    });

    it('should calculate linear regression correctly', () => {
      // Access private method for testing
      const calculateLinearRegression = (service as any).calculateLinearRegression.bind(service);

      // Test data: perfect linear increase
      const dataPoints = [
        { date: new Date('2024-01-01'), ndvi: 0.5 },
        { date: new Date('2024-02-01'), ndvi: 0.6 },
        { date: new Date('2024-03-01'), ndvi: 0.7 },
      ];

      const result = calculateLinearRegression(dataPoints);

      // Should have positive slope (increasing trend)
      expect(result.slope).toBeGreaterThan(0);
      expect(result.startNDVI).toBe(0.5);
      expect(result.endNDVI).toBe(0.7);
    });

    it('should handle data points with same timestamp gracefully', () => {
      const calculateLinearRegression = (service as any).calculateLinearRegression.bind(service);

      // Test data: all same timestamp (edge case)
      const sameDate = new Date('2024-01-01');
      const dataPoints = [
        { date: sameDate, ndvi: 0.5 },
        { date: sameDate, ndvi: 0.6 },
      ];

      const result = calculateLinearRegression(dataPoints);

      // Slope should be 0 when denominator is 0 (all same x values)
      expect(result.slope).toBe(0);
    });
  });

  describe('calculateTemporalStatistics', () => {
    beforeEach(() => {
      // Reset mocks for temporal statistics tests
      vi.clearAllMocks();
    });

    it('should calculate complete temporal statistics successfully', async () => {
      // Mock temporal data retrieval
      const mockTimeline = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.5,
          cloudCover: 10,
          healthStatus: 'fair' as const,
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.65,
          cloudCover: 15,
          healthStatus: 'good' as const,
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-03-01'),
          ndvi: 0.75,
          cloudCover: 20,
          healthStatus: 'excellent' as const,
          hasSignificantChange: false,
        },
      ];

      // Mock getTemporalData
      const getTemporalDataSpy = vi.spyOn(service, 'getTemporalData').mockResolvedValue(mockTimeline);

      // Mock getNDVITrend
      const mockTrend = {
        trend: 'improving' as const,
        changeRate: 0.08,
        dataPoints: 3,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-01'),
        startNDVI: 0.5,
        endNDVI: 0.75,
      };
      const getNDVITrendSpy = vi.spyOn(service, 'getNDVITrend').mockResolvedValue(mockTrend);

      // Mock detectSignificantChanges
      const mockSignificantChanges = [
        {
          date: new Date('2024-02-01'),
          previousNDVI: 0.5,
          currentNDVI: 0.65,
          absoluteChange: 0.15,
          percentageChange: 30,
          direction: 'increase' as const,
        },
      ];
      const detectSignificantChangesSpy = vi.spyOn(service, 'detectSignificantChanges').mockReturnValue(mockSignificantChanges);

      // Call calculateTemporalStatistics
      const result = await service.calculateTemporalStatistics(
        'parcelle-123',
        new Date('2024-01-01'),
        new Date('2024-03-01'),
        'monthly'
      );

      // Verify all methods were called
      expect(getTemporalDataSpy).toHaveBeenCalledWith(
        'parcelle-123',
        new Date('2024-01-01'),
        new Date('2024-03-01'),
        'monthly',
        {}
      );
      expect(getNDVITrendSpy).toHaveBeenCalledWith(
        'parcelle-123',
        new Date('2024-01-01'),
        new Date('2024-03-01')
      );
      expect(detectSignificantChangesSpy).toHaveBeenCalledWith(mockTimeline);

      // Verify result structure
      expect(result.timeline).toEqual(mockTimeline);
      expect(result.trend).toEqual(mockTrend);
      expect(result.significantChanges).toBe(1);

      // Verify average NDVI calculation
      // (0.5 + 0.65 + 0.75) / 3 = 1.9 / 3 = 0.633...
      expect(result.averageNDVI).toBeCloseTo(0.633, 3);

      // Verify average cloud cover calculation
      // (10 + 15 + 20) / 3 = 45 / 3 = 15
      expect(result.averageCloudCover).toBe(15);

      // Cleanup spies
      getTemporalDataSpy.mockRestore();
      getNDVITrendSpy.mockRestore();
      detectSignificantChangesSpy.mockRestore();
    });

    it('should filter out NaN values when calculating average NDVI', async () => {
      // Mock temporal data with some NaN values
      const mockTimeline = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.5,
          cloudCover: 10,
          healthStatus: 'fair' as const,
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: NaN, // Missing data
          cloudCover: 0,
          healthStatus: 'critical' as const,
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-03-01'),
          ndvi: 0.7,
          cloudCover: 20,
          healthStatus: 'excellent' as const,
          hasSignificantChange: false,
        },
      ];

      const getTemporalDataSpy = vi.spyOn(service, 'getTemporalData').mockResolvedValue(mockTimeline);

      const mockTrend = {
        trend: 'improving' as const,
        changeRate: 0.08,
        dataPoints: 2, // Only 2 valid data points
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-01'),
        startNDVI: 0.5,
        endNDVI: 0.7,
      };
      const getNDVITrendSpy = vi.spyOn(service, 'getNDVITrend').mockResolvedValue(mockTrend);
      const detectSignificantChangesSpy = vi.spyOn(service, 'detectSignificantChanges').mockReturnValue([]);

      const result = await service.calculateTemporalStatistics(
        'parcelle-123',
        new Date('2024-01-01'),
        new Date('2024-03-01'),
        'monthly'
      );

      // Average should only use valid values: (0.5 + 0.7) / 2 = 0.6
      expect(result.averageNDVI).toBeCloseTo(0.6, 5);

      getTemporalDataSpy.mockRestore();
      getNDVITrendSpy.mockRestore();
      detectSignificantChangesSpy.mockRestore();
    });

    it('should handle timeline with no significant changes', async () => {
      const mockTimeline = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.6,
          cloudCover: 10,
          healthStatus: 'good' as const,
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.61,
          cloudCover: 12,
          healthStatus: 'good' as const,
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-03-01'),
          ndvi: 0.62,
          cloudCover: 11,
          healthStatus: 'good' as const,
          hasSignificantChange: false,
        },
      ];

      const getTemporalDataSpy = vi.spyOn(service, 'getTemporalData').mockResolvedValue(mockTimeline);

      const mockTrend = {
        trend: 'stable' as const,
        changeRate: 0.01,
        dataPoints: 3,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-01'),
        startNDVI: 0.6,
        endNDVI: 0.62,
      };
      const getNDVITrendSpy = vi.spyOn(service, 'getNDVITrend').mockResolvedValue(mockTrend);

      // No significant changes (all changes < 0.15)
      const detectSignificantChangesSpy = vi.spyOn(service, 'detectSignificantChanges').mockReturnValue([]);

      const result = await service.calculateTemporalStatistics(
        'parcelle-123',
        new Date('2024-01-01'),
        new Date('2024-03-01'),
        'monthly'
      );

      expect(result.significantChanges).toBe(0);
      expect(result.trend.trend).toBe('stable');

      getTemporalDataSpy.mockRestore();
      getNDVITrendSpy.mockRestore();
      detectSignificantChangesSpy.mockRestore();
    });

    it('should handle timeline with multiple significant changes', async () => {
      const mockTimeline = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.5,
          cloudCover: 10,
          healthStatus: 'fair' as const,
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.7,
          cloudCover: 15,
          healthStatus: 'excellent' as const,
          hasSignificantChange: true,
        },
        {
          date: new Date('2024-03-01'),
          ndvi: 0.4,
          cloudCover: 20,
          healthStatus: 'poor' as const,
          hasSignificantChange: true,
        },
      ];

      const getTemporalDataSpy = vi.spyOn(service, 'getTemporalData').mockResolvedValue(mockTimeline);

      const mockTrend = {
        trend: 'declining' as const,
        changeRate: -0.05,
        dataPoints: 3,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-01'),
        startNDVI: 0.5,
        endNDVI: 0.4,
      };
      const getNDVITrendSpy = vi.spyOn(service, 'getNDVITrend').mockResolvedValue(mockTrend);

      // Two significant changes
      const mockSignificantChanges = [
        {
          date: new Date('2024-02-01'),
          previousNDVI: 0.5,
          currentNDVI: 0.7,
          absoluteChange: 0.2,
          percentageChange: 40,
          direction: 'increase' as const,
        },
        {
          date: new Date('2024-03-01'),
          previousNDVI: 0.7,
          currentNDVI: 0.4,
          absoluteChange: -0.3,
          percentageChange: -42.86,
          direction: 'decrease' as const,
        },
      ];
      const detectSignificantChangesSpy = vi.spyOn(service, 'detectSignificantChanges').mockReturnValue(mockSignificantChanges);

      const result = await service.calculateTemporalStatistics(
        'parcelle-123',
        new Date('2024-01-01'),
        new Date('2024-03-01'),
        'monthly'
      );

      expect(result.significantChanges).toBe(2);
      expect(result.trend.trend).toBe('declining');

      getTemporalDataSpy.mockRestore();
      getNDVITrendSpy.mockRestore();
      detectSignificantChangesSpy.mockRestore();
    });

    it('should calculate average cloud cover correctly', async () => {
      const mockTimeline = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.6,
          cloudCover: 5,
          healthStatus: 'good' as const,
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.65,
          cloudCover: 15,
          healthStatus: 'good' as const,
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-03-01'),
          ndvi: 0.7,
          cloudCover: 25,
          healthStatus: 'excellent' as const,
          hasSignificantChange: false,
        },
      ];

      const getTemporalDataSpy = vi.spyOn(service, 'getTemporalData').mockResolvedValue(mockTimeline);

      const mockTrend = {
        trend: 'improving' as const,
        changeRate: 0.05,
        dataPoints: 3,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-01'),
        startNDVI: 0.6,
        endNDVI: 0.7,
      };
      const getNDVITrendSpy = vi.spyOn(service, 'getNDVITrend').mockResolvedValue(mockTrend);
      const detectSignificantChangesSpy = vi.spyOn(service, 'detectSignificantChanges').mockReturnValue([]);

      const result = await service.calculateTemporalStatistics(
        'parcelle-123',
        new Date('2024-01-01'),
        new Date('2024-03-01'),
        'monthly'
      );

      // Average cloud cover: (5 + 15 + 25) / 3 = 45 / 3 = 15
      expect(result.averageCloudCover).toBe(15);

      getTemporalDataSpy.mockRestore();
      getNDVITrendSpy.mockRestore();
      detectSignificantChangesSpy.mockRestore();
    });

    it('should handle timeline with missing cloud cover data', async () => {
      const mockTimeline = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.6,
          cloudCover: 10,
          healthStatus: 'good' as const,
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.65,
          cloudCover: undefined as any, // Missing cloud cover
          healthStatus: 'good' as const,
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-03-01'),
          ndvi: 0.7,
          cloudCover: 20,
          healthStatus: 'excellent' as const,
          hasSignificantChange: false,
        },
      ];

      const getTemporalDataSpy = vi.spyOn(service, 'getTemporalData').mockResolvedValue(mockTimeline);

      const mockTrend = {
        trend: 'improving' as const,
        changeRate: 0.05,
        dataPoints: 3,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-01'),
        startNDVI: 0.6,
        endNDVI: 0.7,
      };
      const getNDVITrendSpy = vi.spyOn(service, 'getNDVITrend').mockResolvedValue(mockTrend);
      const detectSignificantChangesSpy = vi.spyOn(service, 'detectSignificantChanges').mockReturnValue([]);

      const result = await service.calculateTemporalStatistics(
        'parcelle-123',
        new Date('2024-01-01'),
        new Date('2024-03-01'),
        'monthly'
      );

      // Average cloud cover should only use available values: (10 + 20) / 2 = 15
      expect(result.averageCloudCover).toBe(15);

      getTemporalDataSpy.mockRestore();
      getNDVITrendSpy.mockRestore();
      detectSignificantChangesSpy.mockRestore();
    });

    it('should default to 0 cloud cover when no cloud cover data available', async () => {
      const mockTimeline = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.6,
          cloudCover: undefined as any,
          healthStatus: 'good' as const,
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.65,
          cloudCover: undefined as any,
          healthStatus: 'good' as const,
          hasSignificantChange: false,
        },
      ];

      const getTemporalDataSpy = vi.spyOn(service, 'getTemporalData').mockResolvedValue(mockTimeline);

      const mockTrend = {
        trend: 'stable' as const,
        changeRate: 0.02,
        dataPoints: 2,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-02-01'),
        startNDVI: 0.6,
        endNDVI: 0.65,
      };
      const getNDVITrendSpy = vi.spyOn(service, 'getNDVITrend').mockResolvedValue(mockTrend);
      const detectSignificantChangesSpy = vi.spyOn(service, 'detectSignificantChanges').mockReturnValue([]);

      const result = await service.calculateTemporalStatistics(
        'parcelle-123',
        new Date('2024-01-01'),
        new Date('2024-02-01'),
        'monthly'
      );

      // Should default to 0 when no cloud cover data
      expect(result.averageCloudCover).toBe(0);

      getTemporalDataSpy.mockRestore();
      getNDVITrendSpy.mockRestore();
      detectSignificantChangesSpy.mockRestore();
    });

    it('should throw InsufficientDataError when no valid data points', async () => {
      // Mock timeline with all NaN values
      const mockTimeline = [
        {
          date: new Date('2024-01-01'),
          ndvi: NaN,
          cloudCover: 0,
          healthStatus: 'critical' as const,
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: NaN,
          cloudCover: 0,
          healthStatus: 'critical' as const,
          hasSignificantChange: false,
        },
      ];

      const getTemporalDataSpy = vi.spyOn(service, 'getTemporalData').mockResolvedValue(mockTimeline);

      // Mock getNDVITrend to also throw InsufficientDataError (it will be called first)
      const insufficientDataError = new (await import('@/lib/satellite/types')).InsufficientDataError(
        'Insufficient data points for trend analysis',
        2,
        0
      );
      const getNDVITrendSpy = vi.spyOn(service, 'getNDVITrend').mockRejectedValue(insufficientDataError);

      await expect(
        service.calculateTemporalStatistics(
          'parcelle-123',
          new Date('2024-01-01'),
          new Date('2024-02-01'),
          'monthly'
        )
      ).rejects.toThrow('Insufficient data');

      getTemporalDataSpy.mockRestore();
      getNDVITrendSpy.mockRestore();
    });

    it('should pass options to getTemporalData', async () => {
      const mockTimeline = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.6,
          cloudCover: 10,
          healthStatus: 'good' as const,
          hasSignificantChange: false,
        },
      ];

      const getTemporalDataSpy = vi.spyOn(service, 'getTemporalData').mockResolvedValue(mockTimeline);

      const mockTrend = {
        trend: 'stable' as const,
        changeRate: 0,
        dataPoints: 1,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-01'),
        startNDVI: 0.6,
        endNDVI: 0.6,
      };
      const getNDVITrendSpy = vi.spyOn(service, 'getNDVITrend').mockResolvedValue(mockTrend);
      const detectSignificantChangesSpy = vi.spyOn(service, 'detectSignificantChanges').mockReturnValue([]);

      const mockSupabase = { mock: 'client' };
      await service.calculateTemporalStatistics(
        'parcelle-123',
        new Date('2024-01-01'),
        new Date('2024-01-01'),
        'daily',
        {
          interpolateGaps: true,
          supabase: mockSupabase,
        }
      );

      // Verify options were passed through
      expect(getTemporalDataSpy).toHaveBeenCalledWith(
        'parcelle-123',
        new Date('2024-01-01'),
        new Date('2024-01-01'),
        'daily',
        {
          interpolateGaps: true,
          supabase: mockSupabase,
        }
      );

      getTemporalDataSpy.mockRestore();
      getNDVITrendSpy.mockRestore();
      detectSignificantChangesSpy.mockRestore();
    });

    it('should use monthly interval by default', async () => {
      const mockTimeline = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.6,
          cloudCover: 10,
          healthStatus: 'good' as const,
          hasSignificantChange: false,
        },
      ];

      const getTemporalDataSpy = vi.spyOn(service, 'getTemporalData').mockResolvedValue(mockTimeline);

      const mockTrend = {
        trend: 'stable' as const,
        changeRate: 0,
        dataPoints: 1,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-01'),
        startNDVI: 0.6,
        endNDVI: 0.6,
      };
      const getNDVITrendSpy = vi.spyOn(service, 'getNDVITrend').mockResolvedValue(mockTrend);
      const detectSignificantChangesSpy = vi.spyOn(service, 'detectSignificantChanges').mockReturnValue([]);

      // Call without specifying interval
      await service.calculateTemporalStatistics(
        'parcelle-123',
        new Date('2024-01-01'),
        new Date('2024-01-01')
      );

      // Verify monthly interval was used
      expect(getTemporalDataSpy).toHaveBeenCalledWith(
        'parcelle-123',
        new Date('2024-01-01'),
        new Date('2024-01-01'),
        'monthly',
        {}
      );

      getTemporalDataSpy.mockRestore();
      getNDVITrendSpy.mockRestore();
      detectSignificantChangesSpy.mockRestore();
    });

    it('should wrap unknown errors in NDVICalculationError', async () => {
      const getTemporalDataSpy = vi.spyOn(service, 'getTemporalData').mockRejectedValue(
        new Error('Unknown error')
      );

      await expect(
        service.calculateTemporalStatistics(
          'parcelle-123',
          new Date('2024-01-01'),
          new Date('2024-03-01'),
          'monthly'
        )
      ).rejects.toThrow('Failed to calculate temporal statistics');

      getTemporalDataSpy.mockRestore();
    });

    it('should re-throw known errors without wrapping', async () => {
      const insufficientDataError = new (await import('@/lib/satellite/types')).InsufficientDataError(
        'Test error',
        2,
        1
      );

      const getTemporalDataSpy = vi.spyOn(service, 'getTemporalData').mockRejectedValue(
        insufficientDataError
      );

      await expect(
        service.calculateTemporalStatistics(
          'parcelle-123',
          new Date('2024-01-01'),
          new Date('2024-03-01'),
          'monthly'
        )
      ).rejects.toThrow(insufficientDataError);

      getTemporalDataSpy.mockRestore();
    });
  });
});
