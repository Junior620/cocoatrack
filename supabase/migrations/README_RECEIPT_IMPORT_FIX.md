# Fix Receipt Import Without Cooperative

## Problème

Lors de l'import d'un reçu de collecte sans coopérative, l'application génère l'erreur suivante:

```
Erreur lors de la création des livraisons: null value in column "cooperative_id" 
of relation "dashboard_aggregates" violates not-null constraint
```

## Cause

Le problème se produit à plusieurs niveaux:

1. **Table `deliveries`**: Les colonnes `cooperative_id` et `warehouse_id` sont définies comme NOT NULL, mais le code d'import de reçus ne fournit pas toujours ces valeurs.

2. **Trigger `update_dashboard_aggregates`**: Ce trigger s'exécute automatiquement lors de l'insertion de livraisons et essaie d'insérer dans `dashboard_aggregates` avec `cooperative_id` provenant de la livraison. Si `cooperative_id` est NULL, cela viole la contrainte NOT NULL de `dashboard_aggregates`.

## Solution

Trois migrations ont été créées pour résoudre ce problème:

### 1. `20260420000001_fix_dashboard_aggregates_null_cooperative.sql`

Modifie la fonction `update_dashboard_aggregates()` pour:
- Vérifier si `cooperative_id` est NULL avant d'insérer dans `dashboard_aggregates`
- Ignorer l'agrégation pour les livraisons sans coopérative
- Gérer correctement les cas où la coopérative est ajoutée ou supprimée lors d'une mise à jour

**Logique**: Les agrégats du dashboard sont par coopérative, donc il est logique de ne pas agréger les livraisons sans coopérative.

### 2. `20260420000002_make_deliveries_cooperative_nullable.sql`

Rend la colonne `cooperative_id` nullable dans la table `deliveries`:
```sql
ALTER TABLE public.deliveries 
  ALTER COLUMN cooperative_id DROP NOT NULL;
```

**Justification**: Permet de créer des livraisons qui ne sont pas associées à une coopérative spécifique (par exemple, livraisons directes de planteurs).

### 3. `20260420000003_make_deliveries_warehouse_nullable.sql`

Rend la colonne `warehouse_id` nullable dans la table `deliveries`:
```sql
ALTER TABLE public.deliveries 
  ALTER COLUMN warehouse_id DROP NOT NULL;
```

**Justification**: Les imports de reçus ne spécifient pas d'entrepôt. L'entrepôt peut être assigné ultérieurement.

## Application des migrations

Pour appliquer ces migrations dans Supabase:

1. Ouvrez le SQL Editor dans votre projet Supabase
2. Exécutez les migrations dans l'ordre:
   - `20260420000001_fix_dashboard_aggregates_null_cooperative.sql`
   - `20260420000002_make_deliveries_cooperative_nullable.sql`
   - `20260420000003_make_deliveries_warehouse_nullable.sql`

Ou utilisez la commande Supabase CLI:
```bash
supabase db push
```

## Vérification

Après application des migrations, vous devriez pouvoir:
1. Importer un reçu de collecte sans coopérative
2. Les livraisons seront créées avec `cooperative_id = NULL`
3. Le trigger `update_dashboard_aggregates` ignorera ces livraisons
4. Aucune erreur ne sera générée

## Impact

- **Livraisons existantes**: Aucun impact, toutes les livraisons existantes conservent leurs valeurs
- **Dashboard**: Les livraisons sans coopérative ne seront pas incluses dans les agrégats du dashboard (comportement attendu)
- **Compatibilité**: Le code existant continue de fonctionner normalement

## Notes

- Si vous souhaitez que les livraisons sans coopérative apparaissent dans le dashboard, vous devrez créer une vue ou une requête séparée pour les gérer
- Considérez l'ajout d'une validation côté application pour s'assurer que les livraisons importantes ont une coopérative assignée
