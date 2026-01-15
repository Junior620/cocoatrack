-- ============================================================================
-- CocoaTrack V2 - Parcelles Audit Extension
-- Adds audit logging support for parcelles module
-- ============================================================================

-- Task 1.2: Add composite index on audit_logs for efficient entity queries
-- Note: Using existing column names (table_name, row_id) which serve as (entity_type, entity_id)
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_lookup 
  ON public.audit_logs(table_name, row_id, created_at DESC);

-- ============================================================================
-- Extend audit_logs action CHECK constraint to support parcelles actions
-- Drop existing constraint and recreate with extended values
-- ============================================================================
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check 
  CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'create', 'update', 'archive', 'status_change', 'import_parse', 'import_apply'));

-- ============================================================================
-- Trigger: log_parcelle_audit()
-- Smart action detection for parcelles changes:
--   - INSERT → action='create'
--   - is_active true→false → action='archive'
--   - conformity_status changed → action='status_change' (NOT 'update')
--   - other UPDATE → action='update'
-- Stores before/after JSONB only for useful fields
-- ============================================================================
CREATE OR REPLACE FUNCTION log_parcelle_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
  v_actor_id UUID;
BEGIN
  -- Get actor_id from auth.uid() or fallback to created_by/updated record
  v_actor_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    -- INSERT → action='create'
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
    
    -- Use created_by if auth.uid() is null
    IF v_actor_id IS NULL THEN
      v_actor_id := NEW.created_by;
    END IF;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Build old_data with useful fields
    v_old_data := jsonb_build_object(
      'conformity_status', OLD.conformity_status,
      'certifications', OLD.certifications,
      'risk_flags', OLD.risk_flags,
      'source', OLD.source,
      'import_file_id', OLD.import_file_id,
      'is_active', OLD.is_active
    );
    
    -- Build new_data with useful fields
    v_new_data := jsonb_build_object(
      'conformity_status', NEW.conformity_status,
      'certifications', NEW.certifications,
      'risk_flags', NEW.risk_flags,
      'source', NEW.source,
      'import_file_id', NEW.import_file_id,
      'is_active', NEW.is_active
    );
    
    -- Smart action detection (order matters - most specific first)
    IF OLD.is_active = true AND NEW.is_active = false THEN
      -- is_active true→false → action='archive'
      v_action := 'archive';
    ELSIF OLD.conformity_status IS DISTINCT FROM NEW.conformity_status THEN
      -- conformity_status changed → action='status_change'
      v_action := 'status_change';
    ELSE
      -- other UPDATE → action='update'
      v_action := 'update';
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- DELETE (should not happen via API, but log if it does)
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
  
  -- Insert audit log entry
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
  
  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on parcelles table for all operations
DROP TRIGGER IF EXISTS trg_parcelle_audit ON public.parcelles;
CREATE TRIGGER trg_parcelle_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.parcelles
  FOR EACH ROW EXECUTE FUNCTION log_parcelle_audit();

-- ============================================================================
-- Trigger: log_import_file_audit()
-- Logs import actions for parcel_import_files:
--   - import_status → 'parsed' or 'failed' → action='import_parse'
--   - import_status → 'applied' → action='import_apply'
-- Only logs on status transitions, not on initial upload
-- ============================================================================
CREATE OR REPLACE FUNCTION log_import_file_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
  v_actor_id UUID;
BEGIN
  -- Only log on UPDATE (status transitions)
  IF TG_OP != 'UPDATE' THEN
    RETURN NEW;
  END IF;
  
  -- Only log when import_status changes
  IF OLD.import_status IS NOT DISTINCT FROM NEW.import_status THEN
    RETURN NEW;
  END IF;
  
  -- Get actor_id from auth.uid() or fallback to applied_by/created_by
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    v_actor_id := COALESCE(NEW.applied_by, NEW.created_by);
  END IF;
  
  -- Determine action based on new status
  IF NEW.import_status IN ('parsed', 'failed') THEN
    v_action := 'import_parse';
  ELSIF NEW.import_status = 'applied' THEN
    v_action := 'import_apply';
  ELSE
    -- Don't log other status changes (e.g., uploaded)
    RETURN NEW;
  END IF;
  
  -- Build old_data with relevant fields
  v_old_data := jsonb_build_object(
    'import_status', OLD.import_status,
    'nb_features', OLD.nb_features,
    'nb_applied', OLD.nb_applied,
    'nb_skipped_duplicates', OLD.nb_skipped_duplicates,
    'failed_reason', OLD.failed_reason
  );
  
  -- Build new_data with relevant fields
  v_new_data := jsonb_build_object(
    'import_status', NEW.import_status,
    'nb_features', NEW.nb_features,
    'nb_applied', NEW.nb_applied,
    'nb_skipped_duplicates', NEW.nb_skipped_duplicates,
    'failed_reason', NEW.failed_reason,
    'parse_report', NEW.parse_report,
    'applied_at', NEW.applied_at
  );
  
  -- Insert audit log entry
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on parcel_import_files table for status changes
DROP TRIGGER IF EXISTS trg_import_file_audit ON public.parcel_import_files;
CREATE TRIGGER trg_import_file_audit
  AFTER UPDATE ON public.parcel_import_files
  FOR EACH ROW EXECUTE FUNCTION log_import_file_audit();
