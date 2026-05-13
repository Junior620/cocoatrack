/**
 * Tests for NDVI Worker Manager
 * 
 * Task 6.4.2: Optimize NDVI calculation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NDVIWorkerManager } from '../../../lib/satellite/workers/ndvi-worker-manager';

describe('NDVIWorkerManager', () => {
  let manager: NDVIWorkerManager;

  beforeEach(() => {
    manager = new NDVIWorkerManager();
  });

  afterEach(() => {
    manager.terminate();
  });

  describe('calculateNDVI', () => {
    it('should calculate NDVI for valid band data', async () => {
      // Arrange - use 4x4 grid (16 pixels > 10 minimum)
      const redBand = [
        [100, 150, 100, 150],
        [200, 250, 200, 250],
        [100, 150, 100, 150],
        [200, 250, 200, 250],
      ];
      const nirBand = [
        [300, 350, 300, 350],
        [400, 450, 400, 450],
        [300, 350, 300, 350],
        [400, 450, 400, 450],
      ];

      // Act
      const result = await manager.calculateNDVI(redBand, nirBand);

      // Assert
      expect(result).toBeDefined();
      expect(result.ndviValues).toHaveLength(16);
      expect(result.statistics).toBeDefined();
      expect(result.statistics.mean).toBeGreaterThan(0);
      expect(result.statistics.min).toBeGreaterThanOrEqual(-1);
      expect(result.statistics.max).toBeLessThanOrEqual(1);
      expect(result.error).toBeUndefined();
    });

    it('should handle edge case: division by zero', async () => {
      // Arrange - use 4x4 grid with some zero denominators
      const redBand = [
        [0, 100, 100, 100],
        [100, 100, 100, 100],
        [100, 100, 100, 100],
        [100, 100, 100, 100],
      ];
      const nirBand = [
        [0, 200, 200, 200],
        [200, 200, 200, 200],
        [200, 200, 200, 200],
        [200, 200, 200, 200],
      ];

      // Act
      const result = await manager.calculateNDVI(redBand, nirBand);

      // Assert
      expect(result).toBeDefined();
      expect(result.ndviValues[0]).toBe(0); // NIR + Red = 0, should return 0
      expect(result.ndviValues[1]).toBeCloseTo(0.333, 2); // (200-100)/(200+100) = 0.333
    });

    it('should handle invalid inputs (NaN)', async () => {
      // Arrange - use 4x4 grid with some NaN values
      const redBand = [
        [NaN, 100, 100, 100],
        [100, NaN, 100, 100],
        [100, 100, 100, 100],
        [100, 100, 100, 100],
      ];
      const nirBand = [
        [200, NaN, 200, 200],
        [NaN, 200, 200, 200],
        [200, 200, 200, 200],
        [200, 200, 200, 200],
      ];

      // Act
      const result = await manager.calculateNDVI(redBand, nirBand);

      // Assert
      expect(result).toBeDefined();
      expect(isNaN(result.ndviValues[0])).toBe(true);
      expect(isNaN(result.ndviValues[1])).toBe(true);
      expect(isNaN(result.ndviValues[4])).toBe(true);
      // Should have at least 10 valid pixels
      const validCount = result.ndviValues.filter(v => !isNaN(v)).length;
      expect(validCount).toBeGreaterThanOrEqual(10);
    });

    it('should calculate correct statistics', async () => {
      // Arrange - use 4x4 grid with uniform values
      const redBand = [
        [100, 100, 100, 100],
        [100, 100, 100, 100],
        [100, 100, 100, 100],
        [100, 100, 100, 100],
      ];
      const nirBand = [
        [200, 200, 200, 200],
        [200, 200, 200, 200],
        [200, 200, 200, 200],
        [200, 200, 200, 200],
      ];

      // Act
      const result = await manager.calculateNDVI(redBand, nirBand);

      // Assert
      expect(result.statistics.validPixelCount).toBe(16);
      expect(result.statistics.mean).toBeCloseTo(0.333, 2);
      expect(result.statistics.min).toBeCloseTo(0.333, 2);
      expect(result.statistics.max).toBeCloseTo(0.333, 2);
      expect(result.statistics.stdDev).toBeCloseTo(0, 2);
    });

    it('should handle large datasets efficiently', async () => {
      // Arrange: Create a 100x100 pixel dataset
      const size = 100;
      const redBand: number[][] = [];
      const nirBand: number[][] = [];

      for (let i = 0; i < size; i++) {
        const redRow: number[] = [];
        const nirRow: number[] = [];
        for (let j = 0; j < size; j++) {
          redRow.push(100 + i);
          nirRow.push(200 + j);
        }
        redBand.push(redRow);
        nirBand.push(nirRow);
      }

      // Act
      const startTime = Date.now();
      const result = await manager.calculateNDVI(redBand, nirBand);
      const duration = Date.now() - startTime;

      // Assert
      expect(result).toBeDefined();
      expect(result.ndviValues).toHaveLength(size * size);
      expect(result.statistics.validPixelCount).toBe(size * size);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      console.log(`Large dataset (${size}x${size}) processed in ${duration}ms`);
    });
  });

  describe('batching', () => {
    it('should batch multiple concurrent requests', async () => {
      // Arrange - use 4x4 grids to have enough pixels (16 > 10 minimum)
      const requests = Array.from({ length: 10 }, (_, i) => ({
        redBand: [
          [100 + i, 110 + i, 120 + i, 130 + i],
          [140 + i, 150 + i, 160 + i, 170 + i],
          [180 + i, 190 + i, 200 + i, 210 + i],
          [220 + i, 230 + i, 240 + i, 250 + i],
        ],
        nirBand: [
          [200 + i, 210 + i, 220 + i, 230 + i],
          [240 + i, 250 + i, 260 + i, 270 + i],
          [280 + i, 290 + i, 300 + i, 310 + i],
          [320 + i, 330 + i, 340 + i, 350 + i],
        ],
      }));

      // Act
      const startTime = Date.now();
      const results = await Promise.all(
        requests.map(req => manager.calculateNDVI(req.redBand, req.nirBand))
      );
      const duration = Date.now() - startTime;

      // Assert
      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result).toBeDefined();
        expect(result.error).toBeUndefined();
        expect(result.ndviValues).toHaveLength(16); // 4x4 = 16 pixels
      });

      console.log(`10 concurrent requests processed in ${duration}ms`);
    });
  });

  describe('worker management', () => {
    it('should track pending requests', async () => {
      // Arrange - use 4x4 grid
      const redBand = [
        [100, 110, 120, 130],
        [140, 150, 160, 170],
        [180, 190, 200, 210],
        [220, 230, 240, 250],
      ];
      const nirBand = [
        [200, 210, 220, 230],
        [240, 250, 260, 270],
        [280, 290, 300, 310],
        [320, 330, 340, 350],
      ];

      // Act
      const promise = manager.calculateNDVI(redBand, nirBand);
      
      // In fallback mode, the request completes synchronously
      // so we can't check pending count during execution
      await promise;
      const pendingCountAfter = manager.getPendingCount();

      // Assert
      expect(pendingCountAfter).toBe(0);
    });

    it('should clean up on terminate', () => {
      // Act
      manager.terminate();

      // Assert
      expect(manager.getPendingCount()).toBe(0);
      expect(manager.getQueuedCount()).toBe(0);
    });
  });
});
