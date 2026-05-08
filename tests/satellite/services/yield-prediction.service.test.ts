/**
 * Unit tests for YieldPredictionService
 * 
 * Tests yield prediction logic, model training, parameter loading,
 * and accuracy calculations.
 * 
 * Requirements: Task 5.5.1, Task 5.5.2
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { YieldPredictionService } from '@/lib/satellite/services/yield-prediction.service';
import { ndviService } from '@/lib/satellite/services/ndvi.service';
import type { MultiPolygon } from 'geojson';

// Mock the NDVI service
vi.mock('@/lib/satellite/services/ndvi.service', () => ({
  ndviService: {
    calculateNDVI: vi.fn(),
    getNDVITrend: vi.fn(),
  },
}));

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

describe('YieldPredictionService', () => {
  let service: YieldPredictionService;
  let mockGeometry: MultiPolygon;

  beforeEach(() => {
    service = new YieldPredictionService();
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
    mockSupabaseClient.insert.mockReturnThis();
    mockSupabaseClient.select.mockReturnThis();
  });

  describe('loadModelParameters', () => {
    it('should load latest model parameters from database', async () => {
      // Mock database response with trained model
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'model-123',
          model_version: 'v1.1.0-trained',
          parameters: {
            ndvi_coefficient: 850,
            trend_coefficient: 220,
            baseline_yield: 520,
            historical_weight: 0.35,
          },
          training_date: '2024-01-15T00:00:00.000Z',
          data_points_used: 50,
          accuracy_metrics: {
            mae: 45.5,
            mape: 8.2,
            predictions_evaluated: 50,
          },
          created_at: '2024-01-15T00:00:00.000Z',
        },
        error: null,
      });

      const params = await service.loadModelParameters();

      expect(params.modelVersion).toBe('v1.1.0-trained');
      expect(params.parameters.ndvi_coefficient).toBe(850);
      expect(params.parameters.trend_coefficient).toBe(220);
      expect(params.parameters.baseline_yield).toBe(520);
      expect(params.parameters.historical_weight).toBe(0.35);
      expect(params.dataPointsUsed).toBe(50);
      expect(params.accuracyMetrics.mae).toBe(45.5);
      expect(params.accuracyMetrics.mape).toBe(8.2);
    });

    it('should return default parameters when no trained model exists', async () => {
      // Mock no data found (default behavior)
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' }, // No rows found
      });

      const params = await service.loadModelParameters();

      expect(params.modelVersion).toBe('v1.0.0-simple-regression');
      expect(params.parameters.ndvi_coefficient).toBe(800);
      expect(params.parameters.trend_coefficient).toBe(200);
      expect(params.parameters.baseline_yield).toBe(500);
      expect(params.parameters.historical_weight).toBe(0.3);
      expect(params.dataPointsUsed).toBe(0);
    });

    it('should cache parameters in memory for performance', async () => {
      // Mock database response
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'model-123',
          model_version: 'v1.1.0-trained',
          parameters: {
            ndvi_coefficient: 850,
            trend_coefficient: 220,
            baseline_yield: 520,
            historical_weight: 0.35,
          },
          training_date: '2024-01-15T00:00:00.000Z',
          data_points_used: 50,
          accuracy_metrics: {
            mae: 45.5,
            mape: 8.2,
            predictions_evaluated: 50,
          },
          created_at: '2024-01-15T00:00:00.000Z',
        },
        error: null,
      });

      // First call - should query database
      await service.loadModelParameters();

      // Second call - should use cache
      await service.loadModelParameters();

      // Database should only be queried once
      expect(mockSupabaseClient.single).toHaveBeenCalledTimes(1);
    });

    it('should reload parameters when forceReload is true', async () => {
      // Mock database response
      mockSupabaseClient.single.mockResolvedValue({
        data: {
          id: 'model-123',
          model_version: 'v1.1.0-trained',
          parameters: {
            ndvi_coefficient: 850,
            trend_coefficient: 220,
            baseline_yield: 520,
            historical_weight: 0.35,
          },
          training_date: '2024-01-15T00:00:00.000Z',
          data_points_used: 50,
          accuracy_metrics: {
            mae: 45.5,
            mape: 8.2,
            predictions_evaluated: 50,
          },
          created_at: '2024-01-15T00:00:00.000Z',
        },
        error: null,
      });

      // First call
      await service.loadModelParameters();

      // Second call with forceReload
      await service.loadModelParameters(undefined, true);

      // Database should be queried twice
      expect(mockSupabaseClient.single).toHaveBeenCalledTimes(2);
    });

    it('should fall back to defaults on database error', async () => {
      // Mock database error
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST500', message: 'Database error' },
      });

      const params = await service.loadModelParameters();

      // Should return defaults
      expect(params.modelVersion).toBe('v1.0.0-simple-regression');
      expect(params.parameters.ndvi_coefficient).toBe(800);
    });
  });

  describe('trainModel', () => {
    it('should train model with sufficient training data', async () => {
      // Mock training data (predictions with actual yields)
      const mockTrainingData = Array.from({ length: 20 }, (_, i) => ({
        id: `pred-${i}`,
        parcelle_id: `parcelle-${i}`,
        prediction_date: '2024-01-15T00:00:00.000Z',
        harvest_season: '2024-Q4',
        predicted_yield_kg_per_ha: 500 + i * 10,
        confidence_level: 'medium',
        confidence_interval_lower: 450 + i * 10,
        confidence_interval_upper: 550 + i * 10,
        model_version: 'v1.0.0-simple-regression',
        input_features: {
          meanNDVI: 0.6 + i * 0.01,
          ndviTrend: 0.05,
          historicalYield: [480 + i * 10],
          surfaceHectares: 5.0,
        },
        actual_yield_kg_per_ha: 490 + i * 10, // Actual yields close to predictions
        created_at: '2024-01-15T00:00:00.000Z',
      }));

      // Mock database queries - need to reset and setup properly
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.not.mockResolvedValueOnce({
        data: mockTrainingData,
        error: null,
      });

      // Mock current model version query
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.order.mockReturnThis();
      mockSupabaseClient.limit.mockReturnThis();
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'model-default',
          model_version: 'v1.0.0-simple-regression',
          parameters: {
            ndvi_coefficient: 800,
            trend_coefficient: 200,
            baseline_yield: 500,
            historical_weight: 0.3,
          },
          training_date: '2024-01-01T00:00:00.000Z',
          data_points_used: 0,
          accuracy_metrics: {
            mae: 0,
            mape: 0,
            predictions_evaluated: 0,
          },
          created_at: '2024-01-01T00:00:00.000Z',
        },
        error: null,
      });

      // Mock insert response
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.insert.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'model-new',
          model_version: 'v1.1.0-trained',
          parameters: {
            ndvi_coefficient: 800,
            trend_coefficient: 200,
            baseline_yield: 500,
            historical_weight: 0.3,
          },
          training_date: new Date().toISOString(),
          data_points_used: 20,
          accuracy_metrics: {
            mae: 10,
            mape: 2,
            predictions_evaluated: 20,
          },
          created_at: new Date().toISOString(),
        },
        error: null,
      });

      // Set SUPABASE_SERVICE_KEY for training
      process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

      const result = await service.trainModel();

      expect(result.modelVersion).toBe('v1.1.0-trained');
      expect(result.dataPointsUsed).toBe(20);
      expect(result.accuracyMetrics.predictions_evaluated).toBe(20);

      // Verify insert was called
      expect(mockSupabaseClient.insert).toHaveBeenCalled();

      // Clean up
      delete process.env.SUPABASE_SERVICE_KEY;
    });

    it('should throw error when insufficient training data', async () => {
      // Mock insufficient training data (< 10 predictions)
      const mockTrainingData = Array.from({ length: 5 }, (_, i) => ({
        id: `pred-${i}`,
        parcelle_id: `parcelle-${i}`,
        predicted_yield_kg_per_ha: 500,
        actual_yield_kg_per_ha: 490,
        input_features: {
          meanNDVI: 0.6,
          ndviTrend: 0.05,
          historicalYield: [480],
          surfaceHectares: 5.0,
        },
      }));

      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.not.mockResolvedValueOnce({
        data: mockTrainingData,
        error: null,
      });

      process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

      await expect(service.trainModel()).rejects.toThrow('Insufficient training data');

      delete process.env.SUPABASE_SERVICE_KEY;
    });

    it('should throw error when SUPABASE_SERVICE_KEY is missing', async () => {
      delete process.env.SUPABASE_SERVICE_KEY;

      await expect(service.trainModel()).rejects.toThrow('SUPABASE_SERVICE_KEY not found');
    });

    it('should increment model version correctly', async () => {
      // Access private method via type assertion for testing
      const incrementModelVersion = (service as any).incrementModelVersion.bind(service);

      expect(incrementModelVersion('v1.0.0-simple-regression')).toBe('v1.1.0-trained');
      expect(incrementModelVersion('v1.5.0-trained')).toBe('v1.6.0-trained');
      expect(incrementModelVersion('v2.3.0-trained')).toBe('v2.4.0-trained');
    });

    it('should handle unexpected version format', async () => {
      const incrementModelVersion = (service as any).incrementModelVersion.bind(service);

      // Should default to v1.1.0-trained for unexpected formats
      expect(incrementModelVersion('invalid-version')).toBe('v1.1.0-trained');
      expect(incrementModelVersion('v1-simple')).toBe('v1.1.0-trained');
    });
  });

  describe('calculateTrainingAccuracy', () => {
    it('should calculate MAE and MAPE correctly', async () => {
      const calculateTrainingAccuracy = (service as any).calculateTrainingAccuracy.bind(service);

      const trainingData = [
        {
          predictedYieldKgPerHa: 500,
          actualYieldKgPerHa: 490,
          inputFeatures: {
            meanNDVI: 0.6,
            ndviTrend: 0.05,
            historicalYield: [],
            surfaceHectares: 5.0,
          },
        },
        {
          predictedYieldKgPerHa: 600,
          actualYieldKgPerHa: 620,
          inputFeatures: {
            meanNDVI: 0.7,
            ndviTrend: 0.08,
            historicalYield: [],
            surfaceHectares: 5.0,
          },
        },
        {
          predictedYieldKgPerHa: 550,
          actualYieldKgPerHa: 540,
          inputFeatures: {
            meanNDVI: 0.65,
            ndviTrend: 0.06,
            historicalYield: [],
            surfaceHectares: 5.0,
          },
        },
      ];

      const params = {
        ndvi_coefficient: 800,
        trend_coefficient: 200,
        baseline_yield: 500,
        historical_weight: 0.3,
      };

      const accuracy = calculateTrainingAccuracy(trainingData, params);

      // MAE should be calculated correctly
      expect(accuracy.mae).toBeGreaterThan(0);
      expect(accuracy.mape).toBeGreaterThan(0);
      expect(accuracy.predictions_evaluated).toBe(3);
    });

    it('should handle historical yield blending in accuracy calculation', async () => {
      const calculateTrainingAccuracy = (service as any).calculateTrainingAccuracy.bind(service);

      const trainingData = [
        {
          predictedYieldKgPerHa: 500,
          actualYieldKgPerHa: 490,
          inputFeatures: {
            meanNDVI: 0.6,
            ndviTrend: 0.05,
            historicalYield: [480, 490, 500], // Historical data available
            surfaceHectares: 5.0,
          },
        },
      ];

      const params = {
        ndvi_coefficient: 800,
        trend_coefficient: 200,
        baseline_yield: 500,
        historical_weight: 0.3,
      };

      const accuracy = calculateTrainingAccuracy(trainingData, params);

      expect(accuracy.predictions_evaluated).toBe(1);
      expect(accuracy.mae).toBeGreaterThanOrEqual(0);
      expect(accuracy.mape).toBeGreaterThanOrEqual(0);
    });
  });

  describe('optimizeCoefficients', () => {
    it('should find optimal coefficients that minimize MAPE', async () => {
      const optimizeCoefficients = (service as any).optimizeCoefficients.bind(service);

      // Create training data with known optimal parameters
      const trainingData = Array.from({ length: 20 }, (_, i) => ({
        predictedYieldKgPerHa: 500 + i * 10,
        actualYieldKgPerHa: 500 + i * 10, // Perfect predictions with baseline=500, ndvi_coeff=800
        inputFeatures: {
          meanNDVI: 0.6 + i * 0.01,
          ndviTrend: 0.05,
          historicalYield: [],
          surfaceHectares: 5.0,
        },
      }));

      const optimized = optimizeCoefficients(trainingData);

      // Should find parameters close to optimal
      expect(optimized.ndvi_coefficient).toBeGreaterThan(0);
      expect(optimized.trend_coefficient).toBeGreaterThan(0);
      expect(optimized.baseline_yield).toBeGreaterThan(0);
      expect(optimized.historical_weight).toBeGreaterThanOrEqual(0.1);
      expect(optimized.historical_weight).toBeLessThanOrEqual(0.5);
    });
  });

  describe('getModelInfo', () => {
    it('should return current model information', async () => {
      // Create a fresh service instance to avoid cached parameters
      const freshService = new YieldPredictionService();

      // Mock database response
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.order.mockReturnThis();
      mockSupabaseClient.limit.mockReturnThis();
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'model-123',
          model_version: 'v1.1.0-trained',
          parameters: {
            ndvi_coefficient: 850,
            trend_coefficient: 220,
            baseline_yield: 520,
            historical_weight: 0.35,
          },
          training_date: '2024-01-15T00:00:00.000Z',
          data_points_used: 50,
          accuracy_metrics: {
            mae: 45.5,
            mape: 8.2,
            predictions_evaluated: 50,
          },
          created_at: '2024-01-15T00:00:00.000Z',
        },
        error: null,
      });

      const info = await freshService.getModelInfo();

      expect(info.modelVersion).toBe('v1.1.0-trained');
      expect(info.parameters.ndvi_coefficient).toBe(850);
      expect(info.dataPointsUsed).toBe(50);
      expect(info.accuracyMetrics.mae).toBe(45.5);
      expect(info.accuracyMetrics.mape).toBe(8.2);
    });
  });

  describe('predictYield with model parameters', () => {
    it('should load model parameters before making prediction', async () => {
      // Mock model parameters
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'model-123',
          model_version: 'v1.1.0-trained',
          parameters: {
            ndvi_coefficient: 850,
            trend_coefficient: 220,
            baseline_yield: 520,
            historical_weight: 0.35,
          },
          training_date: '2024-01-15T00:00:00.000Z',
          data_points_used: 50,
          accuracy_metrics: {
            mae: 45.5,
            mape: 8.2,
            predictions_evaluated: 50,
          },
          created_at: '2024-01-15T00:00:00.000Z',
        },
        error: null,
      });

      // Mock NDVI calculation
      vi.mocked(ndviService.calculateNDVI).mockResolvedValue({
        id: 'ndvi-123',
        parcelleId: 'parcelle-123',
        imageryId: null,
        calculationDate: new Date('2024-01-15'),
        meanNDVI: 0.7,
        minNDVI: 0.6,
        maxNDVI: 0.8,
        stdDevNDVI: 0.05,
        healthStatus: 'excellent',
        ndviRasterUrl: null,
        createdAt: new Date(),
      });

      // Mock NDVI trend
      vi.mocked(ndviService.getNDVITrend).mockResolvedValue({
        trend: 'improving',
        changeRate: 0.05,
        dataPoints: 6,
        startNDVI: 0.65,
        endNDVI: 0.7,
      });

      // Mock insert for storing prediction
      mockSupabaseClient.insert.mockResolvedValueOnce({
        error: null,
      });

      const prediction = await service.predictYield(
        'parcelle-123',
        mockGeometry,
        5.0,
        {
          storePrediction: true,
          historicalYield: [480, 490, 500],
        }
      );

      expect(prediction.parcelleId).toBe('parcelle-123');
      expect(prediction.predictedYieldKgPerHa).toBeGreaterThan(0);
      expect(prediction.modelVersion).toBe('v1.1.0-trained');

      // Verify loadModelParameters was called
      expect(mockSupabaseClient.single).toHaveBeenCalled();
    });
  });

  describe('calculateAccuracy', () => {
    it('should calculate accuracy metrics for predictions with actual yields', async () => {
      // Mock predictions with actual yields
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.not.mockResolvedValueOnce({
        data: [
          {
            predicted_yield_kg_per_ha: 500,
            actual_yield_kg_per_ha: 490,
          },
          {
            predicted_yield_kg_per_ha: 600,
            actual_yield_kg_per_ha: 620,
          },
          {
            predicted_yield_kg_per_ha: 550,
            actual_yield_kg_per_ha: 540,
          },
        ],
        error: null,
      });

      const accuracy = await service.calculateAccuracy();

      // MAE = (|500-490| + |600-620| + |550-540|) / 3 = (10 + 20 + 10) / 3 = 13.33
      expect(accuracy.meanAbsoluteError).toBeCloseTo(13.33, 1);

      // MAPE = ((10/490)*100 + (20/620)*100 + (10/540)*100) / 3
      expect(accuracy.meanAbsolutePercentageError).toBeGreaterThan(0);
      expect(accuracy.predictionsEvaluated).toBe(3);
    });

    it('should return zero metrics when no predictions with actual yields exist', async () => {
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.not.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const accuracy = await service.calculateAccuracy();

      expect(accuracy.meanAbsoluteError).toBe(0);
      expect(accuracy.meanAbsolutePercentageError).toBe(0);
      expect(accuracy.predictionsEvaluated).toBe(0);
    });

    it('should filter by parcelle ID when provided', async () => {
      mockSupabaseClient.from.mockReturnThis();
      mockSupabaseClient.select.mockReturnThis();
      mockSupabaseClient.not.mockReturnThis();
      mockSupabaseClient.eq.mockResolvedValueOnce({
        data: [
          {
            predicted_yield_kg_per_ha: 500,
            actual_yield_kg_per_ha: 490,
          },
        ],
        error: null,
      });

      await service.calculateAccuracy('parcelle-123');

      // Verify eq was called with parcelle_id
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('parcelle_id', 'parcelle-123');
    });
  });

  describe('updateActualYield', () => {
    it('should update actual yield for a prediction', async () => {
      mockSupabaseClient.update.mockReturnThis();
      mockSupabaseClient.eq.mockReturnThis();
      mockSupabaseClient.eq.mockResolvedValueOnce({
        error: null,
      });

      // Set SUPABASE_SERVICE_KEY for update
      process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

      await service.updateActualYield('pred-123', 520);

      // Verify update was called
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        actual_yield_kg_per_ha: 520,
      });
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'pred-123');

      delete process.env.SUPABASE_SERVICE_KEY;
    });
  });
});
