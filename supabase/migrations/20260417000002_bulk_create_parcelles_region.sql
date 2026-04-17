-- ============================================================================
-- Migration: Add region field to bulk_create_parcelles
-- Description: Permet de stocker la région lors de l'import de polygones
-- Date: 2026-04-17
-- ============================================================================

CREATE OR REPLACE FUNCTION public.bulk_create_parcelles(
  p_parcelles JSONB,
  p_import_file_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  feature_hash TEXT,
  success BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_created_by UUID;
  v_item JSONB;
  v_parcelle_id UUID;
  v_geometry geometry(MultiPolygon, 4326);
  v_geojson TEXT;
BEGIN
  v_created_by := COALESCE(p_created_by, auth.uid());

  IF v_created_by IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User not authenticated';
  END IF;

  FOR v_item IN SELECT jsonb_array_elements(p_parcelles)
  LOOP
    v_geojson := v_item->>'geometry_geojson';

    BEGIN
      v_geometry := ST_SetSRID(ST_GeomFromGeoJSON(v_geojson), 4326);

      INSERT INTO public.parcelles (
        planteur_id,
        code,
        label,
        village,
        region,
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
        (v_item->>'planteur_id')::UUID,
        v_item->>'code',
        v_item->>'label',
        v_item->>'village',
        v_item->>'region',
        v_geometry,
        ST_PointOnSurface(v_geometry),
        0,
        COALESCE(
          ARRAY(SELECT jsonb_array_elements_text(v_item->'certifications')),
          '{}'::TEXT[]
        ),
        COALESCE(v_item->>'conformity_status', 'informations_manquantes'),
        COALESCE((v_item->'risk_flags')::JSONB, '{}'::JSONB),
        COALESCE(v_item->>'source', 'shapefile'),
        p_import_file_id,
        v_item->>'feature_hash',
        v_created_by
      )
      RETURNING parcelles.id INTO v_parcelle_id;

      id := v_parcelle_id;
      feature_hash := v_item->>'feature_hash';
      success := TRUE;
      error_message := NULL;
      RETURN NEXT;

    EXCEPTION
      WHEN unique_violation THEN
        id := NULL;
        feature_hash := v_item->>'feature_hash';
        success := FALSE;
        error_message := 'duplicate';
        RETURN NEXT;
      WHEN OTHERS THEN
        id := NULL;
        feature_hash := v_item->>'feature_hash';
        success := FALSE;
        error_message := SQLERRM;
        RETURN NEXT;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_create_parcelles TO authenticated;

COMMENT ON FUNCTION public.bulk_create_parcelles IS
'Bulk insert parcelles from a JSONB array in a single DB round-trip.
Each item: { planteur_id, code, label, village, region, geometry_geojson, certifications, conformity_status, risk_flags, source, feature_hash }
Returns rows with (id, feature_hash, success, error_message).
Duplicate violations are silently skipped (success=false, error_message=''duplicate'').';
