-- ============================================================================
-- CocoaTrack V2 - Audit Logs Migration
-- Creates audit_logs table and helper functions
-- ============================================================================

-- Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES public.profiles(id),
  actor_type TEXT NOT NULL DEFAULT 'user',
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_row_id ON public.audit_logs(row_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select" ON public.audit_logs 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "audit_logs_insert" ON public.audit_logs 
  FOR INSERT TO authenticated WITH CHECK (true);

-- Function to get audit logs with actor info
CREATE OR REPLACE FUNCTION get_audit_logs_with_actor(
  p_table_name TEXT DEFAULT NULL,
  p_row_id TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  actor_id UUID,
  actor_type TEXT,
  actor_name TEXT,
  actor_email TEXT,
  table_name TEXT,
  row_id TEXT,
  action TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to count audit logs
CREATE OR REPLACE FUNCTION count_audit_logs(
  p_table_name TEXT DEFAULT NULL,
  p_row_id TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS INTEGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log an audit entry (can be called from triggers or app)
CREATE OR REPLACE FUNCTION log_audit_entry(
  p_actor_id UUID,
  p_table_name TEXT,
  p_row_id TEXT,
  p_action TEXT,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO public.audit_logs (actor_id, table_name, row_id, action, old_data, new_data, ip_address)
  VALUES (p_actor_id, p_table_name, p_row_id, p_action, p_old_data, p_new_data, p_ip_address)
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
