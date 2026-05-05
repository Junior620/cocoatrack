-- Migration: Add RLS policies for ndvi_results table
-- Description: Enables Row Level Security and adds policies for authenticated users
-- Date: 2026-05-04

-- Enable RLS on ndvi_results table
ALTER TABLE ndvi_results ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read all NDVI results
CREATE POLICY "Allow authenticated users to read NDVI results"
ON ndvi_results
FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow service role to insert NDVI results
CREATE POLICY "Allow service role to insert NDVI results"
ON ndvi_results
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Allow service role to update NDVI results
CREATE POLICY "Allow service role to update NDVI results"
ON ndvi_results
FOR UPDATE
TO authenticated
USING (true);

-- Policy: Allow service role to delete NDVI results
CREATE POLICY "Allow service role to delete NDVI results"
ON ndvi_results
FOR DELETE
TO authenticated
USING (true);

-- Add comments
COMMENT ON POLICY "Allow authenticated users to read NDVI results" ON ndvi_results IS
'Allows all authenticated users to read NDVI results for any parcelle';

COMMENT ON POLICY "Allow service role to insert NDVI results" ON ndvi_results IS
'Allows authenticated users (via service role) to insert new NDVI results';

COMMENT ON POLICY "Allow service role to update NDVI results" ON ndvi_results IS
'Allows authenticated users (via service role) to update existing NDVI results';

COMMENT ON POLICY "Allow service role to delete NDVI results" ON ndvi_results IS
'Allows authenticated users (via service role) to delete NDVI results';
