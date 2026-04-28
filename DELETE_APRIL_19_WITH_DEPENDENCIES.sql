-- ============================================================================
-- Suppression complète des planteurs et parcelles du 19 avril 2026
-- Avec gestion de TOUTES les dépendances (receipts, deliveries, invoices)
-- ============================================================================
-- ATTENTION: Cette opération est IRREVERSIBLE et supprime BEAUCOUP de données
-- Vérifiez TRÈS ATTENTIVEMENT avant d'exécuter
-- ============================================================================

-- ============================================================================
-- ÉTAPE 1: ANALYSE COMPLÈTE - Voir toutes les données qui seront supprimées
-- ============================================================================

-- 1.1 Planteurs créés le 19 avril
SELECT 
  COUNT(*) as total_planteurs,
  STRING_AGG(DISTINCT code, ', ') as codes_planteurs
FROM public.planteurs
WHERE DATE(created_at) = '2026-04-19';

-- 1.2 Parcelles créées le 19 avril
SELECT 
  COUNT(*) as total_parcelles
FROM public.parcelles
WHERE DATE(created_at) = '2026-04-19';

-- 1.3 Reçus de collecte liés à ces planteurs
SELECT 
  COUNT(*) as total_receipts,
  SUM(ARRAY_LENGTH(receipt_deliveries, 1)) as total_deliveries_in_receipts
FROM public.collection_receipts cr
WHERE cr.planteur_id IN (
  SELECT id FROM public.planteurs WHERE DATE(created_at) = '2026-04-19'
);

-- 1.4 Livraisons liées à ces planteurs
SELECT 
  COUNT(*) as total_deliveries,
  SUM(weight_kg) as total_weight_kg,
  SUM(total_amount) as total_amount_xaf
FROM public.deliveries
WHERE planteur_id IN (
  SELECT id FROM public.planteurs WHERE DATE(created_at) = '2026-04-19'
);

-- 1.5 Factures potentiellement affectées
SELECT 
  COUNT(DISTINCT i.id) as total_invoices_affected,
  SUM(i.total_amount) as total_invoice_amount
FROM public.invoices i
INNER JOIN public.invoice_deliveries id ON id.invoice_id = i.id
INNER JOIN public.deliveries d ON d.id = id.delivery_id
WHERE d.planteur_id IN (
  SELECT id FROM public.planteurs WHERE DATE(created_at) = '2026-04-19'
);

-- ============================================================================
-- ÉTAPE 2: DÉTAILS DES DONNÉES À SUPPRIMER
-- ============================================================================

-- 2.1 Liste des planteurs
SELECT 
  p.id,
  p.code,
  p.name,
  p.cooperative_id,
  p.created_at,
  COUNT(DISTINCT pa.id) as nb_parcelles,
  COUNT(DISTINCT d.id) as nb_deliveries,
  COUNT(DISTINCT cr.id) as nb_receipts
FROM public.planteurs p
LEFT JOIN public.parcelles pa ON pa.planteur_id = p.id
LEFT JOIN public.deliveries d ON d.planteur_id = p.id
LEFT JOIN public.collection_receipts cr ON cr.planteur_id = p.id
WHERE DATE(p.created_at) = '2026-04-19'
GROUP BY p.id, p.code, p.name, p.cooperative_id, p.created_at
ORDER BY p.code;

-- 2.2 Liste des reçus de collecte
SELECT 
  cr.id,
  cr.receipt_number,
  cr.transaction_date,
  p.code as planteur_code,
  p.name as planteur_name,
  cr.created_at
FROM public.collection_receipts cr
INNER JOIN public.planteurs p ON p.id = cr.planteur_id
WHERE p.id IN (
  SELECT id FROM public.planteurs WHERE DATE(created_at) = '2026-04-19'
)
ORDER BY cr.receipt_number;

-- ============================================================================
-- ÉTAPE 3: SUPPRESSION DANS L'ORDRE CORRECT
-- ============================================================================
-- DÉCOMMENTEZ LES BLOCS CI-DESSOUS APRÈS VÉRIFICATION

-- 3.1 Supprimer les liens invoice_deliveries
/*
DELETE FROM public.invoice_deliveries
WHERE delivery_id IN (
  SELECT d.id 
  FROM public.deliveries d
  WHERE d.planteur_id IN (
    SELECT id FROM public.planteurs WHERE DATE(created_at) = '2026-04-19'
  )
);
*/

-- 3.2 Supprimer les livraisons (deliveries)
/*
DELETE FROM public.deliveries
WHERE planteur_id IN (
  SELECT id FROM public.planteurs WHERE DATE(created_at) = '2026-04-19'
);
*/

-- 3.3 Supprimer les liens receipt_deliveries
/*
DELETE FROM public.receipt_deliveries
WHERE collection_receipt_id IN (
  SELECT cr.id 
  FROM public.collection_receipts cr
  WHERE cr.planteur_id IN (
    SELECT id FROM public.planteurs WHERE DATE(created_at) = '2026-04-19'
  )
);
*/

-- 3.4 Supprimer les reçus de collecte
/*
DELETE FROM public.collection_receipts
WHERE planteur_id IN (
  SELECT id FROM public.planteurs WHERE DATE(created_at) = '2026-04-19'
);
*/

-- 3.5 Supprimer les parcelles
/*
DELETE FROM public.parcelles
WHERE DATE(created_at) = '2026-04-19';
*/

-- 3.6 Supprimer les planteurs
/*
DELETE FROM public.planteurs
WHERE DATE(created_at) = '2026-04-19';
*/

-- ============================================================================
-- ÉTAPE 4: VÉRIFICATION POST-SUPPRESSION
-- ============================================================================

-- Vérifier qu'il ne reste plus rien
SELECT 
  (SELECT COUNT(*) FROM public.planteurs WHERE DATE(created_at) = '2026-04-19') as remaining_planteurs,
  (SELECT COUNT(*) FROM public.parcelles WHERE DATE(created_at) = '2026-04-19') as remaining_parcelles,
  (SELECT COUNT(*) FROM public.collection_receipts cr 
   WHERE cr.planteur_id IN (SELECT id FROM public.planteurs WHERE DATE(created_at) = '2026-04-19')) as remaining_receipts,
  (SELECT COUNT(*) FROM public.deliveries d 
   WHERE d.planteur_id IN (SELECT id FROM public.planteurs WHERE DATE(created_at) = '2026-04-19')) as remaining_deliveries;

-- ============================================================================
-- ALTERNATIVE RECOMMANDÉE: DÉSACTIVATION AU LIEU DE SUPPRESSION
-- ============================================================================
-- Cette approche est PLUS SÛRE car elle préserve l'historique

-- Désactiver les planteurs
/*
UPDATE public.planteurs
SET is_active = false
WHERE DATE(created_at) = '2026-04-19';
*/

-- Désactiver les parcelles
/*
UPDATE public.parcelles
SET is_active = false
WHERE DATE(created_at) = '2026-04-19';
*/

-- ============================================================================
-- SCRIPT COMPLET EN UNE SEULE TRANSACTION (RECOMMANDÉ)
-- ============================================================================
-- Décommentez tout le bloc ci-dessous pour exécuter en une seule transaction
-- Si une erreur survient, TOUT sera annulé (ROLLBACK)

/*
BEGIN;

-- Supprimer invoice_deliveries
DELETE FROM public.invoice_deliveries
WHERE delivery_id IN (
  SELECT d.id FROM public.deliveries d
  WHERE d.planteur_id IN (
    SELECT id FROM public.planteurs WHERE DATE(created_at) = '2026-04-19'
  )
);

-- Supprimer deliveries
DELETE FROM public.deliveries
WHERE planteur_id IN (
  SELECT id FROM public.planteurs WHERE DATE(created_at) = '2026-04-19'
);

-- Supprimer receipt_deliveries
DELETE FROM public.receipt_deliveries
WHERE collection_receipt_id IN (
  SELECT cr.id FROM public.collection_receipts cr
  WHERE cr.planteur_id IN (
    SELECT id FROM public.planteurs WHERE DATE(created_at) = '2026-04-19'
  )
);

-- Supprimer collection_receipts
DELETE FROM public.collection_receipts
WHERE planteur_id IN (
  SELECT id FROM public.planteurs WHERE DATE(created_at) = '2026-04-19'
);

-- Supprimer parcelles
DELETE FROM public.parcelles
WHERE DATE(created_at) = '2026-04-19';

-- Supprimer planteurs
DELETE FROM public.planteurs
WHERE DATE(created_at) = '2026-04-19';

-- Si tout s'est bien passé, valider
COMMIT;

-- En cas de problème, annuler avec: ROLLBACK;
*/

-- ============================================================================
-- NOTES IMPORTANTES
-- ============================================================================
-- 1. Cette suppression affectera:
--    - Les planteurs créés le 19 avril
--    - Leurs parcelles
--    - Leurs livraisons
--    - Leurs reçus de collecte
--    - Les liens avec les factures
--
-- 2. Les factures elles-mêmes ne seront PAS supprimées, mais elles perdront
--    certaines livraisons. Vous devrez peut-être les recalculer ou les supprimer.
--
-- 3. RECOMMANDATION: Utilisez plutôt la désactivation (is_active = false)
--    au lieu de la suppression pour préserver l'historique.
--
-- 4. BACKUP: Faites ABSOLUMENT une sauvegarde complète avant d'exécuter.
--
-- 5. Si vous avez des doutes, contactez un administrateur système.
-- ============================================================================
