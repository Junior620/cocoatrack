-- ============================================================================
-- VERIFICATION SCRIPT - Check Planteurs Import Status
-- Run this in Supabase SQL Editor to verify import results
-- ============================================================================

-- 1. Check planteur_import_files table
SELECT 
  id,
  filename,
  cooperative_id,
  import_status,
  created_by,
  created_at,
  (parse_result->>'total_rows')::int as total_rows,
  (parse_result->>'valid_rows')::int as valid_rows,
  (import_summary->>'created_count')::int as created_count,
  (import_summary->>'failed_count')::int as failed_count
FROM planteur_import_files
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check recently created planteurs (last 24 hours)
SELECT 
  id,
  name,
  code,
  phone,
  cni,
  cooperative_id,
  created_by,
  created_at,
  is_active
FROM planteurs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 3. Check planteurs with NULL cooperative_id
SELECT 
  id,
  name,
  code,
  phone,
  cni,
  cooperative_id,
  created_by,
  created_at
FROM planteurs
WHERE cooperative_id IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- 4. Count planteurs by cooperative_id
SELECT 
  COALESCE(cooperative_id::text, 'NULL') as cooperative,
  COUNT(*) as count
FROM planteurs
GROUP BY cooperative_id
ORDER BY count DESC;

-- 5. Check audit logs for recent imports
SELECT 
  actor_id,
  table_name,
  action,
  new_data->>'operation' as operation,
  (new_data->>'count')::int as count,
  created_at
FROM audit_logs
WHERE table_name = 'planteur_import_files'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 6. Check if RLS policies exist for planteurs
SELECT 
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies 
WHERE tablename = 'planteurs'
ORDER BY policyname;
