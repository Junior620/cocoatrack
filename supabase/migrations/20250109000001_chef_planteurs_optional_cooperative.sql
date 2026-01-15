-- Migration: Make cooperative_id optional for chef_planteurs
-- A chef_planteur can belong to a cooperative OR be independent

-- Step 1: Drop the NOT NULL constraint on cooperative_id
ALTER TABLE public.chef_planteurs 
  ALTER COLUMN cooperative_id DROP NOT NULL;

-- Step 2: Update RLS policies to handle NULL cooperative_id
-- Chef planteurs without cooperative can be viewed by all authenticated users
-- but can only be modified by admins

-- Drop existing policies
DROP POLICY IF EXISTS "chef_planteurs_select_policy" ON public.chef_planteurs;
DROP POLICY IF EXISTS "chef_planteurs_insert_policy" ON public.chef_planteurs;
DROP POLICY IF EXISTS "chef_planteurs_update_policy" ON public.chef_planteurs;
DROP POLICY IF EXISTS "chef_planteurs_delete_policy" ON public.chef_planteurs;

-- Recreate policies with NULL cooperative_id handling
CREATE POLICY "chef_planteurs_select_policy" ON public.chef_planteurs FOR SELECT TO authenticated USING (
  CASE 
    WHEN public.is_admin() THEN true
    WHEN cooperative_id IS NULL THEN true  -- Independent chef_planteurs visible to all
    WHEN public.can_access_cooperative(cooperative_id) THEN true
    ELSE false 
  END
);

CREATE POLICY "chef_planteurs_insert_policy" ON public.chef_planteurs FOR INSERT TO authenticated WITH CHECK (
  public.is_agent_or_above() 
  AND created_by = auth.uid() 
  AND (
    public.is_admin() 
    OR cooperative_id IS NULL  -- Allow creating independent chef_planteurs
    OR cooperative_id = public.get_user_cooperative_id()
  )
);

CREATE POLICY "chef_planteurs_update_policy" ON public.chef_planteurs FOR UPDATE TO authenticated USING (
  CASE 
    WHEN public.is_admin() THEN true
    WHEN public.get_user_role() = 'manager' AND (cooperative_id IS NULL OR public.can_access_cooperative(cooperative_id)) THEN true
    WHEN public.get_user_role() = 'agent' AND (cooperative_id IS NULL OR public.can_access_cooperative(cooperative_id)) AND created_by = auth.uid() THEN true
    ELSE false 
  END
) WITH CHECK (
  CASE 
    WHEN public.is_admin() THEN true
    WHEN public.get_user_role() IN ('manager', 'agent') AND (cooperative_id IS NULL OR cooperative_id = public.get_user_cooperative_id()) THEN true
    ELSE false 
  END
);

CREATE POLICY "chef_planteurs_delete_policy" ON public.chef_planteurs FOR DELETE TO authenticated USING (
  public.is_admin()
);

-- Add comment explaining the change
COMMENT ON COLUMN public.chef_planteurs.cooperative_id IS 'Optional: Chef planteur can be independent (NULL) or belong to a cooperative';
