-- ============================================================================
-- CocoaTrack V2 - Fix Planteurs RLS for NULL cooperative_id
-- Allows users to create/update/delete planteurs with NULL cooperative_id
-- ============================================================================

-- ============================================================================
-- 1. DROP existing RLS policies for planteurs
-- ============================================================================
DROP POLICY IF EXISTS "planteurs_select" ON public.planteurs;
DROP POLICY IF EXISTS "planteurs_insert" ON public.planteurs;
DROP POLICY IF EXISTS "planteurs_update" ON public.planteurs;
DROP POLICY IF EXISTS "planteurs_delete" ON public.planteurs;

-- ============================================================================
-- 2. CREATE new SELECT policy
-- User can see planteurs if:
--   - Planteur belongs to user's cooperative
--   - OR planteur has NULL cooperative_id AND was created by the user
--   - OR user is admin
-- ============================================================================
CREATE POLICY "planteurs_select" ON public.planteurs FOR SELECT TO authenticated
USING (
  public.can_access_cooperative(cooperative_id)
  OR (cooperative_id IS NULL AND created_by = auth.uid())
  OR public.is_admin()
);

-- ============================================================================
-- 3. CREATE new INSERT policy
-- User can create planteurs if:
--   - User is agent or above
--   - AND (planteur belongs to user's cooperative OR cooperative_id is NULL)
-- ============================================================================
CREATE POLICY "planteurs_insert" ON public.planteurs FOR INSERT TO authenticated
WITH CHECK (
  public.is_agent_or_above()
  AND (
    public.can_access_cooperative(cooperative_id)
    OR cooperative_id IS NULL
  )
);

-- ============================================================================
-- 4. CREATE new UPDATE policy
-- User can update planteurs if:
--   - User is agent or above
--   - AND planteur is accessible (same rules as SELECT)
-- ============================================================================
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

-- ============================================================================
-- 5. CREATE new DELETE policy
-- User can delete planteurs if:
--   - User is admin
--   - OR (user is agent or above AND planteur is accessible)
-- ============================================================================
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

-- ============================================================================
-- 6. Verify RLS is enabled
-- ============================================================================
ALTER TABLE public.planteurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planteurs FORCE ROW LEVEL SECURITY;
