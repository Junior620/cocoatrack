-- ============================================================================
-- SECURITY WARNINGS FIXES - Supabase Linter Warnings
-- Date: 2026-03-28
-- Description: Corrections des warnings de sécurité (niveau WARN)
-- ============================================================================

-- ============================================================================
-- SECTION 1: Fix Function Search Path (18 fonctions)
-- ============================================================================

-- 1.1: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 1.2: update_parcelle_updated_at
CREATE OR REPLACE FUNCTION public.update_parcelle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 1.3: update_planteur_import_files_updated_at
CREATE OR REPLACE FUNCTION public.update_planteur_import_files_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 1.4: normalize_planteur_name
CREATE OR REPLACE FUNCTION public.normalize_planteur_name(name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF name IS NULL OR TRIM(name) = '' THEN
    RETURN '';
  END IF;
  
  RETURN LOWER(TRIM(REGEXP_REPLACE(unaccent(name), '\s+', ' ', 'g')));
END;
$function$;

-- 1.5: update_planteur_name_norm
CREATE OR REPLACE FUNCTION public.update_planteur_name_norm()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  NEW.name_norm := public.normalize_planteur_name(NEW.name);
  RETURN NEW;
END;
$function$;

-- 1.6: calculate_parcelle_fields
CREATE OR REPLACE FUNCTION public.calculate_parcelle_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  NEW.centroid := ST_PointOnSurface(NEW.geometry);
  NEW.surface_hectares := ROUND((ST_Area(NEW.geometry::geography) / 10000)::NUMERIC, 4);
  
  IF NEW.surface_hectares < 0.0001 THEN
    RAISE EXCEPTION 'INVALID_GEOMETRY: Polygon has zero or near-zero area (degenerate polygon)';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 1.7: calc_parcelle_geometry
CREATE OR REPLACE FUNCTION public.calc_parcelle_geometry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  NEW.geometry := ST_SetSRID(NEW.geometry, 4326);
  
  IF NOT ST_IsValid(NEW.geometry) THEN
    NEW.geometry := ST_MakeValid(NEW.geometry);
  END IF;
  
  NEW.geometry := ST_CollectionExtract(NEW.geometry, 3);
  NEW.geometry := ST_Multi(NEW.geometry);
  
  IF ST_IsEmpty(NEW.geometry) THEN
    RAISE EXCEPTION 'INVALID_GEOMETRY: geometry is empty or contains no polygons';
  END IF;
  
  IF ST_NPoints(NEW.geometry) < 4 THEN
    RAISE EXCEPTION 'INVALID_GEOMETRY: geometry has too few points (minimum 4 required)';
  END IF;
  
  IF NOT ST_IsValid(NEW.geometry) OR GeometryType(NEW.geometry) != 'MULTIPOLYGON' THEN
    RAISE EXCEPTION 'INVALID_GEOMETRY: geometry must be a valid MultiPolygon';
  END IF;
  
  NEW.centroid := ST_PointOnSurface(NEW.geometry);
  NEW.surface_hectares := ROUND((ST_Area(NEW.geometry::geography) / 10000)::NUMERIC, 4);
  
  IF NEW.surface_hectares <= 0 THEN
    RAISE EXCEPTION 'INVALID_GEOMETRY: geometry has zero or negative surface area';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 1.8: log_audit_entry
CREATE OR REPLACE FUNCTION public.log_audit_entry(
  p_actor_id uuid,
  p_table_name text,
  p_row_id text,
  p_action text,
  p_old_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL,
  p_ip_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO public.audit_logs (actor_id, table_name, row_id, action, old_data, new_data, ip_address)
  VALUES (p_actor_id, p_table_name, p_row_id, p_action, p_old_data, p_new_data, p_ip_address)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$function$;

-- 1.9: log_parcelle_audit
CREATE OR REPLACE FUNCTION public.log_parcelle_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_action TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
  v_actor_id UUID;
BEGIN
  v_actor_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_old_data := NULL;
    v_new_data := jsonb_build_object(
      'conformity_status', NEW.conformity_status,
      'certifications', NEW.certifications,
      'risk_flags', NEW.risk_flags,
      'source', NEW.source,
      'import_file_id', NEW.import_file_id,
      'is_active', NEW.is_active
    );
    
    IF v_actor_id IS NULL THEN
      v_actor_id := NEW.created_by;
    END IF;
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := jsonb_build_object(
      'conformity_status', OLD.conformity_status,
      'certifications', OLD.certifications,
      'risk_flags', OLD.risk_flags,
      'source', OLD.source,
      'import_file_id', OLD.import_file_id,
      'is_active', OLD.is_active
    );
    
    v_new_data := jsonb_build_object(
      'conformity_status', NEW.conformity_status,
      'certifications', NEW.certifications,
      'risk_flags', NEW.risk_flags,
      'source', NEW.source,
      'import_file_id', NEW.import_file_id,
      'is_active', NEW.is_active
    );
    
    IF OLD.is_active = true AND NEW.is_active = false THEN
      v_action := 'archive';
    ELSIF OLD.conformity_status IS DISTINCT FROM NEW.conformity_status THEN
      v_action := 'status_change';
    ELSE
      v_action := 'update';
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old_data := jsonb_build_object(
      'conformity_status', OLD.conformity_status,
      'certifications', OLD.certifications,
      'risk_flags', OLD.risk_flags,
      'source', OLD.source,
      'import_file_id', OLD.import_file_id,
      'is_active', OLD.is_active
    );
    v_new_data := NULL;
  END IF;
  
  INSERT INTO public.audit_logs (
    actor_id,
    actor_type,
    table_name,
    row_id,
    action,
    old_data,
    new_data
  ) VALUES (
    v_actor_id,
    'user',
    'parcelles',
    COALESCE(NEW.id, OLD.id)::TEXT,
    v_action,
    v_old_data,
    v_new_data
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

-- 1.10: log_import_file_audit
CREATE OR REPLACE FUNCTION public.log_import_file_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_action TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
  v_actor_id UUID;
BEGIN
  IF TG_OP != 'UPDATE' THEN
    RETURN NEW;
  END IF;
  
  IF OLD.import_status IS NOT DISTINCT FROM NEW.import_status THEN
    RETURN NEW;
  END IF;
  
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    v_actor_id := COALESCE(NEW.applied_by, NEW.created_by);
  END IF;
  
  IF NEW.import_status IN ('parsed', 'failed') THEN
    v_action := 'import_parse';
  ELSIF NEW.import_status = 'applied' THEN
    v_action := 'import_apply';
  ELSE
    RETURN NEW;
  END IF;
  
  v_old_data := jsonb_build_object(
    'import_status', OLD.import_status,
    'nb_features', OLD.nb_features,
    'nb_applied', OLD.nb_applied,
    'nb_skipped_duplicates', OLD.nb_skipped_duplicates,
    'failed_reason', OLD.failed_reason
  );
  
  v_new_data := jsonb_build_object(
    'import_status', NEW.import_status,
    'nb_features', NEW.nb_features,
    'nb_applied', NEW.nb_applied,
    'nb_skipped_duplicates', NEW.nb_skipped_duplicates,
    'failed_reason', NEW.failed_reason,
    'parse_report', NEW.parse_report,
    'applied_at', NEW.applied_at
  );
  
  INSERT INTO public.audit_logs (
    actor_id,
    actor_type,
    table_name,
    row_id,
    action,
    old_data,
    new_data
  ) VALUES (
    v_actor_id,
    'user',
    'parcel_import_files',
    NEW.id::TEXT,
    v_action,
    v_old_data,
    v_new_data
  );
  
  RETURN NEW;
END;
$function$;

-- 1.11: get_audit_logs_with_actor
CREATE OR REPLACE FUNCTION public.get_audit_logs_with_actor(
  p_table_name text DEFAULT NULL,
  p_row_id text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_start_date timestamp with time zone DEFAULT NULL,
  p_end_date timestamp with time zone DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  actor_id uuid,
  actor_type text,
  actor_name text,
  actor_email text,
  table_name text,
  row_id text,
  action text,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.actor_id,
    al.actor_type,
    COALESCE(p.full_name, 'Système') as actor_name,
    p.email as actor_email,
    al.table_name,
    al.row_id,
    al.action,
    al.old_data,
    al.new_data,
    al.ip_address,
    al.created_at
  FROM public.audit_logs al
  LEFT JOIN public.profiles p ON al.actor_id = p.id
  WHERE 
    (p_table_name IS NULL OR al.table_name = p_table_name)
    AND (p_row_id IS NULL OR al.row_id = p_row_id)
    AND (p_actor_id IS NULL OR al.actor_id = p_actor_id)
    AND (p_action IS NULL OR al.action = p_action)
    AND (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at <= p_end_date)
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;

-- 1.12: count_audit_logs
CREATE OR REPLACE FUNCTION public.count_audit_logs(
  p_table_name text DEFAULT NULL,
  p_row_id text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_start_date timestamp with time zone DEFAULT NULL,
  p_end_date timestamp with time zone DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  total INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO total
  FROM public.audit_logs al
  WHERE 
    (p_table_name IS NULL OR al.table_name = p_table_name)
    AND (p_row_id IS NULL OR al.row_id = p_row_id)
    AND (p_actor_id IS NULL OR al.actor_id = p_actor_id)
    AND (p_action IS NULL OR al.action = p_action)
    AND (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at <= p_end_date);
  
  RETURN total;
END;
$function$;

-- 1.13: update_dashboard_aggregates
CREATE OR REPLACE FUNCTION public.update_dashboard_aggregates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_old_day DATE;
  v_new_day DATE;
  v_old_coop_id UUID;
  v_new_coop_id UUID;
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    v_old_day := OLD.delivered_at::date;
    v_old_coop_id := OLD.cooperative_id;
  END IF;
  
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_new_day := NEW.delivered_at::date;
    v_new_coop_id := NEW.cooperative_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
    VALUES (v_old_coop_id, v_old_day, -1, -OLD.weight_kg, -OLD.total_amount)
    ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
      total_deliveries = dashboard_aggregates.total_deliveries - 1,
      total_weight_kg = dashboard_aggregates.total_weight_kg - OLD.weight_kg,
      total_amount_xaf = dashboard_aggregates.total_amount_xaf - OLD.total_amount,
      updated_at = NOW();
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
    VALUES (v_new_coop_id, v_new_day, 1, NEW.weight_kg, NEW.total_amount)
    ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
      total_deliveries = dashboard_aggregates.total_deliveries + 1,
      total_weight_kg = dashboard_aggregates.total_weight_kg + NEW.weight_kg,
      total_amount_xaf = dashboard_aggregates.total_amount_xaf + NEW.total_amount,
      updated_at = NOW();
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF v_old_day != v_new_day OR v_old_coop_id != v_new_coop_id THEN
      INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
      VALUES (v_old_coop_id, v_old_day, -1, -OLD.weight_kg, -OLD.total_amount)
      ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
        total_deliveries = dashboard_aggregates.total_deliveries - 1,
        total_weight_kg = dashboard_aggregates.total_weight_kg - OLD.weight_kg,
        total_amount_xaf = dashboard_aggregates.total_amount_xaf - OLD.total_amount,
        updated_at = NOW();
      
      INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
      VALUES (v_new_coop_id, v_new_day, 1, NEW.weight_kg, NEW.total_amount)
      ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
        total_deliveries = dashboard_aggregates.total_deliveries + 1,
        total_weight_kg = dashboard_aggregates.total_weight_kg + NEW.weight_kg,
        total_amount_xaf = dashboard_aggregates.total_amount_xaf + NEW.total_amount,
        updated_at = NOW();
    ELSE
      UPDATE public.dashboard_aggregates SET
        total_weight_kg = total_weight_kg + (NEW.weight_kg - OLD.weight_kg),
        total_amount_xaf = total_amount_xaf + (NEW.total_amount - OLD.total_amount),
        updated_at = NOW()
      WHERE cooperative_id = v_new_coop_id AND period_date = v_new_day;
      
      IF NOT FOUND THEN
        INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
        VALUES (v_new_coop_id, v_new_day, 1, NEW.weight_kg, NEW.total_amount);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$function$;

-- 1.14: backfill_dashboard_aggregates
CREATE OR REPLACE FUNCTION public.backfill_dashboard_aggregates()
RETURNS TABLE(
  cooperative_id uuid,
  period_date date,
  total_deliveries bigint,
  total_weight_kg numeric,
  total_amount_xaf bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  DELETE FROM public.dashboard_aggregates;
  
  INSERT INTO public.dashboard_aggregates (cooperative_id, period_date, total_deliveries, total_weight_kg, total_amount_xaf)
  SELECT 
    d.cooperative_id,
    d.delivered_at::date AS period_date,
    COUNT(*)::integer AS total_deliveries,
    COALESCE(SUM(d.weight_kg), 0) AS total_weight_kg,
    COALESCE(SUM(d.total_amount), 0) AS total_amount_xaf
  FROM public.deliveries d
  GROUP BY d.cooperative_id, d.delivered_at::date
  ON CONFLICT (cooperative_id, period_date) DO UPDATE SET
    total_deliveries = EXCLUDED.total_deliveries,
    total_weight_kg = EXCLUDED.total_weight_kg,
    total_amount_xaf = EXCLUDED.total_amount_xaf,
    updated_at = NOW();
  
  RETURN QUERY
  SELECT da.cooperative_id, da.period_date, da.total_deliveries::bigint, da.total_weight_kg, da.total_amount_xaf
  FROM public.dashboard_aggregates da
  ORDER BY da.cooperative_id, da.period_date DESC;
END;
$function$;

-- 1.15: generate_shipment_code
CREATE OR REPLACE FUNCTION public.generate_shipment_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  current_month TEXT;
  current_counter INTEGER;
  new_code TEXT;
BEGIN
  current_month := TO_CHAR(NOW(), 'YYYY-MM');
  
  INSERT INTO public.shipment_code_counters (month, counter)
  VALUES (current_month, 1)
  ON CONFLICT (month) DO UPDATE SET counter = shipment_code_counters.counter + 1
  RETURNING counter INTO current_counter;
  
  new_code := 'EXP-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(current_counter::TEXT, 4, '0');
  
  RETURN new_code;
END;
$function$;

-- 1.16: check_import_file_cooperative
CREATE OR REPLACE FUNCTION public.check_import_file_cooperative()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.planteur_id IS NOT NULL AND NEW.cooperative_id IS NOT NULL THEN
    PERFORM 1 FROM public.planteurs 
    WHERE id = NEW.planteur_id 
    AND cooperative = (SELECT name FROM public.cooperatives WHERE id = NEW.cooperative_id);
    
    IF NOT FOUND THEN
      PERFORM 1 FROM public.planteurs WHERE id = NEW.planteur_id AND cooperative IS NULL;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'planteur_id does not belong to cooperative_id';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 1.17: get_parcelle_counts_by_planteur
CREATE OR REPLACE FUNCTION public.get_parcelle_counts_by_planteur(p_planteur_ids uuid[])
RETURNS TABLE(planteur_id uuid, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS planteur_id,
    COUNT(parc.id) AS count
  FROM unnest(p_planteur_ids) AS p(id)
  LEFT JOIN parcelles parc ON parc.planteur_id = p.id AND parc.is_active = true
  GROUP BY p.id;
END;
$function$;

-- 1.18: cleanup_old_planteur_imports
CREATE OR REPLACE FUNCTION public.cleanup_old_planteur_imports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  old_file RECORD;
  deleted_count INTEGER := 0;
BEGIN
  -- Find files older than 30 days
  FOR old_file IN
    SELECT name, bucket_id
    FROM storage.objects
    WHERE bucket_id = 'planteur-imports'
      AND created_at < NOW() - INTERVAL '30 days'
  LOOP
    -- Delete the file from storage
    DELETE FROM storage.objects
    WHERE bucket_id = old_file.bucket_id
      AND name = old_file.name;
    
    deleted_count := deleted_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Cleaned up % old planteur import files', deleted_count;
END;
$function$;

-- ============================================================================
-- SECTION 2: Fix RLS Policies Always True
-- ============================================================================

-- 2.1: clients - Restreindre aux managers et admins
DROP POLICY IF EXISTS clients_insert ON public.clients;
CREATE POLICY clients_insert ON public.clients
FOR INSERT TO authenticated
WITH CHECK (public.is_manager_or_above());

DROP POLICY IF EXISTS clients_update ON public.clients;
CREATE POLICY clients_update ON public.clients
FOR UPDATE TO authenticated
USING (public.is_manager_or_above())
WITH CHECK (public.is_manager_or_above());

DROP POLICY IF EXISTS clients_delete ON public.clients;
CREATE POLICY clients_delete ON public.clients
FOR DELETE TO authenticated
USING (public.is_admin());

-- 2.2: client_contracts - Restreindre aux managers et admins
DROP POLICY IF EXISTS contracts_insert ON public.client_contracts;
CREATE POLICY contracts_insert ON public.client_contracts
FOR INSERT TO authenticated
WITH CHECK (public.is_manager_or_above());

DROP POLICY IF EXISTS contracts_update ON public.client_contracts;
CREATE POLICY contracts_update ON public.client_contracts
FOR UPDATE TO authenticated
USING (public.is_manager_or_above())
WITH CHECK (public.is_manager_or_above());

DROP POLICY IF EXISTS contracts_delete ON public.client_contracts;
CREATE POLICY contracts_delete ON public.client_contracts
FOR DELETE TO authenticated
USING (public.is_admin());

-- 2.3: client_shipments - Restreindre aux managers et admins
DROP POLICY IF EXISTS shipments_insert ON public.client_shipments;
CREATE POLICY shipments_insert ON public.client_shipments
FOR INSERT TO authenticated
WITH CHECK (public.is_manager_or_above());

DROP POLICY IF EXISTS shipments_update ON public.client_shipments;
CREATE POLICY shipments_update ON public.client_shipments
FOR UPDATE TO authenticated
USING (public.is_manager_or_above())
WITH CHECK (public.is_manager_or_above());

DROP POLICY IF EXISTS shipments_delete ON public.client_shipments;
CREATE POLICY shipments_delete ON public.client_shipments
FOR DELETE TO authenticated
USING (public.is_admin());

-- 2.4: audit_logs - Garder tel quel (intentionnel)
-- Les logs d'audit doivent pouvoir être créés par tous les utilisateurs authentifiés
-- via les triggers. Pas de modification nécessaire.

-- 2.5: sync_processed - Garder tel quel (intentionnel)
-- Table technique de synchronisation, l'accès ouvert est voulu.
-- Pas de modification nécessaire.

-- ============================================================================
-- SECTION 3: Vérifications
-- ============================================================================

-- Vérifier les fonctions avec search_path
SELECT 
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.proconfig as config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'update_updated_at_column',
    'update_parcelle_updated_at',
    'update_planteur_import_files_updated_at',
    'normalize_planteur_name',
    'update_planteur_name_norm',
    'calculate_parcelle_fields',
    'calc_parcelle_geometry',
    'log_audit_entry',
    'log_parcelle_audit',
    'log_import_file_audit',
    'get_audit_logs_with_actor',
    'count_audit_logs',
    'update_dashboard_aggregates',
    'backfill_dashboard_aggregates',
    'generate_shipment_code',
    'check_import_file_cooperative',
    'get_parcelle_counts_by_planteur',
    'cleanup_old_planteur_imports'
  )
ORDER BY p.proname;

-- Vérifier les policies RLS mises à jour
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('clients', 'client_contracts', 'client_shipments')
ORDER BY tablename, policyname;

-- ============================================================================
-- NOTES IMPORTANTES
-- ============================================================================

-- 1. Fonctions avec search_path:
--    Pour les fonctions 1.4 à 1.18, vous devez récupérer leur définition
--    actuelle et les recréer avec SET search_path = public, pg_temp
--
--    Commande pour récupérer une définition:
--    SELECT pg_get_functiondef('public.nom_fonction'::regproc);
--
-- 2. Extensions in Public:
--    Les warnings pour pg_trgm, postgis, unaccent peuvent être ignorés.
--    Déplacer PostGIS est complexe et risqué.
--
-- 3. Leaked Password Protection:
--    Doit être activé dans Supabase Dashboard:
--    Authentication → Policies → Enable "Leaked Password Protection"
--
-- 4. Test après application:
--    Testez avec différents rôles pour vérifier que les permissions
--    fonctionnent correctement, surtout pour clients/contracts/shipments.

-- ============================================================================
-- ROLLBACK (si nécessaire)
-- ============================================================================

-- Pour revenir aux policies permissives:
-- DROP POLICY IF EXISTS clients_insert ON public.clients;
-- CREATE POLICY clients_insert ON public.clients
-- FOR INSERT TO authenticated WITH CHECK (true);
-- (répéter pour toutes les policies modifiées)
