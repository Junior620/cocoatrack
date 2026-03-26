-- Fix deliveries SELECT RLS to show deliveries with NULL cooperative_id
-- Deliveries imported via receipts may have cooperative_id = NULL

DROP POLICY IF EXISTS "deliveries_select_policy" ON public.deliveries;

CREATE POLICY "deliveries_select_policy" ON public.deliveries
  FOR SELECT
  USING (
    CASE
      -- Admin can see all deliveries
      WHEN public.is_admin() THEN true
      -- Others can see deliveries in their cooperative
      WHEN public.can_access_cooperative(cooperative_id) THEN true
      -- Also show deliveries with NULL cooperative_id if user is manager or above
      -- (imported deliveries that haven't been assigned a cooperative yet)
      WHEN cooperative_id IS NULL AND public.is_manager_or_above() THEN true
      ELSE false
    END
  );
