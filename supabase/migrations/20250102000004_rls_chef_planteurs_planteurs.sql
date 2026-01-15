-- CocoaTrack V2 - RLS Policies for Chef Planteurs and Planteurs Tables
-- Implements Row Level Security policies and triggers for data integrity

-- ============================================================================
-- ENABLE RLS ON TABLES
-- ============================================================================
ALTER TABLE public.chef_planteurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planteurs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ADDITIONAL INDEXES FOR SEARCH AND FILTERING
-- ============================================================================

-- Indexes for name-based filtering (cooperative_id, name)
CREATE INDEX IF NOT EXISTS idx_chef_planteurs_cooperative_name 
  ON public.chef_planteurs(cooperative_id, name);
CREATE INDEX IF NOT EXISTS idx_planteurs_cooperative_name 
  ON public.planteurs(cooperative_id, name);

-- ============================================================================
-- TRIGGER: SYNC COOPERATIVE_ID FROM CHEF_PLANTEUR TO PLANTEUR
-- Ensures planteurs always have the same cooperative_id as their chef_planteur
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_planteur_cooperative_id()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  v_chef_cooperative_id UUID;
BEGIN
  -- Get the cooperative_id from the chef_planteur
  SELECT cooperative_id INTO v_chef_cooperative_id
  FROM public.chef_planteurs
  WHERE id = NEW.chef_planteur_id;
  
  -- Validate that chef_planteur exists
  IF v_chef_cooperative_id IS NULL THEN
    RAISE EXCEPTION 'Chef planteur with id % does not exist', NEW.chef_planteur_id;
  END IF;
  
  -- Set the cooperative_id to match the chef_planteur
  NEW.cooperative_id := v_chef_cooperative_id;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Apply trigger on INSERT and UPDATE
CREATE TRIGGER sync_planteur_cooperative_id_trigger
  BEFORE INSERT OR UPDATE OF chef_planteur_id ON public.planteurs
  FOR EACH ROW EXECUTE FUNCTION public.sync_planteur_cooperative_id();

-- ============================================================================
-- CHEF_PLANTEURS RLS POLICIES
-- ============================================================================

-- SELECT: Users can view chef_planteurs based on their role
CREATE POLICY "chef_planteurs_select_policy" ON public.chef_planteurs
  FOR SELECT
  USING (
    CASE
      -- Admin can see all chef_planteurs
      WHEN public.is_admin() THEN true
      -- Others can see chef_planteurs in their cooperative
      WHEN public.can_access_cooperative(cooperative_id) THEN true
      ELSE false
    END
  );

-- INSERT: Agents and above can create chef_planteurs
CREATE POLICY "chef_planteurs_insert_policy" ON public.chef_planteurs
  FOR INSERT
  WITH CHECK (
    -- Must be agent or above
    public.is_agent_or_above()
    -- Must set created_by to current user
    AND created_by = auth.uid()
    -- Admin can create for any cooperative, others only for their own
    AND (
      public.is_admin()
      OR cooperative_id = public.get_user_cooperative_id()
    )
  );

-- UPDATE: Users can update chef_planteurs with restrictions
CREATE POLICY "chef_planteurs_update_policy" ON public.chef_planteurs
  FOR UPDATE
  USING (
    CASE
      -- Admin can update any chef_planteur
      WHEN public.is_admin() THEN true
      -- Manager can update chef_planteurs in their cooperative
      WHEN public.get_user_role() = 'manager' 
        AND public.can_access_cooperative(cooperative_id) THEN true
      -- Agent can update chef_planteurs they created (in their cooperative)
      WHEN public.get_user_role() = 'agent' 
        AND public.can_access_cooperative(cooperative_id)
        AND created_by = auth.uid() THEN true
      ELSE false
    END
  )
  WITH CHECK (
    -- Ensure cooperative_id stays in scope after update
    CASE
      WHEN public.is_admin() THEN true
      WHEN public.get_user_role() IN ('manager', 'agent') 
        AND public.can_access_cooperative(cooperative_id) THEN true
      ELSE false
    END
  );

-- DELETE: Only admin can delete chef_planteurs
CREATE POLICY "chef_planteurs_delete_policy" ON public.chef_planteurs
  FOR DELETE
  USING (
    public.is_admin()
  );

-- ============================================================================
-- PLANTEURS RLS POLICIES
-- ============================================================================

-- SELECT: Users can view planteurs based on their role
CREATE POLICY "planteurs_select_policy" ON public.planteurs
  FOR SELECT
  USING (
    CASE
      -- Admin can see all planteurs
      WHEN public.is_admin() THEN true
      -- Others can see planteurs in their cooperative
      WHEN public.can_access_cooperative(cooperative_id) THEN true
      ELSE false
    END
  );

-- INSERT: Agents and above can create planteurs
CREATE POLICY "planteurs_insert_policy" ON public.planteurs
  FOR INSERT
  WITH CHECK (
    -- Must be agent or above
    public.is_agent_or_above()
    -- Must set created_by to current user
    AND created_by = auth.uid()
    -- The chef_planteur must be in user's cooperative (or admin)
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.chef_planteurs cp
        WHERE cp.id = chef_planteur_id
        AND cp.cooperative_id = public.get_user_cooperative_id()
      )
    )
  );

-- UPDATE: Users can update planteurs with restrictions
CREATE POLICY "planteurs_update_policy" ON public.planteurs
  FOR UPDATE
  USING (
    CASE
      -- Admin can update any planteur
      WHEN public.is_admin() THEN true
      -- Manager can update planteurs in their cooperative
      WHEN public.get_user_role() = 'manager' 
        AND public.can_access_cooperative(cooperative_id) THEN true
      -- Agent can update planteurs they created (in their cooperative)
      WHEN public.get_user_role() = 'agent' 
        AND public.can_access_cooperative(cooperative_id)
        AND created_by = auth.uid() THEN true
      ELSE false
    END
  )
  WITH CHECK (
    -- Ensure the new chef_planteur is in user's scope
    CASE
      WHEN public.is_admin() THEN true
      WHEN public.get_user_role() IN ('manager', 'agent') THEN
        EXISTS (
          SELECT 1 FROM public.chef_planteurs cp
          WHERE cp.id = chef_planteur_id
          AND public.can_access_cooperative(cp.cooperative_id)
        )
      ELSE false
    END
  );

-- DELETE: Only admin can delete planteurs (soft delete via is_active is preferred)
CREATE POLICY "planteurs_delete_policy" ON public.planteurs
  FOR DELETE
  USING (
    public.is_admin()
  );

-- ============================================================================
-- VALIDATION WORKFLOW FUNCTIONS
-- ============================================================================

-- Function to validate a chef_planteur
CREATE OR REPLACE FUNCTION public.validate_chef_planteur(
  p_chef_planteur_id UUID,
  p_validated_by UUID DEFAULT NULL
)
RETURNS public.chef_planteurs
SECURITY DEFINER
SET search_path = public, auth
AS $
DECLARE
  v_result public.chef_planteurs;
  v_validator_id UUID;
BEGIN
  -- Use provided validator or current user
  v_validator_id := COALESCE(p_validated_by, auth.uid());
  
  -- Check if user has permission to validate
  IF NOT public.is_manager_or_above() THEN
    RAISE EXCEPTION 'Only managers and admins can validate chef_planteurs';
  END IF;
  
  -- Update the chef_planteur
  UPDATE public.chef_planteurs
  SET 
    validation_status = 'validated',
    validated_by = v_validator_id,
    validated_at = NOW(),
    rejection_reason = NULL
  WHERE id = p_chef_planteur_id
    AND (public.is_admin() OR cooperative_id = public.get_user_cooperative_id())
  RETURNING * INTO v_result;
  
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Chef planteur not found or access denied';
  END IF;
  
  RETURN v_result;
END;
$ LANGUAGE plpgsql;

-- Function to reject a chef_planteur
CREATE OR REPLACE FUNCTION public.reject_chef_planteur(
  p_chef_planteur_id UUID,
  p_rejection_reason TEXT,
  p_rejected_by UUID DEFAULT NULL
)
RETURNS public.chef_planteurs
SECURITY DEFINER
SET search_path = public, auth
AS $
DECLARE
  v_result public.chef_planteurs;
  v_rejector_id UUID;
BEGIN
  -- Use provided rejector or current user
  v_rejector_id := COALESCE(p_rejected_by, auth.uid());
  
  -- Check if user has permission to reject
  IF NOT public.is_manager_or_above() THEN
    RAISE EXCEPTION 'Only managers and admins can reject chef_planteurs';
  END IF;
  
  -- Validate rejection reason
  IF p_rejection_reason IS NULL OR trim(p_rejection_reason) = '' THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;
  
  -- Update the chef_planteur
  UPDATE public.chef_planteurs
  SET 
    validation_status = 'rejected',
    validated_by = v_rejector_id,
    validated_at = NOW(),
    rejection_reason = p_rejection_reason
  WHERE id = p_chef_planteur_id
    AND (public.is_admin() OR cooperative_id = public.get_user_cooperative_id())
  RETURNING * INTO v_result;
  
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Chef planteur not found or access denied';
  END IF;
  
  RETURN v_result;
END;
$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.sync_planteur_cooperative_id() IS 
  'Automatically syncs cooperative_id from chef_planteur to planteur';

COMMENT ON POLICY "chef_planteurs_select_policy" ON public.chef_planteurs IS 
  'Users can view chef_planteurs in their scope: admin sees all, others see own cooperative';

COMMENT ON POLICY "chef_planteurs_insert_policy" ON public.chef_planteurs IS 
  'Agents and above can create chef_planteurs in their cooperative';

COMMENT ON POLICY "chef_planteurs_update_policy" ON public.chef_planteurs IS 
  'Admin can update any, manager can update own coop, agent can update own created';

COMMENT ON POLICY "chef_planteurs_delete_policy" ON public.chef_planteurs IS 
  'Only admin can delete chef_planteurs';

COMMENT ON POLICY "planteurs_select_policy" ON public.planteurs IS 
  'Users can view planteurs in their scope: admin sees all, others see own cooperative';

COMMENT ON POLICY "planteurs_insert_policy" ON public.planteurs IS 
  'Agents and above can create planteurs for chef_planteurs in their cooperative';

COMMENT ON POLICY "planteurs_update_policy" ON public.planteurs IS 
  'Admin can update any, manager can update own coop, agent can update own created';

COMMENT ON POLICY "planteurs_delete_policy" ON public.planteurs IS 
  'Only admin can delete planteurs (prefer soft delete via is_active)';

COMMENT ON FUNCTION public.validate_chef_planteur(UUID, UUID) IS 
  'Validates a chef_planteur, setting status to validated with timestamp';

COMMENT ON FUNCTION public.reject_chef_planteur(UUID, TEXT, UUID) IS 
  'Rejects a chef_planteur with a required reason';
