-- Migration: Create satellite_imagery table
-- Description: Stores metadata about retrieved satellite imagery from Sentinel-2 via Google Earth Engine
-- Date: 2026-05-03

-- Create satellite_imagery table
CREATE TABLE IF NOT EXISTS satellite_imagery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcelle_id UUID NOT NULL REFERENCES parcelles(id) ON DELETE CASCADE,
  acquisition_date TIMESTAMPTZ NOT NULL,
  cloud_cover_percent DECIMAL(5,2) NOT NULL CHECK (cloud_cover_percent >= 0 AND cloud_cover_percent <= 100),
  satellite_source TEXT NOT NULL DEFAULT 'sentinel-2',
  tile_url TEXT NOT NULL,
  bounds JSONB NOT NULL,
  resolution_meters DECIMAL(6,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one imagery record per parcelle per acquisition date
  CONSTRAINT satellite_imagery_unique UNIQUE (parcelle_id, acquisition_date)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_satellite_imagery_parcelle 
  ON satellite_imagery(parcelle_id);

CREATE INDEX IF NOT EXISTS idx_satellite_imagery_date 
  ON satellite_imagery(acquisition_date);

CREATE INDEX IF NOT EXISTS idx_satellite_imagery_cloud_cover 
  ON satellite_imagery(cloud_cover_percent);

-- Add comment to table
COMMENT ON TABLE satellite_imagery IS 'Stores metadata about satellite imagery retrieved from Google Earth Engine (Sentinel-2)';

-- Add comments to columns
COMMENT ON COLUMN satellite_imagery.id IS 'Primary key';
COMMENT ON COLUMN satellite_imagery.parcelle_id IS 'Foreign key to parcelles table';
COMMENT ON COLUMN satellite_imagery.acquisition_date IS 'Date when satellite captured the imagery';
COMMENT ON COLUMN satellite_imagery.cloud_cover_percent IS 'Percentage of cloud cover in the imagery (0-100)';
COMMENT ON COLUMN satellite_imagery.satellite_source IS 'Source satellite (default: sentinel-2)';
COMMENT ON COLUMN satellite_imagery.tile_url IS 'URL to imagery tiles stored in Supabase Storage';
COMMENT ON COLUMN satellite_imagery.bounds IS 'GeoJSON bounding box of the imagery';
COMMENT ON COLUMN satellite_imagery.resolution_meters IS 'Spatial resolution in meters (typically 10-20m for Sentinel-2)';
COMMENT ON COLUMN satellite_imagery.created_at IS 'Timestamp when record was created';
