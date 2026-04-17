-- ============================================================================
-- Script pour récupérer les définitions de toutes les fonctions
-- à corriger pour le search_path
-- ============================================================================

-- Exécutez ces requêtes une par une et copiez les résultats
-- dans SECURITY_WARNINGS_FIXES.sql

SELECT '-- 1.4: normalize_planteur_name' as comment;
SELECT pg_get_functiondef('public.normalize_planteur_name'::regproc);

SELECT '-- 1.5: update_planteur_name_norm' as comment;
SELECT pg_get_functiondef('public.update_planteur_name_norm'::regproc);

SELECT '-- 1.6: calculate_parcelle_fields' as comment;
SELECT pg_get_functiondef('public.calculate_parcelle_fields'::regproc);

SELECT '-- 1.7: calc_parcelle_geometry' as comment;
SELECT pg_get_functiondef('public.calc_parcelle_geometry'::regproc);

SELECT '-- 1.8: log_audit_entry' as comment;
SELECT pg_get_functiondef('public.log_audit_entry'::regproc);

SELECT '-- 1.9: log_parcelle_audit' as comment;
SELECT pg_get_functiondef('public.log_parcelle_audit'::regproc);

SELECT '-- 1.10: log_import_file_audit' as comment;
SELECT pg_get_functiondef('public.log_import_file_audit'::regproc);

SELECT '-- 1.11: get_audit_logs_with_actor' as comment;
SELECT pg_get_functiondef('public.get_audit_logs_with_actor'::regproc);

SELECT '-- 1.12: count_audit_logs' as comment;
SELECT pg_get_functiondef('public.count_audit_logs'::regproc);

SELECT '-- 1.13: update_dashboard_aggregates' as comment;
SELECT pg_get_functiondef('public.update_dashboard_aggregates'::regproc);

SELECT '-- 1.14: backfill_dashboard_aggregates' as comment;
SELECT pg_get_functiondef('public.backfill_dashboard_aggregates'::regproc);

SELECT '-- 1.15: generate_shipment_code' as comment;
SELECT pg_get_functiondef('public.generate_shipment_code'::regproc);

SELECT '-- 1.16: check_import_file_cooperative' as comment;
SELECT pg_get_functiondef('public.check_import_file_cooperative'::regproc);

SELECT '-- 1.17: get_parcelle_counts_by_planteur' as comment;
SELECT pg_get_functiondef('public.get_parcelle_counts_by_planteur'::regproc);

SELECT '-- 1.18: cleanup_old_planteur_imports' as comment;
SELECT pg_get_functiondef('public.cleanup_old_planteur_imports'::regproc);
