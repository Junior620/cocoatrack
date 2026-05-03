-- Migration: Create satellite_cache_metadata table
-- Description: Tracks cached satellite data for cache management (LRU eviction, expiration)
-- Date: 2026-05-03

-- Create satellite_cache_metadata table
CREATE TABLE IF NOT EXISTS satellite_cache_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcelle_id UUID NOT NULL REFERENCES parcelles(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL UNIQUE,
  data_type TEXT NOT NULL CHECK (data_type IN ('imagery', 'ndvi', 'bands')),
  storage_url TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient cache management
CREATE INDEX IF NOT EXISTS idx_satellite_cache_parcelle 
  ON satellite_cache_metadata(parcelle_id);

CREATE INDEX IF NOT EXISTS idx_satellite_cache_expires 
  ON satellite_cache_metadata(expires_at);

CREATE INDEX IF NOT EXISTS idx_satellite_cache_last_accessed 
  ON satellite_cache_metadata(last_accessed_at);

-- Create index for data type filtering
CREATE INDEX IF NOT EXISTS idx_satellite_cache_data_type 
  ON satellite_cache_metadata(data_type);

-- Add comment to table
COMMENT ON TABLE satellite_cache_metadata IS 'Tracks cached satellite data for cache management including LRU eviction and expiration';

-- Add comments to columns
COMMENT ON COLUMN satellite_cache_metadata.id IS 'Primary key';
COMMENT ON COLUMN satellite_cache_metadata.parcelle_id IS 'Foreign key to parcelles table';
COMMENT ON COLUMN satellite_cache_metadata.cache_key IS 'Unique cache key for identifying cached data';
COMMENT ON COLUMN satellite_cache_metadata.data_type IS 'Type of cached data: imagery, ndvi, or bands';
COMMENT ON COLUMN satellite_cache_metadata.storage_url IS 'URL to cached data in Supabase Storage';
COMMENT ON COLUMN satellite_cache_metadata.size_bytes IS 'Size of cached data in bytes';
COMMENT ON COLUMN satellite_cache_metadata.last_accessed_at IS 'Timestamp of last access (for LRU eviction)';
COMMENT ON COLUMN satellite_cache_metadata.expires_at IS 'Expiration timestamp for cache entry';
COMMENT ON COLUMN satellite_cache_metadata.created_at IS 'Timestamp when cache entry was created';

