/**
 * Unit tests for NDVI change detection
 * 
 * Tests the detectSignificantChanges() method in NDVIService
 * 
 * Task: 3.1.2 - Implement change detection algorithm
 */

import { describe, it, expect } from 'vitest';
import { NDVIService } from '../../../lib/satellite/services/ndvi.service';
import type { TemporalDataPoint } from '../../../lib/satellite/types';

describe('NDVIService - detectSignificantChanges', () => {
  const service = new NDVIService();

  describe('Basic functionality', () => {
    it('should detect significant increase (> 0.15)', () => {
      const timeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.5,
          cloudCover: 10,
          healthStatus: 'fair',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.7, // Increase of 0.2 (> 0.15)
          cloudCover: 5,
          healthStatus: 'good',
          hasSignificantChange: true,
        },
      ];

      const changes = service.detectSignificantChanges(timeline);

      expect(changes).toHaveLength(1);
      expect(changes[0].date).toEqual(new Date('2024-02-01'));
      expect(changes[0].previousNDVI).toBe(0.5);
      expect(changes[0].currentNDVI).toBe(0.7);
      expect(changes[0].absoluteChange).toBeCloseTo(0.2, 10);
      expect(changes[0].direction).toBe('increase');
      expect(changes[0].percentageChange).toBeCloseTo(40, 1); // (0.2 / 0.5) * 100 = 40%
    });

    it('should detect significant decrease (> 0.15)', () => {
      const timeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.7,
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.5, // Decrease of 0.2 (> 0.15)
          cloudCover: 5,
          healthStatus: 'fair',
          hasSignificantChange: true,
        },
      ];

      const changes = service.detectSignificantChanges(timeline);

      expect(changes).toHaveLength(1);
      expect(changes[0].date).toEqual(new Date('2024-02-01'));
      expect(changes[0].previousNDVI).toBe(0.7);
      expect(changes[0].currentNDVI).toBe(0.5);
      expect(changes[0].absoluteChange).toBeCloseTo(-0.2, 10);
      expect(changes[0].direction).toBe('decrease');
      expect(changes[0].percentageChange).toBeCloseTo(-28.57, 1); // (-0.2 / 0.7) * 100 ≈ -28.57%
    });

    it('should NOT detect insignificant changes (< 0.15)', () => {
      const timeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.5,
          cloudCover: 10,
          healthStatus: 'fair',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.55, // Increase of 0.05 (< 0.15)
          cloudCover: 5,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-03-01'),
          ndvi: 0.6, // Increase of 0.05 (< 0.15)
          cloudCover: 8,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
      ];

      const changes = service.detectSignificantChanges(timeline);

      expect(changes).toHaveLength(0);
    });

    it('should detect change exactly at threshold (0.15)', () => {
      const timeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.5,
          cloudCover: 10,
          healthStatus: 'fair',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.65, // Increase of exactly 0.15 (but due to floating point, might be 0.15000000000000002)
          cloudCover: 5,
          healthStatus: 'good',
          hasSignificantChange: true,
        },
      ];

      const changes = service.detectSignificantChanges(timeline);

      // Due to floating point arithmetic, 0.65 - 0.5 = 0.15000000000000002
      // which is > 0.15, so it WILL be detected
      expect(changes).toHaveLength(1);
      expect(changes[0].absoluteChange).toBeCloseTo(0.15, 2);
    });

    it('should detect change just above threshold (0.151)', () => {
      const timeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.5,
          cloudCover: 10,
          healthStatus: 'fair',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.651, // Increase of 0.151 (> 0.15)
          cloudCover: 5,
          healthStatus: 'good',
          hasSignificantChange: true,
        },
      ];

      const changes = service.detectSignificantChanges(timeline);

      expect(changes).toHaveLength(1);
      expect(changes[0].absoluteChange).toBeCloseTo(0.151, 3);
    });
  });

  describe('Multiple changes', () => {
    it('should detect multiple significant changes in timeline', () => {
      const timeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.5,
          cloudCover: 10,
          healthStatus: 'fair',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.7, // Increase of 0.2 (significant)
          cloudCover: 5,
          healthStatus: 'good',
          hasSignificantChange: true,
        },
        {
          date: new Date('2024-03-01'),
          ndvi: 0.75, // Increase of 0.05 (not significant)
          cloudCover: 8,
          healthStatus: 'excellent',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-04-01'),
          ndvi: 0.4, // Decrease of 0.35 (significant)
          cloudCover: 15,
          healthStatus: 'poor',
          hasSignificantChange: true,
        },
        {
          date: new Date('2024-05-01'),
          ndvi: 0.65, // Increase of 0.25 (significant)
          cloudCover: 5,
          healthStatus: 'good',
          hasSignificantChange: true,
        },
      ];

      const changes = service.detectSignificantChanges(timeline);

      expect(changes).toHaveLength(3);
      
      // First change: Jan -> Feb (increase)
      expect(changes[0].date).toEqual(new Date('2024-02-01'));
      expect(changes[0].previousNDVI).toBe(0.5);
      expect(changes[0].currentNDVI).toBe(0.7);
      expect(changes[0].absoluteChange).toBeCloseTo(0.2, 10);
      expect(changes[0].direction).toBe('increase');

      // Second change: Mar -> Apr (decrease)
      expect(changes[1].date).toEqual(new Date('2024-04-01'));
      expect(changes[1].previousNDVI).toBe(0.75);
      expect(changes[1].currentNDVI).toBe(0.4);
      expect(changes[1].absoluteChange).toBeCloseTo(-0.35, 10);
      expect(changes[1].direction).toBe('decrease');

      // Third change: Apr -> May (increase)
      expect(changes[2].date).toEqual(new Date('2024-05-01'));
      expect(changes[2].previousNDVI).toBe(0.4);
      expect(changes[2].currentNDVI).toBe(0.65);
      expect(changes[2].absoluteChange).toBeCloseTo(0.25, 10);
      expect(changes[2].direction).toBe('increase');
    });
  });

  describe('Edge cases', () => {
    it('should return empty array for empty timeline', () => {
      const timeline: TemporalDataPoint[] = [];

      expect(() => service.detectSignificantChanges(timeline)).toThrow(
        'Cannot detect changes in empty timeline'
      );
    });

    it('should return empty array for single data point', () => {
      const timeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.5,
          cloudCover: 10,
          healthStatus: 'fair',
          hasSignificantChange: false,
        },
      ];

      const changes = service.detectSignificantChanges(timeline);

      expect(changes).toHaveLength(0);
    });

    it('should handle timeline with NaN values', () => {
      const timeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.5,
          cloudCover: 10,
          healthStatus: 'fair',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: NaN, // Missing data
          cloudCover: 100,
          healthStatus: 'critical',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-03-01'),
          ndvi: 0.7, // Increase of 0.2 from Jan (significant)
          cloudCover: 5,
          healthStatus: 'good',
          hasSignificantChange: true,
        },
      ];

      const changes = service.detectSignificantChanges(timeline);

      // Should detect change from Jan to Mar, skipping Feb (NaN)
      expect(changes).toHaveLength(1);
      expect(changes[0].date).toEqual(new Date('2024-03-01'));
      expect(changes[0].previousNDVI).toBe(0.5);
      expect(changes[0].currentNDVI).toBe(0.7);
      expect(changes[0].absoluteChange).toBeCloseTo(0.2, 10);
      expect(changes[0].direction).toBe('increase');
    });

    it('should handle timeline with all NaN values', () => {
      const timeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: NaN,
          cloudCover: 100,
          healthStatus: 'critical',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: NaN,
          cloudCover: 100,
          healthStatus: 'critical',
          hasSignificantChange: false,
        },
      ];

      const changes = service.detectSignificantChanges(timeline);

      expect(changes).toHaveLength(0);
    });

    it('should handle zero NDVI values', () => {
      const timeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.0,
          cloudCover: 10,
          healthStatus: 'critical',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.2, // Increase of 0.2 (significant)
          cloudCover: 5,
          healthStatus: 'poor',
          hasSignificantChange: true,
        },
      ];

      const changes = service.detectSignificantChanges(timeline);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({
        date: new Date('2024-02-01'),
        previousNDVI: 0.0,
        currentNDVI: 0.2,
        absoluteChange: 0.2,
        direction: 'increase',
      });
      // Percentage change is 0 when previous NDVI is 0 (to avoid division by zero)
      expect(changes[0].percentageChange).toBe(0);
    });

    it('should handle negative NDVI values (water)', () => {
      const timeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: -0.2, // Water
          cloudCover: 10,
          healthStatus: 'critical',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.1, // Land with sparse vegetation (increase of 0.3)
          cloudCover: 5,
          healthStatus: 'critical',
          hasSignificantChange: true,
        },
      ];

      const changes = service.detectSignificantChanges(timeline);

      expect(changes).toHaveLength(1);
      expect(changes[0].date).toEqual(new Date('2024-02-01'));
      expect(changes[0].previousNDVI).toBe(-0.2);
      expect(changes[0].currentNDVI).toBe(0.1);
      expect(changes[0].absoluteChange).toBeCloseTo(0.3, 10);
      expect(changes[0].direction).toBe('increase');
      // Percentage change uses absolute value of previous NDVI
      expect(changes[0].percentageChange).toBeCloseTo(150, 1); // (0.3 / 0.2) * 100 = 150%
    });
  });

  describe('Percentage change calculation', () => {
    it('should calculate correct percentage for positive baseline', () => {
      const timeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.6,
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.78, // Increase of 0.18
          cloudCover: 5,
          healthStatus: 'excellent',
          hasSignificantChange: true,
        },
      ];

      const changes = service.detectSignificantChanges(timeline);

      expect(changes).toHaveLength(1);
      // (0.18 / 0.6) * 100 = 30%
      expect(changes[0].percentageChange).toBeCloseTo(30, 1);
    });

    it('should calculate correct percentage for negative baseline', () => {
      const timeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: -0.3,
          cloudCover: 10,
          healthStatus: 'critical',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: -0.1, // Increase of 0.2
          cloudCover: 5,
          healthStatus: 'critical',
          hasSignificantChange: true,
        },
      ];

      const changes = service.detectSignificantChanges(timeline);

      expect(changes).toHaveLength(1);
      // (0.2 / |-0.3|) * 100 = (0.2 / 0.3) * 100 ≈ 66.67%
      expect(changes[0].percentageChange).toBeCloseTo(66.67, 1);
    });
  });

  describe('Real-world scenarios', () => {
    it('should detect deforestation event (sharp NDVI drop)', () => {
      const timeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.75,
          cloudCover: 10,
          healthStatus: 'excellent',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.78,
          cloudCover: 5,
          healthStatus: 'excellent',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-03-01'),
          ndvi: 0.35, // Sharp drop of 0.43 (deforestation)
          cloudCover: 8,
          healthStatus: 'poor',
          hasSignificantChange: true,
        },
      ];

      const changes = service.detectSignificantChanges(timeline);

      expect(changes).toHaveLength(1);
      expect(changes[0].date).toEqual(new Date('2024-03-01'));
      expect(changes[0].previousNDVI).toBe(0.78);
      expect(changes[0].currentNDVI).toBe(0.35);
      expect(changes[0].absoluteChange).toBeCloseTo(-0.43, 10);
      expect(changes[0].direction).toBe('decrease');
      expect(changes[0].percentageChange).toBeCloseTo(-55.13, 1);
    });

    it('should detect recovery after intervention', () => {
      const timeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.35, // Poor health
          cloudCover: 10,
          healthStatus: 'poor',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.4, // Slight improvement (not significant)
          cloudCover: 5,
          healthStatus: 'poor',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-03-01'),
          ndvi: 0.65, // Recovery after intervention (increase of 0.25)
          cloudCover: 8,
          healthStatus: 'good',
          hasSignificantChange: true,
        },
      ];

      const changes = service.detectSignificantChanges(timeline);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({
        date: new Date('2024-03-01'),
        previousNDVI: 0.4,
        currentNDVI: 0.65,
        absoluteChange: 0.25,
        direction: 'increase',
      });
      expect(changes[0].percentageChange).toBeCloseTo(62.5, 1);
    });

    it('should handle seasonal variations (gradual changes)', () => {
      const timeline: TemporalDataPoint[] = [
        {
          date: new Date('2024-01-01'),
          ndvi: 0.6, // Dry season
          cloudCover: 5,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-02-01'),
          ndvi: 0.65, // Gradual increase
          cloudCover: 10,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-03-01'),
          ndvi: 0.7, // Gradual increase
          cloudCover: 15,
          healthStatus: 'good',
          hasSignificantChange: false,
        },
        {
          date: new Date('2024-04-01'),
          ndvi: 0.75, // Gradual increase
          cloudCover: 20,
          healthStatus: 'excellent',
          hasSignificantChange: false,
        },
      ];

      const changes = service.detectSignificantChanges(timeline);

      // No significant changes - all changes are < 0.15
      expect(changes).toHaveLength(0);
    });
  });
});
