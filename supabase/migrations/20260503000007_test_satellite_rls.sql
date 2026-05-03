-- ============================================================================
-- Test Script: Satellite Imagery RLS Policies
-- Description: Verification queries to test RLS policies for satellite tables
-- Usage: Run this script after applying 20260503000007_satellite_rls_policies.sql
-- ============================================================================

-- ============================================================================
-- SECTION 1: Verify RLS is Enabled
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN '✓ RLS ENABLED'
    ELSE '✗ RLS DISABLED'
  END as status
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN (
    'satellite_imagery',
    'ndvi_results',
    'deforestation_events',
    'yield_predictions',
    'satellite_cache_metadata',
    'satellite_audit_logs'
  )
ORDER BY tablename;

-- ============================================================================
-- SECTION 2: Verify Policies Created
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  CASE 
    WHEN cmd = 'SELECT' THEN '✓ READ'
    WHEN cmd = 'INSERT' THEN '✓ CREATE'
    WHEN cmd = 'UPDATE' THEN '✓ MODIFY'
    WHEN cmd = 'DELETE' THEN '✓ REMOVE'
    ELSE cmd
  END as operation_type
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN (
    'satellite_imagery',
    'ndvi_results',
    'deforestation_events',
    'yield_predictions',
    'satellite_cache_metadata',
    'satellite_audit_logs'
  )
ORDER BY tablename, cmd, policyname;

-- ============================================================================
-- SECTION 3: Count Policies Per Table
-- ============================================================================

SELECT 
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) >= 4 THEN '✓ COMPLETE (SELECT, INSERT, UPDATE, DELETE)'
    WHEN COUNT(*) >= 3 THEN '⚠ PARTIAL (missing DELETE or UPDATE)'
    ELSE '✗ INCOMPLETE'
  END as coverage_status
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN (
    'satellite_imagery',
    'ndvi_results',
    'deforestation_events',
    'yield_predictions',
    'satellite_cache_metadata',
    'satellite_audit_logs'
  )
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- SECTION 4: Verify Policy Definitions
-- ============================================================================

-- Check SELECT policies reference parcelles table
SELECT 
  tablename,
  policyname,
  CASE 
    WHEN qual::text LIKE '%parcelles%' THEN '✓ References parcelles'
    ELSE '✗ Missing parcelles reference'
  END as parcelle_check,
  CASE 
    WHEN qual::text LIKE '%can_access_cooperative%' THEN '✓ Uses can_access_cooperative'
    ELSE '⚠ No cooperative check'
  END as cooperative_check
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN (
    'satellite_imagery',
    'ndvi_results',
    'deforestation_events',
    'yield_predictions',
    'satellite_cache_metadata',
    'satellite_audit_logs'
  )
  AND cmd = 'SELECT'
ORDER BY tablename;

-- Check INSERT/UPDATE policies require agent_or_above
SELECT 
  tablename,
  policyname,
  cmd,
  CASE 
    WHEN with_check::text LIKE '%is_agent_or_above%' 
      OR with_check::text LIKE '%is_manager_or_above%' 
      OR with_check::text LIKE '%is_admin%' 
    THEN '✓ Role check present'
    ELSE '✗ Missing role check'
  END as role_check
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN (
    'satellite_imagery',
    'ndvi_results',
    'deforestation_events',
    'yield_predictions',
    'satellite_cache_metadata',
    'satellite_audit_logs'
  )
  AND cmd IN ('INSERT', 'UPDATE')
ORDER BY tablename, cmd;

-- Check DELETE policies require admin
SELECT 
  tablename,
  policyname,
  CASE 
    WHEN qual::text LIKE '%is_admin%' THEN '✓ Admin-only'
    ELSE '✗ Not admin-restricted'
  END as admin_check
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN (
    'satellite_imagery',
    'ndvi_results',
    'deforestation_events',
    'yield_predictions',
    'satellite_cache_metadata',
    'satellite_audit_logs'
  )
  AND cmd = 'DELETE'
ORDER BY tablename;

-- ============================================================================
-- SECTION 5: Test Scenarios (Commented - Requires Test Data)
-- ============================================================================

/*
-- Prerequisites for testing:
-- 1. Create test users with different roles (viewer, agent, manager, admin)
-- 2. Create test cooperatives
-- 3. Create test parcelles linked to cooperatives
-- 4. Insert test satellite data

-- Test 1: Viewer can SELECT satellite data for their cooperative's parcelles
-- Expected: Returns rows for cooperative's parcelles only
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "viewer-user-id"}';
SELECT COUNT(*) FROM public.satellite_imagery;
SELECT COUNT(*) FROM public.ndvi_results;
RESET ROLE;

-- Test 2: Agent can INSERT satellite data for accessible parcelles
-- Expected: INSERT succeeds for cooperative's parcelles, fails for others
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "agent-user-id"}';
INSERT INTO public.satellite_imagery (
  parcelle_id, acquisition_date, cloud_cover_percent, 
  satellite_source, tile_url, bounds, resolution_meters
) VALUES (
  'accessible-parcelle-id'::uuid,
  NOW(),
  15.5,
  'sentinel-2',
  'https://storage.example.com/tile.png',
  '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}'::jsonb,
  10.0
);
RESET ROLE;

-- Test 3: Manager can UPDATE deforestation events (acknowledge)
-- Expected: UPDATE succeeds for cooperative's parcelles
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "manager-user-id"}';
UPDATE public.deforestation_events 
SET status = 'acknowledged',
    acknowledged_by = 'manager-user-id'::uuid,
    acknowledged_at = NOW(),
    acknowledgment_notes = 'Verified and acknowledged'
WHERE id = 'test-deforestation-event-id'::uuid;
RESET ROLE;

-- Test 4: Non-admin cannot DELETE satellite data
-- Expected: DELETE fails with permission denied
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "agent-user-id"}';
DELETE FROM public.satellite_imagery WHERE id = 'test-imagery-id'::uuid;
-- Should fail
RESET ROLE;

-- Test 5: Admin can DELETE satellite data
-- Expected: DELETE succeeds
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "admin-user-id"}';
DELETE FROM public.satellite_imagery WHERE id = 'test-imagery-id'::uuid;
-- Should succeed
RESET ROLE;

-- Test 6: Cross-cooperative access blocked
-- Expected: User from cooperative A cannot see data for cooperative B's parcelles
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "user-cooperative-a"}';
SELECT COUNT(*) FROM public.satellite_imagery 
WHERE parcelle_id IN (
  SELECT id FROM public.parcelles p
  JOIN public.planteurs pl ON pl.id = p.planteur_id
  WHERE pl.cooperative_id = 'cooperative-b-id'::uuid
);
-- Should return 0
RESET ROLE;

-- Test 7: Audit logs - users can see their own actions
-- Expected: Returns only current user's audit logs
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "test-user-id"}';
SELECT COUNT(*) FROM public.satellite_audit_logs WHERE user_id = 'test-user-id'::uuid;
RESET ROLE;

-- Test 8: Audit logs - managers can see cooperative's logs
-- Expected: Returns audit logs for all parcelles in manager's cooperative
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "manager-user-id"}';
SELECT COUNT(*) FROM public.satellite_audit_logs 
WHERE parcelle_id IN (
  SELECT id FROM public.parcelles p
  JOIN public.planteurs pl ON pl.id = p.planteur_id
  WHERE pl.cooperative_id = (
    SELECT cooperative_id FROM public.profiles WHERE id = 'manager-user-id'::uuid
  )
);
RESET ROLE;
*/

-- ============================================================================
-- SECTION 6: Summary Report
-- ============================================================================

SELECT 
  '=== SATELLITE RLS POLICIES VERIFICATION SUMMARY ===' as report_section;

SELECT 
  'Total Tables with RLS' as metric,
  COUNT(*) as value,
  '6 expected' as expected
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN (
    'satellite_imagery',
    'ndvi_results',
    'deforestation_events',
    'yield_predictions',
    'satellite_cache_metadata',
    'satellite_audit_logs'
  )
  AND rowsecurity = true;

SELECT 
  'Total Policies Created' as metric,
  COUNT(*) as value,
  '23+ expected' as expected
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN (
    'satellite_imagery',
    'ndvi_results',
    'deforestation_events',
    'yield_predictions',
    'satellite_cache_metadata',
    'satellite_audit_logs'
  );

SELECT 
  'Tables with Complete Coverage' as metric,
  COUNT(*) as value,
  '6 expected' as expected
FROM (
  SELECT tablename
  FROM pg_policies 
  WHERE schemaname = 'public'
    AND tablename IN (
      'satellite_imagery',
      'ndvi_results',
      'deforestation_events',
      'yield_predictions',
      'satellite_cache_metadata',
      'satellite_audit_logs'
    )
  GROUP BY tablename
  HAVING COUNT(*) >= 3
) as covered_tables;

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. This script verifies that RLS policies are correctly created
-- 2. For full testing, create test users and data, then run the commented scenarios
-- 3. Test with different user roles: viewer, agent, manager, admin
-- 4. Verify cross-cooperative access is properly blocked
-- 5. Verify audit logs show correct visibility based on role

-- ============================================================================
-- END OF TEST SCRIPT
-- ============================================================================
