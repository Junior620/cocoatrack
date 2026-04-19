-- ============================================================================
-- Migration: Fix list_parcelles admin visibility
-- Description: Les admins voient toutes les parcelles, y compris celles
--              dont le planteur n'a pas de coopérative assignée
-- Date: 2026-04-19
-- ============================================================================

CREATE OR REPLACE FUNCTION public.list_parcelles(
  p_planteur_id UUID DEFAULT NULL,
  p_conformity_status TEXT DEFAULT NULL,
  p_certification TEXT DEFAULT NULL,
  p_village TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL,
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
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_offset INTEGER;
  v_user_cooperative_id UUID;
  v_user_id UUID;
  v_user_role TEXT;
  v_total BIGINT;
BEGIN
  v_user_id := auth.uid();

  SELECT cooperative_id INTO v_user_cooperative_id
  FROM public.profiles
  WHERE profiles.id = v_user_id;

  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE profiles.id = v_user_id;

  v_offset := (p_page - 1) * p_page_size;

  SELECT COUNT(*) INTO v_total
  FROM public.parcelles par
  LEFT JOIN public.planteurs pl ON pl.id = par.planteur_id
  WHERE (
      -- Admin voit tout
      v_user_role = 'admin'
      OR
      -- Planteur avec coopérative correspondante
      (pl.cooperative_id IS NOT NULL AND pl.cooperative_id = v_user_cooperative_id)
      OR
      -- Planteur sans coopérative créé par l'utilisateur
      (pl.cooperative_id IS NULL AND pl.created_by = v_user_id)
      OR
      -- Parcelle créée directement par l'utilisateur
      (par.created_by = v_user_id)
    )
    AND par.is_active = p_is_active
    AND (p_planteur_id IS NULL OR par.planteur_id = p_planteur_id)
    AND (p_conformity_status IS NULL OR par.conformity_status = p_conformity_status)
    AND (p_certification IS NULL OR p_certification = ANY(par.certifications))
    AND (p_village IS NULL OR par.village = p_village)
    AND (p_region IS NULL OR par.region = p_region)
    AND (p_source IS NULL OR par.source = p_source)
    AND (p_import_file_id IS NULL OR par.import_file_id = p_import_file_id)
    AND (p_search IS NULL OR par.code ILIKE '%' || p_search || '%' OR pl.name ILIKE '%' || p_search || '%' OR pl.code ILIKE '%' || p_search || '%')
    AND (
      p_bbox_min_lng IS NULL OR p_bbox_min_lat IS NULL OR p_bbox_max_lng IS NULL OR p_bbox_max_lat IS NULL
      OR ST_Intersects(par.geometry, ST_MakeEnvelope(p_bbox_min_lng, p_bbox_min_lat, p_bbox_max_lng, p_bbox_max_lat, 4326))
    );

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
    prof.full_name AS created_by_name,
    par.created_at,
    par.updated_at,
    pl.name AS planteur_name,
    pl.code AS planteur_code,
    pl.cooperative_id AS planteur_cooperative_id,
    v_total AS total_count
  FROM public.parcelles par
  LEFT JOIN public.planteurs pl ON pl.id = par.planteur_id
  LEFT JOIN public.profiles prof ON prof.id = par.created_by
  WHERE (
      v_user_role = 'admin'
      OR (pl.cooperative_id IS NOT NULL AND pl.cooperative_id = v_user_cooperative_id)
      OR (pl.cooperative_id IS NULL AND pl.created_by = v_user_id)
      OR (par.created_by = v_user_id)
    )
    AND par.is_active = p_is_active
    AND (p_planteur_id IS NULL OR par.planteur_id = p_planteur_id)
    AND (p_conformity_status IS NULL OR par.conformity_status = p_conformity_status)
    AND (p_certification IS NULL OR p_certification = ANY(par.certifications))
    AND (p_village IS NULL OR par.village = p_village)
    AND (p_region IS NULL OR par.region = p_region)
    AND (p_source IS NULL OR par.source = p_source)
    AND (p_import_file_id IS NULL OR par.import_file_id = p_import_file_id)
    AND (p_search IS NULL OR par.code ILIKE '%' || p_search || '%' OR pl.name ILIKE '%' || p_search || '%' OR pl.code ILIKE '%' || p_search || '%')
    AND (
      p_bbox_min_lng IS NULL OR p_bbox_min_lat IS NULL OR p_bbox_max_lng IS NULL OR p_bbox_max_lat IS NULL
      OR ST_Intersects(par.geometry, ST_MakeEnvelope(p_bbox_min_lng, p_bbox_min_lat, p_bbox_max_lng, p_bbox_max_lat, 4326))
    )
  ORDER BY par.created_at DESC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_parcelles TO authenticated;

-- ============================================================================
-- NOTES
-- ============================================================================
-- Les admins voient maintenant TOUTES les parcelles, y compris celles dont
-- le planteur n'a pas de coopérative assignée.
-- Les managers/agents ne voient que les parcelles de leur coopérative.
-- ============================================================================
