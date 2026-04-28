-- Add elevation and slope columns to parcelles table
-- Migration: 20260427000001_add_elevation_to_parcelles.sql

-- Add elevation_meters column (altitude in meters above sea level)
ALTER TABLE parcelles 
ADD COLUMN IF NOT EXISTS elevation_meters DECIMAL(8, 2);

-- Add slope_percent column (average slope percentage)
ALTER TABLE parcelles 
ADD COLUMN IF NOT EXISTS slope_percent DECIMAL(5, 2);

-- Add elevation_calculated_at timestamp to track when elevation was last calculated
ALTER TABLE parcelles 
ADD COLUMN IF NOT EXISTS elevation_calculated_at TIMESTAMPTZ;

-- Add comments
COMMENT ON COLUMN parcelles.elevation_meters IS 'Average elevation of the parcelle in meters above sea level (calculated from Google Elevation API)';
COMMENT ON COLUMN parcelles.slope_percent IS 'Average slope of the parcelle in percentage (calculated from elevation data)';
COMMENT ON COLUMN parcelles.elevation_calculated_at IS 'Timestamp when elevation and slope were last calculated';

-- Create index for filtering by elevation
CREATE INDEX IF NOT EXISTS idx_parcelles_elevation ON parcelles(elevation_meters) WHERE elevation_meters IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parcelles_slope ON parcelles(slope_percent) WHERE slope_percent IS NOT NULL;
