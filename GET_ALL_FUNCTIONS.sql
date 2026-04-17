-- ============================================================================
-- Récupérer toutes les définitions de fonctions en une seule requête
-- ============================================================================

SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'normalize_planteur_name',
    'update_planteur_name_norm',
    'calculate_parcelle_fields',
    'calc_parcelle_geometry',
    'log_audit_entry',
    'log_parcelle_audit',
    'log_import_file_audit',
    'get_audit_logs_with_actor',
    'count_audit_logs',
    'update_dashboard_aggregates',
    'backfill_dashboard_aggregates',
    'generate_shipment_code',
    'check_import_file_cooperative',
    'get_parcelle_counts_by_planteur',
    'cleanup_old_planteur_imports'
  )
ORDER BY p.proname;
