-- CocoaTrack V2 - Sync Operation RPC (Minimal Version)
-- Implements idempotent sync operations for offline-first functionality
-- Whitelist: deliveries only (for now)
-- Respects RLS (NOT SECURITY DEFINER)

-- ============================================================================
-- SYNC OPERATION ERROR CODES
-- ============================================================================
-- ALREADY_PROCESSED: Operation was already processed (idempotent)
-- INVALID_TABLE: Table not in whitelist
-- INVALID_OPERATION: Operation type not allowed
-- FORBIDDEN: User doesn't have permission (RLS violation)
-- DUPLICATE: Record already exists (unique constraint)
-- INVALID_REFERENCE: Foreign key violation
-- VALIDATION_ERROR: Check constraint violation
-- INTERNAL_ERROR: Unexpected error

-- ============================================================================
-- SYNC OPERATION RPC FUNCTION
-- Processes sync operations from offline queue
-- Uses idempotency_key to prevent duplicate processing
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
  v_allowed_tables TEXT[] := ARRAY['deliveries'];
  v_allowed_ops TEXT[] := ARRAY['CREATE', 'UPDATE', 'DELETE'];
  v_result JSONB;
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
      
    -- Future tables can be added here:
    -- WHEN 'planteurs' THEN ...
    -- WHEN 'chef_planteurs' THEN ...
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
      'message', 'Record already exists with this identifier.'
    );
    
  WHEN foreign_key_violation THEN  -- 23503
    RETURN jsonb_build_object(
      'status', 'error',
      'code', 'INVALID_REFERENCE',
      'message', 'Referenced record not found. Please check planteur, chef_planteur, or warehouse IDs.'
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
-- RETENTION POLICY FOR SYNC_PROCESSED
-- Purges entries older than 90 days
-- ============================================================================

CREATE OR REPLACE FUNCTION public.purge_sync_processed(p_days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER
SET search_path = public
AS $
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.sync_processed
  WHERE processed_at < NOW() - (p_days_to_keep || ' days')::interval;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.sync_operation(UUID, TEXT, TEXT, UUID, JSONB) IS 
  'Processes sync operations from offline queue. Idempotent via idempotency_key. Respects RLS.';

COMMENT ON FUNCTION public.purge_sync_processed(INTEGER) IS 
  'Purges sync_processed entries older than specified days (default 90). Returns count of deleted rows.';

-- ============================================================================
-- GRANT EXECUTE TO AUTHENTICATED USERS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.sync_operation(UUID, TEXT, TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_sync_processed(INTEGER) TO authenticated;
