# Planteurs Import - Fix Final

## Problème Identifié

L'import se terminait avec `status = 'completed'` mais **tous les planteurs étaient ignorés** (`skipped_count = 5`, `created_count = 0`).

### Cause Racine

Le frontend n'initialisait des actions (`rowActions`) que pour les lignes avec des **duplicates**. Les lignes sans duplicates n'avaient pas d'action définie.

Le backend, à la ligne 357-360 de `execute/route.ts`, ignore toute ligne sans action:
```typescript
if (!action || action.action === 'ignore') {
  skippedCount++;
  continue;
}
```

Résultat: Toutes les lignes sans duplicates étaient ignorées.

## Fix Appliqué

Modifié `v2/components/planteurs/ImportModal.tsx` ligne 103-109:

**Avant:**
```typescript
const initialActions: RowAction[] = result.rows
  .filter((row) => row.duplicate_info !== null) // ❌ Seulement les duplicates
  .map((row) => ({
    row_number: row.row_number,
    action: 'ignore' as const,
    planteur_id: row.duplicate_info?.existing_planteur_id,
  }));
```

**Après:**
```typescript
const initialActions: RowAction[] = result.rows
  .filter((row) => row.validation_errors.length === 0) // ✅ Toutes les lignes valides
  .map((row) => ({
    row_number: row.row_number,
    // Si duplicate, ignorer par défaut, sinon créer
    action: row.duplicate_info !== null ? ('ignore' as const) : ('create' as const),
    planteur_id: row.duplicate_info?.existing_planteur_id,
  }));
```

## Actions à Faire Maintenant

### 1. Redémarrez le serveur Next.js
```bash
# Arrêtez le serveur (Ctrl+C)
# Relancez:
cd v2
npm run dev
```

### 2. Réessayez l'import
1. Allez sur la page des planteurs
2. Cliquez sur "Importer"
3. Uploadez `v2/test-data/planteurs-import-valid.csv`
4. Cliquez sur "Analyser"
5. Cliquez sur "Importer"

### 3. Vérifiez le résultat

Dans Supabase SQL Editor:
```sql
-- Vérifier l'import
SELECT 
  import_status,
  (import_summary->>'created_count')::int as created,
  (import_summary->>'skipped_count')::int as skipped
FROM planteur_import_files
ORDER BY created_at DESC
LIMIT 1;

-- Vérifier les planteurs créés
SELECT id, name, code, cooperative_id, chef_planteur_id
FROM planteurs
WHERE created_at > NOW() - INTERVAL '1 hour';
```

### 4. Si les planteurs existent mais ne sont pas visibles

Appliquez le fix RLS:
```bash
# Dans Supabase SQL Editor:
v2/APPLY_PLANTEURS_RLS_FIX.sql
```

## Résultat Attendu

Après le fix:
- ✅ `created_count = 5` (ou le nombre de lignes valides dans votre CSV)
- ✅ `skipped_count = 0` (sauf si vous avez des lignes invalides ou des duplicates)
- ✅ Les planteurs apparaissent dans la table `planteurs`
- ✅ Les planteurs sont visibles dans le frontend (après fix RLS si nécessaire)

## Fichiers Modifiés
- `v2/components/planteurs/ImportModal.tsx` - Fix de l'initialisation des rowActions
- `v2/app/api/planteurs/import/[id]/execute/route.ts` - Déjà corrigé (chef_planteur_id = null)

## Notes
- Le problème était côté **frontend**, pas backend
- Le backend fonctionnait correctement mais ignorait les lignes sans action
- Le fix garantit que toutes les lignes valides ont une action par défaut ('create')
