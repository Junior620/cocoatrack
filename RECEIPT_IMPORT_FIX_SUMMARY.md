# Fix: Import de Reçu sans Coopérative

## 🔴 Problème

Lors de l'import d'un reçu de collecte sans coopérative, l'application génère l'erreur suivante:

```
Erreur lors de la création des livraisons: null value in column "cooperative_id" 
of relation "dashboard_aggregates" violates not-null constraint
```

**Contexte**: L'utilisateur essaie d'importer un reçu de collecte qui n'est pas associé à une coopérative spécifique.

## 🔍 Analyse

Le problème se produit à trois niveaux:

### 1. Schéma de la table `deliveries`
```sql
CREATE TABLE public.deliveries (
  ...
  cooperative_id UUID NOT NULL,  -- ❌ Ne permet pas NULL
  warehouse_id UUID NOT NULL,    -- ❌ Ne permet pas NULL
  ...
);
```

### 2. Code d'import de reçus
Le service `receipt-import-service.ts` crée des livraisons sans spécifier `cooperative_id` ni `warehouse_id` quand ces informations ne sont pas disponibles:

```typescript
return {
  code,
  cooperative_id: data.cooperativeId,  // Peut être NULL
  planteur_id: data.planteurId,
  chef_planteur_id: data.chefPlanteurId || null,
  weight_kg: line.netWeight,
  // ... pas de warehouse_id
};
```

### 3. Trigger `update_dashboard_aggregates`
Le trigger s'exécute automatiquement lors de l'insertion de livraisons et essaie d'insérer dans `dashboard_aggregates`:

```sql
INSERT INTO public.dashboard_aggregates (
  cooperative_id,  -- ❌ Reçoit NULL, viole la contrainte NOT NULL
  period_date, 
  ...
)
VALUES (v_new_coop_id, v_new_day, ...);
```

## ✅ Solution

Trois modifications ont été apportées:

### 1. Modification du trigger `update_dashboard_aggregates`
**Fichier**: `20260420000001_fix_dashboard_aggregates_null_cooperative.sql`

Le trigger vérifie maintenant si `cooperative_id` est NULL avant d'insérer dans `dashboard_aggregates`:

```sql
IF TG_OP = 'INSERT' THEN
  -- Only aggregate if new cooperative exists
  IF v_new_coop_id IS NOT NULL THEN
    INSERT INTO public.dashboard_aggregates (...)
    VALUES (...);
  END IF;
  RETURN NEW;
END IF;
```

**Logique**: Les agrégats du dashboard sont par coopérative, donc il est logique de ne pas agréger les livraisons sans coopérative.

### 2. Rendre `cooperative_id` nullable
**Fichier**: `20260420000002_make_deliveries_cooperative_nullable.sql`

```sql
ALTER TABLE public.deliveries 
  ALTER COLUMN cooperative_id DROP NOT NULL;
```

**Justification**: Permet de créer des livraisons qui ne sont pas associées à une coopérative spécifique.

### 3. Rendre `warehouse_id` nullable
**Fichier**: `20260420000003_make_deliveries_warehouse_nullable.sql`

```sql
ALTER TABLE public.deliveries 
  ALTER COLUMN warehouse_id DROP NOT NULL;
```

**Justification**: Les imports de reçus ne spécifient pas d'entrepôt. L'entrepôt peut être assigné ultérieurement.

## 🚀 Application du Fix

### Option 1: Script SQL combiné (Recommandé)
Exécutez le fichier `FIX_RECEIPT_IMPORT_NULL_COOPERATIVE.sql` dans le SQL Editor de Supabase:

1. Ouvrez votre projet Supabase
2. Allez dans SQL Editor
3. Copiez-collez le contenu de `FIX_RECEIPT_IMPORT_NULL_COOPERATIVE.sql`
4. Cliquez sur "Run"

### Option 2: Migrations individuelles
Exécutez les migrations dans l'ordre:
1. `supabase/migrations/20260420000001_fix_dashboard_aggregates_null_cooperative.sql`
2. `supabase/migrations/20260420000002_make_deliveries_cooperative_nullable.sql`
3. `supabase/migrations/20260420000003_make_deliveries_warehouse_nullable.sql`

### Option 3: Supabase CLI
```bash
supabase db push
```

## ✓ Vérification

Après application du fix, vérifiez que les colonnes sont bien nullable:

```sql
SELECT 
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'deliveries'
  AND column_name IN ('cooperative_id', 'warehouse_id');
```

**Résultat attendu**:
```
column_name     | is_nullable | data_type
----------------|-------------|----------
cooperative_id  | YES         | uuid
warehouse_id    | YES         | uuid
```

## 📊 Impact

### ✅ Avantages
- ✓ Import de reçus sans coopérative fonctionne
- ✓ Import de reçus sans entrepôt fonctionne
- ✓ Pas d'impact sur les livraisons existantes
- ✓ Le dashboard continue de fonctionner normalement

### ⚠️ Points d'attention
- Les livraisons sans coopérative ne seront pas incluses dans les agrégats du dashboard (comportement attendu)
- Considérez l'ajout d'une validation côté application pour s'assurer que les livraisons importantes ont une coopérative assignée
- Si vous souhaitez voir les livraisons sans coopérative dans le dashboard, créez une vue ou une requête séparée

## 🧪 Test

Pour tester le fix:

1. Appliquez les migrations
2. Essayez d'importer un reçu de collecte sans coopérative
3. Vérifiez que:
   - Les livraisons sont créées avec `cooperative_id = NULL`
   - Aucune erreur n'est générée
   - Le reçu apparaît dans la liste des reçus

## 📝 Notes Techniques

### Gestion des cas dans le trigger

Le trigger gère maintenant tous les cas possibles:

| Opération | Old Coop | New Coop | Action |
|-----------|----------|----------|--------|
| INSERT    | -        | NULL     | Ignore |
| INSERT    | -        | EXISTS   | Agrège |
| UPDATE    | NULL     | NULL     | Ignore |
| UPDATE    | NULL     | EXISTS   | Agrège (nouveau) |
| UPDATE    | EXISTS   | NULL     | Désagrège (ancien) |
| UPDATE    | EXISTS   | EXISTS   | Désagrège (ancien) + Agrège (nouveau) |
| DELETE    | NULL     | -        | Ignore |
| DELETE    | EXISTS   | -        | Désagrège |

### Compatibilité

- ✓ Compatible avec le code existant
- ✓ Pas de migration de données nécessaire
- ✓ Pas de downtime requis
- ✓ Rollback possible (voir section suivante)

## 🔄 Rollback (si nécessaire)

Si vous devez annuler ces changements:

```sql
-- Restaurer les contraintes NOT NULL
ALTER TABLE public.deliveries 
  ALTER COLUMN cooperative_id SET NOT NULL;

ALTER TABLE public.deliveries 
  ALTER COLUMN warehouse_id SET NOT NULL;

-- Restaurer l'ancienne version du trigger
-- (voir supabase/FULL_SETUP.sql pour la version originale)
```

**⚠️ Attention**: Le rollback échouera s'il existe des livraisons avec `cooperative_id` ou `warehouse_id` NULL.

## 📚 Fichiers Créés

- `FIX_RECEIPT_IMPORT_NULL_COOPERATIVE.sql` - Script SQL combiné
- `supabase/migrations/20260420000001_fix_dashboard_aggregates_null_cooperative.sql`
- `supabase/migrations/20260420000002_make_deliveries_cooperative_nullable.sql`
- `supabase/migrations/20260420000003_make_deliveries_warehouse_nullable.sql`
- `supabase/migrations/README_RECEIPT_IMPORT_FIX.md` - Documentation détaillée
- `RECEIPT_IMPORT_FIX_SUMMARY.md` - Ce document

## 🤝 Support

Si vous rencontrez des problèmes après l'application du fix:

1. Vérifiez que toutes les migrations ont été appliquées
2. Vérifiez les logs Supabase pour plus de détails
3. Consultez la documentation dans `README_RECEIPT_IMPORT_FIX.md`
