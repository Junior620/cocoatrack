# Pourquoi les Factures Scannées sont Liées aux Coopératives?

## 🏢 Architecture de CocoaTrack V2

CocoaTrack V2 est un système multi-tenant où chaque **coopérative** est une entité indépendante avec ses propres données.

### Hiérarchie des Données

```
Coopérative (Cooperative)
  ├── Utilisateurs (Profiles)
  │   ├── Managers
  │   └── Admins
  │
  ├── Factures (Invoices)
  │   ├── Facture 1
  │   │   ├── Facture scannée 1.pdf
  │   │   ├── Facture scannée 2.jpg
  │   │   └── ...
  │   │
  │   └── Facture 2
  │       └── Facture scannée 1.pdf
  │
  └── Autres données (Planteurs, Parcelles, etc.)
```

---

## 🔗 Relation: Facture → Coopérative

### Structure de la Table `invoices`

```sql
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  cooperative_id UUID NOT NULL REFERENCES public.cooperatives(id),  -- ← Lien vers la coopérative
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_weight_kg NUMERIC(12,2) NOT NULL,
  total_amount BIGINT NOT NULL,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  pdf_path TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Chaque facture appartient à UNE coopérative** via `cooperative_id`.

### Structure de la Table `scanned_invoices`

```sql
CREATE TABLE public.scanned_invoices (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),  -- ← Lien vers la facture
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Chaque facture scannée appartient à UNE facture** via `invoice_id`.

### Relation Transitive

```
scanned_invoice → invoice → cooperative
```

**Donc, chaque facture scannée appartient indirectement à une coopérative.**

---

## 🔒 Pourquoi Organiser par Coopérative dans le Storage?

### 1. Isolation des Données (Multi-Tenancy)

**Problème**: Dans un système multi-tenant, il faut garantir que:
- Les managers de la coopérative A ne peuvent pas accéder aux fichiers de la coopérative B
- Les données de chaque coopérative sont isolées

**Solution**: Organiser les fichiers par coopérative dans le storage:

```
invoice-scans/
  cooperative-A-uuid/
    invoice-1-uuid/
      scan-1.pdf
      scan-2.jpg
  cooperative-B-uuid/
    invoice-2-uuid/
      scan-3.pdf
```

### 2. Sécurité via RLS (Row Level Security)

Les politiques de storage peuvent vérifier facilement si un utilisateur a accès à une coopérative:

```sql
-- Policy: Upload
WITH CHECK (
  bucket_id = 'invoice-scans'
  AND (storage.foldername(name))[1] IN (  -- ← Extrait cooperative_id du chemin
    SELECT cooperative_id::text
    FROM public.invoices
    WHERE id = (storage.foldername(name))[2]::uuid  -- ← Extrait invoice_id du chemin
    AND (
      public.is_admin()  -- ← Admin peut tout faire
      OR public.can_access_cooperative(cooperative_id)  -- ← Manager vérifie l'accès
    )
  )
)
```

**Explication**:
1. Le chemin du fichier est: `{cooperative_id}/{invoice_id}/{filename}`
2. La politique extrait `cooperative_id` du chemin: `(storage.foldername(name))[1]`
3. La politique extrait `invoice_id` du chemin: `(storage.foldername(name))[2]`
4. La politique vérifie que l'utilisateur a accès à cette coopérative

### 3. Performance et Organisation

**Avantages**:
- ✅ Recherche rapide: tous les fichiers d'une coopérative sont dans le même dossier
- ✅ Maintenance facile: on peut supprimer tous les fichiers d'une coopérative en une fois
- ✅ Quotas: on peut limiter l'espace de stockage par coopérative
- ✅ Backup: on peut sauvegarder les données d'une coopérative séparément

### 4. Conformité et Audit

**Avantages**:
- ✅ Traçabilité: on sait exactement quelle coopérative possède quel fichier
- ✅ RGPD: on peut supprimer toutes les données d'une coopérative si nécessaire
- ✅ Audit: on peut auditer les accès par coopérative

---

## 🎯 Exemple Concret

### Scénario

**Coopérative A**: "Cacao du Nord"
- Manager: Alice
- Facture: `INV-2024-001`
- Fichiers scannés: `facture-originale.pdf`, `photo-signature.jpg`

**Coopérative B**: "Cacao du Sud"
- Manager: Bob
- Facture: `INV-2024-002`
- Fichiers scannés: `facture-scan.pdf`

### Structure dans le Storage

```
invoice-scans/
  a1b2c3d4-e5f6-7890-abcd-ef1234567890/  ← cooperative_id de "Cacao du Nord"
    f1e2d3c4-b5a6-7890-cdef-123456789abc/  ← invoice_id de INV-2024-001
      550e8400-e29b-41d4-a716-446655440000_facture-originale.pdf
      660e8400-e29b-41d4-a716-446655440001_photo-signature.jpg
  
  b2c3d4e5-f6a7-8901-bcde-f12345678901/  ← cooperative_id de "Cacao du Sud"
    e2d3c4b5-a6f7-8901-defc-234567890bcd/  ← invoice_id de INV-2024-002
      770e8400-e29b-41d4-a716-446655440002_facture-scan.pdf
```

### Contrôle d'Accès

| Utilisateur | Rôle | Coopérative | Peut accéder à |
|-------------|------|-------------|----------------|
| Alice | Manager | Cacao du Nord | ✅ Fichiers de Cacao du Nord<br>❌ Fichiers de Cacao du Sud |
| Bob | Manager | Cacao du Sud | ❌ Fichiers de Cacao du Nord<br>✅ Fichiers de Cacao du Sud |
| Admin | Admin | - | ✅ Tous les fichiers |

### Tentative d'Accès Non Autorisé

**Scénario**: Bob (manager de Cacao du Sud) tente d'accéder à un fichier de Cacao du Nord

```bash
curl -X GET \
  http://localhost:3000/api/invoices/scans/550e8400-e29b-41d4-a716-446655440000/download \
  -H "Authorization: Bearer BOB_TOKEN"
```

**Résultat**: ❌ **403 Forbidden** ou **404 Not Found**

**Pourquoi?**
1. La politique RLS sur `scanned_invoices` vérifie que Bob a accès à la facture
2. La facture appartient à Cacao du Nord
3. Bob appartient à Cacao du Sud
4. La politique bloque l'accès

---

## 🔍 Comment ça Fonctionne en Pratique?

### Étape 1: Upload d'un Fichier

```typescript
// 1. L'utilisateur upload un fichier pour la facture INV-2024-001
POST /api/invoices/f1e2d3c4-b5a6-7890-cdef-123456789abc/scans

// 2. Le backend récupère la facture
const invoice = await supabase
  .from('invoices')
  .select('id, cooperative_id')
  .eq('id', 'f1e2d3c4-b5a6-7890-cdef-123456789abc')
  .single();

// invoice.cooperative_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

// 3. Le backend génère le chemin de stockage
const storagePath = generateStoragePath(
  invoice.cooperative_id,  // ← Coopérative de la facture
  invoice.id,
  uuid,
  filename
);

// storagePath = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890/f1e2d3c4-b5a6-7890-cdef-123456789abc/550e8400_facture.pdf'

// 4. Le backend upload le fichier
await supabase.storage
  .from('invoice-scans')
  .upload(storagePath, file);

// 5. La politique de storage vérifie:
//    - Le chemin commence par la cooperative_id de l'utilisateur? ✅
//    - L'utilisateur a accès à cette coopérative? ✅
//    - Upload autorisé ✅
```

### Étape 2: Téléchargement d'un Fichier

```typescript
// 1. L'utilisateur demande à télécharger un fichier
GET /api/invoices/scans/550e8400-e29b-41d4-a716-446655440000/download

// 2. Le backend récupère le fichier scanné
const scan = await supabase
  .from('scanned_invoices')
  .select('storage_path')
  .eq('id', '550e8400-e29b-41d4-a716-446655440000')
  .single();

// scan.storage_path = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890/f1e2d3c4-b5a6-7890-cdef-123456789abc/550e8400_facture.pdf'

// 3. Le backend génère une URL signée
const { data } = await supabase.storage
  .from('invoice-scans')
  .createSignedUrl(scan.storage_path, 60);

// 4. La politique de storage vérifie:
//    - Le chemin contient la cooperative_id de l'utilisateur? ✅
//    - L'utilisateur a accès à cette coopérative? ✅
//    - Téléchargement autorisé ✅
```

---

## 📊 Résumé

### Pourquoi lier aux coopératives?

| Raison | Bénéfice |
|--------|----------|
| **Isolation des données** | Chaque coopérative a ses propres fichiers |
| **Sécurité** | Les managers ne peuvent accéder qu'aux fichiers de leur coopérative |
| **Performance** | Recherche et organisation optimisées |
| **Conformité** | Traçabilité et audit par coopérative |
| **Maintenance** | Gestion facile des données par coopérative |

### Structure des Chemins

```
{cooperative_id}/{invoice_id}/{uuid}_{filename}
     ↓               ↓              ↓
  Isolation      Facture        Unicité
```

### Contrôle d'Accès

```
Utilisateur → Coopérative → Facture → Fichier Scanné
              ↑
              └─ Vérifié par RLS
```

---

## ❓ Questions Fréquentes

### Q: Pourquoi ne pas juste utiliser `invoice_id` dans le chemin?

**R**: Parce que les politiques de storage ont besoin de vérifier rapidement si un utilisateur a accès à un fichier. Avec `cooperative_id` dans le chemin, la politique peut extraire directement la coopérative du chemin sans faire de jointure avec la table `invoices`.

### Q: Est-ce que les admins peuvent accéder à tous les fichiers?

**R**: Oui, les admins ont accès à tous les fichiers de toutes les coopératives. C'est vérifié par la fonction `is_admin()` dans les politiques.

### Q: Que se passe-t-il si une facture change de coopérative?

**R**: Dans CocoaTrack V2, une facture ne peut pas changer de coopérative. La `cooperative_id` est une clé étrangère NOT NULL et ne peut pas être modifiée après la création.

### Q: Comment supprimer tous les fichiers d'une coopérative?

**R**: Vous pouvez supprimer le dossier entier dans le storage:

```typescript
await supabase.storage
  .from('invoice-scans')
  .remove([`${cooperative_id}/`]);
```

---

**En résumé**: L'organisation par coopérative dans le storage est une décision d'architecture qui garantit la sécurité, l'isolation des données, et la performance du système multi-tenant de CocoaTrack V2.
