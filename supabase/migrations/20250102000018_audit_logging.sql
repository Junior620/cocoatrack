-- CocoaTrack V2 - Audit Logging Configuration
-- This migration sets up comprehensive audit logging with:
-- - audit_trigger_func() with safe IP extraction
-- - Triggers on all audited tables
-- - RLS policies: deny writes + select scope by role

-- ============================================================================
-- AUDIT TRIGGER FUNCTION
-- Records all INSERT, UPDATE, DELETE operations with actor info and IP
-- ============================================================================
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
AS $
DECLARE
  v_actor_id UUID;
  v_actor_type TEXT;
  v_ip_address TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
  v_row_id UUID;
BEGIN
  -- Get actor from JWT or mark as system
  v_actor_id := auth.uid();
  v_actor_type := CASE WHEN v_actor_id IS NULL THEN 'system' ELSE 'user' END;
  
  -- Safe IP extraction from request headers
  -- Uses current_setting with missing_ok=true to avoid errors
  BEGIN
    v_ip_address := current_setting('request.headers', true)::json->>'x-forwarded-for';
    -- If x-forwarded-for contains multiple IPs (comma-separated), take the first one
    IF v_ip_address IS NOT NULL AND position(',' in v_ip_address) > 0 THEN
      v_ip_address := split_part(v_ip_address, ',', 1);
    END IF;
    -- Trim whitespace
    v_ip_address := trim(v_ip_address);
  EXCEPTION WHEN OTHERS THEN
    v_ip_address := NULL;
  END;
  
  -- Determine row_id and data based on operation
  CASE TG_OP
    WHEN 'INSERT' THEN
      v_row_id := NEW.id;
      v_old_data := NULL;
      v_new_data := to_jsonb(NEW);
    WHEN 'UPDATE' THEN
      v_row_id := NEW.id;
      v_old_data := to_jsonb(OLD);
      v_new_data := to_jsonb(NEW);
    WHEN 'DELETE' THEN
      v_row_id := OLD.id;
      v_old_data := to_jsonb(OLD);
      v_new_data := NULL;
  END CASE;
  
  -- Insert audit log entry
  INSERT INTO public.audit_log (
    actor_id,
    actor_type,
    table_name,
    row_id,
    action,
    old_data,
    new_data,
    ip_address,
    created_at
  ) VALUES (
    v_actor_id,
    v_actor_type,
    TG_TABLE_NAME,
    v_row_id,
    TG_OP::public.audit_action,
    v_old_data,
    v_new_data,
    v_ip_address,
    NOW()
  );
  
  -- Return appropriate row
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.audit_trigger_func() IS 'Audit trigger function that logs all INSERT, UPDATE, DELETE operations with actor info and IP address';

-- ============================================================================
-- AUDIT TRIGGERS ON ALL AUDITED TABLES
-- ============================================================================

-- Drop existing triggers if they exist (for idempotency)
DROP TRIGGER IF EXISTS audit_deliveries ON public.deliveries;
DROP TRIGGER IF EXISTS audit_planteurs ON public.planteurs;
DROP TRIGGER IF EXISTS audit_chef_planteurs ON public.chef_planteurs;
DROP TRIGGER IF EXISTS audit_invoices ON public.invoices;
DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
DROP TRIGGER IF EXISTS audit_warehouses ON public.warehouses;
DROP TRIGGER IF EXISTS audit_cooperatives ON public.cooperatives;

-- Deliveries audit trigger
CREATE TRIGGER audit_deliveries
  AFTER INSERT OR UPDATE OR DELETE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Planteurs audit trigger
CREATE TRIGGER audit_planteurs
  AFTER INSERT OR UPDATE OR DELETE ON public.planteurs
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Chef Planteurs audit trigger
CREATE TRIGGER audit_chef_planteurs
  AFTER INSERT OR UPDATE OR DELETE ON public.chef_planteurs
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Invoices audit trigger
CREATE TRIGGER audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Profiles audit trigger
CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Warehouses audit trigger
CREATE TRIGGER audit_warehouses
  AFTER INSERT OR UPDATE OR DELETE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- Cooperatives audit trigger
CREATE TRIGGER audit_cooperatives
  AFTER INSERT OR UPDATE OR DELETE ON public.cooperatives
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ============================================================================
-- RLS POLICIES FOR AUDIT_LOG
-- Deny all writes (INSERT, UPDATE, DELETE) - only triggers can write
-- Select scope based on role: admin=all, manager=own coop, others=none
-- ============================================================================

-- Enable RLS on audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner as well
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Deny all inserts on audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Deny all updates on audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Deny all deletes on audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Admin can view all audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Manager can view own cooperative audit logs" ON public.audit_log;

-- Deny INSERT for all users (only triggers can insert via SECURITY DEFINER)
CREATE POLICY "Deny all inserts on audit_log"
  ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Deny UPDATE for all users
CREATE POLICY "Deny all updates on audit_log"
  ON public.audit_log
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Deny DELETE for all users
CREATE POLICY "Deny all deletes on audit_log"
  ON public.audit_log
  FOR DELETE
  TO authenticated
  USING (false);

-- Admin can view all audit logs
CREATE POLICY "Admin can view all audit logs"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Manager can view audit logs for their cooperative
-- This requires joining with the audited tables to check cooperative_id
CREATE POLICY "Manager can view own cooperative audit logs"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'manager'::public.user_role
    AND (
      -- Check if the audited row belongs to user's cooperative
      -- For tables with direct cooperative_id
      (table_name IN ('deliveries', 'planteurs', 'chef_planteurs', 'invoices', 'warehouses')
       AND (new_data->>'cooperative_id')::UUID = public.get_user_cooperative_id())
      OR
      -- For profiles, check the cooperative_id in the data
      (table_name = 'profiles'
       AND (new_data->>'cooperative_id')::UUID = public.get_user_cooperative_id())
      OR
      -- For cooperatives table, check if it's the user's cooperative
      (table_name = 'cooperatives'
       AND row_id = public.get_user_cooperative_id())
      OR
      -- For old_data when new_data is null (DELETE operations)
      (new_data IS NULL AND old_data IS NOT NULL
       AND (
         (table_name IN ('deliveries', 'planteurs', 'chef_planteurs', 'invoices', 'warehouses', 'profiles')
          AND (old_data->>'cooperative_id')::UUID = public.get_user_cooperative_id())
         OR
         (table_name = 'cooperatives'
          AND row_id = public.get_user_cooperative_id())
       ))
    )
  );

-- ============================================================================
-- ADDITIONAL INDEXES FOR AUDIT LOG QUERIES
-- ============================================================================

-- Index for filtering by table_name and date range
CREATE INDEX IF NOT EXISTS idx_audit_log_table_date 
  ON public.audit_log(table_name, created_at DESC);

-- Index for filtering by actor_id
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_date 
  ON public.audit_log(actor_id, created_at DESC);

-- Index for filtering by action type
CREATE INDEX IF NOT EXISTS idx_audit_log_action 
  ON public.audit_log(action, created_at DESC);

-- ============================================================================
-- HELPER FUNCTION TO GET AUDIT LOGS WITH ACTOR INFO
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_audit_logs_with_actor(
  p_table_name TEXT DEFAULT NULL,
  p_row_id UUID DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_action public.audit_action DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  actor_id UUID,
  actor_type TEXT,
  actor_name TEXT,
  actor_email TEXT,
  table_name TEXT,
  row_id UUID,
  action public.audit_action,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ
)
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $
BEGIN
  -- Check if user has permission to view audit logs
  IF NOT (public.is_admin() OR public.get_user_role() = 'manager'::public.user_role) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions to view audit logs';
  END IF;
  
  RETURN QUERY
  SELECT 
    al.id,
    al.actor_id,
    al.actor_type,
    COALESCE(p.full_name, 'System') AS actor_name,
    p.email AS actor_email,
    al.table_name,
    al.row_id,
    al.action,
    al.old_data,
    al.new_data,
    al.ip_address,
    al.created_at
  FROM public.audit_log al
  LEFT JOIN public.profiles p ON al.actor_id = p.id
  WHERE 
    (p_table_name IS NULL OR al.table_name = p_table_name)
    AND (p_row_id IS NULL OR al.row_id = p_row_id)
    AND (p_actor_id IS NULL OR al.actor_id = p_actor_id)
    AND (p_action IS NULL OR al.action = p_action)
    AND (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at <= p_end_date)
    -- Apply cooperative filter for managers
    AND (
      public.is_admin()
      OR (
        public.get_user_role() = 'manager'::public.user_role
        AND (
          (al.table_name IN ('deliveries', 'planteurs', 'chef_planteurs', 'invoices', 'warehouses', 'profiles')
           AND (
             (al.new_data->>'cooperative_id')::UUID = public.get_user_cooperative_id()
             OR (al.new_data IS NULL AND (al.old_data->>'cooperative_id')::UUID = public.get_user_cooperative_id())
           ))
          OR (al.table_name = 'cooperatives' AND al.row_id = public.get_user_cooperative_id())
        )
      )
    )
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_audit_logs_with_actor IS 'Returns audit logs with actor information, filtered by various criteria and respecting RLS';

-- ============================================================================
-- FUNCTION TO COUNT AUDIT LOGS (for pagination)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.count_audit_logs(
  p_table_name TEXT DEFAULT NULL,
  p_row_id UUID DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_action public.audit_action DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS BIGINT
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $
DECLARE
  v_count BIGINT;
BEGIN
  -- Check if user has permission to view audit logs
  IF NOT (public.is_admin() OR public.get_user_role() = 'manager'::public.user_role) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions to view audit logs';
  END IF;
  
  SELECT COUNT(*) INTO v_count
  FROM public.audit_log al
  WHERE 
    (p_table_name IS NULL OR al.table_name = p_table_name)
    AND (p_row_id IS NULL OR al.row_id = p_row_id)
    AND (p_actor_id IS NULL OR al.actor_id = p_actor_id)
    AND (p_action IS NULL OR al.action = p_action)
    AND (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at <= p_end_date)
    -- Apply cooperative filter for managers
    AND (
      public.is_admin()
      OR (
        public.get_user_role() = 'manager'::public.user_role
        AND (
          (al.table_name IN ('deliveries', 'planteurs', 'chef_planteurs', 'invoices', 'warehouses', 'profiles')
           AND (
             (al.new_data->>'cooperative_id')::UUID = public.get_user_cooperative_id()
             OR (al.new_data IS NULL AND (al.old_data->>'cooperative_id')::UUID = public.get_user_cooperative_id())
           ))
          OR (al.table_name = 'cooperatives' AND al.row_id = public.get_user_cooperative_id())
        )
      )
    );
  
  RETURN v_count;
END;
$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.count_audit_logs IS 'Returns count of audit logs matching the given criteria, respecting RLS';
