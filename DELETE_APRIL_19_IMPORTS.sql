-- ============================================================================
-- Suppression des planteurs et parcelles créés le 19 avril 2026
-- Issus de l'import de parcelles
-- ============================================================================
-- ATTENTION: Cette opération est IRREVERSIBLE
-- Vérifiez d'abord avec les requêtes SELECT avant d'exécuter les DELETE
-- ============================================================================

-- ============================================================================
-- ÉTAPE 1: VÉRIFICATION - Comptez d'abord ce qui sera supprimé
-- ============================================================================

-- Compter les parcelles créées le 19 avril 2026
SELECT COUNT(*) as parcelles_count
FROM public.parcelles
WHERE DATE(created_at) = '2026-04-19';

-- Compter les planteurs créés le 19 avril 2026
SELECT COUNT(*) as planteurs_count
FROM public.planteurs
WHERE DATE(created_at) = '2026-04-19';

-- Voir les détails des parcelles qui seront supprimées
SELECT 
  id,
  code,
  label,
  planteur_id,
  source,
  import_file_id,
  created_at,
  created_by
FROM public.parcelles
WHERE DATE(created_at) = '2026-04-19'
ORDER BY created_at;

-- Voir les détails des planteurs qui seront supprimés
SELECT 
  id,
  code,
  name,
  cooperative_id,
  created_at,
  created_by
FROM public.planteurs
WHERE DATE(created_at) = '2026-04-19'
ORDER BY created_at;

-- ============================================================================
-- ÉTAPE 2: SUPPRESSION - Exécutez ces requêtes SEULEMENT après vérification
-- ============================================================================

-- IMPORTANT: Décommentez les lignes ci-dessous pour exécuter la suppression

-- Supprimer les parcelles créées le 19 avril 2026
-- Les parcelles seront supprimées en premier car elles référencent les planteurs
/*
DELETE FROM public.parcelles
WHERE DATE(created_at) = '2026-04-19';
*/

-- Supprimer les planteurs créés le 19 avril 2026
-- ATTENTION: Cela supprimera aussi toutes les parcelles associées (CASCADE)
/*
DELETE FROM public.planteurs
WHERE DATE(created_at) = '2026-04-19';
*/

-- ============================================================================
-- ALTERNATIVE: Suppression par import_file_id (plus précis)
-- ============================================================================
-- Si vous connaissez l'ID du fichier d'import, utilisez cette méthode

-- Trouver les fichiers d'import du 19 avril 2026
SELECT 
  id,
  filename,
  file_type,
  cooperative_id,
  planteur_id,
  nb_features,
  nb_applied,
  created_at,
  applied_at
FROM public.parcel_import_files
WHERE DATE(created_at) = '2026-04-19'
ORDER BY created_at;

-- Supprimer les parcelles d'un import spécifique
-- Remplacez 'IMPORT_FILE_ID' par l'ID réel du fichier d'import
/*
DELETE FROM public.parcelles
WHERE import_file_id = 'IMPORT_FILE_ID';
*/

-- Supprimer le fichier d'import lui-même (après avoir supprimé les parcelles)
/*
DELETE FROM public.parcel_import_files
WHERE id = 'IMPORT_FILE_ID';
*/

-- ============================================================================
-- ÉTAPE 3: VÉRIFICATION POST-SUPPRESSION
-- ============================================================================

-- Vérifier que les parcelles ont été supprimées
SELECT COUNT(*) as remaining_parcelles
FROM public.parcelles
WHERE DATE(created_at) = '2026-04-19';

-- Vérifier que les planteurs ont été supprimés
SELECT COUNT(*) as remaining_planteurs
FROM public.planteurs
WHERE DATE(created_at) = '2026-04-19';

-- ============================================================================
-- NOTES IMPORTANTES
-- ============================================================================
-- 1. La suppression des planteurs supprimera automatiquement leurs parcelles
--    grâce à la contrainte ON DELETE CASCADE
-- 
-- 2. Si vous voulez garder les planteurs mais supprimer seulement les parcelles,
--    exécutez SEULEMENT la suppression des parcelles
--
-- 3. Si les planteurs ont des livraisons (deliveries), la suppression échouera
--    car il y a une contrainte de clé étrangère. Dans ce cas, vous devrez:
--    a) Soit supprimer d'abord les livraisons
--    b) Soit désactiver les planteurs au lieu de les supprimer (is_active = false)
--
-- 4. BACKUP: Assurez-vous d'avoir une sauvegarde avant de supprimer
-- ============================================================================

-- Alternative: Désactiver au lieu de supprimer (RECOMMANDÉ si des données liées existent)
/*
UPDATE public.planteurs
SET is_active = false
WHERE DATE(created_at) = '2026-04-19';

UPDATE public.parcelles
SET is_active = false
WHERE DATE(created_at) = '2026-04-19';
*/
