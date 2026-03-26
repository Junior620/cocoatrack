# Vérification du Backend - Upload de Factures Scannées

## ✅ Résumé de l'Implémentation

Le backend pour l'upload de factures scannées a été **entièrement implémenté** selon les spécifications. Voici un résumé des composants:

### 1. Base de Données ✅

**Table `scanned_invoices`** créée avec:
- ✅ Colonnes: id, invoice_id, storage_path, original_filename, file_size_bytes, mime_type, thumbnail_path, created_by, created_at
- ✅ Contraintes CHECK sur mime_type (PDF, JPEG, PNG, WEBP uniquement)
- ✅ Contrainte CHECK sur file_size_bytes (max 10MB)
- ✅ CASCADE DELETE sur invoice_id
- ✅ Index sur invoice_id, created_by, created_at

**Politiques RLS** configurées:
- ✅ SELECT: Managers et admins peuvent voir les fichiers de leur coopérative
- ✅ INSERT: Managers et admins peuvent uploader
- ✅ DELETE: Seuls les admins peuvent supprimer

**Migration**: `v2/supabase/migrations/20260320000001_scanned_invoices.sql`

### 2. API Routes ✅

Toutes les routes sont implémentées et fonctionnelles:

| Route | Méthode | Statut | Fichier |
|-------|---------|--------|---------|
| `/api/invoices/[id]/scans` | POST | ✅ | `v2/app/api/invoices/[id]/scans/route.ts` |
| `/api/invoices/[id]/scans` | GET | ✅ | `v2/app/api/invoices/[id]/scans/route.ts` |
| `/api/invoices/scans/[scanId]/download` | GET | ✅ | `v2/app/api/invoices/scans/[scanId]/download/route.ts` |
| `/api/invoices/scans/[scanId]` | DELETE | ✅ | `v2/app/api/invoices/scans/[scanId]/route.ts` |
| `/api/invoices/scans/bulk` | DELETE | ✅ | `v2/app/api/invoices/scans/bulk/route.ts` |

### 3. Services ✅

Trois services backend implémentés:

| Service | Fichier | Fonctionnalités |
|---------|---------|-----------------|
| **Validation** | `v2/lib/services/scanned-invoice-validation.ts` | Validation MIME type, taille, limite, sanitization |
| **Storage** | `v2/lib/services/scanned-invoice-storage.ts` | Upload, download (URL signée), delete, cleanup |
| **Audit** | `v2/lib/services/scanned-invoice-audit.ts` | Logging upload, download, delete |

### 4. Types et Validations ✅

- ✅ Types TypeScript: `v2/types/scanned-invoices.ts`
- ✅ Schéma Zod: `v2/lib/validations/scanned-invoice.ts`

---

## 🔍 Vérifications Manuelles Requises

### A. Vérifier la Table dans Supabase

1. Ouvrir le dashboard Supabase: https://txtncqcirhmbrnpkjmpy.supabase.co
2. Aller dans **Database** → **Tables**
3. Vérifier que la table `scanned_invoices` existe
4. Vérifier les colonnes et contraintes

**Commande SQL pour vérifier:**
```sql
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'scanned_invoices'
ORDER BY ordinal_position;
```

### B. Vérifier le Bucket Supabase Storage

1. Aller dans **Storage** dans le dashboard Supabase
2. Vérifier qu'un bucket nommé `invoice-scans` existe
3. Si le bucket n'existe pas, le créer avec:
   - **Nom**: `invoice-scans`
   - **Public**: ❌ Non (privé)
   - **File size limit**: 10MB (10485760 bytes)
   - **Allowed MIME types**: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`

**⚠️ IMPORTANT**: Le bucket doit être créé manuellement dans le dashboard Supabase.

### C. Configurer les Politiques de Storage

Les politiques de storage doivent être configurées manuellement dans le dashboard:

#### Policy 1: Upload (INSERT)
```sql
-- Operation: INSERT
-- Target roles: authenticated
-- WITH CHECK expression:
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

#### Policy 2: Download (SELECT)
```sql
-- Operation: SELECT
-- Target roles: authenticated
-- USING expression:
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

#### Policy 3: Delete (DELETE)
```sql
-- Operation: DELETE
-- Target roles: authenticated
-- USING expression:
bucket_id = 'invoice-scans'
AND public.is_admin()
```

### D. Vérifier les Politiques RLS

1. Aller dans **Database** → **Tables** → `scanned_invoices`
2. Cliquer sur **Policies**
3. Vérifier que 3 politiques existent:
   - `scanned_invoices_select_policy`
   - `scanned_invoices_insert_policy`
   - `scanned_invoices_delete_policy`

---

## 🧪 Tests Manuels avec curl

### Prérequis

1. Le serveur de développement doit être en cours d'exécution:
   ```bash
   cd v2
   npm run dev
   ```

2. Vous devez avoir un token d'authentification valide. Pour l'obtenir:
   - Connectez-vous à l'application
   - Ouvrez les DevTools (F12)
   - Allez dans **Application** → **Local Storage**
   - Copiez la valeur de `sb-txtncqcirhmbrnpkjmpy-auth-token`

3. Vous devez avoir un `invoice_id` valide d'une facture existante

### Test 1: Upload d'un Fichier

Créez un fichier PDF de test:
```bash
echo "Test PDF" > test-invoice.pdf
```

Uploadez le fichier:
```bash
curl -X POST \
  http://localhost:3000/api/invoices/YOUR_INVOICE_ID/scans \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "file=@test-invoice.pdf"
```

**Résultat attendu (201 Created):**
```json
{
  "id": "uuid",
  "invoice_id": "uuid",
  "storage_path": "cooperative_id/invoice_id/uuid_test-invoice.pdf",
  "original_filename": "test-invoice.pdf",
  "file_size_bytes": 123,
  "mime_type": "application/pdf",
  "thumbnail_path": null,
  "created_by": "uuid",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Test 2: Lister les Fichiers

```bash
curl -X GET \
  http://localhost:3000/api/invoices/YOUR_INVOICE_ID/scans \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Résultat attendu (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "invoice_id": "uuid",
      "storage_path": "...",
      "original_filename": "test-invoice.pdf",
      "file_size_bytes": 123,
      "mime_type": "application/pdf",
      "thumbnail_path": null,
      "created_by": "uuid",
      "created_by_name": "John Doe",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

### Test 3: Télécharger un Fichier

```bash
curl -X GET \
  http://localhost:3000/api/invoices/scans/YOUR_SCAN_ID/download \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Résultat attendu (200 OK):**
```json
{
  "url": "https://txtncqcirhmbrnpkjmpy.supabase.co/storage/v1/object/sign/invoice-scans/...",
  "filename": "test-invoice.pdf"
}
```

### Test 4: Supprimer un Fichier (Admin uniquement)

```bash
curl -X DELETE \
  http://localhost:3000/api/invoices/scans/YOUR_SCAN_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Résultat attendu (204 No Content):**
Pas de corps de réponse, juste le code 204.

### Test 5: Suppression Multiple (Admin uniquement)

```bash
curl -X DELETE \
  http://localhost:3000/api/invoices/scans/bulk \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scan_ids": ["SCAN_ID_1", "SCAN_ID_2"]}'
```

**Résultat attendu (200 OK):**
```json
{
  "deleted": 2,
  "failed": []
}
```

---

## 🔒 Tests de Sécurité RLS

### Test 1: Isolation par Coopérative

**Scénario**: Un manager de la coopérative A ne doit pas pouvoir accéder aux fichiers de la coopérative B.

1. Créez 2 utilisateurs managers dans 2 coopératives différentes
2. Manager A upload un fichier pour une facture de coop A
3. Manager B tente d'accéder au fichier de coop A → **Doit échouer (403 ou 404)**
4. Admin peut accéder aux fichiers des 2 coopératives → **Doit réussir**

### Test 2: Permissions de Suppression

**Scénario**: Seuls les admins peuvent supprimer des fichiers.

1. Manager tente de supprimer un fichier → **Doit échouer (403)**
2. Admin supprime le même fichier → **Doit réussir (204)**

### Test 3: Limite de 10 Fichiers

**Scénario**: Une facture ne peut pas avoir plus de 10 fichiers scannés.

1. Uploadez 10 fichiers pour une facture → **Tous doivent réussir**
2. Tentez d'uploader un 11ème fichier → **Doit échouer (400) avec message "Limite atteinte"**

---

## 📊 Vérification des Audit Logs

Après avoir effectué des opérations (upload, download, delete), vérifiez que les audit logs sont créés:

```sql
SELECT 
  action,
  table_name,
  metadata->>'operation' as operation,
  metadata->>'original_filename' as filename,
  created_at
FROM audit_logs
WHERE table_name = 'scanned_invoices'
ORDER BY created_at DESC
LIMIT 10;
```

**Résultat attendu:**
- Chaque upload doit créer un log avec action='INSERT'
- Chaque download doit créer un log avec action='SELECT'
- Chaque delete doit créer un log avec action='DELETE'

---

## ✅ Checklist de Vérification

Cochez chaque élément après vérification:

### Base de Données
- [ ] Table `scanned_invoices` existe
- [ ] Contraintes CHECK fonctionnent (MIME type, taille)
- [ ] Index sont créés
- [ ] Politiques RLS sont actives

### Storage
- [ ] Bucket `invoice-scans` existe
- [ ] Bucket est privé (non public)
- [ ] Limite de taille est 10MB
- [ ] Politiques de storage sont configurées

### API Routes
- [ ] POST /api/invoices/[id]/scans fonctionne
- [ ] GET /api/invoices/[id]/scans fonctionne
- [ ] GET /api/invoices/scans/[scanId]/download fonctionne
- [ ] DELETE /api/invoices/scans/[scanId] fonctionne (admin)
- [ ] DELETE /api/invoices/scans/bulk fonctionne (admin)

### Validation
- [ ] Types MIME invalides sont rejetés
- [ ] Fichiers > 10MB sont rejetés
- [ ] Limite de 10 fichiers par facture fonctionne

### Sécurité
- [ ] Managers ne peuvent accéder qu'aux fichiers de leur coopérative
- [ ] Seuls les admins peuvent supprimer
- [ ] Non-managers ne peuvent pas uploader

### Audit
- [ ] Uploads sont loggés
- [ ] Downloads sont loggés
- [ ] Deletes sont loggés

---

## 🚀 Prochaines Étapes

Une fois le backend vérifié, vous pouvez passer aux tâches suivantes:

1. **Tâche 6**: Composants React - Upload (FileUploader)
2. **Tâche 7**: Composants React - Liste et visualisation
3. **Tâche 8**: Intégration dans la page de détail de facture

---

## 📝 Notes

- Le bucket Supabase Storage doit être créé manuellement
- Les politiques de storage doivent être configurées manuellement
- Les tests nécessitent un token d'authentification valide
- Les tests RLS nécessitent plusieurs utilisateurs avec différents rôles

---

## 🐛 Problèmes Connus

Aucun problème connu pour le moment. Si vous rencontrez des erreurs:

1. Vérifiez que la migration a été appliquée
2. Vérifiez que le bucket existe
3. Vérifiez que les politiques RLS sont actives
4. Vérifiez les logs du serveur pour plus de détails

---

**Date de vérification**: À compléter par l'utilisateur
**Vérifié par**: À compléter par l'utilisateur
