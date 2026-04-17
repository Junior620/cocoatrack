-- ============================================================================
-- Migration: Security Fixes - Critical Issues
-- Description: Corrections des alertes de sécurité critiques (ERRORS)
--              - SECURITY DEFINER views → SECURITY INVOKER
--              - RLS manquant sur tables sensibles
-- Date: 2026-03-28
-- Author: Security Audit
-- Related: SECURITY_FIXES.sql, SECURITY_FIXES_APPLIED.md
-- ============================================================================

-- ============================================================================
-- SECTION 1: Fix SECURITY DEFINER Views
-- ============================================================================
-- Problème: Les vues utilisaient SECURITY DEFINER, contournant les RLS policies
-- Solution: Convertir en SECURITY INVOKER pour respecter les permissions utilisateur

-- 1.1: planteurs_with_stats
DROP VIEW IF EXISTS public.planteurs_with_stats;
CREATE VIEW public.planteurs_with_stats
WITH (security_invoker = true)
AS
SELECT 
    p.id,
    p.name,
    p.code,
    p.phone,
    p.cni,
    p.chef_planteur_id,
    p.cooperative_id,
    p.latitude,
    p.longitude,
    p.is_active,
    p.created_by,
    p.created_at,
    p.updated_at,
    p.superficie_hectares,
    p.statut_plantation,
    p.region,
    p.departement,
    p.localite,
    COALESCE(p.superficie_hectares * 1000::numeric, 0::numeric) AS limite_production_kg,
    COALESCE(stats.total_loaded_kg, 0::numeric) AS total_charge_kg,
    COALESCE(stats.total_delivered_kg, 0::numeric) AS total_decharge_kg,
    COALESCE(stats.total_losses_kg, 0::numeric) AS pertes_kg,
    COALESCE(stats.loss_percentage, 0::numeric) AS pourcentage_pertes,
    stats.remaining_kg AS restant_kg,
    stats.usage_percentage AS pourcentage_utilise,
    cp.name AS chef_planteur_name,
    cp.code AS chef_planteur_code
FROM planteurs p
LEFT JOIN LATERAL get_planteur_stats(p.id) stats(
    total_loaded_kg, 
    total_delivered_kg, 
    total_losses_kg, 
    loss_percentage, 
    production_limit_kg, 
    remaining_kg, 
    usage_percentage
) ON true
LEFT JOIN chef_planteurs cp ON cp.id = p.chef_planteur_id;

-- 1.2: chef_planteurs_with_stats
DROP VIEW IF EXISTS public.chef_planteurs_with_stats;
CREATE VIEW public.chef_planteurs_with_stats
WITH (security_invoker = true)
AS
SELECT 
    cp.id,
    cp.name,
    cp.code,
    cp.phone,
    cp.cni,
    cp.cooperative_id,
    cp.region,
    cp.departement,
    cp.localite,
    cp.latitude,
    cp.longitude,
    cp.quantite_max_kg,
    cp.contract_start,
    cp.contract_end,
    cp.termination_reason,
    cp.validation_status,
    cp.validated_by,
    cp.validated_at,
    cp.rejection_reason,
    cp.created_by,
    cp.created_at,
    cp.updated_at,
    COALESCE(stats.total_delivered_kg, 0::numeric) AS total_livre_kg,
    COALESCE(stats.total_planteurs, 0) AS nombre_planteurs,
    COALESCE(stats.total_planteurs_limit_kg, 0::numeric) AS total_limite_planteurs_kg,
    COALESCE(stats.remaining_kg, cp.quantite_max_kg) AS restant_kg,
    COALESCE(stats.usage_percentage, 0::numeric) AS pourcentage_utilise,
    COALESCE(stats.is_exploited, false) AS est_exploite
FROM chef_planteurs cp
LEFT JOIN LATERAL get_chef_planteur_stats(cp.id) stats(
    total_delivered_kg, 
    total_planteurs, 
    total_planteurs_limit_kg, 
    quantite_max_kg, 
    remaining_kg, 
    usage_percentage, 
    is_exploited
) ON true;

-- ============================================================================
-- SECTION 2: Enable RLS on Counter Tables
-- ============================================================================
-- Problème: Tables de compteurs accessibles sans restriction
-- Solution: Activer RLS avec policies restrictives

-- 2.1: delivery_code_counters
ALTER TABLE public.delivery_code_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_code_counters FORCE ROW LEVEL SECURITY;

CREATE POLICY delivery_code_counters_select_policy 
ON public.delivery_code_counters
FOR SELECT
TO authenticated
USING (public.is_agent_or_above());

-- 2.2: invoice_code_counters
ALTER TABLE public.invoice_code_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_code_counters FORCE ROW LEVEL SECURITY;

CREATE POLICY invoice_code_counters_select_policy 
ON public.invoice_code_counters
FOR SELECT
TO authenticated
USING (public.is_agent_or_above());

-- 2.3: shipment_code_counters
ALTER TABLE public.shipment_code_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_code_counters FORCE ROW LEVEL SECURITY;

CREATE POLICY shipment_code_counters_select_policy 
ON public.shipment_code_counters
FOR SELECT
TO authenticated
USING (public.is_agent_or_above());

-- ============================================================================
-- SECTION 3: Enable RLS on auth_events (HIGH PRIORITY)
-- ============================================================================
-- Problème: Événements d'authentification accessibles à tous
-- Solution: Restreindre l'accès aux admins uniquement

ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_events FORCE ROW LEVEL SECURITY;

CREATE POLICY auth_events_select_policy 
ON public.auth_events
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY auth_events_insert_policy 
ON public.auth_events
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- ============================================================================
-- SECTION 4: Enable RLS on sync_processed
-- ============================================================================
-- Problème: Table de synchronisation accessible sans restriction
-- Solution: Permettre lecture/écriture à tous (table technique), 
--           mais modification/suppression aux admins uniquement

ALTER TABLE public.sync_processed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_processed FORCE ROW LEVEL SECURITY;

CREATE POLICY sync_processed_select_policy 
ON public.sync_processed
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY sync_processed_insert_policy 
ON public.sync_processed
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY sync_processed_update_policy 
ON public.sync_processed
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY sync_processed_delete_policy 
ON public.sync_processed
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- SECTION 5: Verification Queries (commented out for migration)
-- ============================================================================

-- Uncomment to verify after migration:

-- -- Vérifier que RLS est activé
-- SELECT 
--   schemaname,
--   tablename,
--   rowsecurity as rls_enabled
-- FROM pg_tables 
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'delivery_code_counters',
--     'invoice_code_counters', 
--     'shipment_code_counters',
--     'auth_events',
--     'sync_processed'
--   )
-- ORDER BY tablename;

-- -- Vérifier les policies créées
-- SELECT 
--   schemaname,
--   tablename,
--   policyname,
--   cmd
-- FROM pg_policies 
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'delivery_code_counters',
--     'invoice_code_counters',
--     'shipment_code_counters', 
--     'auth_events',
--     'sync_processed'
--   )
-- ORDER BY tablename, policyname;

-- -- Vérifier les vues SECURITY INVOKER
-- SELECT 
--   schemaname,
--   viewname,
--   viewowner
-- FROM pg_views 
-- WHERE schemaname = 'public'
--   AND viewname IN ('planteurs_with_stats', 'chef_planteurs_with_stats');

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. spatial_ref_sys:
--    Cette table PostGIS système n'est PAS modifiée dans cette migration.
--    Elle appartient au superuser postgres et ne pose pas de risque de sécurité.
--    L'alerte du linter peut être ignorée en toute sécurité.
--
-- 2. Impact sur les performances:
--    Les vues SECURITY INVOKER ont les mêmes performances que SECURITY DEFINER.
--    Les policies RLS sont évaluées au niveau de la base de données (très rapide).
--
-- 3. Test recommandé:
--    Après application, testez avec différents rôles (admin, manager, agent, viewer)
--    pour vérifier que les permissions fonctionnent correctement.
--
-- 4. Rollback:
--    En cas de problème, utilisez les commandes suivantes:
--    - ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
--    - DROP POLICY IF EXISTS policy_name ON table_name;
--    - Recréer les vues avec security_definer = true

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
