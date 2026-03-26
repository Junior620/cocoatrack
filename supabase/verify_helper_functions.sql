-- CocoaTrack V2 - Verify Helper Functions for Storage Policies
--
-- This script verifies that the required helper functions exist
-- for the storage policies to work correctly.

-- ============================================================================
-- CHECK HELPER FUNCTIONS
-- ============================================================================

-- Check if is_admin() function exists
SELECT 
  'is_admin()' as function_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname = 'is_admin'
    ) THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname = 'is_admin'
    ) THEN 'Function exists and can be used in storage policies'
    ELSE 'Function is missing. Storage policies will fail. Create it first.'
  END as notes;

-- Check if can_access_cooperative() function exists
SELECT 
  'can_access_cooperative(uuid)' as function_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname = 'can_access_cooperative'
    ) THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname = 'can_access_cooperative'
    ) THEN 'Function exists and can be used in storage policies'
    ELSE 'Function is missing. Storage policies will fail. Create it first.'
  END as notes;

-- ============================================================================
-- CHECK PROFILES TABLE
-- ============================================================================

-- Check if profiles table exists (required for cooperative_id lookup)
SELECT 
  'profiles' as table_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
    ) THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
    ) THEN 'Table exists'
    ELSE 'Table is missing. Create it first.'
  END as notes;

-- Check if profiles table has cooperative_id column
SELECT 
  'profiles.cooperative_id' as column_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'cooperative_id'
    ) THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'cooperative_id'
    ) THEN 'Column exists'
    ELSE 'Column is missing. Add it to profiles table.'
  END as notes;

-- Check if profiles table has role column
SELECT 
  'profiles.role' as column_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'role'
    ) THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'role'
    ) THEN 'Column exists'
    ELSE 'Column is missing. Add it to profiles table.'
  END as notes;

-- ============================================================================
-- CHECK INVOICES TABLE
-- ============================================================================

-- Check if invoices table exists (required for cooperative_id lookup)
SELECT 
  'invoices' as table_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'invoices'
    ) THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'invoices'
    ) THEN 'Table exists'
    ELSE 'Table is missing. Create it first.'
  END as notes;

-- Check if invoices table has cooperative_id column
SELECT 
  'invoices.cooperative_id' as column_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'invoices'
        AND column_name = 'cooperative_id'
    ) THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END as status,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'invoices'
        AND column_name = 'cooperative_id'
    ) THEN 'Column exists'
    ELSE 'Column is missing. Add it to invoices table.'
  END as notes;

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT 
  '=== SUMMARY ===' as section,
  CASE 
    WHEN (
      SELECT COUNT(*) 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname IN ('is_admin', 'can_access_cooperative')
    ) = 2
    AND EXISTS (
      SELECT 1 
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
    )
    AND EXISTS (
      SELECT 1 
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name IN ('cooperative_id', 'role')
    )
    AND EXISTS (
      SELECT 1 
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'invoices'
    )
    AND EXISTS (
      SELECT 1 
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'invoices'
        AND column_name = 'cooperative_id'
    )
    THEN '✓ ALL REQUIREMENTS MET'
    ELSE '✗ SOME REQUIREMENTS MISSING'
  END as status,
  CASE 
    WHEN (
      SELECT COUNT(*) 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname IN ('is_admin', 'can_access_cooperative')
    ) = 2
    AND EXISTS (
      SELECT 1 
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
    )
    AND EXISTS (
      SELECT 1 
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name IN ('cooperative_id', 'role')
    )
    AND EXISTS (
      SELECT 1 
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'invoices'
    )
    AND EXISTS (
      SELECT 1 
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'invoices'
        AND column_name = 'cooperative_id'
    )
    THEN 'You can proceed with creating the storage policies'
    ELSE 'Please create the missing functions/tables/columns first'
  END as notes;

-- ============================================================================
-- EXAMPLE HELPER FUNCTIONS (if they don't exist)
-- ============================================================================

-- If the helper functions don't exist, you can create them with these examples:

/*
-- Example: is_admin() function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- Example: can_access_cooperative() function
CREATE OR REPLACE FUNCTION public.can_access_cooperative(cooperative_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND (
        role = 'admin'
        OR cooperative_id = cooperative_id_param
      )
  );
$$;

-- Example: is_manager_or_above() function (bonus)
CREATE OR REPLACE FUNCTION public.is_manager_or_above()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('manager', 'admin')
  );
$$;
*/

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. These helper functions are required for the storage policies to work.
-- 2. If any function is missing, create it before setting up storage policies.
-- 3. The functions should be SECURITY DEFINER to bypass RLS when checking permissions.
-- 4. The functions should be STABLE (not VOLATILE) for better performance.
-- 5. Make sure the profiles table has the correct structure with cooperative_id and role columns.

