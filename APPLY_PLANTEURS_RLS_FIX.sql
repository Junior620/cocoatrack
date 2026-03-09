-- ============================================================================
-- APPLY THIS IN SUPABASE SQL EDITOR
-- Fix Planteurs RLS for NULL cooperative_id
-- ============================================================================

-- 1. DROP existing RLS policies for planteurs
DROP POLICY IF EXISTS "planteurs_select" ON public.planteurs;
DROP POLICY IF EXISTS "planteurs_insert" ON public.planteurs;
DROP POLICY IF EXISTS "planteurs_update" ON public.planteurs;
DROP POLICY IF EXISTS "planteurs_delete" ON public.planteurs;

-- 2. CREATE new SELECT policy
CREATE POLICY "planteurs_select" ON public.planteurs FOR SELECT TO authenticated
USING (
  public.can_access_cooperative(cooperative_id)
  OR (cooperative_id IS NULL AND created_by = auth.uid())
  OR public.is_admin()
);

-- 3. CREATE new INSERT policy
CREATE POLICY "planteurs_insert" ON public.planteurs FOR INSERT TO authenticated
WITH CHECK (
  public.is_agent_or_above()
  AND (
    public.can_access_cooperative(cooperative_id)
    OR cooperative_id IS NULL
  )
);

-- 4. CREATE new UPDATE policy
CREATE POLICY "planteurs_update" ON public.planteurs FOR UPDATE TO authenticated
USING (
  public.is_agent_or_above()
  AND (
    public.can_access_cooperative(cooperative_id)
    OR (cooperative_id IS NULL AND created_by = auth.uid())
    OR public.is_admin()
  )
)
WITH CHECK (
  public.is_agent_or_above()
  AND (
    public.can_access_cooperative(cooperative_id)
    OR cooperative_id IS NULL
  )
);

-- 5. CREATE new DELETE policy
CREATE POLICY "planteurs_delete" ON public.planteurs FOR DELETE TO authenticated
USING (
  public.is_admin()
  OR (
    public.is_agent_or_above()
    AND (
      public.can_access_cooperative(cooperative_id)
      OR (cooperative_id IS NULL AND created_by = auth.uid())
    )
  )
);

-- 6. Verify RLS is enabled
ALTER TABLE public.planteurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planteurs FORCE ROW LEVEL SECURITY;

-- 7. Verify the changes
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
