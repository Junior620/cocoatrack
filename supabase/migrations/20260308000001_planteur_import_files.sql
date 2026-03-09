-- ============================================================================
-- CocoaTrack V2 - Planteur Import Files Table
-- Creates table to track CSV import operations for planteurs
-- Requirements: 5.5, 8.6
-- ============================================================================

-- ============================================================================
-- 1. Create planteur_import_files table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.planteur_import_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  file_path TEXT NOT NULL,
  import_status TEXT NOT NULL CHECK (import_status IN (
    'uploaded',
    'parsed',
    'executing',
    'completed',
    'failed'
  )),
  parse_result JSONB,
  import_summary JSONB,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. Add comments for documentation
-- ============================================================================
COMMENT ON TABLE public.planteur_import_files IS 'Tracks CSV import operations for planteurs with parsing and execution results';
COMMENT ON COLUMN public.planteur_import_files.file_path IS 'Storage path in Supabase Storage (planteur-imports bucket)';
COMMENT ON COLUMN public.planteur_import_files.import_status IS 'Current status: uploaded, parsed, executing, completed, failed';
COMMENT ON COLUMN public.planteur_import_files.parse_result IS 'JSON containing parsed rows, validation errors, and duplicate info';
COMMENT ON COLUMN public.planteur_import_files.import_summary IS 'JSON containing import execution summary (created, updated, skipped, failed counts)';

-- ============================================================================
-- 3. Create indexes for efficient queries
-- ============================================================================

-- Index for listing imports by cooperative (most recent first)
CREATE INDEX IF NOT EXISTS idx_planteur_imports_cooperative
  ON public.planteur_import_files(cooperative_id, created_at DESC);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_planteur_imports_status
  ON public.planteur_import_files(import_status, created_at DESC);

-- Index for finding imports by creator
CREATE INDEX IF NOT EXISTS idx_planteur_imports_created_by
  ON public.planteur_import_files(created_by, created_at DESC);

-- ============================================================================
-- 4. Create trigger for updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_planteur_import_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS planteur_import_files_updated_at_trigger ON public.planteur_import_files;
CREATE TRIGGER planteur_import_files_updated_at_trigger
  BEFORE UPDATE ON public.planteur_import_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_planteur_import_files_updated_at();

-- ============================================================================
-- 5. Enable Row Level Security (RLS)
-- ============================================================================
ALTER TABLE public.planteur_import_files ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. Create RLS Policies
-- ============================================================================

-- Policy: Users can view imports from their cooperative
CREATE POLICY "planteur_imports_select" 
  ON public.planteur_import_files 
  FOR SELECT
  USING (
    cooperative_id IN (
      SELECT cooperative_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can create imports for their cooperative
CREATE POLICY "planteur_imports_insert" 
  ON public.planteur_import_files 
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND cooperative_id IN (
      SELECT cooperative_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can update imports from their cooperative
CREATE POLICY "planteur_imports_update" 
  ON public.planteur_import_files 
  FOR UPDATE
  USING (
    cooperative_id IN (
      SELECT cooperative_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete their own imports (optional - for cleanup)
CREATE POLICY "planteur_imports_delete" 
  ON public.planteur_import_files 
  FOR DELETE
  USING (
    created_by = auth.uid()
    AND cooperative_id IN (
      SELECT cooperative_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- 7. Grant permissions
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planteur_import_files TO authenticated;
