-- ============================================================================
-- Migration: Fix update_parcelle for internal users (admin/manager)
-- Date: 2025-01-16
-- Description: Allows internal users (admin, manager) to update any parcelle
--              without requiring a cooperative_id. These users manage all data.
--              Regular users (agent, viewer) still need cooperative-based access.
-- ============================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.update_parcelle(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, JSONB);

-- ============================================================================
-- Function: update_parcelle (supports internal users without cooperative)
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
AS $func$
DECLARE
  v_auth_uid UUID;
  v_user_role TEXT;
  v_user_cooperative_id UUID;
  v_is_internal_user BOOLEAN;
  v_parcelle_exists BOOLEAN;
  v_geometry geometry(MultiPolygon, 4326);
BEGIN
  -- Step 1: Check if user is authenticated
  v_auth_uid := auth.uid();
  
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: No active session - please log in again';
  END IF;

  -- Step 2: Get user's role and cooperative_id
  SELECT role, cooperative_id INTO v_user_role, v_user_cooperative_id
  FROM public.profiles
  WHERE profiles.id = v_auth_uid;

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User profile not found - please contact support';
  END IF;

  -- Step 3: Check if user is internal (admin or manager)
  -- Internal users can access ALL parcelles without cooperative restriction
  v_is_internal_user := v_user_role IN ('admin', 'manager');

  -- Step 4: Check parcelle access
  IF v_is_internal_user THEN
    -- Internal users: just check if parcelle exists
    SELECT EXISTS (
      SELECT 1 FROM public.parcelles WHERE parcelles.id = p_id
    ) INTO v_parcelle_exists;
  ELSE
    -- Regular users: need cooperative-based access
    IF v_user_cooperative_id IS NULL THEN
      RAISE EXCEPTION 'UNAUTHORIZED: No cooperative assigned to your profile - please contact your administrator';
    END IF;

    -- Check if parcelle exists and user has access via cooperative
    SELECT EXISTS (
      SELECT 1 FROM public.parcelles par
      LEFT JOIN public.planteurs pl ON pl.id = par.planteur_id
      LEFT JOIN public.parcelle_import_files pif ON pif.id = par.import_file_id
      WHERE par.id = p_id 
        AND (
          -- Case 1: Assigned parcelle - check planteur's cooperative
          (par.planteur_id IS NOT NULL AND pl.cooperative_id = v_user_cooperative_id)
          OR
          -- Case 2: Orphan parcelle - check import_file's cooperative
          (par.planteur_id IS NULL AND pif.cooperative_id = v_user_cooperative_id)
        )
    ) INTO v_parcelle_exists;
  END IF;

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

  -- Return the updated parcelle with planteur info and author name
  -- Use LEFT JOIN to support orphan parcelles
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
  LEFT JOIN public.planteurs pl ON pl.id = par.planteur_id
  LEFT JOIN public.profiles pr ON pr.id = par.created_by
  WHERE par.id = p_id;
END;
$func$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_parcelle TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.update_parcelle IS 
'Updates an existing parcelle with optional geometry conversion from GeoJSON.
Supports both assigned parcelles (with planteur_id) and orphan parcelles (planteur_id IS NULL).
Only provided fields are updated (NULL values preserve existing data).
Access control:
- Internal users (admin, manager): can update ANY parcelle
- Regular users (agent, viewer): must belong to the same cooperative as the planteur 
  (for assigned) or the import_file (for orphan parcelles).';
