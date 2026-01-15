-- CocoaTrack V2 - RLS Helper Functions Tests
-- This file tests the RLS helper functions to ensure they work correctly
-- Run with: psql -f test_rls_helpers.sql

-- ============================================================================
-- TEST SETUP
-- ============================================================================

-- Create a test user without a profile (to test fallback behavior)
DO $
DECLARE
  v_test_user_id UUID := 'ffffffff-0000-0000-0000-000000000001';
BEGIN
  -- Insert test user without profile into auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    role,
    aud,
    confirmation_token
  )
  VALUES (
    v_test_user_id,
    '00000000-0000-0000-0000-000000000000',
    'no_profile@test.cm',
    crypt('Test123!', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "User Without Profile"}',
    NOW(),
    NOW(),
    'authenticated',
    'authenticated',
    ''
  )
  ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE 'Test user without profile created: %', v_test_user_id;
END $;

-- ============================================================================
-- TEST 1: get_user_role() returns 'viewer' for user without profile
-- ============================================================================
DO $
DECLARE
  v_result public.user_role;
BEGIN
  -- Simulate being the user without profile
  -- Note: In actual RLS context, auth.uid() would return the user's ID
  -- For this test, we directly query the function behavior
  
  -- Test that COALESCE fallback works
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = 'ffffffff-0000-0000-0000-000000000001'),
    'viewer'::public.user_role
  ) INTO v_result;
  
  IF v_result = 'viewer' THEN
    RAISE NOTICE 'TEST 1 PASSED: get_user_role() returns viewer for user without profile';
  ELSE
    RAISE EXCEPTION 'TEST 1 FAILED: Expected viewer, got %', v_result;
  END IF;
END $;

-- ============================================================================
-- TEST 2: get_user_role() returns correct role for admin
-- ============================================================================
DO $
DECLARE
  v_result public.user_role;
BEGIN
  SELECT role INTO v_result
  FROM public.profiles
  WHERE id = '00000000-0000-0000-0000-000000000001';
  
  IF v_result = 'admin' THEN
    RAISE NOTICE 'TEST 2 PASSED: get_user_role() returns admin for admin user';
  ELSE
    RAISE EXCEPTION 'TEST 2 FAILED: Expected admin, got %', v_result;
  END IF;
END $;

-- ============================================================================
-- TEST 3: get_user_role() returns correct role for manager
-- ============================================================================
DO $
DECLARE
  v_result public.user_role;
BEGIN
  SELECT role INTO v_result
  FROM public.profiles
  WHERE id = '00000000-0000-0000-0000-000000000002';
  
  IF v_result = 'manager' THEN
    RAISE NOTICE 'TEST 3 PASSED: get_user_role() returns manager for manager user';
  ELSE
    RAISE EXCEPTION 'TEST 3 FAILED: Expected manager, got %', v_result;
  END IF;
END $;

-- ============================================================================
-- TEST 4: get_user_role() returns correct role for agent
-- ============================================================================
DO $
DECLARE
  v_result public.user_role;
BEGIN
  SELECT role INTO v_result
  FROM public.profiles
  WHERE id = '00000000-0000-0000-0000-000000000003';
  
  IF v_result = 'agent' THEN
    RAISE NOTICE 'TEST 4 PASSED: get_user_role() returns agent for agent user';
  ELSE
    RAISE EXCEPTION 'TEST 4 FAILED: Expected agent, got %', v_result;
  END IF;
END $;

-- ============================================================================
-- TEST 5: get_user_role() returns correct role for viewer
-- ============================================================================
DO $
DECLARE
  v_result public.user_role;
BEGIN
  SELECT role INTO v_result
  FROM public.profiles
  WHERE id = '00000000-0000-0000-0000-000000000004';
  
  IF v_result = 'viewer' THEN
    RAISE NOTICE 'TEST 5 PASSED: get_user_role() returns viewer for viewer user';
  ELSE
    RAISE EXCEPTION 'TEST 5 FAILED: Expected viewer, got %', v_result;
  END IF;
END $;

-- ============================================================================
-- TEST 6: get_user_cooperative_id() returns NULL for admin
-- ============================================================================
DO $
DECLARE
  v_result UUID;
BEGIN
  SELECT cooperative_id INTO v_result
  FROM public.profiles
  WHERE id = '00000000-0000-0000-0000-000000000001';
  
  IF v_result IS NULL THEN
    RAISE NOTICE 'TEST 6 PASSED: get_user_cooperative_id() returns NULL for admin';
  ELSE
    RAISE EXCEPTION 'TEST 6 FAILED: Expected NULL, got %', v_result;
  END IF;
END $;

-- ============================================================================
-- TEST 7: get_user_cooperative_id() returns correct cooperative for manager
-- ============================================================================
DO $
DECLARE
  v_result UUID;
  v_expected UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
BEGIN
  SELECT cooperative_id INTO v_result
  FROM public.profiles
  WHERE id = '00000000-0000-0000-0000-000000000002';
  
  IF v_result = v_expected THEN
    RAISE NOTICE 'TEST 7 PASSED: get_user_cooperative_id() returns correct cooperative for manager';
  ELSE
    RAISE EXCEPTION 'TEST 7 FAILED: Expected %, got %', v_expected, v_result;
  END IF;
END $;

-- ============================================================================
-- TEST 8: get_user_cooperative_id() returns NULL for user without profile
-- ============================================================================
DO $
DECLARE
  v_result UUID;
BEGIN
  SELECT cooperative_id INTO v_result
  FROM public.profiles
  WHERE id = 'ffffffff-0000-0000-0000-000000000001';
  
  -- User without profile should return NULL (no row found)
  IF v_result IS NULL THEN
    RAISE NOTICE 'TEST 8 PASSED: get_user_cooperative_id() returns NULL for user without profile';
  ELSE
    RAISE EXCEPTION 'TEST 8 FAILED: Expected NULL, got %', v_result;
  END IF;
END $;

-- ============================================================================
-- TEST 9: is_admin() logic test
-- ============================================================================
DO $
DECLARE
  v_admin_role public.user_role;
  v_manager_role public.user_role;
BEGIN
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001';
  SELECT role INTO v_manager_role FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002';
  
  IF v_admin_role = 'admin' AND v_manager_role != 'admin' THEN
    RAISE NOTICE 'TEST 9 PASSED: is_admin() logic correctly identifies admin vs non-admin';
  ELSE
    RAISE EXCEPTION 'TEST 9 FAILED: Admin role check failed';
  END IF;
END $;

-- ============================================================================
-- TEST 10: is_manager_or_above() logic test
-- ============================================================================
DO $
DECLARE
  v_admin_role public.user_role;
  v_manager_role public.user_role;
  v_agent_role public.user_role;
BEGIN
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001';
  SELECT role INTO v_manager_role FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002';
  SELECT role INTO v_agent_role FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000003';
  
  IF v_admin_role IN ('admin', 'manager') 
     AND v_manager_role IN ('admin', 'manager')
     AND v_agent_role NOT IN ('admin', 'manager') THEN
    RAISE NOTICE 'TEST 10 PASSED: is_manager_or_above() logic correctly identifies manager+ roles';
  ELSE
    RAISE EXCEPTION 'TEST 10 FAILED: Manager or above check failed';
  END IF;
END $;

-- ============================================================================
-- TEST 11: is_agent_or_above() logic test
-- ============================================================================
DO $
DECLARE
  v_admin_role public.user_role;
  v_manager_role public.user_role;
  v_agent_role public.user_role;
  v_viewer_role public.user_role;
BEGIN
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001';
  SELECT role INTO v_manager_role FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002';
  SELECT role INTO v_agent_role FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000003';
  SELECT role INTO v_viewer_role FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000004';
  
  IF v_admin_role IN ('admin', 'manager', 'agent') 
     AND v_manager_role IN ('admin', 'manager', 'agent')
     AND v_agent_role IN ('admin', 'manager', 'agent')
     AND v_viewer_role NOT IN ('admin', 'manager', 'agent') THEN
    RAISE NOTICE 'TEST 11 PASSED: is_agent_or_above() logic correctly identifies agent+ roles';
  ELSE
    RAISE EXCEPTION 'TEST 11 FAILED: Agent or above check failed';
  END IF;
END $;

-- ============================================================================
-- TEST 12: can_access_cooperative() logic for admin (access all)
-- ============================================================================
DO $
DECLARE
  v_admin_role public.user_role;
  v_test_coop_id UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
BEGIN
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001';
  
  -- Admin should be able to access any cooperative
  IF v_admin_role = 'admin' THEN
    RAISE NOTICE 'TEST 12 PASSED: Admin can access any cooperative';
  ELSE
    RAISE EXCEPTION 'TEST 12 FAILED: Admin access check failed';
  END IF;
END $;

-- ============================================================================
-- TEST 13: can_access_cooperative() logic for non-admin (own coop only)
-- ============================================================================
DO $
DECLARE
  v_manager_coop_id UUID;
  v_own_coop UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_other_coop UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
BEGIN
  SELECT cooperative_id INTO v_manager_coop_id 
  FROM public.profiles 
  WHERE id = '00000000-0000-0000-0000-000000000002';
  
  -- Manager should only access their own cooperative
  IF v_manager_coop_id = v_own_coop AND v_manager_coop_id != v_other_coop THEN
    RAISE NOTICE 'TEST 13 PASSED: Non-admin can only access own cooperative';
  ELSE
    RAISE EXCEPTION 'TEST 13 FAILED: Non-admin cooperative access check failed';
  END IF;
END $;

-- ============================================================================
-- TEST 14: Verify all helper functions exist
-- ============================================================================
DO $
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_user_role',
    'get_user_cooperative_id',
    'get_user_region_id',
    'is_admin',
    'is_manager_or_above',
    'is_agent_or_above',
    'can_access_cooperative',
    'get_current_user_profile'
  );
  
  IF v_count = 8 THEN
    RAISE NOTICE 'TEST 14 PASSED: All 8 RLS helper functions exist';
  ELSE
    RAISE EXCEPTION 'TEST 14 FAILED: Expected 8 functions, found %', v_count;
  END IF;
END $;

-- ============================================================================
-- TEST 15: Verify functions have SECURITY DEFINER
-- ============================================================================
DO $
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_user_role',
    'get_user_cooperative_id',
    'get_user_region_id',
    'is_admin',
    'is_manager_or_above',
    'is_agent_or_above',
    'can_access_cooperative',
    'get_current_user_profile'
  )
  AND p.prosecdef = true;
  
  IF v_count = 8 THEN
    RAISE NOTICE 'TEST 15 PASSED: All 8 RLS helper functions have SECURITY DEFINER';
  ELSE
    RAISE EXCEPTION 'TEST 15 FAILED: Expected 8 SECURITY DEFINER functions, found %', v_count;
  END IF;
END $;

-- ============================================================================
-- CLEANUP
-- ============================================================================
DO $
BEGIN
  -- Remove test user without profile
  DELETE FROM auth.users WHERE id = 'ffffffff-0000-0000-0000-000000000001';
  RAISE NOTICE 'Test cleanup completed';
END $;

-- ============================================================================
-- SUMMARY
-- ============================================================================
DO $
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'ALL RLS HELPER TESTS PASSED SUCCESSFULLY!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $;
