-- CocoaTrack V2 - RLS Profiles Policies Tests
-- This file tests the RLS policies on the profiles table

-- ============================================================================
-- TEST SETUP
-- ============================================================================

-- Verify RLS is enabled on profiles
DO $
DECLARE
  v_rls_enabled BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE relname = 'profiles' AND relnamespace = 'public'::regnamespace;
  
  IF v_rls_enabled THEN
    RAISE NOTICE 'TEST SETUP: RLS is enabled on profiles table';
  ELSE
    RAISE EXCEPTION 'TEST SETUP FAILED: RLS is not enabled on profiles table';
  END IF;
END $;

-- ============================================================================
-- TEST 1: Verify all expected policies exist
-- ============================================================================
DO $
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles';
  
  IF v_count >= 4 THEN
    RAISE NOTICE 'TEST 1 PASSED: Found % policies on profiles table', v_count;
  ELSE
    RAISE EXCEPTION 'TEST 1 FAILED: Expected at least 4 policies, found %', v_count;
  END IF;
END $;

-- ============================================================================
-- TEST 2: Verify SELECT policy exists
-- ============================================================================
DO $
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'profiles_select_policy'
    AND cmd = 'SELECT'
  ) INTO v_exists;
  
  IF v_exists THEN
    RAISE NOTICE 'TEST 2 PASSED: SELECT policy exists on profiles';
  ELSE
    RAISE EXCEPTION 'TEST 2 FAILED: SELECT policy not found on profiles';
  END IF;
END $;

-- ============================================================================
-- TEST 3: Verify INSERT policy exists
-- ============================================================================
DO $
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'profiles_insert_policy'
    AND cmd = 'INSERT'
  ) INTO v_exists;
  
  IF v_exists THEN
    RAISE NOTICE 'TEST 3 PASSED: INSERT policy exists on profiles';
  ELSE
    RAISE EXCEPTION 'TEST 3 FAILED: INSERT policy not found on profiles';
  END IF;
END $;

-- ============================================================================
-- TEST 4: Verify UPDATE policies exist
-- ============================================================================
DO $
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies 
  WHERE schemaname = 'public' 
  AND tablename = 'profiles' 
  AND cmd = 'UPDATE';
  
  IF v_count >= 2 THEN
    RAISE NOTICE 'TEST 4 PASSED: Found % UPDATE policies on profiles', v_count;
  ELSE
    RAISE EXCEPTION 'TEST 4 FAILED: Expected at least 2 UPDATE policies, found %', v_count;
  END IF;
END $;

-- ============================================================================
-- TEST 5: Verify DELETE policy exists
-- ============================================================================
DO $
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'profiles_delete_policy'
    AND cmd = 'DELETE'
  ) INTO v_exists;
  
  IF v_exists THEN
    RAISE NOTICE 'TEST 5 PASSED: DELETE policy exists on profiles';
  ELSE
    RAISE EXCEPTION 'TEST 5 FAILED: DELETE policy not found on profiles';
  END IF;
END $;

-- ============================================================================
-- TEST 6: Admin user exists and has correct role
-- ============================================================================
DO $
DECLARE
  v_role public.user_role;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = '00000000-0000-0000-0000-000000000001';
  
  IF v_role = 'admin' THEN
    RAISE NOTICE 'TEST 6 PASSED: Admin user has admin role';
  ELSE
    RAISE EXCEPTION 'TEST 6 FAILED: Admin user role is %, expected admin', v_role;
  END IF;
END $;

-- ============================================================================
-- TEST 7: Manager user has correct cooperative_id
-- ============================================================================
DO $
DECLARE
  v_coop_id UUID;
  v_expected UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
BEGIN
  SELECT cooperative_id INTO v_coop_id
  FROM public.profiles
  WHERE id = '00000000-0000-0000-0000-000000000002';
  
  IF v_coop_id = v_expected THEN
    RAISE NOTICE 'TEST 7 PASSED: Manager user has correct cooperative_id';
  ELSE
    RAISE EXCEPTION 'TEST 7 FAILED: Manager cooperative_id is %, expected %', v_coop_id, v_expected;
  END IF;
END $;

-- ============================================================================
-- TEST 8: Viewer user is in different cooperative than manager
-- ============================================================================
DO $
DECLARE
  v_manager_coop UUID;
  v_viewer_coop UUID;
BEGIN
  SELECT cooperative_id INTO v_manager_coop
  FROM public.profiles
  WHERE id = '00000000-0000-0000-0000-000000000002';
  
  SELECT cooperative_id INTO v_viewer_coop
  FROM public.profiles
  WHERE id = '00000000-0000-0000-0000-000000000004';
  
  IF v_manager_coop != v_viewer_coop THEN
    RAISE NOTICE 'TEST 8 PASSED: Manager and viewer are in different cooperatives';
  ELSE
    RAISE EXCEPTION 'TEST 8 FAILED: Manager and viewer should be in different cooperatives';
  END IF;
END $;

-- ============================================================================
-- TEST 9: All 4 test users exist
-- ============================================================================
DO $
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.profiles
  WHERE id IN (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004'
  );
  
  IF v_count = 4 THEN
    RAISE NOTICE 'TEST 9 PASSED: All 4 test users exist';
  ELSE
    RAISE EXCEPTION 'TEST 9 FAILED: Expected 4 test users, found %', v_count;
  END IF;
END $;

-- ============================================================================
-- TEST 10: Each role type is represented
-- ============================================================================
DO $
DECLARE
  v_admin_count INTEGER;
  v_manager_count INTEGER;
  v_agent_count INTEGER;
  v_viewer_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_admin_count FROM public.profiles WHERE role = 'admin';
  SELECT COUNT(*) INTO v_manager_count FROM public.profiles WHERE role = 'manager';
  SELECT COUNT(*) INTO v_agent_count FROM public.profiles WHERE role = 'agent';
  SELECT COUNT(*) INTO v_viewer_count FROM public.profiles WHERE role = 'viewer';
  
  IF v_admin_count >= 1 AND v_manager_count >= 1 AND v_agent_count >= 1 AND v_viewer_count >= 1 THEN
    RAISE NOTICE 'TEST 10 PASSED: All role types are represented (admin:%, manager:%, agent:%, viewer:%)', 
      v_admin_count, v_manager_count, v_agent_count, v_viewer_count;
  ELSE
    RAISE EXCEPTION 'TEST 10 FAILED: Not all role types are represented';
  END IF;
END $;

-- ============================================================================
-- SUMMARY
-- ============================================================================
DO $
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'ALL RLS PROFILES TESTS PASSED SUCCESSFULLY!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $;
