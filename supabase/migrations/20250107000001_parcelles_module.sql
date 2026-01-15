-- ============================================================================
-- CocoaTrack V2 - Parcelles Module Migration
-- PostGIS extension + Tables for agricultural plots management
-- ============================================================================

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- Table: parcel_import_files (must be created first for FK reference)
-- Tracks all import files and their processing status
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.parcel_import_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  planteur_id UUID REFERENCES public.planteurs(id) ON DELETE SET NULL,
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id),
  filename TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('shapefile_zip', 'kml', 'kmz', 'geojson')),
  file_sha256 TEXT NOT NULL,
  import_status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (import_status IN ('uploaded', 'parsed', 'failed', 'applied')),
  parse_report JSONB DEFAULT '{}',
  failed_reason TEXT,
  nb_features INT DEFAULT 0,
  nb_applied INT DEFAULT 0,
  nb_skipped_duplicates INT DEFAULT 0,
  applied_by UUID REFERENCES public.profiles(id),
  applied_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for parcel_import_files
CREATE INDEX IF NOT EXISTS idx_parcel_import_files_sha256 ON public.parcel_import_files(file_sha256);
CREATE INDEX IF NOT EXISTS idx_parcel_import_files_planteur ON public.parcel_import_files(planteur_id);
CREATE INDEX IF NOT EXISTS idx_parcel_import_files_cooperative ON public.parcel_import_files(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_parcel_import_files_status ON public.parcel_import_files(import_status);

-- UNIQUE INDEX: Prevent re-import of same file per cooperative
CREATE UNIQUE INDEX IF NOT EXISTS uniq_import_file_sha256 
  ON public.parcel_import_files (cooperative_id, file_sha256);

-- ============================================================================
-- Trigger: Validate planteur_id belongs to cooperative_id
-- ============================================================================
CREATE OR REPLACE FUNCTION check_import_file_cooperative()
RETURNS TRIGGER AS $$
BEGIN
  -- If planteur_id is provided, verify it belongs to the cooperative
  IF NEW.planteur_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.planteurs 
      WHERE id = NEW.planteur_id AND cooperative_id = NEW.cooperative_id
    ) THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: planteur_id does not belong to cooperative_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_import_file_cooperative ON public.parcel_import_files;
CREATE TRIGGER trg_import_file_cooperative
  BEFORE INSERT OR UPDATE ON public.parcel_import_files
  FOR EACH ROW EXECUTE FUNCTION check_import_file_cooperative();

-- ============================================================================
-- Table: parcelles
-- Agricultural plots with PostGIS geometry
-- NOTE: NO cooperative_id column - inherited via planteur.cooperative_id
-- ============================================================================
-- IMPORTANT: Enum values must match TypeScript constants in v2/types/parcelles.ts:
-- - CONFORMITY_STATUS_VALUES: conforme, non_conforme, en_cours, informations_manquantes
-- - PARCELLE_SOURCE_VALUES: manual, shapefile, kml, geojson
-- - CERTIFICATIONS_WHITELIST: rainforest_alliance, utz, fairtrade, bio, organic, other
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.parcelles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  planteur_id UUID NOT NULL REFERENCES public.planteurs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT,
  village TEXT,
  geometry geometry(MultiPolygon, 4326) NOT NULL,
  centroid geometry(Point, 4326) NOT NULL,
  surface_hectares NUMERIC(12,4) NOT NULL,
  certifications TEXT[] DEFAULT '{}',
  conformity_status TEXT NOT NULL DEFAULT 'informations_manquantes'
    CHECK (conformity_status IN ('conforme', 'non_conforme', 'en_cours', 'informations_manquantes')),
  risk_flags JSONB DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'shapefile', 'kml', 'geojson')),
  import_file_id UUID REFERENCES public.parcel_import_files(id) ON DELETE SET NULL,
  feature_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Code unique per planteur (not per cooperative)
  CONSTRAINT parcelles_code_unique UNIQUE (planteur_id, code),
  -- Ensure geometry SRID is 4326
  CONSTRAINT parcelles_geometry_srid CHECK (ST_SRID(geometry) = 4326),
  -- Certifications whitelist
  CONSTRAINT parcelles_certifications_valid CHECK (
    certifications <@ ARRAY['rainforest_alliance', 'utz', 'fairtrade', 'bio', 'organic', 'other']::TEXT[]
  )
);

-- GIST indexes for spatial queries
CREATE INDEX IF NOT EXISTS idx_parcelles_geometry ON public.parcelles USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_parcelles_centroid ON public.parcelles USING GIST(centroid);

-- BTREE indexes for filtering
CREATE INDEX IF NOT EXISTS idx_parcelles_planteur_id ON public.parcelles(planteur_id);
CREATE INDEX IF NOT EXISTS idx_parcelles_conformity_status ON public.parcelles(conformity_status);
CREATE INDEX IF NOT EXISTS idx_parcelles_is_active ON public.parcelles(is_active);
CREATE INDEX IF NOT EXISTS idx_parcelles_feature_hash ON public.parcelles(feature_hash);
CREATE INDEX IF NOT EXISTS idx_parcelles_source ON public.parcelles(source);
CREATE INDEX IF NOT EXISTS idx_parcelles_import_file ON public.parcelles(import_file_id);

-- UNIQUE partial index: Prevent duplicate geometries per planteur (concurrent-safe)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_parcelle_hash 
  ON public.parcelles (planteur_id, feature_hash) 
  WHERE is_active = true AND feature_hash IS NOT NULL;


-- ============================================================================
-- Trigger: ROBUST geometry validation + calculations
-- Handles ST_MakeValid edge cases (GeometryCollection, empty, degenerate)
-- ============================================================================
CREATE OR REPLACE FUNCTION calc_parcelle_geometry()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure SRID is set to 4326 (WGS84)
  NEW.geometry := ST_SetSRID(NEW.geometry, 4326);
  
  -- Validate and fix geometry if invalid
  IF NOT ST_IsValid(NEW.geometry) THEN
    NEW.geometry := ST_MakeValid(NEW.geometry);
  END IF;
  
  -- IMPORTANT: ST_MakeValid can return GeometryCollection
  -- Extract only polygons (type 3 = Polygon)
  NEW.geometry := ST_CollectionExtract(NEW.geometry, 3);
  
  -- Force MultiPolygon (even if single polygon)
  NEW.geometry := ST_Multi(NEW.geometry);
  
  -- Check for empty geometry (no polygons extracted)
  IF ST_IsEmpty(NEW.geometry) THEN
    RAISE EXCEPTION 'INVALID_GEOMETRY: geometry is empty or contains no polygons';
  END IF;
  
  -- Check for degenerate geometry (too few points)
  IF ST_NPoints(NEW.geometry) < 4 THEN
    RAISE EXCEPTION 'INVALID_GEOMETRY: geometry has too few points (minimum 4 required)';
  END IF;
  
  -- Final validation
  IF NOT ST_IsValid(NEW.geometry) OR GeometryType(NEW.geometry) != 'MULTIPOLYGON' THEN
    RAISE EXCEPTION 'INVALID_GEOMETRY: geometry must be a valid MultiPolygon';
  END IF;
  
  -- Calculate centroid (point guaranteed inside polygon)
  NEW.centroid := ST_PointOnSurface(NEW.geometry);
  
  -- Calculate surface in hectares (geography for accurate area on Earth)
  NEW.surface_hectares := ROUND(ST_Area(NEW.geometry::geography) / 10000, 4);
  
  -- Check for flat/degenerate polygon (zero or near-zero area)
  IF NEW.surface_hectares <= 0 THEN
    RAISE EXCEPTION 'INVALID_GEOMETRY: geometry has zero or negative surface area';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_parcelle_geometry ON public.parcelles;
CREATE TRIGGER trg_parcelle_geometry
  BEFORE INSERT OR UPDATE OF geometry ON public.parcelles
  FOR EACH ROW EXECUTE FUNCTION calc_parcelle_geometry();

-- ============================================================================
-- Trigger: Update updated_at on ANY column change
-- ============================================================================
CREATE OR REPLACE FUNCTION update_parcelle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_parcelle_updated_at ON public.parcelles;
CREATE TRIGGER trg_parcelle_updated_at
  BEFORE UPDATE ON public.parcelles
  FOR EACH ROW EXECUTE FUNCTION update_parcelle_updated_at();

-- ============================================================================
-- RLS Policies: parcelles
-- Access via planteur.cooperative_id = user.cooperative_id
-- NO DELETE policy - soft-delete only via API (is_active=false)
-- ============================================================================
ALTER TABLE public.parcelles ENABLE ROW LEVEL SECURITY;

-- SELECT: User can see parcelles of planteurs in their cooperative
CREATE POLICY "parcelles_select" ON public.parcelles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.planteurs p
    JOIN public.profiles pr ON pr.cooperative_id = p.cooperative_id
    WHERE p.id = parcelles.planteur_id AND pr.id = auth.uid()
  )
);

-- INSERT: User can create parcelles for planteurs in their cooperative
CREATE POLICY "parcelles_insert" ON public.parcelles FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.planteurs p
    JOIN public.profiles pr ON pr.cooperative_id = p.cooperative_id
    WHERE p.id = planteur_id AND pr.id = auth.uid()
  )
);

-- UPDATE: User can update parcelles of planteurs in their cooperative
-- WITH CHECK prevents moving parcelle to another cooperative's planteur
CREATE POLICY "parcelles_update" ON public.parcelles FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.planteurs p
    JOIN public.profiles pr ON pr.cooperative_id = p.cooperative_id
    WHERE p.id = parcelles.planteur_id AND pr.id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.planteurs p
    JOIN public.profiles pr ON pr.cooperative_id = p.cooperative_id
    WHERE p.id = planteur_id AND pr.id = auth.uid()
  )
);

-- NO DELETE POLICY: Soft-delete only via API (is_active=false)
-- Hard delete reserved for DB admin scripts only

-- ============================================================================
-- RLS Policies: parcel_import_files
-- Access via cooperative_id = user.cooperative_id
-- NO DELETE policy - import files are never deleted
-- ============================================================================
ALTER TABLE public.parcel_import_files ENABLE ROW LEVEL SECURITY;

-- SELECT: User can see import files of their cooperative
CREATE POLICY "import_files_select" ON public.parcel_import_files FOR SELECT TO authenticated
USING (
  cooperative_id = (SELECT cooperative_id FROM public.profiles WHERE id = auth.uid())
);

-- INSERT: User can create import files for their cooperative
CREATE POLICY "import_files_insert" ON public.parcel_import_files FOR INSERT TO authenticated
WITH CHECK (
  cooperative_id = (SELECT cooperative_id FROM public.profiles WHERE id = auth.uid())
);

-- UPDATE: User can update import files of their cooperative
CREATE POLICY "import_files_update" ON public.parcel_import_files FOR UPDATE TO authenticated
USING (
  cooperative_id = (SELECT cooperative_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  cooperative_id = (SELECT cooperative_id FROM public.profiles WHERE id = auth.uid())
);

-- NO DELETE POLICY: Import files are never deleted (audit trail)
