-- ============================================================================
-- CocoaTrack V2 - Parcelles Archive RPC Function
-- RPC function for soft-deleting parcelles (setting is_active=false)
-- ============================================================================

-- ============================================================================
-- Function: archive_parcelle
-- Soft-deletes a parcelle by setting is_active=false
-- Returns the archived parcelle with all fields
-- 
-- Note: This is a soft-delete - the record remains in the database
-- Note: Hard delete is reserved for DB admin scripts only
-- ============================================================================
CREATE OR REPLACE FUNCTION public.archive_parcelle(
  p_id UUID
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
  v_already_archived BOOLEAN;
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

  -- Check if already archived
  SELECT NOT is_active INTO v_already_archived
  FROM public.parcelles
  WHERE parcelles.id = p_id;

  IF v_already_archived THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Parcelle is already archived';
  END IF;

  -- Soft-delete by setting is_active=false
  UPDATE public.parcelles par
  SET is_active = false
  WHERE par.id = p_id;

  -- Return the archived parcelle with planteur info
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
GRANT EXECUTE ON FUNCTION public.archive_parcelle TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.archive_parcelle IS 
'Soft-deletes a parcelle by setting is_active=false.
The record remains in the database for audit purposes.
Returns the archived parcelle with all fields.
Hard delete is reserved for DB admin scripts only.';
