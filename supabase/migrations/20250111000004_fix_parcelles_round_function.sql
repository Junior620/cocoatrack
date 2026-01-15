-- Migration: Fix ROUND function for surface_hectares calculation
-- The ROUND(double precision, integer) function doesn't exist in PostgreSQL
-- We need to cast to NUMERIC first: ROUND(value::NUMERIC, precision)

-- ============================================================================
-- Fix the calculate_parcelle_fields trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_parcelle_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate centroid (point on surface for irregular shapes)
  NEW.centroid := ST_PointOnSurface(NEW.geometry);
  
  -- Calculate surface in hectares (geography for accurate area on Earth)
  -- Cast to NUMERIC for ROUND function compatibility
  NEW.surface_hectares := ROUND((ST_Area(NEW.geometry::geography) / 10000)::NUMERIC, 4);
  
  -- Check for flat/degenerate polygon (zero or near-zero area)
  IF NEW.surface_hectares < 0.0001 THEN
    RAISE EXCEPTION 'INVALID_GEOMETRY: Polygon has zero or near-zero area (degenerate polygon)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION public.calculate_parcelle_fields() IS 
  'Calculates centroid and surface_hectares for parcelles. Fixed ROUND function to use NUMERIC cast.';
