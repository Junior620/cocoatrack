-- Migration: Fix create_parcelle function to support orphan parcelles
-- Orphan parcelles have planteur_id = NULL, so we need LEFT JOIN instead of JOIN

-- Drop existing function first
DROP FUNCTION IF EXISTS public.create_parcelle(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, JSONB, TEXT, UUID, UUID, TEXT);

-- ============================================================================
-- Function: create_parcelle (fixed for orphan parcelles)
-- Now uses LEFT JOIN to support parcelles without planteur_id
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_parcelle(
  p_planteur_id UUID,
  p_code TEXT,
  p_label TEXT DEFAULT NULL,
  p_village TEXT DEFAULT NULL,
  p_geometry_geojson TEXT DEFAULT NULL,
  p_certifications TEXT[] DEFAULT '{}',
  p_conformity_status TEXT DEFAULT 'informations_manquantes',
  p_risk_flags JSONB DEFAULT '{}',
  p_source TEXT DEFAULT 'manual',
  p_created_by UUID DEFAULT NULL,
  p_import_file_id UUID DEFAULT NULL,
  p_feature_hash TEXT DEFAULT NULL
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
  created_by_name TEXT,
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
  v_parcelle_id UUID;
  v_geometry geometry(MultiPolygon, 4326);
  v_created_by UUID;
BEGIN
  -- Use provided created_by or current user
  v_created_by := COALESCE(p_created_by, auth.uid());
  
  IF v_created_by IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User not authenticated';
  END IF;

  -- Convert GeoJSON to PostGIS geometry
  IF p_geometry_geojson IS NULL OR p_geometry_geojson = '' THEN
    RAISE EXCEPTION 'INVALID_GEOMETRY: geometry is required';
  END IF;
  
  BEGIN
    v_geometry := ST_SetSRID(ST_GeomFromGeoJSON(p_geometry_geojson), 4326);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'INVALID_GEOMETRY: failed to parse GeoJSON - %', SQLERRM;
  END;

  -- Insert the parcelle (triggers will handle validation and calculations)
  INSERT INTO public.parcelles (
    planteur_id,
    code,
    label,
    village,
    geometry,
    centroid,  -- Will be overwritten by trigger
    surface_hectares,  -- Will be overwritten by trigger
    certifications,
    conformity_status,
    risk_flags,
    source,
    import_file_id,
    feature_hash,
    created_by
  ) VALUES (
    p_planteur_id,  -- Can be NULL for orphan parcelles
    p_code,
    p_label,
    p_village,
    v_geometry,
    ST_PointOnSurface(v_geometry),  -- Placeholder, trigger will recalculate
    0,  -- Placeholder, trigger will recalculate
    p_certifications,
    p_conformity_status,
    p_risk_flags,
    p_source,
    p_import_file_id,
    p_feature_hash,
    v_created_by
  )
  RETURNING parcelles.id INTO v_parcelle_id;

  -- Return the created parcelle with planteur info and author name
  -- Use LEFT JOIN to support orphan parcelles (planteur_id = NULL)
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
    pr.full_name AS created_by_name,
    par.created_at,
    par.updated_at,
    pl.name AS planteur_name,
    pl.code AS planteur_code,
    pl.cooperative_id AS planteur_cooperative_id
  FROM public.parcelles par
  LEFT JOIN public.planteurs pl ON pl.id = par.planteur_id  -- LEFT JOIN for orphan support
  LEFT JOIN public.profiles pr ON pr.id = par.created_by
  WHERE par.id = v_parcelle_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_parcelle TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.create_parcelle IS 
'Creates a new parcelle with geometry conversion from GeoJSON.
Supports orphan parcelles (planteur_id = NULL) via LEFT JOIN.
The geometry is validated and normalized by database triggers.
Returns the created parcelle with all calculated fields.';
