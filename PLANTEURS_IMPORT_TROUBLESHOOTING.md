# Planteurs Import Troubleshooting

## Problème
L'import des planteurs s'est exécuté avec succès, mais les planteurs ne sont pas visibles dans le frontend.

## Cause
Les politiques RLS (Row Level Security) pour la table `planteurs` n'ont pas été mises à jour pour gérer les planteurs avec `cooperative_id = NULL`. Seule la politique SELECT a été mise à jour, mais pas les politiques INSERT, UPDATE et DELETE.

## Solution

### Étape 1: Vérifier si les planteurs ont été créés
Exécutez le script `CHECK_PLANTEURS_IMPORT.sql` dans Supabase SQL Editor pour vérifier:
1. Si les planteurs avec `cooperative_id = NULL` existent
2. Le statut de l'import
3. Les logs d'audit

```sql
-- Voir le fichier: v2/CHECK_PLANTEURS_IMPORT.sql
```

### Étape 2: Appliquer le correctif RLS
Exécutez le script `APPLY_PLANTEURS_RLS_FIX.sql` dans Supabase SQL Editor:

```sql
-- Voir le fichier: v2/APPLY_PLANTEURS_RLS_FIX.sql
```

Ce script va:
1. Supprimer toutes les anciennes politiques RLS pour `planteurs`
2. Créer de nouvelles politiques qui supportent `cooperative_id = NULL`
3. Vérifier que les politiques ont été créées correctement

### Étape 3: Vérifier les politiques RLS
Après avoir appliqué le script, vérifiez que les 4 politiques ont été créées:

```sql
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'planteurs'
ORDER BY policyname;
```

Vous devriez voir:
- `planteurs_select` (SELECT)
- `planteurs_insert` (INSERT)
- `planteurs_update` (UPDATE)
- `planteurs_delete` (DELETE)

### Étape 4: Tester dans le frontend
1. Rafraîchissez la page des planteurs
2. Les planteurs importés devraient maintenant être visibles
3. Vous devriez pouvoir les modifier et leur assigner une coopérative

## Détails techniques

### Politiques RLS mises à jour

**SELECT**: Permet de voir les planteurs si:
- L'utilisateur a accès à la coopérative (via `can_access_cooperative`)
- OU le planteur n'a pas de coopérative ET a été créé par l'utilisateur

**INSERT**: Permet de créer des planteurs si:
- L'utilisateur est agent ou supérieur
- ET (a accès à la coopérative OU le planteur n'a pas de coopérative ET est le créateur)

**UPDATE**: Permet de modifier des planteurs si:
- L'utilisateur est admin
- OU a accès à la coopérative
- OU le planteur n'a pas de coopérative ET a été créé par l'utilisateur

**DELETE**: Seuls les admins peuvent supprimer (soft delete via `is_active` préféré)

## Fichiers créés
- `v2/supabase/migrations/20260309000002_fix_planteurs_rls_null_cooperative.sql` - Migration
- `v2/APPLY_PLANTEURS_RLS_FIX.sql` - Script à appliquer manuellement
- `v2/CHECK_PLANTEURS_IMPORT.sql` - Script de vérification
- `v2/PLANTEURS_IMPORT_TROUBLESHOOTING.md` - Ce document

## Prochaines étapes
Après avoir appliqué le correctif RLS, vous pourrez:
1. Voir les planteurs importés dans le frontend
2. Les modifier individuellement
3. Leur assigner une coopérative manuellement
4. Continuer à importer d'autres planteurs sans coopérative
