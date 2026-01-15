-- ============================================================================
-- CocoaTrack V2 - Add Author Name to Parcelles RPC Functions
-- Updates list_parcelles and get_parcelle to include created_by_name
-- ============================================================================

-- Drop existing functions first (return type is changing)
DROP FUNCTION IF EXISTS public.list_parcelles(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN, INTEGER, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS public.get_parcelle(UUID);
DROP FUNCTION IF EXISTS public.create_parcelle(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, JSONB, TEXT, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.update_parcelle(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, JSONB);

-- ============================================================================
-- Function: list_parcelles (updated)
-- Now includes created_by_name from profiles table
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
  p_simplify BOOLEAN DEFAULT FALSE
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
  created_by_name TEXT,
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
  RETURN QUERY
  SELECT
    par.id,
    par.planteur_id,
    par.code,
    par.label,
    par.village,
    CASE 
      WHEN p_simplify THEN ST_AsGeoJSON(ST_SimplifyPreserveTopology(par.geometry, 0.001))::JSONB
      ELSE ST_AsGeoJSON(par.geometry)::JSONB
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
    pr.full_name AS created_by_name,
    par.created_at,
    par.updated_at,
    pl.name AS planteur_name,
    pl.code AS planteur_code,
    pl.cooperative_id AS planteur_cooperative_id,
    v_total AS total_count
  FROM public.parcelles par
  JOIN public.planteurs pl ON pl.id = par.planteur_id
  LEFT JOIN public.profiles pr ON pr.id = par.created_by
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
GRANT EXECUTE ON FUNCTION public.list_parcelles TO authenticated;

-- ============================================================================
-- Function: get_parcelle (updated)
-- Now includes created_by_name from profiles table
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_parcelle(p_id UUID)
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
  created_by_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  planteur_name TEXT,
  planteur_code TEXT,
  planteur_cooperative_id UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_cooperative_id UUID;
BEGIN
  -- Get user's cooperative_id for RLS
  SELECT cooperative_id INTO v_user_cooperative_id
  FROM public.profiles
  WHERE profiles.id = auth.uid();

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
  JOIN public.planteurs pl ON pl.id = par.planteur_id
  LEFT JOIN public.profiles pr ON pr.id = par.created_by
  WHERE par.id = p_id
    AND pl.cooperative_id = v_user_cooperative_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_parcelle TO authenticated;


-- ============================================================================
-- Function: create_parcelle (updated)
-- Now includes created_by_name from profiles table
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
    p_planteur_id,
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
  JOIN public.planteurs pl ON pl.id = par.planteur_id
  LEFT JOIN public.profiles pr ON pr.id = par.created_by
  WHERE par.id = v_parcelle_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_parcelle TO authenticated;

-- ============================================================================
-- Function: update_parcelle (updated)
-- Now includes created_by_name from profiles table
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

  -- Return the updated parcelle with planteur info and author name
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
  JOIN public.planteurs pl ON pl.id = par.planteur_id
  LEFT JOIN public.profiles pr ON pr.id = par.created_by
  WHERE par.id = p_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_parcelle TO authenticated;
