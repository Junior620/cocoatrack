-- ============================================================================
-- CocoaTrack V2 - Fix RLS for NULL cooperative_id
-- Allows users to access their own data when cooperative_id is NULL
-- ============================================================================

-- ============================================================================
-- 1. Update can_access_cooperative to handle NULL cooperative_id
-- If both user's cooperative_id and target cooperative_id are NULL,
-- we need to check created_by instead (handled in RLS policies)
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
  
  -- If target cooperative_id is NULL, return false
  -- (access to NULL cooperative data is handled separately in RLS via created_by)
  IF p_cooperative_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Others can only access their own cooperative
  RETURN public.get_user_cooperative_id() = p_cooperative_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. DROP existing RLS policies for parcelles
-- ============================================================================
DROP POLICY IF EXISTS "parcelles_select" ON public.parcelles;
DROP POLICY IF EXISTS "parcelles_insert" ON public.parcelles;
DROP POLICY IF EXISTS "parcelles_update" ON public.parcelles;

-- ============================================================================
-- 3. CREATE new SELECT policy with created_by fallback
-- User can see parcelles if:
--   - Parcelle is assigned AND planteur belongs to user's cooperative
--   - OR parcelle is orphan AND import_file belongs to user's cooperative
--   - OR parcelle was created by the user (for NULL cooperative cases)
-- ============================================================================
CREATE POLICY "parcelles_select" ON public.parcelles FOR SELECT TO authenticated
USING (
  -- Case 1: Assigned parcelle - access via planteur.cooperative_id
  (
    planteur_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.planteurs p
      WHERE p.id = parcelles.planteur_id 
      AND (
        public.can_access_cooperative(p.cooperative_id)
        OR (p.cooperative_id IS NULL AND p.created_by = auth.uid())
      )
    )
  )
  OR
  -- Case 2: Orphan parcelle - access via import_file.cooperative_id
  (
    planteur_id IS NULL 
    AND import_file_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.parcel_import_files pif
      WHERE pif.id = parcelles.import_file_id 
      AND (
        public.can_access_cooperative(pif.cooperative_id)
        OR (pif.cooperative_id IS NULL AND pif.created_by = auth.uid())
      )
    )
  )
  OR
  -- Case 3: Direct created_by check (fallback for NULL cooperative)
  (
    parcelles.created_by = auth.uid()
  )
);

-- ============================================================================
-- 4. CREATE new INSERT policy
-- ============================================================================
CREATE POLICY "parcelles_insert" ON public.parcelles FOR INSERT TO authenticated
WITH CHECK (
  public.is_agent_or_above() 
  AND (
    -- Case 1: Assigned parcelle - planteur must be accessible
    (
      planteur_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.planteurs p
        WHERE p.id = planteur_id 
        AND (
          public.can_access_cooperative(p.cooperative_id)
          OR (p.cooperative_id IS NULL AND p.created_by = auth.uid())
        )
      )
    )
    OR
    -- Case 2: Orphan parcelle - import_file must be accessible
    (
      planteur_id IS NULL 
      AND import_file_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.parcel_import_files pif
        WHERE pif.id = import_file_id 
        AND (
          public.can_access_cooperative(pif.cooperative_id)
          OR (pif.cooperative_id IS NULL AND pif.created_by = auth.uid())
        )
      )
    )
  )
);

-- ============================================================================
-- 5. CREATE new UPDATE policy
-- ============================================================================
CREATE POLICY "parcelles_update" ON public.parcelles FOR UPDATE TO authenticated
USING (
  public.is_agent_or_above() 
  AND (
    -- Case 1: Assigned parcelle
    (
      planteur_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.planteurs p
        WHERE p.id = parcelles.planteur_id 
        AND (
          public.can_access_cooperative(p.cooperative_id)
          OR (p.cooperative_id IS NULL AND p.created_by = auth.uid())
        )
      )
    )
    OR
    -- Case 2: Orphan parcelle
    (
      planteur_id IS NULL 
      AND import_file_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.parcel_import_files pif
        WHERE pif.id = parcelles.import_file_id 
        AND (
          public.can_access_cooperative(pif.cooperative_id)
          OR (pif.cooperative_id IS NULL AND pif.created_by = auth.uid())
        )
      )
    )
    OR
    -- Case 3: Direct created_by check
    (
      parcelles.created_by = auth.uid()
    )
  )
)
WITH CHECK (
  public.is_agent_or_above() 
  AND (
    (
      planteur_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.planteurs p
        WHERE p.id = planteur_id 
        AND (
          public.can_access_cooperative(p.cooperative_id)
          OR (p.cooperative_id IS NULL AND p.created_by = auth.uid())
        )
      )
    )
    OR
    (
      planteur_id IS NULL 
      AND import_file_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.parcel_import_files pif
        WHERE pif.id = import_file_id 
        AND (
          public.can_access_cooperative(pif.cooperative_id)
          OR (pif.cooperative_id IS NULL AND pif.created_by = auth.uid())
        )
      )
    )
  )
);

-- ============================================================================
-- 6. Update planteurs RLS to also handle NULL cooperative_id
-- ============================================================================
DROP POLICY IF EXISTS "planteurs_select" ON public.planteurs;
DROP POLICY IF EXISTS "planteurs_select_policy" ON public.planteurs;

CREATE POLICY "planteurs_select" ON public.planteurs FOR SELECT TO authenticated
USING (
  public.can_access_cooperative(cooperative_id)
  OR (cooperative_id IS NULL AND created_by = auth.uid())
);

-- ============================================================================
-- 7. Update parcel_import_files RLS to handle NULL cooperative_id
-- ============================================================================
DROP POLICY IF EXISTS "parcel_import_files_select" ON public.parcel_import_files;
DROP POLICY IF EXISTS "parcel_import_files_select_policy" ON public.parcel_import_files;

CREATE POLICY "parcel_import_files_select" ON public.parcel_import_files FOR SELECT TO authenticated
USING (
  public.can_access_cooperative(cooperative_id)
  OR (cooperative_id IS NULL AND created_by = auth.uid())
);
