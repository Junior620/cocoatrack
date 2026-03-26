# Guide: Configuration des Politiques de Storage via le Dashboard Supabase

Ce guide explique comment configurer manuellement les politiques de storage pour le bucket `invoice-scans` via le Dashboard Supabase.

## ⚠️ IMPORTANT: Pourquoi via le Dashboard ?

**L'erreur "must be owner of relation objects" est normale.** Les politiques de storage Supabase ne peuvent pas être créées via SQL standard car elles nécessitent des permissions spéciales sur la table `storage.objects`. Le Dashboard Supabase fournit une interface dédiée pour gérer ces politiques.

**NE PAS exécuter le fichier `setup_storage_policies.sql` directement dans le SQL Editor.**

## Prérequis

1. ✅ Le bucket `invoice-scans` doit être créé (voir étape 1 ci-dessous)
2. ✅ Les fonctions helper `is_admin()` et `can_access_cooperative()` doivent exister dans votre base de données
3. ✅ Vous devez être connecté au Dashboard Supabase avec les permissions appropriées

## Étape 1: Créer le Bucket

1. Allez dans **Storage** dans le menu latéral gauche
2. Cliquez sur **New bucket** (bouton vert en haut à droite)
3. Configurez le bucket :
   - **Name**: `invoice-scans`
   - **Public**: ❌ **Décoché** (le bucket doit être privé)
   - **File size limit**: `10485760` (10MB en bytes)
   - **Allowed MIME types**: Laissez vide pour l'instant (nous allons le configurer après)
4. Cliquez sur **Create bucket**

## Étape 2: Configurer les MIME Types Autorisés

1. Dans la liste des buckets, cliquez sur le bucket `invoice-scans`
2. Cliquez sur l'icône **Settings** (⚙️) ou sur les trois points (...) puis **Settings**
3. Faites défiler jusqu'à la section **Allowed MIME types**
4. Ajoutez ces types MIME (un par ligne) :
   ```
   application/pdf
   image/jpeg
   image/png
   image/webp
   ```
5. Cliquez sur **Save**

## Étape 3: Créer les Politiques de Storage

### 🔐 Politique 1: Upload (INSERT)

**Permet aux managers et admins d'uploader des fichiers dans leur coopérative**

1. Dans le bucket `invoice-scans`, cliquez sur l'onglet **Policies**
2. Cliquez sur **New policy**
3. Sélectionnez **For full customization** (ou "Create a policy from scratch")
4. Configurez la politique :
   - **Policy name**: `Allow authenticated users to upload to their cooperative folder`
   - **Allowed operation**: Cochez **INSERT** uniquement
   - **Target roles**: Sélectionnez `authenticated`
   - **WITH CHECK expression** (copiez-collez exactement) :
     ```sql
     bucket_id = 'invoice-scans'
     AND (storage.foldername(name))[1] IN (
       SELECT cooperative_id::text
       FROM public.invoices
       WHERE id = (storage.foldername(name))[2]::uuid
       AND (
         public.is_admin()
         OR public.can_access_cooperative(cooperative_id)
       )
     )
     ```
5. Cliquez sur **Review** puis **Save policy**

### 📥 Politique 2: Download (SELECT)

**Permet aux managers et admins de télécharger des fichiers de leur coopérative**

1. Cliquez sur **New policy** à nouveau
2. Sélectionnez **For full customization**
3. Configurez la politique :
   - **Policy name**: `Allow authenticated users to download from their cooperative folder`
   - **Allowed operation**: Cochez **SELECT** uniquement
   - **Target roles**: Sélectionnez `authenticated`
   - **USING expression** (copiez-collez exactement) :
     ```sql
     bucket_id = 'invoice-scans'
     AND (storage.foldername(name))[1] IN (
       SELECT cooperative_id::text
       FROM public.invoices
       WHERE id = (storage.foldername(name))[2]::uuid
       AND (
         public.is_admin()
         OR public.can_access_cooperative(cooperative_id)
       )
     )
     ```
4. Cliquez sur **Review** puis **Save policy**

### 🗑️ Politique 3: Delete (DELETE)

**Permet uniquement aux admins de supprimer des fichiers**

1. Cliquez sur **New policy** à nouveau
2. Sélectionnez **For full customization**
3. Configurez la politique :
   - **Policy name**: `Allow only admins to delete files`
   - **Allowed operation**: Cochez **DELETE** uniquement
   - **Target roles**: Sélectionnez `authenticated`
   - **USING expression** (copiez-collez exactement) :
     ```sql
     bucket_id = 'invoice-scans'
     AND public.is_admin()
     ```
4. Cliquez sur **Review** puis **Save policy**

## ✅ Étape 4: Vérification

Pour vérifier que les politiques ont été créées correctement, exécutez cette requête SQL dans le **SQL Editor** :

```sql
SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN cmd = 'INSERT' THEN 'Upload'
    WHEN cmd = 'SELECT' THEN 'Download'
    WHEN cmd = 'DELETE' THEN 'Delete'
    ELSE cmd
  END as description
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname IN (
    'Allow authenticated users to upload to their cooperative folder',
    'Allow authenticated users to download from their cooperative folder',
    'Allow only admins to delete files'
  )
ORDER BY cmd;
```

**Résultat attendu** : Vous devriez voir 3 lignes (une pour chaque politique).

## 📊 Résumé de la Structure des Politiques

| Politique | Opération | Qui peut ? | Condition |
|-----------|-----------|------------|-----------|
| Upload | INSERT | Managers & Admins | Seulement dans leur coopérative |
| Download | SELECT | Managers & Admins | Seulement depuis leur coopérative |
| Delete | DELETE | Admins uniquement | Tous les fichiers du bucket |

## 🔧 Dépannage

### ❌ Erreur: "must be owner of relation objects"

**C'est normal !** Vous essayez d'exécuter le fichier SQL directement. Suivez ce guide pour créer les politiques via le Dashboard à la place.

### ❌ Erreur: "function storage.foldername does not exist"

Cette fonction devrait exister par défaut dans Supabase. Si elle n'existe pas, contactez le support Supabase ou vérifiez que vous utilisez une version récente de Supabase.

### ❌ Erreur: "function public.is_admin does not exist"

Vous devez créer les fonctions helper. Exécutez le fichier `v2/supabase/verify_helper_functions.sql` pour vérifier qu'elles existent. Si elles n'existent pas, elles devraient être créées par les migrations précédentes.

### ❌ Les uploads échouent avec "new row violates row-level security policy"

Vérifiez que :
1. ✅ L'utilisateur est authentifié (connecté)
2. ✅ L'utilisateur a le rôle `manager` ou `admin` dans la table `profiles`
3. ✅ L'utilisateur a accès à la coopérative (via `can_access_cooperative()`)
4. ✅ Le chemin du fichier suit la structure : `{cooperative_id}/{invoice_id}/{filename}`

Pour déboguer, exécutez :
```sql
-- Remplacez USER_ID et COOPERATIVE_ID par les vraies valeurs
SELECT 
  public.is_admin() as is_admin,
  public.can_access_cooperative('COOPERATIVE_ID'::uuid) as can_access_coop
FROM auth.users
WHERE id = 'USER_ID'::uuid;
```

## 📝 Notes Importantes

1. **Ordre des opérations** : Créez toujours le bucket AVANT les politiques
2. **MIME types** : Configurez les MIME types autorisés pour une sécurité supplémentaire
3. **Test** : Testez chaque politique après création avec un utilisateur test
4. **Backup** : Les expressions SQL des politiques sont sauvegardées dans `setup_storage_policies.sql` pour référence future
5. **Sécurité** : Ces politiques fonctionnent en conjonction avec les politiques RLS sur la table `scanned_invoices` pour une défense en profondeur

## 🎯 Prochaines Étapes

Une fois les politiques créées :
1. ✅ Vérifiez avec la requête SQL de l'étape 4
2. ✅ Testez un upload via l'API
3. ✅ Testez un téléchargement via l'API
4. ✅ Testez la suppression (en tant qu'admin)
5. ✅ Continuez avec les tâches suivantes du spec
