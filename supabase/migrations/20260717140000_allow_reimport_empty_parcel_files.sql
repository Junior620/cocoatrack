-- Allow re-importing files that never produced parcelles.
-- Old unique index blocked ANY second upload of the same SHA256 per cooperative,
-- including failed / empty applies (common after KML server parse issues).

DROP INDEX IF EXISTS public.uniq_import_file_sha256;

-- Only successfully applied imports must remain unique per cooperative.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_import_file_sha256_applied_coop
  ON public.parcel_import_files (cooperative_id, file_sha256)
  WHERE cooperative_id IS NOT NULL
    AND import_status = 'applied'
    AND COALESCE(nb_applied, 0) > 0;

-- Same rule for imports without cooperative (keyed by uploader).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_import_file_sha256_applied_user
  ON public.parcel_import_files (created_by, file_sha256)
  WHERE cooperative_id IS NULL
    AND import_status = 'applied'
    AND COALESCE(nb_applied, 0) > 0;

-- Keep a non-unique lookup index for duplicate checks.
CREATE INDEX IF NOT EXISTS idx_parcel_import_files_sha256_lookup
  ON public.parcel_import_files (cooperative_id, file_sha256);

-- Ensure users can update their own orphan imports (NULL cooperative_id).
DROP POLICY IF EXISTS "import_files_update" ON public.parcel_import_files;
CREATE POLICY "import_files_update" ON public.parcel_import_files
  FOR UPDATE TO authenticated
  USING (
    public.can_access_cooperative(cooperative_id)
    OR (cooperative_id IS NULL AND created_by = auth.uid())
  )
  WITH CHECK (
    public.can_access_cooperative(cooperative_id)
    OR (cooperative_id IS NULL AND created_by = auth.uid())
  );

-- Free already-stuck empty applies so the same KML/shapefile can be retried now.
UPDATE public.parcel_import_files
SET
  file_sha256 = file_sha256 || '_superseded_' || extract(epoch from now())::bigint::text,
  import_status = 'failed',
  failed_reason = 'Débloqué automatiquement (0 parcelle créée) pour permettre un nouvel import.',
  applied_at = NULL,
  applied_by = NULL
WHERE import_status = 'applied'
  AND COALESCE(nb_applied, 0) = 0;
