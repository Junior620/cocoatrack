-- ============================================================================
-- SECURITY FIXES - Supabase Linter Alerts
-- Date: 2026-03-28
-- Description: Corrections des alertes de sécurité détectées par le linter
-- ============================================================================

-- ============================================================================
-- SECTION 1: Fix SECURITY DEFINER Views
-- ============================================================================

-- Option 1: Remplacer par SECURITY INVOKER (recommandé)
-- Cela force l'utilisation des permissions de l'utilisateur qui interroge la vue

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

-- 2.1: delivery_code_counters
ALTER TABLE public.delivery_code_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_code_counters FORCE ROW LEVEL SECURITY;

-- Policy: Seuls les agents et au-dessus peuvent lire
CREATE POLICY delivery_code_counters_select_policy 
ON public.delivery_code_counters
FOR SELECT
TO authenticated
USING (public.is_agent_or_above());

-- Policy: Seul le système peut insérer/mettre à jour (via RPC)
-- Pas de policy INSERT/UPDATE = seules les fonctions SECURITY DEFINER peuvent modifier

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

ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_events FORCE ROW LEVEL SECURITY;

-- Policy: Seuls les admins peuvent lire les événements d'auth
CREATE POLICY auth_events_select_policy 
ON public.auth_events
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Policy: Seuls les admins peuvent insérer (ou via trigger SECURITY DEFINER)
CREATE POLICY auth_events_insert_policy 
ON public.auth_events
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- ============================================================================
-- SECTION 4: Enable RLS on sync_processed
-- ============================================================================

-- Note: Cette table utilise idempotency_key (UUID) sans user_id
-- Elle est utilisée pour éviter les doublons lors de la synchronisation
-- Stratégie: Permettre à tous les utilisateurs authentifiés de lire/écrire
-- car l'idempotency_key est unique et ne contient pas de données sensibles

ALTER TABLE public.sync_processed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_processed FORCE ROW LEVEL SECURITY;

-- Policy: Tous les utilisateurs authentifiés peuvent lire
CREATE POLICY sync_processed_select_policy 
ON public.sync_processed
FOR SELECT
TO authenticated
USING (true);

-- Policy: Tous les utilisateurs authentifiés peuvent insérer
CREATE POLICY sync_processed_insert_policy 
ON public.sync_processed
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Seuls les admins peuvent mettre à jour
CREATE POLICY sync_processed_update_policy 
ON public.sync_processed
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Policy: Seuls les admins peuvent supprimer
CREATE POLICY sync_processed_delete_policy 
ON public.sync_processed
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================================
-- SECTION 5: spatial_ref_sys (PostGIS system table)
-- ============================================================================

-- IMPORTANT: Cette table appartient à PostGIS (propriétaire: postgres superuser)
-- Vous NE POUVEZ PAS modifier cette table sans être superuser
-- 
-- SOLUTION: Ignorer cette alerte du linter
-- 
-- Raisons:
-- 1. C'est une table système PostGIS en lecture seule
-- 2. Elle contient uniquement des données de référence publiques (systèmes de coordonnées)
-- 3. Elle n'est pas exposée dans votre API applicative
-- 4. PostGIS la gère automatiquement
--
-- Si vous voulez vraiment activer RLS (optionnel et non recommandé):
-- Connectez-vous en tant que superuser et exécutez:
--
-- ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY spatial_ref_sys_select_policy 
-- ON public.spatial_ref_sys FOR SELECT TO authenticated USING (true);
--
-- Mais ce n'est PAS nécessaire pour la sécurité de votre application.

-- RIEN À FAIRE ICI - PASSEZ À LA SECTION SUIVANTE

-- ============================================================================
-- SECTION 6: Verification
-- ============================================================================

-- Vérifier que RLS est activé sur les tables modifiables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN (
    'delivery_code_counters',
    'invoice_code_counters', 
    'shipment_code_counters',
    'auth_events',
    'sync_processed'
    -- spatial_ref_sys exclu (table système PostGIS)
  )
ORDER BY tablename;

-- Vérifier les policies créées
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN (
    'delivery_code_counters',
    'invoice_code_counters',
    'shipment_code_counters', 
    'auth_events',
    'sync_processed'
    -- spatial_ref_sys exclu (table système PostGIS)
  )
ORDER BY tablename, policyname;

-- Vérifier les vues SECURITY INVOKER
SELECT 
  schemaname,
  viewname,
  viewowner,
  definition
FROM pg_views 
WHERE schemaname = 'public'
  AND viewname IN ('planteurs_with_stats', 'chef_planteurs_with_stats');

-- ============================================================================
-- NOTES IMPORTANTES
-- ============================================================================

-- 1. SECURITY DEFINER Views:
--    Avant d'appliquer les changements, récupérez les définitions actuelles:
--    SELECT pg_get_viewdef('public.planteurs_with_stats'::regclass, true);
--    SELECT pg_get_viewdef('public.chef_planteurs_with_stats'::regclass, true);
--
-- 2. Tables de compteurs:
--    Ces tables sont modifiées par des fonctions SECURITY DEFINER.
--    Vérifiez que les fonctions qui les utilisent ont les bonnes permissions.
--
-- 3. auth_events:
--    Si cette table est remplie par un trigger, assurez-vous que le trigger
--    utilise SECURITY DEFINER pour contourner les RLS policies.
--
-- 4. sync_processed:
--    Cette table n'a pas de user_id, elle utilise idempotency_key.
--    Les policies permettent à tous les utilisateurs authentifiés de lire/écrire
--    car elle sert uniquement à éviter les doublons de synchronisation.
--
-- 5. Test après application:
--    Testez avec différents rôles (admin, manager, agent, viewer) pour
--    vérifier que les permissions fonctionnent correctement.
--
-- 6. spatial_ref_sys:
--    Cette table PostGIS nécessite des permissions superuser.
--    IGNOREZ l'alerte du linter pour cette table - c'est une table système
--    en lecture seule qui ne pose pas de risque de sécurité.
--    Elle n'est pas modifiable via votre application.

-- ============================================================================
-- ROLLBACK (en cas de problème)
-- ============================================================================

-- Pour désactiver RLS sur une table:
-- ALTER TABLE public.table_name DISABLE ROW LEVEL SECURITY;

-- Pour supprimer une policy:
-- DROP POLICY IF EXISTS policy_name ON public.table_name;

-- Pour revenir aux vues SECURITY DEFINER:
-- DROP VIEW IF EXISTS public.planteurs_with_stats;
-- CREATE VIEW public.planteurs_with_stats
-- WITH (security_definer = true)
-- AS ...
