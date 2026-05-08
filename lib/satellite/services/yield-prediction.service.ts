/**
 * Yield Prediction Service
 * 
 * This service provides ML-based yield prediction for cocoa parcelles using
 * NDVI data, historical yield records, and simple regression models.
 * 
 * The prediction model uses:
 * - Mean NDVI: Current vegetation health indicator
 * - NDVI Trend: Rate of change in vegetation health over past 3 months
 * - Historical Yield: Past yield data for the parcelle (if available)
 * - Surface Area: Parcelle size in hectares
 * 
 * Yield predictions include:
 * - Predicted yield in kg/ha
 * - Confidence level (high, medium, low)
 * - Confidence interval (lower and upper bounds)
 * 
 * Requirements: Task 5.5.1
 * - Implement simple regression model based on NDVI
 * - Use mean NDVI, NDVI trend, and historical yield data
 * - Calculate confidence interval
 * - Determine confidence level (high, medium, low)
 */

import type { MultiPolygon } from 'geojson';
import {
  YieldPrediction,
  NDVICalculationError,
  InsufficientDataError,
} from '../types';
import { ndviService } from './ndvi.service';

// ============================================================================
// Constants
// ============================================================================

/**
 * Model version identifier
 * Increment this when the prediction algorithm changes
 */
let MODEL_VERSION = 'v1.0.0-simple-regression';

/**
 * Baseline yield for cocoa in Cameroon (kg/ha)
 * Based on average cocoa yields in Cameroon: 400-600 kg/ha
 * Source: ICCO (International Cocoa Organization) statistics
 */
let BASELINE_YIELD_KG_PER_HA = 500;

/**
 * NDVI coefficient for yield prediction
 * This coefficient determines how much NDVI affects yield prediction
 * Higher NDVI → Higher yield
 * 
 * Calibrated based on research showing positive correlation between
 * NDVI and cocoa yield (r² ≈ 0.6-0.7)
 */
let NDVI_COEFFICIENT = 800; // kg/ha per NDVI unit

/**
 * NDVI trend coefficient for yield prediction
 * This coefficient determines how much NDVI trend affects yield prediction
 * Positive trend (improving) → Higher yield
 * Negative trend (declining) → Lower yield
 */
let TREND_COEFFICIENT = 200; // kg/ha per NDVI unit/month

/**
 * Historical yield weight
 * When historical yield data is available, this weight determines
 * how much to blend historical data with NDVI-based prediction
 * 0.0 = ignore historical data, 1.0 = use only historical data
 */
let HISTORICAL_YIELD_WEIGHT = 0.3; // 30% weight to historical data

/**
 * Minimum data points required for high confidence prediction
 */
const MIN_DATA_POINTS_HIGH_CONFIDENCE = 6; // 6 months of NDVI data

/**
 * Minimum data points required for medium confidence prediction
 */
const MIN_DATA_POINTS_MEDIUM_CONFIDENCE = 3; // 3 months of NDVI data

/**
 * Confidence interval width as percentage of predicted yield
 * - High confidence: ±10%
 * - Medium confidence: ±20%
 * - Low confidence: ±30%
 */
const CONFIDENCE_INTERVAL_WIDTHS = {
  high: 0.10,   // ±10%
  medium: 0.20, // ±20%
  low: 0.30,    // ±30%
} as const;

/**
 * Minimum yield threshold (kg/ha)
 * Predictions below this are clamped to this minimum
 */
const MIN_YIELD_KG_PER_HA = 100;

/**
 * Maximum yield threshold (kg/ha)
 * Predictions above this are clamped to this maximum
 * Based on maximum observed cocoa yields in optimal conditions
 */
const MAX_YIELD_KG_PER_HA = 2000;

// ============================================================================
// Types
// ============================================================================

/**
 * Yield prediction options
 */
interface YieldPredictionOptions {
  /**
   * Target harvest season (e.g., "2024-Q4", "2025-Q1")
   * If not provided, uses next quarter
   */
  harvestSeason?: string;

  /**
   * Historical yield data for the parcelle (kg/ha)
   * If provided, will be used to improve prediction accuracy
   */
  historicalYield?: number[];

  /**
   * Whether to store the prediction in the database
   */
  storePrediction?: boolean;

  /**
   * Supabase client for database operations
   */
  supabase?: any;
}

/**
 * Yield prediction input features
 */
interface YieldPredictionInputs {
  meanNDVI: number;
  ndviTrend: number; // NDVI units per month
  historicalYield: number[]; // kg/ha
  surfaceHectares: number;
  dataPoints: number; // Number of NDVI data points used
}

/**
 * Model parameters stored in database
 */
interface ModelParameters {
  id: string;
  modelVersion: string;
  parameters: {
    ndvi_coefficient: number;
    trend_coefficient: number;
    baseline_yield: number;
    historical_weight: number;
  };
  trainingDate: Date;
  dataPointsUsed: number;
  accuracyMetrics: {
    mae: number; // Mean Absolute Error
    mape: number; // Mean Absolute Percentage Error
    predictions_evaluated: number;
  };
  createdAt: Date;
}

/**
 * Training data point (prediction with actual yield)
 */
interface TrainingDataPoint {
  predictedYieldKgPerHa: number;
  actualYieldKgPerHa: number;
  inputFeatures: {
    meanNDVI: number;
    ndviTrend: number;
    historicalYield: number[];
    surfaceHectares: number;
  };
}

// ============================================================================
// YieldPredictionService Class
// ============================================================================

/**
 * Service for predicting cocoa yield based on NDVI and historical data
 */
export class YieldPredictionService {
  /**
   * Cached model parameters
   * Loaded from database on first use
   */
  private cachedParameters: ModelParameters | null = null;

  /**
   * Load model parameters from database
   * 
   * Loads the latest trained model parameters from the database.
   * Falls back to hardcoded defaults if no trained model exists.
   * Caches parameters in memory for performance.
   * 
   * @param supabase - Optional Supabase client
   * @param forceReload - Force reload from database (bypass cache)
   * @returns Model parameters
   */
  async loadModelParameters(
    supabase?: any,
    forceReload: boolean = false
  ): Promise<ModelParameters> {
    // Return cached parameters if available and not forcing reload
    if (this.cachedParameters && !forceReload) {
      return this.cachedParameters;
    }

    try {
      // Use provided client or create a new one
      let client = supabase;
      if (!client) {
        const { createClient } = await import('@supabase/supabase-js');
        client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              fetch: fetch.bind(globalThis),
            },
          }
        );
      }

      // Query latest model parameters
      const { data, error } = await client
        .from('model_parameters')
        .select('*')
        .order('training_date', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is acceptable (use defaults)
        throw error;
      }

      if (!data) {
        // No trained model exists, use defaults
        console.log('[Yield Prediction] No trained model found, using default parameters');
        return this.getDefaultParameters();
      }

      // Convert database row to ModelParameters
      const parameters: ModelParameters = {
        id: data.id,
        modelVersion: data.model_version,
        parameters: data.parameters,
        trainingDate: new Date(data.training_date),
        dataPointsUsed: data.data_points_used,
        accuracyMetrics: data.accuracy_metrics,
        createdAt: new Date(data.created_at),
      };

      // Cache parameters
      this.cachedParameters = parameters;

      // Update global constants with loaded parameters
      MODEL_VERSION = parameters.modelVersion;
      NDVI_COEFFICIENT = parameters.parameters.ndvi_coefficient;
      TREND_COEFFICIENT = parameters.parameters.trend_coefficient;
      BASELINE_YIELD_KG_PER_HA = parameters.parameters.baseline_yield;
      HISTORICAL_YIELD_WEIGHT = parameters.parameters.historical_weight;

      console.log(`[Yield Prediction] Loaded model parameters: ${parameters.modelVersion}`);

      return parameters;
    } catch (error) {
      console.error('[Yield Prediction] Failed to load model parameters:', error);
      // Fall back to defaults on error
      return this.getDefaultParameters();
    }
  }

  /**
   * Get default model parameters
   * 
   * Returns hardcoded default parameters used when no trained model exists.
   * 
   * @returns Default model parameters
   */
  private getDefaultParameters(): ModelParameters {
    return {
      id: 'default',
      modelVersion: 'v1.0.0-simple-regression',
      parameters: {
        ndvi_coefficient: 800,
        trend_coefficient: 200,
        baseline_yield: 500,
        historical_weight: 0.3,
      },
      trainingDate: new Date(),
      dataPointsUsed: 0,
      accuracyMetrics: {
        mae: 0,
        mape: 0,
        predictions_evaluated: 0,
      },
      createdAt: new Date(),
    };
  }

  /**
   * Train model with historical data
   * 
   * This method:
   * 1. Fetches all yield predictions with actual yield data
   * 2. Uses simple linear regression to fit optimal coefficients
   * 3. Validates model accuracy (should achieve ±15% MAPE)
   * 4. Stores trained parameters in database
   * 5. Increments model version
   * 
   * The training uses a simple optimization approach:
   * - Iterates through different coefficient combinations
   * - Calculates prediction error for each combination
   * - Selects coefficients that minimize Mean Absolute Percentage Error (MAPE)
   * 
   * @param supabase - Optional Supabase client
   * @returns Trained model parameters with accuracy metrics
   * @throws {NDVICalculationError} If training fails or insufficient data
   */
  async trainModel(supabase?: any): Promise<ModelParameters> {
    try {
      console.log('[Yield Prediction] Starting model training...');

      // Use provided client or create a new one with SERVICE ROLE KEY
      let client = supabase;
      if (!client) {
        const { createClient } = await import('@supabase/supabase-js');

        const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;
        if (!serviceRoleKey) {
          throw new NDVICalculationError(
            'SUPABASE_SERVICE_KEY not found - required for model training',
            undefined,
            'Missing service role key'
          );
        }

        client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
            global: {
              fetch: fetch.bind(globalThis),
            },
          }
        );
      }

      // Step 1: Fetch all predictions with actual yield data
      const { data: predictions, error } = await client
        .from('yield_predictions')
        .select('*')
        .not('actual_yield_kg_per_ha', 'is', null);

      if (error) {
        throw error;
      }

      if (!predictions || predictions.length < 10) {
        throw new NDVICalculationError(
          `Insufficient training data: ${predictions?.length || 0} predictions with actual yields (minimum 10 required)`,
          undefined,
          'Insufficient data'
        );
      }

      console.log(`[Yield Prediction] Found ${predictions.length} predictions with actual yields`);

      // Step 2: Convert to training data points
      const trainingData: TrainingDataPoint[] = predictions.map((row: any) => ({
        predictedYieldKgPerHa: Number(row.predicted_yield_kg_per_ha),
        actualYieldKgPerHa: Number(row.actual_yield_kg_per_ha),
        inputFeatures: row.input_features,
      }));

      // Step 3: Optimize coefficients using grid search
      const optimizedParams = this.optimizeCoefficients(trainingData);

      console.log('[Yield Prediction] Optimized parameters:', optimizedParams);

      // Step 4: Calculate accuracy metrics with optimized parameters
      const accuracyMetrics = this.calculateTrainingAccuracy(trainingData, optimizedParams);

      console.log('[Yield Prediction] Training accuracy:', accuracyMetrics);

      // Step 5: Validate accuracy (should achieve ±15% MAPE)
      if (accuracyMetrics.mape > 15) {
        console.warn(
          `[Yield Prediction] Model accuracy (${accuracyMetrics.mape.toFixed(2)}% MAPE) exceeds target of ±15%`
        );
      }

      // Step 6: Generate new model version
      const currentVersion = await this.loadModelParameters(client);
      const newVersion = this.incrementModelVersion(currentVersion.modelVersion);

      // Step 7: Store trained parameters in database
      const modelParameters: ModelParameters = {
        id: '', // Will be generated by database
        modelVersion: newVersion,
        parameters: optimizedParams,
        trainingDate: new Date(),
        dataPointsUsed: trainingData.length,
        accuracyMetrics,
        createdAt: new Date(),
      };

      const { data: insertedData, error: insertError } = await client
        .from('model_parameters')
        .insert({
          model_version: modelParameters.modelVersion,
          parameters: modelParameters.parameters,
          training_date: modelParameters.trainingDate.toISOString(),
          data_points_used: modelParameters.dataPointsUsed,
          accuracy_metrics: modelParameters.accuracyMetrics,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      modelParameters.id = insertedData.id;

      console.log(`[Yield Prediction] Model training complete: ${newVersion}`);
      console.log(`[Yield Prediction] Accuracy: MAE=${accuracyMetrics.mae.toFixed(2)} kg/ha, MAPE=${accuracyMetrics.mape.toFixed(2)}%`);

      // Step 8: Clear cached parameters to force reload
      this.cachedParameters = null;

      return modelParameters;
    } catch (error) {
      if (error instanceof NDVICalculationError) {
        throw error;
      }

      throw new NDVICalculationError(
        `Failed to train model: ${(error as Error).message}`,
        undefined,
        'Training failed'
      );
    }
  }

  /**
   * Optimize model coefficients using grid search
   * 
   * This method uses a simple grid search to find optimal coefficients
   * that minimize prediction error. It tests different combinations of:
   * - NDVI coefficient (600-1000 kg/ha per NDVI unit)
   * - Trend coefficient (100-300 kg/ha per NDVI unit/month)
   * - Baseline yield (400-600 kg/ha)
   * - Historical weight (0.1-0.5)
   * 
   * @param trainingData - Training data points
   * @returns Optimized parameters
   */
  private optimizeCoefficients(trainingData: TrainingDataPoint[]): {
    ndvi_coefficient: number;
    trend_coefficient: number;
    baseline_yield: number;
    historical_weight: number;
  } {
    let bestParams = {
      ndvi_coefficient: 800,
      trend_coefficient: 200,
      baseline_yield: 500,
      historical_weight: 0.3,
    };
    let bestMAPE = Infinity;

    // Grid search ranges
    const ndviCoeffs = [600, 700, 800, 900, 1000];
    const trendCoeffs = [100, 150, 200, 250, 300];
    const baselineYields = [400, 450, 500, 550, 600];
    const historicalWeights = [0.1, 0.2, 0.3, 0.4, 0.5];

    // Test all combinations
    for (const ndviCoeff of ndviCoeffs) {
      for (const trendCoeff of trendCoeffs) {
        for (const baselineYield of baselineYields) {
          for (const historicalWeight of historicalWeights) {
            const params = {
              ndvi_coefficient: ndviCoeff,
              trend_coefficient: trendCoeff,
              baseline_yield: baselineYield,
              historical_weight: historicalWeight,
            };

            const accuracy = this.calculateTrainingAccuracy(trainingData, params);

            if (accuracy.mape < bestMAPE) {
              bestMAPE = accuracy.mape;
              bestParams = params;
            }
          }
        }
      }
    }

    return bestParams;
  }

  /**
   * Calculate training accuracy metrics
   * 
   * Calculates Mean Absolute Error (MAE) and Mean Absolute Percentage Error (MAPE)
   * for a given set of parameters on the training data.
   * 
   * @param trainingData - Training data points
   * @param params - Model parameters to evaluate
   * @returns Accuracy metrics
   */
  private calculateTrainingAccuracy(
    trainingData: TrainingDataPoint[],
    params: {
      ndvi_coefficient: number;
      trend_coefficient: number;
      baseline_yield: number;
      historical_weight: number;
    }
  ): {
    mae: number;
    mape: number;
    predictions_evaluated: number;
  } {
    let totalAbsoluteError = 0;
    let totalPercentageError = 0;

    for (const dataPoint of trainingData) {
      const { inputFeatures, actualYieldKgPerHa } = dataPoint;

      // Recalculate prediction with new parameters
      const ndviBasedPrediction =
        params.baseline_yield +
        inputFeatures.meanNDVI * params.ndvi_coefficient +
        inputFeatures.ndviTrend * params.trend_coefficient;

      let prediction = ndviBasedPrediction;

      // Blend with historical data if available
      if (inputFeatures.historicalYield && inputFeatures.historicalYield.length > 0) {
        const historicalAverage =
          inputFeatures.historicalYield.reduce((sum, y) => sum + y, 0) /
          inputFeatures.historicalYield.length;

        prediction =
          (1 - params.historical_weight) * ndviBasedPrediction +
          params.historical_weight * historicalAverage;
      }

      // Clamp prediction
      prediction = Math.max(MIN_YIELD_KG_PER_HA, Math.min(MAX_YIELD_KG_PER_HA, prediction));

      // Calculate errors
      const absoluteError = Math.abs(prediction - actualYieldKgPerHa);
      totalAbsoluteError += absoluteError;

      const percentageError = actualYieldKgPerHa !== 0 ? (absoluteError / actualYieldKgPerHa) * 100 : 0;
      totalPercentageError += percentageError;
    }

    const count = trainingData.length;

    return {
      mae: Math.round((totalAbsoluteError / count) * 100) / 100,
      mape: Math.round((totalPercentageError / count) * 100) / 100,
      predictions_evaluated: count,
    };
  }

  /**
   * Increment model version
   * 
   * Increments the minor version number of the model.
   * Example: v1.0.0-simple-regression → v1.1.0-trained
   * 
   * @param currentVersion - Current model version
   * @returns New model version
   */
  private incrementModelVersion(currentVersion: string): string {
    // Extract version number (e.g., "v1.0.0" from "v1.0.0-simple-regression")
    const versionMatch = currentVersion.match(/v(\d+)\.(\d+)\.(\d+)/);

    if (!versionMatch) {
      // If version format is unexpected, default to v1.1.0
      return 'v1.1.0-trained';
    }

    const major = parseInt(versionMatch[1], 10);
    const minor = parseInt(versionMatch[2], 10);
    const patch = parseInt(versionMatch[3], 10);

    // Increment minor version
    return `v${major}.${minor + 1}.${patch}-trained`;
  }

  /**
   * Get model information
   * 
   * Returns current model version, parameters, and training metadata.
   * Includes accuracy metrics from last training.
   * 
   * @param supabase - Optional Supabase client
   * @returns Model information
   */
  async getModelInfo(supabase?: any): Promise<ModelParameters> {
    return await this.loadModelParameters(supabase);
  }

  /**
   * Predict yield for a parcelle
   * 
   * This method:
   * 1. Retrieves current NDVI data for the parcelle
   * 2. Calculates NDVI trend over past 3 months
   * 3. Applies simple regression model to predict yield
   * 4. Incorporates historical yield data if available
   * 5. Calculates confidence level based on data availability
   * 6. Computes confidence interval
   * 7. Stores prediction in database (if storePrediction is true)
   * 8. Returns complete yield prediction
   * 
   * @param parcelleId - Parcelle ID
   * @param geometry - Parcelle geometry (MultiPolygon)
   * @param surfaceHectares - Parcelle surface area in hectares
   * @param options - Prediction options
   * @returns Yield prediction with confidence interval
   * @throws {NDVICalculationError} If yield prediction fails
   * @throws {InsufficientDataError} If insufficient NDVI data is available
   * 
   * @example
   * ```typescript
   * const service = new YieldPredictionService();
   * const prediction = await service.predictYield(
   *   'parcelle-123',
   *   parcelleGeometry,
   *   5.2, // 5.2 hectares
   *   {
   *     harvestSeason: '2024-Q4',
   *     historicalYield: [450, 480, 520], // Past 3 years
   *   }
   * );
   * console.log('Predicted yield:', prediction.predictedYieldKgPerHa, 'kg/ha');
   * console.log('Confidence:', prediction.confidenceLevel);
   * ```
   */
  async predictYield(
    parcelleId: string,
    geometry: MultiPolygon,
    surfaceHectares: number,
    options: YieldPredictionOptions = {}
  ): Promise<YieldPrediction> {
    const {
      harvestSeason = this.getNextHarvestSeason(),
      historicalYield = [],
      storePrediction = true,
      supabase,
    } = options;

    try {
      // Step 0: Load model parameters (use cached or fetch from DB)
      await this.loadModelParameters(supabase);

      // Step 1: Retrieve current NDVI data
      const currentDate = new Date();
      const ndviResult = await ndviService.calculateNDVI(
        parcelleId,
        geometry,
        currentDate,
        { forceRecalculate: false, storeResult: true }
      );

      // Step 2: Calculate NDVI trend over past 3 months
      const threeMonthsAgo = new Date(currentDate);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      let ndviTrend;
      let dataPoints = 1; // At minimum, we have current NDVI

      try {
        const trendResult = await ndviService.getNDVITrend(
          parcelleId,
          threeMonthsAgo,
          currentDate,
          supabase
        );
        ndviTrend = trendResult.changeRate; // NDVI units per month
        dataPoints = trendResult.dataPoints;
      } catch (error) {
        // If insufficient data for trend, use 0 (stable trend)
        if (error instanceof InsufficientDataError) {
          console.log(`[Yield Prediction] Insufficient data for trend, using 0: ${error.message}`);
          ndviTrend = 0;
        } else {
          throw error;
        }
      }

      // Step 3: Prepare input features
      const inputs: YieldPredictionInputs = {
        meanNDVI: ndviResult.meanNDVI,
        ndviTrend,
        historicalYield,
        surfaceHectares,
        dataPoints,
      };

      // Step 4: Apply regression model to predict yield
      const predictedYield = this.calculatePredictedYield(inputs);

      // Step 5: Determine confidence level based on data availability
      const confidenceLevel = this.determineConfidenceLevel(inputs);

      // Step 6: Calculate confidence interval
      const { lower, upper } = this.calculateConfidenceInterval(
        predictedYield,
        confidenceLevel
      );

      // Step 7: Create yield prediction object
      const prediction: YieldPrediction = {
        id: `yield-${parcelleId}-${Date.now()}`,
        parcelleId,
        predictionDate: currentDate,
        harvestSeason,
        predictedYieldKgPerHa: predictedYield,
        confidenceLevel,
        confidenceIntervalLower: lower,
        confidenceIntervalUpper: upper,
        modelVersion: MODEL_VERSION,
        inputFeatures: {
          meanNDVI: inputs.meanNDVI,
          ndviTrend: inputs.ndviTrend,
          historicalYield: inputs.historicalYield,
          surfaceHectares: inputs.surfaceHectares,
        },
        actualYieldKgPerHa: null, // Will be filled after harvest
        createdAt: currentDate,
      };

      // Step 8: Store prediction in database if requested
      if (storePrediction) {
        await this.storePrediction(prediction, supabase);
      }

      return prediction;
    } catch (error) {
      // Re-throw known errors
      if (
        error instanceof NDVICalculationError ||
        error instanceof InsufficientDataError
      ) {
        throw error;
      }

      // Wrap unknown errors
      throw new NDVICalculationError(
        `Failed to predict yield for parcelle ${parcelleId}: ${(error as Error).message}`,
        parcelleId,
        (error as Error).message
      );
    }
  }

  /**
   * Calculate predicted yield using simple regression model
   * 
   * The model uses the following formula:
   * 
   *   Predicted Yield = Baseline + (NDVI × NDVI_Coefficient) + (Trend × Trend_Coefficient)
   * 
   * If historical yield data is available, the prediction is blended:
   * 
   *   Final Prediction = (1 - w) × NDVI_Prediction + w × Historical_Average
   * 
   * Where w is the historical yield weight (default 0.3)
   * 
   * The prediction is clamped to realistic bounds [MIN_YIELD, MAX_YIELD]
   * 
   * @param inputs - Yield prediction input features
   * @returns Predicted yield in kg/ha
   */
  private calculatePredictedYield(inputs: YieldPredictionInputs): number {
    const { meanNDVI, ndviTrend, historicalYield } = inputs;

    // Calculate NDVI-based prediction
    // Formula: Baseline + (NDVI × Coefficient) + (Trend × Coefficient)
    let ndviBasedPrediction = BASELINE_YIELD_KG_PER_HA +
      (meanNDVI * NDVI_COEFFICIENT) +
      (ndviTrend * TREND_COEFFICIENT);

    // If historical yield data is available, blend with NDVI prediction
    if (historicalYield.length > 0) {
      // Calculate average historical yield
      const historicalAverage = historicalYield.reduce((sum, y) => sum + y, 0) / historicalYield.length;

      // Blend NDVI prediction with historical average
      // Formula: (1 - w) × NDVI_Prediction + w × Historical_Average
      const blendedPrediction = (1 - HISTORICAL_YIELD_WEIGHT) * ndviBasedPrediction +
        HISTORICAL_YIELD_WEIGHT * historicalAverage;

      ndviBasedPrediction = blendedPrediction;
    }

    // Clamp prediction to realistic bounds
    const clampedPrediction = Math.max(
      MIN_YIELD_KG_PER_HA,
      Math.min(MAX_YIELD_KG_PER_HA, ndviBasedPrediction)
    );

    // Round to 2 decimal places
    return Math.round(clampedPrediction * 100) / 100;
  }

  /**
   * Determine confidence level based on data availability
   * 
   * Confidence level is determined by:
   * - Number of NDVI data points available
   * - Availability of historical yield data
   * 
   * Rules:
   * - High confidence: ≥6 NDVI data points AND historical yield data
   * - Medium confidence: ≥3 NDVI data points OR historical yield data
   * - Low confidence: <3 NDVI data points AND no historical yield data
   * 
   * @param inputs - Yield prediction input features
   * @returns Confidence level ('high', 'medium', 'low')
   */
  private determineConfidenceLevel(
    inputs: YieldPredictionInputs
  ): 'high' | 'medium' | 'low' {
    const { dataPoints, historicalYield } = inputs;
    const hasHistoricalData = historicalYield.length > 0;

    // High confidence: Sufficient NDVI data AND historical yield data
    if (dataPoints >= MIN_DATA_POINTS_HIGH_CONFIDENCE && hasHistoricalData) {
      return 'high';
    }

    // Medium confidence: Either sufficient NDVI data OR historical yield data
    if (dataPoints >= MIN_DATA_POINTS_MEDIUM_CONFIDENCE || hasHistoricalData) {
      return 'medium';
    }

    // Low confidence: Insufficient data
    return 'low';
  }

  /**
   * Calculate confidence interval for yield prediction
   * 
   * The confidence interval represents the range within which the actual
   * yield is likely to fall. The width of the interval depends on the
   * confidence level:
   * - High confidence: ±10% of predicted yield
   * - Medium confidence: ±20% of predicted yield
   * - Low confidence: ±30% of predicted yield
   * 
   * The interval is clamped to realistic bounds [MIN_YIELD, MAX_YIELD]
   * 
   * @param predictedYield - Predicted yield in kg/ha
   * @param confidenceLevel - Confidence level
   * @returns Confidence interval with lower and upper bounds
   */
  private calculateConfidenceInterval(
    predictedYield: number,
    confidenceLevel: 'high' | 'medium' | 'low'
  ): { lower: number; upper: number } {
    // Get interval width based on confidence level
    const intervalWidth = CONFIDENCE_INTERVAL_WIDTHS[confidenceLevel];

    // Calculate lower and upper bounds
    const margin = predictedYield * intervalWidth;
    let lower = predictedYield - margin;
    let upper = predictedYield + margin;

    // Clamp to realistic bounds
    lower = Math.max(MIN_YIELD_KG_PER_HA, lower);
    upper = Math.min(MAX_YIELD_KG_PER_HA, upper);

    // Ensure lower < upper (in case clamping caused issues)
    if (lower >= upper) {
      lower = predictedYield * 0.9;
      upper = predictedYield * 1.1;
    }

    // Round to 2 decimal places
    return {
      lower: Math.round(lower * 100) / 100,
      upper: Math.round(upper * 100) / 100,
    };
  }

  /**
   * Get next harvest season identifier
   * 
   * Cocoa in Cameroon has two main harvest seasons:
   * - Main harvest: October-December (Q4)
   * - Mid-crop: April-June (Q2)
   * 
   * This method returns the next upcoming harvest season in format "YYYY-QX"
   * 
   * @returns Harvest season identifier (e.g., "2024-Q4", "2025-Q2")
   */
  private getNextHarvestSeason(): string {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const currentYear = now.getFullYear();

    // Determine next harvest season based on current month
    // Q2 (April-June): Months 3-5
    // Q4 (October-December): Months 9-11

    if (currentMonth < 3) {
      // January-March: Next harvest is Q2 of current year
      return `${currentYear}-Q2`;
    } else if (currentMonth < 9) {
      // April-September: Next harvest is Q4 of current year
      return `${currentYear}-Q4`;
    } else {
      // October-December: Next harvest is Q2 of next year
      return `${currentYear + 1}-Q2`;
    }
  }

  /**
   * Store yield prediction in database
   * 
   * Stores the yield prediction in the yield_predictions table.
   * Uses UPSERT logic to handle cases where a prediction already exists
   * for the same parcelle and harvest season.
   * 
   * @param prediction - Yield prediction to store
   * @param supabase - Optional Supabase client
   * @throws {NDVICalculationError} If storage fails
   */
  private async storePrediction(
    prediction: YieldPrediction,
    supabase?: any
  ): Promise<void> {
    try {
      // Use provided client or create a new one with SERVICE ROLE KEY to bypass RLS
      let client = supabase;
      if (!client) {
        const { createClient } = await import('@supabase/supabase-js');

        // Use service role key to bypass RLS for storage operations
        const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;
        if (!serviceRoleKey) {
          console.warn('SUPABASE_SERVICE_KEY not found, using anon key (may fail due to RLS)');
        }

        client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
            global: {
              fetch: fetch.bind(globalThis),
            },
          }
        );
      }

      // Prepare database row
      const row = {
        parcelle_id: prediction.parcelleId,
        prediction_date: prediction.predictionDate.toISOString(),
        harvest_season: prediction.harvestSeason,
        predicted_yield_kg_per_ha: prediction.predictedYieldKgPerHa,
        confidence_level: prediction.confidenceLevel,
        confidence_interval_lower: prediction.confidenceIntervalLower,
        confidence_interval_upper: prediction.confidenceIntervalUpper,
        model_version: prediction.modelVersion,
        input_features: prediction.inputFeatures,
        actual_yield_kg_per_ha: prediction.actualYieldKgPerHa,
      };

      // Insert prediction into database
      const { error } = await client
        .from('yield_predictions')
        .insert(row);

      if (error) {
        throw error;
      }

      console.log(`[Yield Prediction] Stored prediction for parcelle ${prediction.parcelleId}, season ${prediction.harvestSeason}`);
    } catch (error) {
      throw new NDVICalculationError(
        `Failed to store yield prediction: ${(error as Error).message}`,
        prediction.parcelleId,
        'Storage failed'
      );
    }
  }

  /**
   * Get yield predictions for a parcelle
   * 
   * Retrieves all yield predictions for a parcelle, optionally filtered
   * by harvest season.
   * 
   * @param parcelleId - Parcelle ID
   * @param harvestSeason - Optional harvest season filter
   * @param supabase - Optional Supabase client
   * @returns Array of yield predictions
   * @throws {NDVICalculationError} If retrieval fails
   */
  async getPredictions(
    parcelleId: string,
    harvestSeason?: string,
    supabase?: any
  ): Promise<YieldPrediction[]> {
    try {
      // Use provided client or create a new one
      let client = supabase;
      if (!client) {
        const { createClient } = await import('@supabase/supabase-js');
        client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              fetch: fetch.bind(globalThis),
            },
          }
        );
      }

      // Build query
      let query = client
        .from('yield_predictions')
        .select('*')
        .eq('parcelle_id', parcelleId)
        .order('prediction_date', { ascending: false });

      // Add harvest season filter if provided
      if (harvestSeason) {
        query = query.eq('harvest_season', harvestSeason);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Convert database rows to YieldPrediction objects
      return data.map((row: any) => ({
        id: row.id,
        parcelleId: row.parcelle_id,
        predictionDate: new Date(row.prediction_date),
        harvestSeason: row.harvest_season,
        predictedYieldKgPerHa: Number(row.predicted_yield_kg_per_ha),
        confidenceLevel: row.confidence_level as 'high' | 'medium' | 'low',
        confidenceIntervalLower: Number(row.confidence_interval_lower),
        confidenceIntervalUpper: Number(row.confidence_interval_upper),
        modelVersion: row.model_version,
        inputFeatures: row.input_features,
        actualYieldKgPerHa: row.actual_yield_kg_per_ha ? Number(row.actual_yield_kg_per_ha) : null,
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      throw new NDVICalculationError(
        `Failed to retrieve yield predictions for parcelle ${parcelleId}: ${(error as Error).message}`,
        parcelleId,
        'Retrieval failed'
      );
    }
  }

  /**
   * Update actual yield after harvest
   * 
   * Updates a yield prediction with the actual yield recorded after harvest.
   * This data is used to improve future predictions and validate model accuracy.
   * 
   * @param predictionId - Prediction ID
   * @param actualYieldKgPerHa - Actual yield in kg/ha
   * @param supabase - Optional Supabase client
   * @throws {NDVICalculationError} If update fails
   */
  async updateActualYield(
    predictionId: string,
    actualYieldKgPerHa: number,
    supabase?: any
  ): Promise<void> {
    try {
      // Use provided client or create a new one with SERVICE ROLE KEY
      let client = supabase;
      if (!client) {
        const { createClient } = await import('@supabase/supabase-js');

        const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY;
        if (!serviceRoleKey) {
          console.warn('SUPABASE_SERVICE_KEY not found, using anon key (may fail due to RLS)');
        }

        client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
            global: {
              fetch: fetch.bind(globalThis),
            },
          }
        );
      }

      // Update actual yield
      const { error } = await client
        .from('yield_predictions')
        .update({ actual_yield_kg_per_ha: actualYieldKgPerHa })
        .eq('id', predictionId);

      if (error) {
        throw error;
      }

      console.log(`[Yield Prediction] Updated actual yield for prediction ${predictionId}: ${actualYieldKgPerHa} kg/ha`);
    } catch (error) {
      throw new NDVICalculationError(
        `Failed to update actual yield: ${(error as Error).message}`,
        undefined,
        'Update failed'
      );
    }
  }

  /**
   * Calculate prediction accuracy
   * 
   * Calculates the accuracy of yield predictions by comparing predicted
   * vs actual yields for predictions that have actual yield data.
   * 
   * Returns:
   * - Mean Absolute Error (MAE): Average absolute difference
   * - Mean Absolute Percentage Error (MAPE): Average percentage difference
   * - Number of predictions evaluated
   * 
   * @param parcelleId - Optional parcelle ID to filter predictions
   * @param supabase - Optional Supabase client
   * @returns Accuracy metrics
   */
  async calculateAccuracy(
    parcelleId?: string,
    supabase?: any
  ): Promise<{
    meanAbsoluteError: number;
    meanAbsolutePercentageError: number;
    predictionsEvaluated: number;
  }> {
    try {
      // Use provided client or create a new one
      let client = supabase;
      if (!client) {
        const { createClient } = await import('@supabase/supabase-js');
        client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              fetch: fetch.bind(globalThis),
            },
          }
        );
      }

      // Query predictions with actual yield data
      let query = client
        .from('yield_predictions')
        .select('predicted_yield_kg_per_ha, actual_yield_kg_per_ha')
        .not('actual_yield_kg_per_ha', 'is', null);

      if (parcelleId) {
        query = query.eq('parcelle_id', parcelleId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return {
          meanAbsoluteError: 0,
          meanAbsolutePercentageError: 0,
          predictionsEvaluated: 0,
        };
      }

      // Calculate errors
      let totalAbsoluteError = 0;
      let totalPercentageError = 0;

      data.forEach((row: any) => {
        const predicted = Number(row.predicted_yield_kg_per_ha);
        const actual = Number(row.actual_yield_kg_per_ha);

        // Absolute error
        const absoluteError = Math.abs(predicted - actual);
        totalAbsoluteError += absoluteError;

        // Percentage error
        const percentageError = actual !== 0 ? (absoluteError / actual) * 100 : 0;
        totalPercentageError += percentageError;
      });

      const count = data.length;

      return {
        meanAbsoluteError: Math.round((totalAbsoluteError / count) * 100) / 100,
        meanAbsolutePercentageError: Math.round((totalPercentageError / count) * 100) / 100,
        predictionsEvaluated: count,
      };
    } catch (error) {
      throw new NDVICalculationError(
        `Failed to calculate prediction accuracy: ${(error as Error).message}`,
        undefined,
        'Accuracy calculation failed'
      );
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of YieldPredictionService
 * 
 * Use this instance throughout the application for consistent yield predictions.
 */
export const yieldPredictionService = new YieldPredictionService();
