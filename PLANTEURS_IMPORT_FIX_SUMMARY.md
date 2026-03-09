# Planteurs Import - Fix Summary

## Problem Identified
Les planteurs ne sont pas créés dans la base de données lors de l'import.

## Root Cause
Le champ `chef_planteur_id` était défini comme une chaîne vide `''` au lieu de `null`, ce qui causait probablement une erreur d'insertion silencieuse.

## Fix Applied
Modifié `v2/app/api/planteurs/import/[id]/execute/route.ts`:
- Changé `chef_planteur_id: ''` → `chef_planteur_id: null`

## Actions Required

### 1. Redémarrer le serveur Next.js
Le code a été modifié, vous devez redémarrer votre serveur de développement:
```bash
# Dans le terminal où tourne Next.js
# Ctrl+C pour arrêter
# Puis relancer:
cd v2
npm run dev
```

### 2. Réessayer l'import
1. Allez sur la page des planteurs
2. Cliquez sur "Importer"
3. Uploadez un fichier CSV (utilisez `v2/test-data/planteurs-import-valid.csv`)
4. Analysez le fichier
5. Exécutez l'import

### 3. Vérifier dans Supabase
Exécutez le script `v2/DEBUG_IMPORT_EXECUTION.sql` dans Supabase SQL Editor pour:
- Voir le statut de l'import
- Vérifier si des planteurs ont été créés
- Voir les erreurs éventuelles dans import_summary
- Consulter les logs d'audit

### 4. Si les planteurs ne sont toujours pas visibles
Appliquez le fix RLS:
```bash
# Dans Supabase SQL Editor, exécutez:
v2/APPLY_PLANTEURS_RLS_FIX.sql
```

## Expected Behavior After Fix

### Import Execution
- ✅ Upload réussit
- ✅ Parse réussit
- ✅ Execute réussit
- ✅ Planteurs créés avec:
  - `cooperative_id = NULL`
  - `chef_planteur_id = NULL`
  - `created_by = <votre user_id>`

### Database
```sql
SELECT id, name, code, cooperative_id, chef_planteur_id, created_by
FROM planteurs
WHERE created_at > NOW() - INTERVAL '1 hour';
```
Devrait retourner les planteurs importés.

### Frontend
Les planteurs devraient apparaître dans la liste (après avoir appliqué le fix RLS si nécessaire).

## Debugging Steps

### Step 1: Check Import Status
```sql
SELECT id, filename, import_status, import_summary
FROM planteur_import_files
ORDER BY created_at DESC
LIMIT 1;
```

### Step 2: Check for Errors
```sql
SELECT 
  (import_summary->>'failed_count')::int as failed_count,
  import_summary->'errors' as errors
FROM planteur_import_files
WHERE import_status = 'failed'
ORDER BY created_at DESC
LIMIT 1;
```

### Step 3: Check Audit Logs
```sql
SELECT 
  new_data->>'operation' as operation,
  (new_data->>'count')::int as count,
  new_data->'errors' as errors
FROM audit_logs
WHERE table_name = 'planteur_import_files'
ORDER BY created_at DESC
LIMIT 5;
```

## Files Modified
- `v2/app/api/planteurs/import/[id]/execute/route.ts` - Fixed chef_planteur_id value

## Files Created
- `v2/DEBUG_IMPORT_EXECUTION.sql` - Detailed debugging script
- `v2/APPLY_PLANTEURS_RLS_FIX.sql` - RLS fix (if needed)
- `v2/CHECK_PLANTEURS_IMPORT.sql` - Quick verification script
- `v2/PLANTEURS_IMPORT_FIX_SUMMARY.md` - This file

## Next Steps
1. Restart Next.js dev server
2. Try import again
3. Run DEBUG_IMPORT_EXECUTION.sql to verify
4. Apply RLS fix if planteurs exist but not visible
