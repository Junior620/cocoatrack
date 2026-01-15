-- ============================================================================
-- CocoaTrack V2 - Parcelles Update RPC Function
-- RPC function for updating parcelles with geometry conversion
-- ============================================================================

-- ============================================================================
-- Function: update_parcelle
-- Updates an existing parcelle with proper geometry conversion from GeoJSON
-- Returns the updated parcelle with all calculated fields
-- 
-- Note: planteur_id cannot be changed (parcelle ownership is immutable)
-- Note: source and import_file_id are set by the system, not user-editable
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_parcelle(
  p_id UUID,
  p_code TEXT DEFAULT NULL,
  p_label TEXT DEFAULT NULL,
  p_village TEXT DEFAULT NULL,
  p_geometry_geojson TEXT DEFAULT NULL,
  p_certifications TEXT[] DEFAULT NULL,
  p_conformity_status TEXT DEFAULT NULL,
  p_risk_flags JSONB DEFAULT NULL
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
  surface_hectares NUMERIC,
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
  planteur_cooperative_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_cooperative_id UUID;
  v_parcelle_exists BOOLEAN;
  v_geometry geometry(MultiPolygon, 4326);
BEGIN
  -- Get user's cooperative_id for RLS
  SELECT cooperative_id INTO v_user_cooperative_id
  FROM public.profiles
  WHERE profiles.id = auth.uid();

  IF v_user_cooperative_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User not authenticated';
  END IF;

  -- Check if parcelle exists and user has access
  SELECT EXISTS (
    SELECT 1 FROM public.parcelles par
    JOIN public.planteurs pl ON pl.id = par.planteur_id
    WHERE par.id = p_id AND pl.cooperative_id = v_user_cooperative_id
  ) INTO v_parcelle_exists;

  IF NOT v_parcelle_exists THEN
    RAISE EXCEPTION 'NOT_FOUND: Parcelle not found or access denied';
  END IF;

  -- Convert GeoJSON to PostGIS geometry if provided
  IF p_geometry_geojson IS NOT NULL AND p_geometry_geojson != '' THEN
    BEGIN
      v_geometry := ST_SetSRID(ST_GeomFromGeoJSON(p_geometry_geojson), 4326);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'INVALID_GEOMETRY: failed to parse GeoJSON - %', SQLERRM;
    END;
  END IF;

  -- Update the parcelle (triggers will handle validation and calculations)
  UPDATE public.parcelles par
  SET
    code = COALESCE(p_code, par.code),
    label = CASE WHEN p_label IS NOT NULL THEN p_label ELSE par.label END,
    village = CASE WHEN p_village IS NOT NULL THEN p_village ELSE par.village END,
    geometry = COALESCE(v_geometry, par.geometry),
    certifications = COALESCE(p_certifications, par.certifications),
    conformity_status = COALESCE(p_conformity_status, par.conformity_status),
    risk_flags = COALESCE(p_risk_flags, par.risk_flags)
  WHERE par.id = p_id;

  -- Return the updated parcelle with planteur info
  RETURN QUERY
  SELECT
    par.id,
    par.planteur_id,
    par.code,
    par.label,
    par.village,
    ST_AsGeoJSON(par.geometry)::JSONB AS geometry_geojson,
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
    pl.cooperative_id AS planteur_cooperative_id
  FROM public.parcelles par
  JOIN public.planteurs pl ON pl.id = par.planteur_id
  WHERE par.id = p_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_parcelle TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.update_parcelle IS 
'Updates an existing parcelle with optional geometry conversion from GeoJSON.
Only provided fields are updated (NULL values preserve existing data).
The geometry is validated and normalized by database triggers.
Returns the updated parcelle with recalculated centroid and surface area.
Note: planteur_id cannot be changed (parcelle ownership is immutable).';
