-- Migration: Create ndvi_results table
-- Description: Stores calculated NDVI values and statistics for parcelles
-- Date: 2026-05-03

-- Create ndvi_results table
CREATE TABLE IF NOT EXISTS ndvi_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcelle_id UUID NOT NULL REFERENCES parcelles(id) ON DELETE CASCADE,
  imagery_id UUID REFERENCES satellite_imagery(id) ON DELETE SET NULL,
  calculation_date TIMESTAMPTZ NOT NULL,
  mean_ndvi DECIMAL(5,4) NOT NULL CHECK (mean_ndvi >= -1 AND mean_ndvi <= 1),
  min_ndvi DECIMAL(5,4) NOT NULL CHECK (min_ndvi >= -1 AND min_ndvi <= 1),
  max_ndvi DECIMAL(5,4) NOT NULL CHECK (max_ndvi >= -1 AND max_ndvi <= 1),
  std_dev_ndvi DECIMAL(5,4) NOT NULL CHECK (std_dev_ndvi >= 0),
  health_status TEXT NOT NULL CHECK (health_status IN ('excellent', 'good', 'fair', 'poor', 'critical')),
  ndvi_raster_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one NDVI calculation per parcelle per calculation date
  CONSTRAINT ndvi_results_unique UNIQUE (parcelle_id, calculation_date)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ndvi_results_parcelle 
  ON ndvi_results(parcelle_id);

CREATE INDEX IF NOT EXISTS idx_ndvi_results_calculation_date 
  ON ndvi_results(calculation_date);

CREATE INDEX IF NOT EXISTS idx_ndvi_results_health_status 
  ON ndvi_results(health_status);

CREATE INDEX IF NOT EXISTS idx_ndvi_results_mean_ndvi 
  ON ndvi_results(mean_ndvi);

-- Add comment to table
COMMENT ON TABLE ndvi_results IS 'Stores calculated NDVI (Normalized Difference Vegetation Index) values and health statistics for parcelles';

-- Add comments to columns
COMMENT ON COLUMN ndvi_results.id IS 'Primary key';
COMMENT ON COLUMN ndvi_results.parcelle_id IS 'Foreign key to parcelles table';
COMMENT ON COLUMN ndvi_results.imagery_id IS 'Foreign key to satellite_imagery table (nullable if imagery is deleted)';
COMMENT ON COLUMN ndvi_results.calculation_date IS 'Date when NDVI was calculated';
COMMENT ON COLUMN ndvi_results.mean_ndvi IS 'Mean NDVI value for the parcelle (-1 to 1)';
COMMENT ON COLUMN ndvi_results.min_ndvi IS 'Minimum NDVI value for the parcelle (-1 to 1)';
COMMENT ON COLUMN ndvi_results.max_ndvi IS 'Maximum NDVI value for the parcelle (-1 to 1)';
COMMENT ON COLUMN ndvi_results.std_dev_ndvi IS 'Standard deviation of NDVI values (>= 0)';
COMMENT ON COLUMN ndvi_results.health_status IS 'Health status classification: excellent (0.7-1.0), good (0.6-0.7), fair (0.5-0.6), poor (0.3-0.5), critical (0.0-0.3)';
COMMENT ON COLUMN ndvi_results.ndvi_raster_url IS 'Optional URL to NDVI raster image stored in Supabase Storage';
COMMENT ON COLUMN ndvi_results.created_at IS 'Timestamp when record was created';
