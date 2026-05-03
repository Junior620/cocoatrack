-- Migration: Create yield_predictions table
-- Description: Stores ML-based yield predictions for parcelles with confidence intervals
-- Date: 2026-05-03

-- Create yield_predictions table
CREATE TABLE IF NOT EXISTS yield_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcelle_id UUID NOT NULL REFERENCES parcelles(id) ON DELETE CASCADE,
  prediction_date TIMESTAMPTZ NOT NULL,
  harvest_season TEXT NOT NULL, -- e.g., "2024-Q4", "2025-Q1"
  predicted_yield_kg_per_ha DECIMAL(10,2) NOT NULL CHECK (predicted_yield_kg_per_ha >= 0),
  confidence_level TEXT NOT NULL CHECK (confidence_level IN ('high', 'medium', 'low')),
  confidence_interval_lower DECIMAL(10,2) NOT NULL CHECK (confidence_interval_lower >= 0),
  confidence_interval_upper DECIMAL(10,2) NOT NULL CHECK (confidence_interval_upper >= 0),
  model_version TEXT NOT NULL,
  input_features JSONB NOT NULL, -- Stores NDVI trend, historical yield, surface area, etc.
  actual_yield_kg_per_ha DECIMAL(10,2) CHECK (actual_yield_kg_per_ha >= 0), -- Filled after harvest
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraint: confidence interval upper must be >= lower
  CONSTRAINT yield_predictions_confidence_interval_check 
    CHECK (confidence_interval_upper >= confidence_interval_lower),
  
  -- Constraint: predicted yield should be within confidence interval
  CONSTRAINT yield_predictions_within_interval_check 
    CHECK (predicted_yield_kg_per_ha >= confidence_interval_lower 
           AND predicted_yield_kg_per_ha <= confidence_interval_upper)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_yield_predictions_parcelle 
  ON yield_predictions(parcelle_id);

CREATE INDEX IF NOT EXISTS idx_yield_predictions_harvest_season 
  ON yield_predictions(harvest_season);

CREATE INDEX IF NOT EXISTS idx_yield_predictions_prediction_date 
  ON yield_predictions(prediction_date);

-- Create GIN index for JSONB queries on input_features
CREATE INDEX IF NOT EXISTS idx_yield_predictions_input_features 
  ON yield_predictions USING GIN (input_features);

-- Add comment to table
COMMENT ON TABLE yield_predictions IS 'Stores ML-based yield predictions for parcelles with confidence intervals and input features';

-- Add comments to columns
COMMENT ON COLUMN yield_predictions.id IS 'Primary key';
COMMENT ON COLUMN yield_predictions.parcelle_id IS 'Foreign key to parcelles table';
COMMENT ON COLUMN yield_predictions.prediction_date IS 'Date when prediction was made';
COMMENT ON COLUMN yield_predictions.harvest_season IS 'Target harvest season (e.g., "2024-Q4", "2025-Q1")';
COMMENT ON COLUMN yield_predictions.predicted_yield_kg_per_ha IS 'Predicted yield in kilograms per hectare';
COMMENT ON COLUMN yield_predictions.confidence_level IS 'Confidence level: high, medium, or low';
COMMENT ON COLUMN yield_predictions.confidence_interval_lower IS 'Lower bound of confidence interval (kg/ha)';
COMMENT ON COLUMN yield_predictions.confidence_interval_upper IS 'Upper bound of confidence interval (kg/ha)';
COMMENT ON COLUMN yield_predictions.model_version IS 'Version identifier of the prediction model used';
COMMENT ON COLUMN yield_predictions.input_features IS 'JSONB object containing input features: meanNDVI, ndviTrend, historicalYield, surfaceHectares, etc.';
COMMENT ON COLUMN yield_predictions.actual_yield_kg_per_ha IS 'Actual yield recorded after harvest (nullable until harvest)';
COMMENT ON COLUMN yield_predictions.created_at IS 'Timestamp when record was created';

