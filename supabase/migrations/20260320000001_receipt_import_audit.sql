-- ============================================================================
-- CocoaTrack V2 - Receipt Import Audit Extension
-- Extends audit_logs action constraint to support receipt import actions
-- Requirements: 12.1, 12.2, 12.3, 12.4, 13.6
-- ============================================================================

-- Extend audit_logs action CHECK constraint to support receipt import actions
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'INSERT', 'UPDATE', 'DELETE',
    'create', 'update', 'archive', 'status_change',
    'import_parse', 'import_apply',
    'receipt_imported', 'receipt_import_failed', 'ocr_extraction'
  ));
