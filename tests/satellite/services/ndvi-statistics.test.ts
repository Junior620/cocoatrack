/**
 * Unit Tests for NDVI Statistics Calculation
 * 
 * Tests the calculateStatistics method of NDVIService to ensure:
 * 1. Statistics are calculated correctly for various array sizes
 * 2. Efficient array processing for large parcelles
 * 3. Validation for minimum pixel count (at least 10 pixels)
 * 
 * Task: 2.1.2 - Implement NDVI statistics calculation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NDVIService } from '../../../lib/satellite/services/ndvi.service';
import { InsufficientDataError } from '../../../lib/satellite/types';

describe('NDVIService - Statistics Calculation', () => {
  let service: NDVIService;

  beforeEach(() => {
    service = new NDVIService();
  });

  describe('calculateStatistics - Basic Functionality', () => {
    it('should calculate correct mean for simple array', () => {
      // Access private method via type assertion for testing
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      const ndviValues = [0.5, 0.6, 0.7, 0.8, 0.9, 0.5, 0.6, 0.7, 0.8, 0.9];
      const stats = calculateStats(ndviValues);

      const expectedMean = (0.5 + 0.6 + 0.7 + 0.8 + 0.9 + 0.5 + 0.6 + 0.7 + 0.8 + 0.9) / 10;
      expect(stats.mean).toBeCloseTo(expectedMean, 5);
      expect(stats.validPixelCount).toBe(10);
    });

    it('should calculate correct min and max', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      const ndviValues = [0.2, 0.5, 0.8, 0.3, 0.9, 0.1, 0.7, 0.4, 0.6, 0.95];
      const stats = calculateStats(ndviValues);

      expect(stats.min).toBe(0.1);
      expect(stats.max).toBe(0.95);
    });

    it('should calculate correct standard deviation', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      // Use values with known standard deviation
      const ndviValues = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const stats = calculateStats(ndviValues);

      // All values are the same, so std dev should be 0
      expect(stats.stdDev).toBeCloseTo(0, 5);
      expect(stats.mean).toBe(0.5);
    });

    it('should calculate standard deviation for varying values', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      const ndviValues = [0.3, 0.4, 0.5, 0.6, 0.7, 0.3, 0.4, 0.5, 0.6, 0.7];
      const stats = calculateStats(ndviValues);

      // Calculate expected standard deviation manually
      const mean = 0.5;
      const squaredDiffs = ndviValues.map(v => Math.pow(v - mean, 2));
      const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / ndviValues.length;
      const expectedStdDev = Math.sqrt(variance);

      expect(stats.mean).toBeCloseTo(mean, 5);
      expect(stats.stdDev).toBeCloseTo(expectedStdDev, 5);
    });
  });

  describe('calculateStatistics - NaN Handling', () => {
    it('should filter out NaN values', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      const ndviValues = [0.5, NaN, 0.6, NaN, 0.7, 0.8, NaN, 0.9, 0.5, 0.6, 0.7, 0.8];
      const stats = calculateStats(ndviValues);

      // Should only count valid values (9 valid values)
      expect(stats.validPixelCount).toBe(9);
      
      // Mean should be calculated from valid values only
      const validValues = [0.5, 0.6, 0.7, 0.8, 0.9, 0.5, 0.6, 0.7, 0.8];
      const expectedMean = validValues.reduce((acc, val) => acc + val, 0) / validValues.length;
      expect(stats.mean).toBeCloseTo(expectedMean, 5);
    });

    it('should throw error when all values are NaN', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      const ndviValues = [NaN, NaN, NaN, NaN, NaN];
      
      expect(() => calculateStats(ndviValues)).toThrow(InsufficientDataError);
    });

    it('should throw error when array is empty', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      const ndviValues: number[] = [];
      
      expect(() => calculateStats(ndviValues)).toThrow(InsufficientDataError);
    });
  });

  describe('calculateStatistics - Minimum Pixel Count Validation', () => {
    it('should accept exactly 10 valid pixels (minimum threshold)', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      const ndviValues = [0.5, 0.6, 0.7, 0.8, 0.9, 0.5, 0.6, 0.7, 0.8, 0.9];
      const stats = calculateStats(ndviValues);

      expect(stats.validPixelCount).toBe(10);
      expect(stats.mean).toBeDefined();
    });

    it('should accept more than 10 valid pixels', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      const ndviValues = Array(50).fill(0).map((_, i) => 0.5 + (i % 5) * 0.1);
      const stats = calculateStats(ndviValues);

      expect(stats.validPixelCount).toBe(50);
      expect(stats.mean).toBeDefined();
    });

    it('should accept 10 valid pixels even with NaN values present', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      // 10 valid values + 5 NaN values
      const ndviValues = [
        0.5, 0.6, 0.7, 0.8, 0.9,
        NaN, NaN, NaN, NaN, NaN,
        0.5, 0.6, 0.7, 0.8, 0.9
      ];
      const stats = calculateStats(ndviValues);

      expect(stats.validPixelCount).toBe(10);
      expect(stats.mean).toBeDefined();
    });
  });

  describe('calculateStatistics - Various Array Sizes', () => {
    it('should handle small arrays (10 pixels)', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      const ndviValues = Array(10).fill(0.6);
      const stats = calculateStats(ndviValues);

      expect(stats.validPixelCount).toBe(10);
      expect(stats.mean).toBeCloseTo(0.6, 5);
      expect(stats.min).toBe(0.6);
      expect(stats.max).toBe(0.6);
      expect(stats.stdDev).toBeCloseTo(0, 5);
    });

    it('should handle medium arrays (100 pixels)', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      const ndviValues = Array(100).fill(0).map((_, i) => 0.5 + (i % 10) * 0.05);
      const stats = calculateStats(ndviValues);

      expect(stats.validPixelCount).toBe(100);
      expect(stats.mean).toBeDefined();
      expect(stats.min).toBeLessThanOrEqual(stats.mean);
      expect(stats.max).toBeGreaterThanOrEqual(stats.mean);
      expect(stats.stdDev).toBeGreaterThan(0);
    });

    it('should handle large arrays (1000 pixels)', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      const ndviValues = Array(1000).fill(0).map((_, i) => 0.3 + (i % 50) * 0.01);
      const stats = calculateStats(ndviValues);

      expect(stats.validPixelCount).toBe(1000);
      expect(stats.mean).toBeDefined();
      expect(stats.min).toBeLessThanOrEqual(stats.mean);
      expect(stats.max).toBeGreaterThanOrEqual(stats.mean);
    });

    it('should handle very large arrays (10000 pixels) efficiently', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      // Generate 10,000 NDVI values
      const ndviValues = Array(10000).fill(0).map((_, i) => 
        0.4 + Math.sin(i / 100) * 0.2
      );

      const startTime = Date.now();
      const stats = calculateStats(ndviValues);
      const endTime = Date.now();

      // Should complete in reasonable time (< 100ms for 10k pixels)
      expect(endTime - startTime).toBeLessThan(100);
      
      expect(stats.validPixelCount).toBe(10000);
      expect(stats.mean).toBeDefined();
      expect(stats.mean).toBeGreaterThan(0);
      expect(stats.mean).toBeLessThan(1);
    });

    it('should handle extremely large arrays (100000 pixels) efficiently', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      // Generate 100,000 NDVI values (simulating large parcelle)
      const ndviValues = Array(100000).fill(0).map((_, i) => 
        0.5 + Math.sin(i / 1000) * 0.3
      );

      const startTime = Date.now();
      const stats = calculateStats(ndviValues);
      const endTime = Date.now();

      // Should complete in reasonable time (< 500ms for 100k pixels)
      expect(endTime - startTime).toBeLessThan(500);
      
      expect(stats.validPixelCount).toBe(100000);
      expect(stats.mean).toBeDefined();
    });
  });

  describe('calculateStatistics - Edge Cases', () => {
    it('should handle all negative NDVI values', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      const ndviValues = [-0.5, -0.4, -0.3, -0.2, -0.1, -0.5, -0.4, -0.3, -0.2, -0.1];
      const stats = calculateStats(ndviValues);

      expect(stats.mean).toBeLessThan(0);
      expect(stats.min).toBe(-0.5);
      expect(stats.max).toBe(-0.1);
    });

    it('should handle NDVI values at boundaries (-1 to 1)', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      const ndviValues = [-1, -0.5, 0, 0.5, 1, -1, -0.5, 0, 0.5, 1];
      const stats = calculateStats(ndviValues);

      expect(stats.min).toBe(-1);
      expect(stats.max).toBe(1);
      expect(stats.mean).toBeCloseTo(0, 5);
    });

    it('should handle uniform NDVI values (zero variance)', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      const ndviValues = Array(20).fill(0.75);
      const stats = calculateStats(ndviValues);

      expect(stats.mean).toBe(0.75);
      expect(stats.min).toBe(0.75);
      expect(stats.max).toBe(0.75);
      expect(stats.stdDev).toBeCloseTo(0, 5);
    });

    it('should handle high variance NDVI values', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      const ndviValues = [0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.1, 0.9];
      const stats = calculateStats(ndviValues);

      expect(stats.mean).toBeCloseTo(0.5, 5);
      expect(stats.min).toBe(0.1);
      expect(stats.max).toBe(0.9);
      expect(stats.stdDev).toBeGreaterThan(0.3); // High variance
    });
  });

  describe('calculateStatistics - Precision and Accuracy', () => {
    it('should maintain precision for small differences', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      const ndviValues = [
        0.7001, 0.7002, 0.7003, 0.7004, 0.7005,
        0.7006, 0.7007, 0.7008, 0.7009, 0.7010
      ];
      const stats = calculateStats(ndviValues);

      expect(stats.mean).toBeCloseTo(0.70055, 5);
      expect(stats.min).toBe(0.7001);
      expect(stats.max).toBe(0.7010);
    });

    it('should calculate correct statistics for known dataset', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      // Dataset with known statistics
      const ndviValues = [0.2, 0.4, 0.6, 0.8, 1.0, 0.2, 0.4, 0.6, 0.8, 1.0];
      const stats = calculateStats(ndviValues);

      // Expected values
      const expectedMean = 0.6;
      const expectedMin = 0.2;
      const expectedMax = 1.0;
      
      // Calculate expected std dev
      const squaredDiffs = ndviValues.map(v => Math.pow(v - expectedMean, 2));
      const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / ndviValues.length;
      const expectedStdDev = Math.sqrt(variance);

      expect(stats.mean).toBeCloseTo(expectedMean, 5);
      expect(stats.min).toBe(expectedMin);
      expect(stats.max).toBe(expectedMax);
      expect(stats.stdDev).toBeCloseTo(expectedStdDev, 5);
    });
  });

  describe('calculateStatistics - Real-World Scenarios', () => {
    it('should handle typical healthy vegetation NDVI values', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      // Typical NDVI values for healthy cocoa plantation (0.6-0.8)
      const ndviValues = Array(100).fill(0).map(() => 
        0.6 + Math.random() * 0.2
      );
      const stats = calculateStats(ndviValues);

      expect(stats.mean).toBeGreaterThan(0.6);
      expect(stats.mean).toBeLessThan(0.8);
      expect(stats.min).toBeGreaterThanOrEqual(0.6);
      expect(stats.max).toBeLessThanOrEqual(0.8);
    });

    it('should handle stressed vegetation NDVI values', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      // NDVI values for stressed vegetation (0.3-0.5)
      const ndviValues = Array(100).fill(0).map(() => 
        0.3 + Math.random() * 0.2
      );
      const stats = calculateStats(ndviValues);

      expect(stats.mean).toBeGreaterThan(0.3);
      expect(stats.mean).toBeLessThan(0.5);
    });

    it('should handle mixed vegetation conditions', () => {
      const calculateStats = (service as any).calculateStatistics.bind(service);
      
      // Mix of healthy (0.7-0.8) and stressed (0.3-0.4) vegetation
      const healthyValues = Array(50).fill(0).map(() => 0.7 + Math.random() * 0.1);
      const stressedValues = Array(50).fill(0).map(() => 0.3 + Math.random() * 0.1);
      const ndviValues = [...healthyValues, ...stressedValues];
      
      const stats = calculateStats(ndviValues);

      expect(stats.validPixelCount).toBe(100);
      expect(stats.min).toBeLessThan(0.5);
      expect(stats.max).toBeGreaterThan(0.6);
      expect(stats.stdDev).toBeGreaterThan(0.1); // High variance due to mixed conditions
    });
  });
});
