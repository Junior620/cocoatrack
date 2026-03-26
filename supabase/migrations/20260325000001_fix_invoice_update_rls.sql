-- Fix invoice UPDATE RLS policy to handle NULL cooperative_id
-- and detect silent failures when 0 rows are updated

DROP POLICY IF EXISTS "invoices_update_policy" ON public.invoices;

CREATE POLICY "invoices_update_policy" ON public.invoices
  FOR UPDATE
  USING (
    CASE
      WHEN public.is_admin() THEN true
      WHEN public.is_manager_or_above()
        AND (
          cooperative_id IS NULL
          OR public.can_access_cooperative(cooperative_id)
        ) THEN true
      ELSE false
    END
  )
  WITH CHECK (
    CASE
      WHEN public.is_admin() THEN true
      WHEN public.is_manager_or_above() THEN
        cooperative_id IS NULL
        OR cooperative_id = public.get_user_cooperative_id()
      ELSE false
    END
  );
