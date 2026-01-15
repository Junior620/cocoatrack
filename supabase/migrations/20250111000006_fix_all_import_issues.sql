-- ============================================================================
-- SCRIPT COMPLET: Correction des problèmes d'import de parcelles
-- Exécuter ce script dans Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- ÉTAPE 1: Nettoyer les données de test (respecter l'ordre des FK)
-- ============================================================================
DELETE FROM parcelles WHERE import_file_id IS NOT NULL;
DELETE FROM planteurs WHERE created_via_import_id IS NOT NULL;
DELETE FROM parcel_import_files;

-- ============================================================================
-- ÉTAPE 2: Corriger la fonction calculate_parcelle_fields (erreur ROUND)
-- Le problème: ROUND(double precision, integer) n'existe pas en PostgreSQL
-- Solution: Caster en NUMERIC d'abord
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

COMMENT ON FUNCTION public.calculate_parcelle_fields() IS 
  'Calculates centroid and surface_hectares for parcelles. Fixed ROUND function to use NUMERIC cast.';

-- ============================================================================
-- ÉTAPE 3: Corriger la fonction create_parcelle (support orphan parcelles)
-- Le problème: JOIN échoue quand planteur_id est NULL
-- Solution: Utiliser LEFT JOIN
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_parcelle(UUID, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, JSONB, TEXT, UUID, UUID, TEXT);

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
    centroid,
    surface_hectares,
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
    ST_PointOnSurface(v_geometry),
    0,
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
  LEFT JOIN public.planteurs pl ON pl.id = par.planteur_id
  LEFT JOIN public.profiles pr ON pr.id = par.created_by
  WHERE par.id = v_parcelle_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_parcelle TO authenticated;

COMMENT ON FUNCTION public.create_parcelle IS 
'Creates a new parcelle with geometry conversion from GeoJSON.
Supports orphan parcelles (planteur_id = NULL) via LEFT JOIN.
The geometry is validated and normalized by database triggers.
Returns the created parcelle with all calculated fields.';

-- ============================================================================
-- VÉRIFICATION
-- ============================================================================
SELECT 'Migration terminée avec succès!' AS status;
