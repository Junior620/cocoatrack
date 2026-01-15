-- CocoaTrack V2 - RLS Policies for Profiles Table
-- Implements Row Level Security policies for the profiles table

-- ============================================================================
-- ENABLE RLS ON PROFILES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SELECT POLICIES
-- Users can view profiles based on their role:
-- - Admin: can see all profiles
-- - Manager/Agent/Viewer: can see profiles in their own cooperative
-- ============================================================================

CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT
  USING (
    CASE
      -- Admin can see all profiles
      WHEN public.is_admin() THEN true
      -- Others can see their own profile
      WHEN id = auth.uid() THEN true
      -- Others can see profiles in their cooperative
      WHEN cooperative_id IS NOT NULL AND cooperative_id = public.get_user_cooperative_id() THEN true
      -- Admin profiles (cooperative_id IS NULL) are visible to all authenticated users
      WHEN cooperative_id IS NULL AND auth.uid() IS NOT NULL THEN true
      ELSE false
    END
  );

-- ============================================================================
-- INSERT POLICIES
-- Only system/triggers can insert profiles (via handle_new_user trigger)
-- Admin can also create profiles manually
-- ============================================================================

CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT
  WITH CHECK (
    -- User can insert their own profile (for handle_new_user trigger)
    id = auth.uid()
    -- Or admin can create any profile
    OR public.is_admin()
  );

-- ============================================================================
-- UPDATE POLICIES
-- Users can update their own profile with restrictions:
-- - Regular users can update: full_name, phone
-- - Only admin can update: role, cooperative_id, region_id, is_active
-- ============================================================================

-- Policy for users updating their own non-sensitive fields
CREATE POLICY "profiles_update_own_policy" ON public.profiles
  FOR UPDATE
  USING (
    -- User can update their own profile
    id = auth.uid()
  )
  WITH CHECK (
    -- User can only update their own profile
    id = auth.uid()
    -- Ensure sensitive fields are not changed by non-admin
    AND (
      public.is_admin()
      OR (
        -- Non-admin cannot change these fields (must remain the same)
        role = (SELECT role FROM public.profiles WHERE id = auth.uid())
        AND cooperative_id IS NOT DISTINCT FROM (SELECT cooperative_id FROM public.profiles WHERE id = auth.uid())
        AND region_id IS NOT DISTINCT FROM (SELECT region_id FROM public.profiles WHERE id = auth.uid())
        AND is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid())
      )
    )
  );

-- Policy for admin updating any profile
CREATE POLICY "profiles_update_admin_policy" ON public.profiles
  FOR UPDATE
  USING (
    public.is_admin()
  )
  WITH CHECK (
    public.is_admin()
  );

-- ============================================================================
-- DELETE POLICIES
-- Only admin can delete profiles
-- ============================================================================

CREATE POLICY "profiles_delete_policy" ON public.profiles
  FOR DELETE
  USING (
    public.is_admin()
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON POLICY "profiles_select_policy" ON public.profiles IS 
  'Users can view profiles in their scope: admin sees all, others see own cooperative';

COMMENT ON POLICY "profiles_insert_policy" ON public.profiles IS 
  'Profiles are created by handle_new_user trigger or admin';

COMMENT ON POLICY "profiles_update_own_policy" ON public.profiles IS 
  'Users can update their own profile but cannot change role, cooperative_id, region_id, or is_active';

COMMENT ON POLICY "profiles_update_admin_policy" ON public.profiles IS 
  'Admin can update any profile including sensitive fields';

COMMENT ON POLICY "profiles_delete_policy" ON public.profiles IS 
  'Only admin can delete profiles';
