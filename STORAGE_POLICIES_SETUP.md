# Configuration des Politiques de Storage - invoice-scans

Ce guide vous aide à configurer les politiques de storage pour le bucket `invoice-scans` dans Supabase.

## Prérequis

1. Le bucket `invoice-scans` doit exister
2. Vous devez être connecté au dashboard Supabase avec des droits d'administration

---

## Étape 1: Créer le Bucket (si pas encore fait)

1. Ouvrez le dashboard Supabase: https://txtncqcirhmbrnpkjmpy.supabase.co
2. Allez dans **Storage** (icône de dossier dans le menu de gauche)
3. Cliquez sur **New bucket**
4. Configurez le bucket:
   - **Name**: `invoice-scans`
   - **Public bucket**: ❌ **Décoché** (le bucket doit être privé)
   - **File size limit**: `10485760` (10MB en bytes)
   - **Allowed MIME types**: Laissez vide pour l'instant (on va le configurer via les politiques)
5. Cliquez sur **Create bucket**

---

## Étape 2: Accéder aux Politiques du Bucket

1. Dans **Storage**, cliquez sur le bucket `invoice-scans`
2. Cliquez sur l'onglet **Policies** en haut
3. Vous devriez voir "No policies created yet"

---

## Étape 3: Créer la Politique d'Upload (INSERT)

Cette politique permet aux utilisateurs d'uploader des fichiers dans le dossier de leur coopérative.

### 3.1 Créer la Politique

1. Cliquez sur **New policy**
2. Choisissez **For full customization** (ou "Create a policy from scratch")
3. Remplissez les champs:

**Policy name:**
```
Allow authenticated users to upload to their cooperative folder
```

**Allowed operation:**
- ✅ Cochez **INSERT** uniquement

**Target roles:**
- Sélectionnez **authenticated**

**WITH CHECK expression:**
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

### 3.2 Explication de la Politique

Cette politique vérifie:
1. Le fichier est uploadé dans le bucket `invoice-scans`
2. Le chemin du fichier suit la structure: `{cooperative_id}/{invoice_id}/{filename}`
3. L'utilisateur est soit:
   - Un admin (peut uploader partout)
   - Un manager qui a accès à la coopérative spécifiée

---

## Étape 4: Créer la Politique de Téléchargement (SELECT)

Cette politique permet aux utilisateurs de télécharger des fichiers de leur coopérative.

### 4.1 Créer la Politique

1. Cliquez sur **New policy**
2. Choisissez **For full customization**
3. Remplissez les champs:

**Policy name:**
```
Allow authenticated users to download from their cooperative folder
```

**Allowed operation:**
- ✅ Cochez **SELECT** uniquement

**Target roles:**
- Sélectionnez **authenticated**

**USING expression:**
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

### 4.2 Explication de la Politique

Cette politique vérifie:
1. Le fichier est dans le bucket `invoice-scans`
2. L'utilisateur a accès à la coopérative du fichier
3. Les admins peuvent télécharger tous les fichiers

---

## Étape 5: Créer la Politique de Suppression (DELETE)

Cette politique permet uniquement aux admins de supprimer des fichiers.

### 5.1 Créer la Politique

1. Cliquez sur **New policy**
2. Choisissez **For full customization**
3. Remplissez les champs:

**Policy name:**
```
Allow only admins to delete files
```

**Allowed operation:**
- ✅ Cochez **DELETE** uniquement

**Target roles:**
- Sélectionnez **authenticated**

**USING expression:**
```sql
bucket_id = 'invoice-scans'
AND public.is_admin()
```

4. Cliquez sur **Review** puis **Save policy**

### 5.2 Explication de la Politique

Cette politique vérifie:
1. Le fichier est dans le bucket `invoice-scans`
2. L'utilisateur est un admin (seuls les admins peuvent supprimer)

---

## Étape 6: Vérifier les Politiques

Après avoir créé les 3 politiques, vous devriez voir:

```
┌─────────────────────────────────────────────────────────────────┐
│ Policies for bucket: invoice-scans                              │
├─────────────────────────────────────────────────────────────────┤
│ 1. Allow authenticated users to upload to their cooperative... │
│    Operation: INSERT                                            │
│    Target roles: authenticated                                  │
│                                                                 │
│ 2. Allow authenticated users to download from their coopera... │
│    Operation: SELECT                                            │
│    Target roles: authenticated                                  │
│                                                                 │
│ 3. Allow only admins to delete files                           │
│    Operation: DELETE                                            │
│    Target roles: authenticated                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Étape 7: Tester les Politiques

### Test 1: Upload

Essayez d'uploader un fichier via l'API:

```bash
curl -X POST \
  http://localhost:3000/api/invoices/YOUR_INVOICE_ID/scans \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.pdf"
```

**Résultat attendu**: 201 Created (si vous êtes manager/admin de la bonne coopérative)

### Test 2: Download

Essayez de télécharger un fichier:

```bash
curl -X GET \
  http://localhost:3000/api/invoices/scans/SCAN_ID/download \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Résultat attendu**: 200 OK avec une URL signée

### Test 3: Delete (Admin uniquement)

Essayez de supprimer un fichier:

```bash
curl -X DELETE \
  http://localhost:3000/api/invoices/scans/SCAN_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Résultat attendu**: 
- 204 No Content (si vous êtes admin)
- 403 Forbidden (si vous n'êtes pas admin)

---

## Dépannage

### Erreur: "new row violates row-level security policy"

**Cause**: Les politiques RLS sur la table `scanned_invoices` ou les politiques de storage bloquent l'opération.

**Solution**:
1. Vérifiez que vous êtes bien manager ou admin
2. Vérifiez que vous avez accès à la coopérative de la facture
3. Vérifiez que les fonctions `is_admin()` et `can_access_cooperative()` existent dans votre base de données

### Erreur: "storage/object-not-found"

**Cause**: Le fichier n'existe pas dans le storage ou vous n'avez pas les permissions pour y accéder.

**Solution**:
1. Vérifiez que le fichier a bien été uploadé
2. Vérifiez le chemin du fichier dans la table `scanned_invoices`
3. Vérifiez que vous avez accès à la coopérative du fichier

### Erreur: "storage/unauthorized"

**Cause**: Les politiques de storage bloquent l'accès.

**Solution**:
1. Vérifiez que les politiques sont bien configurées
2. Vérifiez que vous êtes authentifié
3. Vérifiez que votre token est valide

---

## Vérification SQL

Pour vérifier que les politiques sont bien créées, exécutez cette requête SQL:

```sql
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%invoice-scans%'
ORDER BY policyname;
```

Vous devriez voir 3 politiques.

---

## Alternative: Configuration via SQL

Si vous préférez configurer les politiques via SQL, vous pouvez exécuter ces commandes dans l'éditeur SQL de Supabase:

```sql
-- Policy 1: Upload (INSERT)
CREATE POLICY "Allow authenticated users to upload to their cooperative folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
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
);

-- Policy 2: Download (SELECT)
CREATE POLICY "Allow authenticated users to download from their cooperative folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
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
);

-- Policy 3: Delete (DELETE)
CREATE POLICY "Allow only admins to delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoice-scans'
  AND public.is_admin()
);
```

---

## Résumé

✅ **Politiques créées:**
1. INSERT - Permet aux managers/admins d'uploader dans leur coopérative
2. SELECT - Permet aux managers/admins de télécharger depuis leur coopérative
3. DELETE - Permet uniquement aux admins de supprimer

✅ **Sécurité:**
- Isolation par coopérative
- Seuls les utilisateurs authentifiés peuvent accéder
- Seuls les admins peuvent supprimer

✅ **Structure des chemins:**
```
invoice-scans/
  {cooperative_id}/
    {invoice_id}/
      {uuid}_{filename}
```

---

**Prochaine étape**: Testez les API routes avec les commandes curl fournies dans `SCANNED_INVOICES_VERIFICATION.md`
