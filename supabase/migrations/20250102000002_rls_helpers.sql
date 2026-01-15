-- CocoaTrack V2 - RLS Helper Functions
-- Safe helper functions for Row Level Security policies

-- ============================================================================
-- GET USER ROLE
-- Returns the role of the current authenticated user
-- Falls back to 'viewer' if no profile exists (safe default)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  -- Safe fallback: if no profile exists, return 'viewer' (most restrictive)
  RETURN COALESCE(v_role, 'viewer'::public.user_role);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GET USER COOPERATIVE ID
-- Returns the cooperative_id of the current authenticated user
-- Returns NULL for admin users (they have access to all cooperatives)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_cooperative_id()
RETURNS UUID
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_cooperative_id UUID;
BEGIN
  SELECT cooperative_id INTO v_cooperative_id
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN v_cooperative_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GET USER REGION ID
-- Returns the region_id of the current authenticated user
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_region_id()
RETURNS UUID
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_region_id UUID;
BEGIN
  SELECT region_id INTO v_region_id
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN v_region_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- IS ADMIN
-- Returns true if the current user is an admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.get_user_role() = 'admin'::public.user_role;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- IS MANAGER OR ABOVE
-- Returns true if the current user is a manager or admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_manager_or_above()
RETURNS BOOLEAN
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.get_user_role() IN ('admin'::public.user_role, 'manager'::public.user_role);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- IS AGENT OR ABOVE
-- Returns true if the current user is an agent, manager, or admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_agent_or_above()
RETURNS BOOLEAN
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.get_user_role() IN ('admin'::public.user_role, 'manager'::public.user_role, 'agent'::public.user_role);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CAN ACCESS COOPERATIVE
-- Returns true if the current user can access data for the given cooperative
-- Admin can access all, others can only access their own cooperative
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_access_cooperative(p_cooperative_id UUID)
RETURNS BOOLEAN
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Admin can access all cooperatives
  IF public.is_admin() THEN
    RETURN true;
  END IF;
  
  -- Others can only access their own cooperative
  RETURN public.get_user_cooperative_id() = p_cooperative_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GET USER PROFILE
-- Returns the full profile of the current authenticated user
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS public.profiles
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid();
  
  RETURN v_profile;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION public.get_user_role() IS 'Returns the role of the current authenticated user, defaults to viewer if no profile exists';
COMMENT ON FUNCTION public.get_user_cooperative_id() IS 'Returns the cooperative_id of the current authenticated user';
COMMENT ON FUNCTION public.get_user_region_id() IS 'Returns the region_id of the current authenticated user';
COMMENT ON FUNCTION public.is_admin() IS 'Returns true if the current user is an admin';
COMMENT ON FUNCTION public.is_manager_or_above() IS 'Returns true if the current user is a manager or admin';
COMMENT ON FUNCTION public.is_agent_or_above() IS 'Returns true if the current user is an agent, manager, or admin';
COMMENT ON FUNCTION public.can_access_cooperative(UUID) IS 'Returns true if the current user can access data for the given cooperative';
COMMENT ON FUNCTION public.get_current_user_profile() IS 'Returns the full profile of the current authenticated user';
