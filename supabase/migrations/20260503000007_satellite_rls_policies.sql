-- ============================================================================
-- Migration: Satellite Imagery RLS Policies
-- Description: Row Level Security policies for satellite imagery tables
--              - SELECT policies based on parcelle access
--              - INSERT/UPDATE policies for cooperative managers and agronomists
-- Date: 2026-05-03
-- Related: .kiro/specs/satellite-imagery-analysis/tasks.md (Task 1.2.7)
-- ============================================================================

-- ============================================================================
-- SECTION 1: Enable RLS on Satellite Tables
-- ============================================================================

ALTER TABLE public.satellite_imagery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.satellite_imagery FORCE ROW LEVEL SECURITY;

ALTER TABLE public.ndvi_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ndvi_results FORCE ROW LEVEL SECURITY;

ALTER TABLE public.deforestation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deforestation_events FORCE ROW LEVEL SECURITY;

ALTER TABLE public.yield_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yield_predictions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.satellite_cache_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.satellite_cache_metadata FORCE ROW LEVEL SECURITY;

ALTER TABLE public.satellite_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.satellite_audit_logs FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 2: satellite_imagery Table Policies
-- ============================================================================

-- SELECT: Users can view satellite imagery for parcelles they have access to
CREATE POLICY satellite_imagery_select ON public.satellite_imagery
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = satellite_imagery.parcelle_id
    AND (
      -- Case 1: Assigned parcelle - access via planteur.cooperative_id
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      -- Case 2: Orphan parcelle - access via import_file.cooperative_id
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
);

-- INSERT: Agents and above can insert satellite imagery for accessible parcelles
CREATE POLICY satellite_imagery_insert ON public.satellite_imagery
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_agent_or_above()
  AND EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = parcelle_id
    AND (
      -- Case 1: Assigned parcelle
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      -- Case 2: Orphan parcelle
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
);

-- UPDATE: Agents and above can update satellite imagery metadata
CREATE POLICY satellite_imagery_update ON public.satellite_imagery
FOR UPDATE
TO authenticated
USING (
  public.is_agent_or_above()
  AND EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = satellite_imagery.parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
)
WITH CHECK (
  public.is_agent_or_above()
  AND EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
);

-- DELETE: Only admins can delete satellite imagery
CREATE POLICY satellite_imagery_delete ON public.satellite_imagery
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- SECTION 3: ndvi_results Table Policies
-- ============================================================================

-- SELECT: Users can view NDVI results for parcelles they have access to
CREATE POLICY ndvi_results_select ON public.ndvi_results
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = ndvi_results.parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
);

-- INSERT: Agents and above can insert NDVI results
CREATE POLICY ndvi_results_insert ON public.ndvi_results
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_agent_or_above()
  AND EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
);

-- UPDATE: Agents and above can update NDVI results
CREATE POLICY ndvi_results_update ON public.ndvi_results
FOR UPDATE
TO authenticated
USING (
  public.is_agent_or_above()
  AND EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = ndvi_results.parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
)
WITH CHECK (
  public.is_agent_or_above()
  AND EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
);

-- DELETE: Only admins can delete NDVI results
CREATE POLICY ndvi_results_delete ON public.ndvi_results
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- SECTION 4: deforestation_events Table Policies
-- ============================================================================

-- SELECT: Users can view deforestation events for parcelles they have access to
CREATE POLICY deforestation_events_select ON public.deforestation_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = deforestation_events.parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
);

-- INSERT: Agents and above can insert deforestation events
CREATE POLICY deforestation_events_insert ON public.deforestation_events
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_agent_or_above()
  AND EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
);

-- UPDATE: Managers and above can update deforestation events (acknowledge/dispute)
CREATE POLICY deforestation_events_update ON public.deforestation_events
FOR UPDATE
TO authenticated
USING (
  public.is_manager_or_above()
  AND EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = deforestation_events.parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
)
WITH CHECK (
  public.is_manager_or_above()
  AND EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
);

-- DELETE: Only admins can delete deforestation events
CREATE POLICY deforestation_events_delete ON public.deforestation_events
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- SECTION 5: yield_predictions Table Policies
-- ============================================================================

-- SELECT: Users can view yield predictions for parcelles they have access to
CREATE POLICY yield_predictions_select ON public.yield_predictions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = yield_predictions.parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
);

-- INSERT: Agents and above can insert yield predictions
CREATE POLICY yield_predictions_insert ON public.yield_predictions
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_agent_or_above()
  AND EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
);

-- UPDATE: Agents and above can update yield predictions (e.g., add actual yield)
CREATE POLICY yield_predictions_update ON public.yield_predictions
FOR UPDATE
TO authenticated
USING (
  public.is_agent_or_above()
  AND EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = yield_predictions.parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
)
WITH CHECK (
  public.is_agent_or_above()
  AND EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
);

-- DELETE: Only admins can delete yield predictions
CREATE POLICY yield_predictions_delete ON public.yield_predictions
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- SECTION 6: satellite_cache_metadata Table Policies
-- ============================================================================

-- SELECT: Users can view cache metadata for parcelles they have access to
CREATE POLICY satellite_cache_metadata_select ON public.satellite_cache_metadata
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = satellite_cache_metadata.parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
);

-- INSERT: System can insert cache metadata (via SECURITY DEFINER functions)
CREATE POLICY satellite_cache_metadata_insert ON public.satellite_cache_metadata
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_agent_or_above()
  AND EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
);

-- UPDATE: System can update cache metadata (last_accessed_at)
CREATE POLICY satellite_cache_metadata_update ON public.satellite_cache_metadata
FOR UPDATE
TO authenticated
USING (
  public.is_agent_or_above()
  AND EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = satellite_cache_metadata.parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
)
WITH CHECK (
  public.is_agent_or_above()
  AND EXISTS (
    SELECT 1 FROM public.parcelles p
    WHERE p.id = parcelle_id
    AND (
      (
        p.planteur_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.planteurs pl
          WHERE pl.id = p.planteur_id 
          AND public.can_access_cooperative(pl.cooperative_id)
        )
      )
      OR
      (
        p.planteur_id IS NULL 
        AND p.import_file_id IS NOT NULL 
        AND EXISTS (
          SELECT 1 FROM public.parcel_import_files pif
          WHERE pif.id = p.import_file_id 
          AND public.can_access_cooperative(pif.cooperative_id)
        )
      )
    )
  )
);

-- DELETE: Admins and system can delete expired cache entries
CREATE POLICY satellite_cache_metadata_delete ON public.satellite_cache_metadata
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- SECTION 7: satellite_audit_logs Table Policies
-- ============================================================================

-- SELECT: Users can view audit logs for their own actions or for parcelles they manage
CREATE POLICY satellite_audit_logs_select ON public.satellite_audit_logs
FOR SELECT
TO authenticated
USING (
  -- Users can see their own audit logs
  user_id = auth.uid()
  OR
  -- Managers and admins can see audit logs for parcelles in their cooperative
  (
    public.is_manager_or_above()
    AND parcelle_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.parcelles p
      WHERE p.id = satellite_audit_logs.parcelle_id
      AND (
        (
          p.planteur_id IS NOT NULL 
          AND EXISTS (
            SELECT 1 FROM public.planteurs pl
            WHERE pl.id = p.planteur_id 
            AND public.can_access_cooperative(pl.cooperative_id)
          )
        )
        OR
        (
          p.planteur_id IS NULL 
          AND p.import_file_id IS NOT NULL 
          AND EXISTS (
            SELECT 1 FROM public.parcel_import_files pif
            WHERE pif.id = p.import_file_id 
            AND public.can_access_cooperative(pif.cooperative_id)
          )
        )
      )
    )
  )
);

-- INSERT: All authenticated users can insert audit logs for their actions
CREATE POLICY satellite_audit_logs_insert ON public.satellite_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

-- UPDATE: No updates allowed on audit logs (immutable)
-- DELETE: Only admins can delete audit logs (for cleanup)
CREATE POLICY satellite_audit_logs_delete ON public.satellite_audit_logs
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- SECTION 8: Comments
-- ============================================================================

COMMENT ON POLICY satellite_imagery_select ON public.satellite_imagery IS 
  'Users can view satellite imagery for parcelles they have access to via planteur or import_file cooperative';

COMMENT ON POLICY satellite_imagery_insert ON public.satellite_imagery IS 
  'Agents and above can insert satellite imagery for accessible parcelles';

COMMENT ON POLICY satellite_imagery_update ON public.satellite_imagery IS 
  'Agents and above can update satellite imagery metadata';

COMMENT ON POLICY satellite_imagery_delete ON public.satellite_imagery IS 
  'Only admins can delete satellite imagery';

COMMENT ON POLICY ndvi_results_select ON public.ndvi_results IS 
  'Users can view NDVI results for parcelles they have access to';

COMMENT ON POLICY ndvi_results_insert ON public.ndvi_results IS 
  'Agents and above can insert NDVI results';

COMMENT ON POLICY ndvi_results_update ON public.ndvi_results IS 
  'Agents and above can update NDVI results';

COMMENT ON POLICY ndvi_results_delete ON public.ndvi_results IS 
  'Only admins can delete NDVI results';

COMMENT ON POLICY deforestation_events_select ON public.deforestation_events IS 
  'Users can view deforestation events for parcelles they have access to';

COMMENT ON POLICY deforestation_events_insert ON public.deforestation_events IS 
  'Agents and above can insert deforestation events';

COMMENT ON POLICY deforestation_events_update ON public.deforestation_events IS 
  'Managers and above can update deforestation events (acknowledge/dispute)';

COMMENT ON POLICY deforestation_events_delete ON public.deforestation_events IS 
  'Only admins can delete deforestation events';

COMMENT ON POLICY yield_predictions_select ON public.yield_predictions IS 
  'Users can view yield predictions for parcelles they have access to';

COMMENT ON POLICY yield_predictions_insert ON public.yield_predictions IS 
  'Agents and above can insert yield predictions';

COMMENT ON POLICY yield_predictions_update ON public.yield_predictions IS 
  'Agents and above can update yield predictions (e.g., add actual yield)';

COMMENT ON POLICY yield_predictions_delete ON public.yield_predictions IS 
  'Only admins can delete yield predictions';

COMMENT ON POLICY satellite_cache_metadata_select ON public.satellite_cache_metadata IS 
  'Users can view cache metadata for parcelles they have access to';

COMMENT ON POLICY satellite_cache_metadata_insert ON public.satellite_cache_metadata IS 
  'System can insert cache metadata via SECURITY DEFINER functions';

COMMENT ON POLICY satellite_cache_metadata_update ON public.satellite_cache_metadata IS 
  'System can update cache metadata (last_accessed_at)';

COMMENT ON POLICY satellite_cache_metadata_delete ON public.satellite_cache_metadata IS 
  'Admins can delete expired cache entries';

COMMENT ON POLICY satellite_audit_logs_select ON public.satellite_audit_logs IS 
  'Users can view their own audit logs; managers can view logs for their cooperative parcelles';

COMMENT ON POLICY satellite_audit_logs_insert ON public.satellite_audit_logs IS 
  'All authenticated users can insert audit logs for their actions';

COMMENT ON POLICY satellite_audit_logs_delete ON public.satellite_audit_logs IS 
  'Only admins can delete audit logs for cleanup';

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. Access Control Pattern:
--    All satellite data access is based on parcelle access, which follows the
--    existing pattern: access via planteur.cooperative_id OR import_file.cooperative_id
--
-- 2. Role-Based Permissions:
--    - Viewers: Can SELECT satellite data for their cooperative's parcelles
--    - Agents: Can SELECT and INSERT/UPDATE satellite data
--    - Managers: Can SELECT, INSERT/UPDATE, and manage deforestation alerts
--    - Admins: Full access including DELETE operations
--
-- 3. Deforestation Events:
--    UPDATE policy requires manager_or_above role to acknowledge/dispute alerts
--    This ensures proper oversight of EUDR compliance decisions
--
-- 4. Audit Logs:
--    Users can see their own actions; managers can see all actions in their cooperative
--    Audit logs are immutable (no UPDATE policy)
--
-- 5. Cache Management:
--    Cache metadata follows same access pattern as other satellite data
--    System functions should use SECURITY DEFINER to bypass RLS when needed
--
-- 6. Testing:
--    Test with different user roles (viewer, agent, manager, admin)
--    Test with both assigned parcelles and orphan parcelles
--    Verify cross-cooperative access is properly blocked

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
