-- Migration: Internal App - Full Visibility for All Authenticated Users
-- Description: Since this is an internal application, all authenticated users
--              should be able to see all planteurs and parcelles regardless of
--              cooperative assignment. This simplifies the RLS policies.
-- Date: 2026-04-19

-- ============================================================================
-- DROP EXISTING RESTRICTIVE POLICIES
-- ============================================================================

-- Drop existing planteurs policies
DROP POLICY IF EXISTS "planteurs_select" ON public.planteurs;
DROP POLICY IF EXISTS "planteurs_insert" ON public.planteurs;
DROP POLICY IF EXISTS "planteurs_update" ON public.planteurs;
DROP POLICY IF EXISTS "planteurs_delete" ON public.planteurs;

-- Drop existing parcelles policies
DROP POLICY IF EXISTS "parcelles_select" ON public.parcelles;
DROP POLICY IF EXISTS "parcelles_insert" ON public.parcelles;
DROP POLICY IF EXISTS "parcelles_update" ON public.parcelles;
DROP POLICY IF EXISTS "parcelles_delete" ON public.parcelles;

-- ============================================================================
-- CREATE NEW SIMPLIFIED POLICIES FOR PLANTEURS
-- ============================================================================

-- All authenticated users can view all planteurs (internal app)
CREATE POLICY "planteurs_select_internal"
ON public.planteurs
FOR SELECT
TO authenticated
USING (true);

-- All authenticated users can insert planteurs
CREATE POLICY "planteurs_insert_internal"
ON public.planteurs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- All authenticated users can update planteurs
CREATE POLICY "planteurs_update_internal"
ON public.planteurs
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Only admins can delete planteurs
CREATE POLICY "planteurs_delete_internal"
ON public.planteurs
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ============================================================================
-- CREATE NEW SIMPLIFIED POLICIES FOR PARCELLES
-- ============================================================================

-- All authenticated users can view all parcelles (internal app)
CREATE POLICY "parcelles_select_internal"
ON public.parcelles
FOR SELECT
TO authenticated
USING (true);

-- All authenticated users can insert parcelles
CREATE POLICY "parcelles_insert_internal"
ON public.parcelles
FOR INSERT
TO authenticated
WITH CHECK (true);

-- All authenticated users can update parcelles
CREATE POLICY "parcelles_update_internal"
ON public.parcelles
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Only admins can delete parcelles
CREATE POLICY "parcelles_delete_internal"
ON public.parcelles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ============================================================================
-- VERIFY POLICIES
-- ============================================================================

-- List all policies for planteurs
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

-- List all policies for parcelles
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
WHERE tablename = 'parcelles'
ORDER BY policyname;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "planteurs_select_internal" ON public.planteurs IS
'Internal app: All authenticated users can view all planteurs regardless of cooperative';

COMMENT ON POLICY "planteurs_insert_internal" ON public.planteurs IS
'Internal app: All authenticated users can create planteurs';

COMMENT ON POLICY "planteurs_update_internal" ON public.planteurs IS
'Internal app: All authenticated users can update planteurs';

COMMENT ON POLICY "planteurs_delete_internal" ON public.planteurs IS
'Internal app: Only admins can delete planteurs';

COMMENT ON POLICY "parcelles_select_internal" ON public.parcelles IS
'Internal app: All authenticated users can view all parcelles regardless of cooperative';

COMMENT ON POLICY "parcelles_insert_internal" ON public.parcelles IS
'Internal app: All authenticated users can create parcelles';

COMMENT ON POLICY "parcelles_update_internal" ON public.parcelles IS
'Internal app: All authenticated users can update parcelles';

COMMENT ON POLICY "parcelles_delete_internal" ON public.parcelles IS
'Internal app: Only admins can delete parcelles';
