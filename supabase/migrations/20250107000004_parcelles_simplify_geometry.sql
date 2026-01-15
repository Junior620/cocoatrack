-- ============================================================================
-- CocoaTrack V2 - Parcelles Geometry Simplification
-- Adds geometry simplification support for low zoom levels / large bbox areas
-- Per Requirement 5.8: FOR zoom levels <= 10 OR bbox area > 10000 km², 
-- THE API SHALL return simplified geometry via ST_SimplifyPreserveTopology(geometry, 0.001)
-- ============================================================================

-- ============================================================================
-- Drop the old version of list_parcelles (without p_simplify parameter)
-- This is needed because CREATE OR REPLACE cannot change function signature
-- ============================================================================
DROP FUNCTION IF EXISTS public.list_parcelles(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
  BOOLEAN, INTEGER, INTEGER
);

-- ============================================================================
-- Function: list_parcelles (UPDATED)
-- Added p_simplify parameter for geometry simplification
-- When p_simplify = true, returns simplified geometry for map display
-- ============================================================================
CREATE OR REPLACE FUNCTION public.list_parcelles(
  p_planteur_id UUID DEFAULT NULL,
  p_conformity_status TEXT DEFAULT NULL,
  p_certification TEXT DEFAULT NULL,
  p_village TEXT DEFAULT NULL,
  p_source TEXT DEFAULT NULL,
  p_import_file_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_bbox_min_lng DOUBLE PRECISION DEFAULT NULL,
  p_bbox_min_lat DOUBLE PRECISION DEFAULT NULL,
  p_bbox_max_lng DOUBLE PRECISION DEFAULT NULL,
  p_bbox_max_lat DOUBLE PRECISION DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT TRUE,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20,
  p_simplify BOOLEAN DEFAULT FALSE  -- NEW: Simplify geometry for low zoom levels
)
RETURNS TABLE (
  id UUID,
  planteur_id UUID,
  code TEXT,
  label TEXT,
  village TEXT,
  geometry_geojson JSONB,
  centroid_lat DOUBLE PRECISION,
  centroid_lng DOUBLE PRECISION,
  surface_hectares NUMERIC(12,4),
  certifications TEXT[],
  conformity_status TEXT,
  risk_flags JSONB,
  source TEXT,
  import_file_id UUID,
  feature_hash TEXT,
  is_active BOOLEAN,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  planteur_name TEXT,
  planteur_code TEXT,
  planteur_cooperative_id UUID,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset INTEGER;
  v_user_cooperative_id UUID;
  v_total BIGINT;
  v_simplify_tolerance DOUBLE PRECISION := 0.001; -- ~111m at equator
BEGIN
  -- Get user's cooperative_id for RLS
  SELECT cooperative_id INTO v_user_cooperative_id
  FROM public.profiles
  WHERE profiles.id = auth.uid();

  -- Calculate offset
  v_offset := (p_page - 1) * p_page_size;

  -- Get total count first
  SELECT COUNT(*) INTO v_total
  FROM public.parcelles par
  JOIN public.planteurs pl ON pl.id = par.planteur_id
  WHERE pl.cooperative_id = v_user_cooperative_id
    AND par.is_active = p_is_active
    AND (p_planteur_id IS NULL OR par.planteur_id = p_planteur_id)
    AND (p_conformity_status IS NULL OR par.conformity_status = p_conformity_status)
    AND (p_certification IS NULL OR p_certification = ANY(par.certifications))
    AND (p_village IS NULL OR par.village = p_village)
    AND (p_source IS NULL OR par.source = p_source)
    AND (p_import_file_id IS NULL OR par.import_file_id = p_import_file_id)
    AND (p_search IS NULL OR par.code ILIKE '%' || p_search || '%' OR pl.name ILIKE '%' || p_search || '%' OR pl.code ILIKE '%' || p_search || '%')
    AND (
      p_bbox_min_lng IS NULL OR p_bbox_min_lat IS NULL OR p_bbox_max_lng IS NULL OR p_bbox_max_lat IS NULL
      OR ST_Intersects(
        par.geometry,
        ST_MakeEnvelope(p_bbox_min_lng, p_bbox_min_lat, p_bbox_max_lng, p_bbox_max_lat, 4326)
      )
    );

  -- Return results with geometry as GeoJSON
  -- If p_simplify is true, use ST_SimplifyPreserveTopology to reduce geometry complexity
  RETURN QUERY
  SELECT
    par.id,
    par.planteur_id,
    par.code,
    par.label,
    par.village,
    CASE 
      WHEN p_simplify THEN 
        ST_AsGeoJSON(ST_SimplifyPreserveTopology(par.geometry, v_simplify_tolerance))::JSONB
      ELSE 
        ST_AsGeoJSON(par.geometry)::JSONB
    END AS geometry_geojson,
    ST_Y(par.centroid) AS centroid_lat,
    ST_X(par.centroid) AS centroid_lng,
    par.surface_hectares,
    par.certifications,
    par.conformity_status,
    par.risk_flags,
    par.source,
    par.import_file_id,
    par.feature_hash,
    par.is_active,
    par.created_by,
    par.created_at,
    par.updated_at,
    pl.name AS planteur_name,
    pl.code AS planteur_code,
    pl.cooperative_id AS planteur_cooperative_id,
    v_total AS total_count
  FROM public.parcelles par
  JOIN public.planteurs pl ON pl.id = par.planteur_id
  WHERE pl.cooperative_id = v_user_cooperative_id
    AND par.is_active = p_is_active
    AND (p_planteur_id IS NULL OR par.planteur_id = p_planteur_id)
    AND (p_conformity_status IS NULL OR par.conformity_status = p_conformity_status)
    AND (p_certification IS NULL OR p_certification = ANY(par.certifications))
    AND (p_village IS NULL OR par.village = p_village)
    AND (p_source IS NULL OR par.source = p_source)
    AND (p_import_file_id IS NULL OR par.import_file_id = p_import_file_id)
    AND (p_search IS NULL OR par.code ILIKE '%' || p_search || '%' OR pl.name ILIKE '%' || p_search || '%' OR pl.code ILIKE '%' || p_search || '%')
    AND (
      p_bbox_min_lng IS NULL OR p_bbox_min_lat IS NULL OR p_bbox_max_lng IS NULL OR p_bbox_max_lat IS NULL
      OR ST_Intersects(
        par.geometry,
        ST_MakeEnvelope(p_bbox_min_lng, p_bbox_min_lat, p_bbox_max_lng, p_bbox_max_lat, 4326)
      )
    )
  ORDER BY par.created_at DESC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.list_parcelles(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
  BOOLEAN, INTEGER, INTEGER, BOOLEAN
) TO authenticated;

-- ============================================================================
-- Comment explaining the simplification logic
-- ============================================================================
COMMENT ON FUNCTION public.list_parcelles(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT,
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
  BOOLEAN, INTEGER, INTEGER, BOOLEAN
) IS 
'List parcelles with optional geometry simplification for map display.

Parameters:
- p_simplify: When TRUE, simplifies geometry using ST_SimplifyPreserveTopology 
  with tolerance 0.001 (~111m at equator). Use for zoom levels <= 10 or 
  bbox area > 10000 km² to improve map rendering performance.

The simplification preserves topology (no self-intersections) while reducing
the number of vertices in complex polygons.';
