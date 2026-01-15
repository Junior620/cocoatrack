# Checkpoint 3: Vérifier Migrations Parcelles Orphelines

Ce document guide la vérification des migrations pour le support des parcelles orphelines.

## Prérequis

Les migrations suivantes doivent être exécutées dans Supabase SQL Editor:
1. `20250110000001_parcelles_orphan_support.sql` - Parcelles orphelines
2. `20250110000002_parcelles_rls_orphan_support.sql` - Policies RLS
3. `20250110000003_planteurs_name_norm.sql` - Normalisation des noms

## Étapes de vérification

### 1. Exécuter les migrations

Dans Supabase SQL Editor, exécutez chaque fichier de migration dans l'ordre:

```bash
# Option A: Via Supabase CLI (local)
cd v2
supabase db reset  # Réinitialise et applique toutes les migrations

# Option B: Via SQL Editor (production)
# Copiez-collez le contenu de chaque fichier de migration
```

### 2. Vérifier la structure des tables

Exécutez le script de vérification:
```sql
-- Copiez le contenu de verify_parcelles_orphan_migrations.sql
```

### 3. Checklist de vérification

#### Structure parcelles
- [ ] `planteur_id` est nullable
- [ ] `code` est nullable
- [ ] Contrainte `parcelles_orphan_requires_import` existe
- [ ] Contrainte `parcelles_code_required_when_assigned` existe
- [ ] Index `parcelles_unique_code_per_planteur` existe
- [ ] Index `idx_parcelles_orphan` existe

#### Structure planteurs
- [ ] Colonne `name_norm` existe (NOT NULL)
- [ ] Colonne `auto_created` existe (default false)
- [ ] Colonne `created_via_import_id` existe
- [ ] Index `planteurs_unique_name_norm_per_coop` existe
- [ ] Trigger `planteur_name_norm_trigger` existe

#### RLS Policies
- [ ] Policy `parcelles_select` existe
- [ ] Policy `parcelles_insert` existe
- [ ] Policy `parcelles_update` existe

#### Fonctions
- [ ] Fonction `normalize_planteur_name` existe
- [ ] Extension `unaccent` est installée

### 4. Tests de contraintes

#### Test 1: Orpheline sans import_file_id (doit échouer)
```sql
INSERT INTO public.parcelles (id, planteur_id, import_file_id, code, label, geometry, is_active)
VALUES (
  gen_random_uuid(), 
  NULL,  -- orpheline
  NULL,  -- pas d'import_file_id
  NULL, 
  'Test', 
  ST_GeomFromText('MULTIPOLYGON(((0 0, 1 0, 1 1, 0 1, 0 0)))', 4326), 
  true
);
-- Attendu: ERROR violates check constraint "parcelles_orphan_requires_import"
```

#### Test 2: Assignée sans code (doit échouer)
```sql
-- Remplacez 'valid-planteur-uuid' par un UUID de planteur existant
INSERT INTO public.parcelles (id, planteur_id, import_file_id, code, label, geometry, is_active)
VALUES (
  gen_random_uuid(), 
  'valid-planteur-uuid',  -- assignée
  NULL, 
  NULL,  -- pas de code
  'Test', 
  ST_GeomFromText('MULTIPOLYGON(((0 0, 1 0, 1 1, 0 1, 0 0)))', 4326), 
  true
);
-- Attendu: ERROR violates check constraint "parcelles_code_required_when_assigned"
```

### 5. Test de normalisation des noms

```sql
SELECT 
  'Konan Yao' AS input,
  public.normalize_planteur_name('Konan Yao') AS normalized
UNION ALL
SELECT 'KONAN YAO', public.normalize_planteur_name('KONAN YAO')
UNION ALL
SELECT '  konan  yao  ', public.normalize_planteur_name('  konan  yao  ')
UNION ALL
SELECT 'Éric Müller', public.normalize_planteur_name('Éric Müller');

-- Attendu:
-- 'Konan Yao' → 'konan yao'
-- 'KONAN YAO' → 'konan yao'
-- '  konan  yao  ' → 'konan yao'
-- 'Éric Müller' → 'eric muller'
```

### 6. Test RLS avec utilisateur de coopérative

```sql
-- 1. Créer un import_file de test pour une coopérative
INSERT INTO public.parcel_import_files (id, cooperative_id, filename, status, created_by)
VALUES (
  gen_random_uuid(),
  'votre-cooperative-id',  -- Remplacez par un ID de coopérative valide
  'test_import.zip',
  'completed',
  'votre-user-id'  -- Remplacez par un ID utilisateur valide
)
RETURNING id;

-- 2. Créer une parcelle orpheline avec cet import_file_id
INSERT INTO public.parcelles (id, planteur_id, import_file_id, label, geometry, is_active)
VALUES (
  gen_random_uuid(),
  NULL,  -- orpheline
  'import-file-id-from-step-1',  -- Remplacez par l'ID retourné
  'Parcelle Test Orpheline',
  ST_GeomFromText('MULTIPOLYGON(((0 0, 1 0, 1 1, 0 1, 0 0)))', 4326),
  true
);

-- 3. Vérifier que la parcelle est visible pour les utilisateurs de la coopérative
-- (Connectez-vous avec un utilisateur de la coopérative et vérifiez)
```

## Résultat attendu

Si toutes les vérifications passent:
- ✅ Les parcelles peuvent être créées sans planteur (orphelines)
- ✅ Les parcelles orphelines nécessitent un import_file_id
- ✅ Les parcelles assignées nécessitent un code
- ✅ Les noms de planteurs sont normalisés automatiquement
- ✅ RLS fonctionne pour les parcelles orphelines via import_file

## Problèmes courants

### Extension unaccent non disponible
```sql
-- Vérifier si l'extension est disponible
SELECT * FROM pg_available_extensions WHERE name = 'unaccent';

-- Si non disponible, contacter le support Supabase
```

### Contrainte échoue sur données existantes
```sql
-- Vérifier les parcelles problématiques
SELECT id, planteur_id, import_file_id, code 
FROM public.parcelles 
WHERE (planteur_id IS NULL AND import_file_id IS NULL)
   OR (planteur_id IS NOT NULL AND code IS NULL);

-- Corriger les données avant d'appliquer les contraintes
```
