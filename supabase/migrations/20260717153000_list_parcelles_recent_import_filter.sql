-- ============================================================================
-- Migration: Filter list_parcelles by recent imports (24h / 48h)
-- Description: Adds p_recent_import_hours to show only parcelles from
--              imports applied/uploaded within the selected window.
-- Date: 2026-07-17
-- ============================================================================

DROP FUNCTION IF EXISTS public.list_parcelles(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN, INTEGER, INTEGER, BOOLEAN, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.list_parcelles(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN, INTEGER, INTEGER, BOOLEAN, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.list_parcelles(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN, INTEGER, INTEGER, BOOLEAN, TEXT, TEXT, TEXT, INTEGER);

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
  p_simplify BOOLEAN DEFAULT FALSE,
  p_sort_by TEXT DEFAULT 'created_at',
  p_sort_order TEXT DEFAULT 'desc',
  p_health_status TEXT DEFAULT NULL,
  p_recent_import_hours INTEGER DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  planteur_id UUID,
  code TEXT,
  label TEXT,
  village TEXT,
  region TEXT,
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
  v_user_id UUID;
  v_total BIGINT;
  v_sort_clause TEXT;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_recent_import_hours IS NOT NULL AND p_recent_import_hours NOT IN (24, 48) THEN
    RAISE EXCEPTION 'p_recent_import_hours must be 24 or 48';
  END IF;

  v_offset := (p_page - 1) * p_page_size;

  IF p_sort_by = 'planteur' THEN
    IF p_sort_order = 'asc' THEN
      v_sort_clause := 'pl.name ASC NULLS LAST, par.created_at DESC';
    ELSE
      v_sort_clause := 'pl.name DESC NULLS LAST, par.created_at DESC';
    END IF;
  ELSIF p_sort_by = 'village' THEN
    IF p_sort_order = 'asc' THEN
      v_sort_clause := 'par.village ASC NULLS LAST, par.created_at DESC';
    ELSE
      v_sort_clause := 'par.village DESC NULLS LAST, par.created_at DESC';
    END IF;
  ELSIF p_sort_by = 'surface_hectares' THEN
    IF p_sort_order = 'asc' THEN
      v_sort_clause := 'par.surface_hectares ASC, par.created_at DESC';
    ELSE
      v_sort_clause := 'par.surface_hectares DESC, par.created_at DESC';
    END IF;
  ELSIF p_sort_by = 'conformity_status' THEN
    IF p_sort_order = 'asc' THEN
      v_sort_clause := 'par.conformity_status ASC, par.created_at DESC';
    ELSE
      v_sort_clause := 'par.conformity_status DESC, par.created_at DESC';
    END IF;
  ELSIF p_sort_by = 'code' THEN
    IF p_sort_order = 'asc' THEN
      v_sort_clause := 'par.code ASC NULLS LAST, par.created_at DESC';
    ELSE
      v_sort_clause := 'par.code DESC NULLS LAST, par.created_at DESC';
    END IF;
  ELSE
    IF p_sort_order = 'asc' THEN
      v_sort_clause := 'par.created_at ASC';
    ELSE
      v_sort_clause := 'par.created_at DESC';
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.parcelles par
  LEFT JOIN public.planteurs pl ON pl.id = par.planteur_id
  LEFT JOIN public.parcel_import_files pif ON pif.id = par.import_file_id
  LEFT JOIN LATERAL (
    SELECT health_status
    FROM public.ndvi_results
    WHERE ndvi_results.parcelle_id = par.id
    ORDER BY calculation_date DESC
    LIMIT 1
  ) latest_ndvi ON true
  WHERE par.is_active = p_is_active
    AND (p_planteur_id IS NULL OR par.planteur_id = p_planteur_id)
    AND (p_conformity_status IS NULL OR par.conformity_status = p_conformity_status)
    AND (p_certification IS NULL OR p_certification = ANY(par.certifications))
    AND (p_village IS NULL OR par.village = p_village)
    AND (p_region IS NULL OR par.region = p_region)
    AND (p_source IS NULL OR par.source = p_source)
    AND (p_import_file_id IS NULL OR par.import_file_id = p_import_file_id)
    AND (p_search IS NULL OR par.code ILIKE '%' || p_search || '%' OR pl.name ILIKE '%' || p_search || '%' OR pl.code ILIKE '%' || p_search || '%')
    AND (p_health_status IS NULL OR latest_ndvi.health_status = p_health_status)
    AND (
      p_recent_import_hours IS NULL
      OR (
        par.import_file_id IS NOT NULL
        AND COALESCE(pif.applied_at, pif.created_at, par.created_at)
          >= NOW() - make_interval(hours => p_recent_import_hours)
      )
    )
    AND (
      p_bbox_min_lng IS NULL OR p_bbox_min_lat IS NULL OR p_bbox_max_lng IS NULL OR p_bbox_max_lat IS NULL
      OR ST_Intersects(par.geometry, ST_MakeEnvelope(p_bbox_min_lng, p_bbox_min_lat, p_bbox_max_lng, p_bbox_max_lat, 4326))
    );

  RETURN QUERY EXECUTE format('
    SELECT
      par.id,
      par.planteur_id,
      par.code,
      par.label,
      par.village,
      par.region,
      CASE
        WHEN $1 THEN ST_AsGeoJSON(ST_SimplifyPreserveTopology(par.geometry, 0.001))::JSONB
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
      $2::BIGINT AS total_count
    FROM public.parcelles par
    LEFT JOIN public.planteurs pl ON pl.id = par.planteur_id
    LEFT JOIN public.profiles prof ON prof.id = par.created_by
    LEFT JOIN public.parcel_import_files pif ON pif.id = par.import_file_id
    LEFT JOIN LATERAL (
      SELECT health_status
      FROM public.ndvi_results
      WHERE ndvi_results.parcelle_id = par.id
      ORDER BY calculation_date DESC
      LIMIT 1
    ) latest_ndvi ON true
    WHERE par.is_active = $3
      AND ($4::UUID IS NULL OR par.planteur_id = $4)
      AND ($5::TEXT IS NULL OR par.conformity_status = $5)
      AND ($6::TEXT IS NULL OR $6 = ANY(par.certifications))
      AND ($7::TEXT IS NULL OR par.village = $7)
      AND ($8::TEXT IS NULL OR par.region = $8)
      AND ($9::TEXT IS NULL OR par.source = $9)
      AND ($10::UUID IS NULL OR par.import_file_id = $10)
      AND ($11::TEXT IS NULL OR par.code ILIKE ''%%'' || $11 || ''%%'' OR pl.name ILIKE ''%%'' || $11 || ''%%'' OR pl.code ILIKE ''%%'' || $11 || ''%%'')
      AND ($12::TEXT IS NULL OR latest_ndvi.health_status = $12)
      AND (
        $13::INTEGER IS NULL
        OR (
          par.import_file_id IS NOT NULL
          AND COALESCE(pif.applied_at, pif.created_at, par.created_at)
            >= NOW() - make_interval(hours => $13)
        )
      )
      AND (
        $14::DOUBLE PRECISION IS NULL OR $15::DOUBLE PRECISION IS NULL OR $16::DOUBLE PRECISION IS NULL OR $17::DOUBLE PRECISION IS NULL
        OR ST_Intersects(par.geometry, ST_MakeEnvelope($14, $15, $16, $17, 4326))
      )
    ORDER BY %s
    LIMIT $18
    OFFSET $19
  ', v_sort_clause)
  USING
    p_simplify,
    v_total,
    p_is_active,
    p_planteur_id,
    p_conformity_status,
    p_certification,
    p_village,
    p_region,
    p_source,
    p_import_file_id,
    p_search,
    p_health_status,
    p_recent_import_hours,
    p_bbox_min_lng,
    p_bbox_min_lat,
    p_bbox_max_lng,
    p_bbox_max_lat,
    p_page_size,
    v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_parcelles TO authenticated;

COMMENT ON FUNCTION public.list_parcelles IS
'Lists parcelles with sorting, health_status filtering, and optional recent-import window (24h/48h).';
