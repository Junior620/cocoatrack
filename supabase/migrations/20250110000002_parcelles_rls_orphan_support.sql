-- ============================================================================
-- CocoaTrack V2 - Parcelles RLS Policies for Orphan Support
-- Updates RLS policies to handle parcelles without planteur (orphelines)
-- Access via planteur.cooperative_id OR import_file.cooperative_id
-- Requirements: 1.1 (RLS safety)
-- ============================================================================

-- ============================================================================
-- 1. DROP existing RLS policies for parcelles
-- Drop both naming conventions to ensure clean slate
-- ============================================================================
DROP POLICY IF EXISTS "parcelles_select" ON public.parcelles;
DROP POLICY IF EXISTS "parcelles_insert" ON public.parcelles;
DROP POLICY IF EXISTS "parcelles_update" ON public.parcelles;
DROP POLICY IF EXISTS "parcelles_select_policy" ON public.parcelles;
DROP POLICY IF EXISTS "parcelles_insert_policy" ON public.parcelles;
DROP POLICY IF EXISTS "parcelles_update_policy" ON public.parcelles;

-- ============================================================================
-- 2. CREATE new SELECT policy
-- User can see parcelles if:
--   - Parcelle is assigned (planteur_id NOT NULL) AND planteur belongs to user's cooperative
--   - OR parcelle is orphan (planteur_id IS NULL) AND import_file belongs to user's cooperative
-- ============================================================================
CREATE POLICY "parcelles_select" ON public.parcelles FOR SELECT TO authenticated
USING (
  -- Case 1: Assigned parcelle - access via planteur.cooperative_id
  (
    planteur_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.planteurs p
      WHERE p.id = parcelles.planteur_id 
      AND public.can_access_cooperative(p.cooperative_id)
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
      AND public.can_access_cooperative(pif.cooperative_id)
    )
  )
);

-- ============================================================================
-- 3. CREATE new INSERT policy
-- User can create parcelles if:
--   - Agent or above role
--   - AND (assigned to planteur in user's cooperative OR orphan with import_file in user's cooperative)
-- ============================================================================
CREATE POLICY "parcelles_insert" ON public.parcelles FOR INSERT TO authenticated
WITH CHECK (
  public.is_agent_or_above() 
  AND (
    -- Case 1: Assigned parcelle - planteur must belong to user's cooperative
    (
      planteur_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.planteurs p
        WHERE p.id = planteur_id 
        AND public.can_access_cooperative(p.cooperative_id)
      )
    )
    OR
    -- Case 2: Orphan parcelle - import_file must belong to user's cooperative
    (
      planteur_id IS NULL 
      AND import_file_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.parcel_import_files pif
        WHERE pif.id = import_file_id 
        AND public.can_access_cooperative(pif.cooperative_id)
      )
    )
  )
);

-- ============================================================================
-- 4. CREATE new UPDATE policy
-- User can update parcelles if:
--   - Agent or above role
--   - AND current parcelle is accessible (via planteur OR import_file)
-- WITH CHECK ensures the updated parcelle remains accessible
-- ============================================================================
CREATE POLICY "parcelles_update" ON public.parcelles FOR UPDATE TO authenticated
USING (
  public.is_agent_or_above() 
  AND (
    -- Case 1: Assigned parcelle - access via planteur.cooperative_id
    (
      planteur_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.planteurs p
        WHERE p.id = parcelles.planteur_id 
        AND public.can_access_cooperative(p.cooperative_id)
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
        AND public.can_access_cooperative(pif.cooperative_id)
      )
    )
  )
)
WITH CHECK (
  public.is_agent_or_above() 
  AND (
    -- After update: assigned parcelle must still be in user's cooperative
    (
      planteur_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.planteurs p
        WHERE p.id = planteur_id 
        AND public.can_access_cooperative(p.cooperative_id)
      )
    )
    OR
    -- After update: orphan parcelle must still have import_file in user's cooperative
    (
      planteur_id IS NULL 
      AND import_file_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.parcel_import_files pif
        WHERE pif.id = import_file_id 
        AND public.can_access_cooperative(pif.cooperative_id)
      )
    )
  )
);

-- ============================================================================
-- NOTES:
-- - NO DELETE policy: Soft-delete only via API (is_active=false)
-- - Hard delete reserved for DB admin scripts only
-- - The constraint parcelles_orphan_requires_import ensures orphan parcelles
--   always have import_file_id, making RLS via import_file always possible
-- ============================================================================
