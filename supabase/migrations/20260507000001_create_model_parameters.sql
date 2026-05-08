-- Migration: Create model_parameters table
-- Description: Stores trained model parameters for yield prediction with versioning support
-- Date: 2026-05-07

-- Create model_parameters table
CREATE TABLE IF NOT EXISTS model_parameters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_version TEXT NOT NULL UNIQUE,
  parameters JSONB NOT NULL, -- {ndvi_coefficient, trend_coefficient, baseline_yield, historical_weight}
  training_date TIMESTAMPTZ NOT NULL,
  data_points_used INTEGER NOT NULL CHECK (data_points_used >= 0),
  accuracy_metrics JSONB NOT NULL, -- {mae, mape, predictions_evaluated}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient version lookups
CREATE INDEX IF NOT EXISTS idx_model_parameters_version 
  ON model_parameters(model_version);

-- Create index for training date (to get latest model)
CREATE INDEX IF NOT EXISTS idx_model_parameters_training_date 
  ON model_parameters(training_date DESC);

-- Create GIN index for JSONB queries on parameters
CREATE INDEX IF NOT EXISTS idx_model_parameters_parameters 
  ON model_parameters USING GIN (parameters);

-- Create GIN index for JSONB queries on accuracy_metrics
CREATE INDEX IF NOT EXISTS idx_model_parameters_accuracy_metrics 
  ON model_parameters USING GIN (accuracy_metrics);

-- Add comments to table
COMMENT ON TABLE model_parameters IS 'Stores trained model parameters for yield prediction with versioning and accuracy metrics';

-- Add comments to columns
COMMENT ON COLUMN model_parameters.id IS 'Primary key';
COMMENT ON COLUMN model_parameters.model_version IS 'Unique version identifier (e.g., "v1.1.0-trained")';
COMMENT ON COLUMN model_parameters.parameters IS 'JSONB object containing model coefficients: ndvi_coefficient, trend_coefficient, baseline_yield, historical_weight';
COMMENT ON COLUMN model_parameters.training_date IS 'Date when model was trained';
COMMENT ON COLUMN model_parameters.data_points_used IS 'Number of yield predictions used for training';
COMMENT ON COLUMN model_parameters.accuracy_metrics IS 'JSONB object containing accuracy metrics: mae (Mean Absolute Error), mape (Mean Absolute Percentage Error), predictions_evaluated';
COMMENT ON COLUMN model_parameters.created_at IS 'Timestamp when record was created';

-- Seed with default parameters (v1.0.0-simple-regression)
INSERT INTO model_parameters (
  model_version,
  parameters,
  training_date,
  data_points_used,
  accuracy_metrics
) VALUES (
  'v1.0.0-simple-regression',
  jsonb_build_object(
    'ndvi_coefficient', 800,
    'trend_coefficient', 200,
    'baseline_yield', 500,
    'historical_weight', 0.3
  ),
  NOW(),
  0,
  jsonb_build_object(
    'mae', 0,
    'mape', 0,
    'predictions_evaluated', 0
  )
) ON CONFLICT (model_version) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE model_parameters ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read model parameters
CREATE POLICY "Allow authenticated users to read model parameters"
  ON model_parameters
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only admins can insert/update model parameters (train models)
CREATE POLICY "Allow admins to train models"
  ON model_parameters
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Only admins can delete model parameters
CREATE POLICY "Allow admins to delete model parameters"
  ON model_parameters
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
