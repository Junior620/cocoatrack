-- CocoaTrack V2 - Extend Sync Operation for Planteurs and Chef Planteurs
-- Adds support for syncing planteurs and chef_planteurs tables
-- Requirements: 8.3, 8.6

-- ============================================================================
-- UPDATE SYNC_OPERATION TO SUPPORT MORE TABLES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_operation(
  p_idempotency_key UUID,
  p_table TEXT,
  p_operation TEXT,
  p_record_id UUID,
  p_data JSONB
)
RETURNS JSONB
SET search_path = public, auth
AS $
DECLARE
  v_existing RECORD;
  v_allowed_tables TEXT[] := ARRAY['deliveries', 'planteurs', 'chef_planteurs'];
  v_allowed_ops TEXT[] := ARRAY['CREATE', 'UPDATE', 'DELETE'];
  v_result JSONB;
  v_chef_planteur_coop_id UUID;
BEGIN
  -- ========================================================================
  -- VALIDATION
  -- ========================================================================
  
  -- Validate table whitelist
  IF NOT (p_table = ANY(v_allowed_tables)) THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'code', 'INVALID_TABLE',
      'message', format('Table "%s" is not allowed for sync operations', p_table)
    );
  END IF;
  
  -- Validate operation type
  IF NOT (p_operation = ANY(v_allowed_ops)) THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'code', 'INVALID_OPERATION',
      'message', format('Operation "%s" is not allowed', p_operation)
    );
  END IF;
  
  -- ========================================================================
  -- IDEMPOTENCY CHECK
  -- ========================================================================
  
  SELECT * INTO v_existing 
  FROM public.sync_processed 
  WHERE idempotency_key = p_idempotency_key;
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'already_processed',
      'code', 'ALREADY_PROCESSED',
      'result', v_existing.result
    );
  END IF;
  
  -- ========================================================================
  -- EXECUTE OPERATION (explicit, no dynamic SQL)
  -- Note: This respects RLS because we're NOT using SECURITY DEFINER
  -- ========================================================================
  
  CASE p_table
    -- ======================================================================
    -- DELIVERIES
    -- ======================================================================
    WHEN 'deliveries' THEN
      CASE p_operation
        WHEN 'CREATE' THEN
          INSERT INTO public.deliveries (
            id,
            planteur_id,
            chef_planteur_id,
            warehouse_id,
            weight_kg,
            price_per_kg,
            quality_grade,
            notes,
            delivered_at,
            created_by
          )
          VALUES (
            p_record_id,
            (p_data->>'planteur_id')::uuid,
            (p_data->>'chef_planteur_id')::uuid,
            (p_data->>'warehouse_id')::uuid,
            (p_data->>'weight_kg')::numeric,
            (p_data->>'price_per_kg')::numeric,
            COALESCE((p_data->>'quality_grade')::public.quality_grade, 'B'),
            p_data->>'notes',
            COALESCE((p_data->>'delivered_at')::timestamptz, NOW()),
            auth.uid()
          );
          
        WHEN 'UPDATE' THEN
          UPDATE public.deliveries
          SET
            weight_kg = COALESCE((p_data->>'weight_kg')::numeric, weight_kg),
            price_per_kg = COALESCE((p_data->>'price_per_kg')::numeric, price_per_kg),
            quality_grade = COALESCE((p_data->>'quality_grade')::public.quality_grade, quality_grade),
            notes = COALESCE(p_data->>'notes', notes),
            delivered_at = COALESCE((p_data->>'delivered_at')::timestamptz, delivered_at),
            updated_at = NOW()
          WHERE id = p_record_id;
          
        WHEN 'DELETE' THEN
          DELETE FROM public.deliveries 
          WHERE id = p_record_id;
      END CASE;
      
    -- ======================================================================
    -- PLANTEURS
    -- ======================================================================
    WHEN 'planteurs' THEN
      CASE p_operation
        WHEN 'CREATE' THEN
          -- Get cooperative_id from chef_planteur
          SELECT cooperative_id INTO v_chef_planteur_coop_id
          FROM public.chef_planteurs
          WHERE id = (p_data->>'chef_planteur_id')::uuid;
          
          IF v_chef_planteur_coop_id IS NULL THEN
            RETURN jsonb_build_object(
              'status', 'error',
              'code', 'INVALID_REFERENCE',
              'message', 'Chef planteur not found or has no cooperative'
            );
          END IF;
          
          INSERT INTO public.planteurs (
            id,
            name,
            code,
            phone,
            cni,
            chef_planteur_id,
            cooperative_id,
            latitude,
            longitude,
            is_active,
            created_by
          )
          VALUES (
            p_record_id,
            p_data->>'name',
            p_data->>'code',
            p_data->>'phone',
            p_data->>'cni',
            (p_data->>'chef_planteur_id')::uuid,
            v_chef_planteur_coop_id,
            (p_data->>'latitude')::float,
            (p_data->>'longitude')::float,
            COALESCE((p_data->>'is_active')::boolean, true),
            auth.uid()
          );
          
        WHEN 'UPDATE' THEN
          UPDATE public.planteurs
          SET
            name = COALESCE(p_data->>'name', name),
            code = COALESCE(p_data->>'code', code),
            phone = COALESCE(p_data->>'phone', phone),
            cni = COALESCE(p_data->>'cni', cni),
            latitude = COALESCE((p_data->>'latitude')::float, latitude),
            longitude = COALESCE((p_data->>'longitude')::float, longitude),
            is_active = COALESCE((p_data->>'is_active')::boolean, is_active),
            updated_at = NOW()
          WHERE id = p_record_id;
          
        WHEN 'DELETE' THEN
          -- Soft delete by setting is_active = false
          UPDATE public.planteurs
          SET is_active = false, updated_at = NOW()
          WHERE id = p_record_id;
      END CASE;
      
    -- ======================================================================
    -- CHEF PLANTEURS
    -- ======================================================================
    WHEN 'chef_planteurs' THEN
      CASE p_operation
        WHEN 'CREATE' THEN
          INSERT INTO public.chef_planteurs (
            id,
            name,
            code,
            phone,
            cni,
            cooperative_id,
            region,
            departement,
            localite,
            latitude,
            longitude,
            quantite_max_kg,
            validation_status,
            created_by
          )
          VALUES (
            p_record_id,
            p_data->>'name',
            p_data->>'code',
            p_data->>'phone',
            p_data->>'cni',
            (p_data->>'cooperative_id')::uuid,
            p_data->>'region',
            p_data->>'departement',
            p_data->>'localite',
            (p_data->>'latitude')::float,
            (p_data->>'longitude')::float,
            COALESCE((p_data->>'quantite_max_kg')::numeric, 0),
            COALESCE((p_data->>'validation_status')::public.validation_status, 'pending'),
            auth.uid()
          );
          
        WHEN 'UPDATE' THEN
          UPDATE public.chef_planteurs
          SET
            name = COALESCE(p_data->>'name', name),
            code = COALESCE(p_data->>'code', code),
            phone = COALESCE(p_data->>'phone', phone),
            cni = COALESCE(p_data->>'cni', cni),
            region = COALESCE(p_data->>'region', region),
            departement = COALESCE(p_data->>'departement', departement),
            localite = COALESCE(p_data->>'localite', localite),
            latitude = COALESCE((p_data->>'latitude')::float, latitude),
            longitude = COALESCE((p_data->>'longitude')::float, longitude),
            quantite_max_kg = COALESCE((p_data->>'quantite_max_kg')::numeric, quantite_max_kg),
            updated_at = NOW()
          WHERE id = p_record_id;
          
        WHEN 'DELETE' THEN
          -- Note: Chef planteurs should not be deleted if they have associated planteurs
          -- This will fail with FK constraint if planteurs exist
          DELETE FROM public.chef_planteurs 
          WHERE id = p_record_id;
      END CASE;
  END CASE;
  
  -- ========================================================================
  -- MARK AS PROCESSED
  -- ========================================================================
  
  v_result := jsonb_build_object('status', 'success');
  
  INSERT INTO public.sync_processed (idempotency_key, result)
  VALUES (p_idempotency_key, v_result);
  
  RETURN v_result;

-- ========================================================================
-- ERROR HANDLING
-- ========================================================================
EXCEPTION
  WHEN insufficient_privilege THEN  -- 42501
    RETURN jsonb_build_object(
      'status', 'error',
      'code', 'FORBIDDEN',
      'message', 'Access denied. You do not have permission to perform this operation.'
    );
    
  WHEN unique_violation THEN  -- 23505
    RETURN jsonb_build_object(
      'status', 'error',
      'code', 'DUPLICATE',
      'message', 'Record already exists with this identifier or code.'
    );
    
  WHEN foreign_key_violation THEN  -- 23503
    RETURN jsonb_build_object(
      'status', 'error',
      'code', 'INVALID_REFERENCE',
      'message', 'Referenced record not found. Please check the IDs provided.'
    );
    
  WHEN check_violation THEN  -- 23514
    RETURN jsonb_build_object(
      'status', 'error',
      'code', 'VALIDATION_ERROR',
      'message', 'Data validation failed. Please check the values provided.'
    );
    
  WHEN raise_exception THEN  -- Custom exceptions from triggers
    RETURN jsonb_build_object(
      'status', 'error',
      'code', 'VALIDATION_ERROR',
      'message', SQLERRM
    );
    
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'code', 'INTERNAL_ERROR',
      'message', 'An unexpected error occurred. Please try again.'
    );
END;
$ LANGUAGE plpgsql;

-- ============================================================================
-- SCHEDULED RETENTION JOB
-- Note: pg_cron must be enabled in Supabase dashboard
-- This creates the job if pg_cron is available
-- ============================================================================

-- Create a wrapper function that can be called by pg_cron
CREATE OR REPLACE FUNCTION public.scheduled_purge_sync_processed()
RETURNS void
SET search_path = public
AS $
BEGIN
  PERFORM public.purge_sync_processed(90);
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role for scheduled jobs
GRANT EXECUTE ON FUNCTION public.scheduled_purge_sync_processed() TO service_role;

-- Note: To enable the scheduled job, run this in the Supabase SQL editor:
-- SELECT cron.schedule(
--   'purge-sync-processed',
--   '0 3 * * *',  -- Run at 3 AM daily
--   'SELECT public.scheduled_purge_sync_processed()'
-- );

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.sync_operation(UUID, TEXT, TEXT, UUID, JSONB) IS 
  'Processes sync operations from offline queue. Supports deliveries, planteurs, and chef_planteurs. Idempotent via idempotency_key. Respects RLS.';

COMMENT ON FUNCTION public.scheduled_purge_sync_processed() IS 
  'Wrapper function for scheduled purge of sync_processed table. Called by pg_cron.';
