-- ============================================================================
-- DEBUG SCRIPT - Diagnose Import Execution Issues
-- Run this in Supabase SQL Editor to understand what's happening
-- ============================================================================

-- 1. Check if planteur_import_files table exists and has data
SELECT 
  'planteur_import_files' as table_name,
  COUNT(*) as row_count
FROM planteur_import_files;

-- 2. Check the most recent import file details
SELECT 
  id,
  filename,
  cooperative_id,
  import_status,
  file_size,
  created_by,
  created_at,
  parse_result,
  import_summary
FROM planteur_import_files
ORDER BY created_at DESC
LIMIT 1;

-- 3. Check if there are ANY planteurs in the database
SELECT 
  'planteurs' as table_name,
  COUNT(*) as total_count,
  COUNT(CASE WHEN cooperative_id IS NULL THEN 1 END) as null_cooperative_count,
  COUNT(CASE WHEN cooperative_id IS NOT NULL THEN 1 END) as with_cooperative_count
FROM planteurs;

-- 4. Check recent planteurs (last 24 hours)
SELECT 
  id,
  name,
  code,
  phone,
  cni,
  cooperative_id,
  chef_planteur_id,
  created_by,
  created_at
FROM planteurs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 5. Check if chef_planteur_id column allows NULL
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'planteurs'
  AND column_name IN ('chef_planteur_id', 'cooperative_id', 'created_by');

-- 6. Check if there are any constraints blocking inserts
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.planteurs'::regclass;

-- 7. Try a test insert (will fail if there are issues)
-- UNCOMMENT TO TEST:
/*
INSERT INTO planteurs (
  name,
  code,
  phone,
  cni,
  cooperative_id,
  chef_planteur_id,
  superficie_hectares,
  is_active,
  created_by
) VALUES (
  'TEST PLANTEUR',
  'TEST001',
  '+237600000000',
  'CM123456',
  NULL,  -- NULL cooperative
  NULL,  -- NULL chef_planteur
  10.5,
  true,
  auth.uid()  -- Current user
);
*/

-- 8. Check audit logs for import operations
SELECT 
  id,
  actor_id,
  table_name,
  action,
  new_data,
  created_at
FROM audit_logs
WHERE table_name IN ('planteur_import_files', 'planteurs')
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- 9. Check RLS policies on planteurs table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'planteurs'
ORDER BY policyname;

-- 10. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'planteurs';
