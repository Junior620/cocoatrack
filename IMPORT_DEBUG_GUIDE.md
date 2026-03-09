# Guide de Débogage - Import Planteurs

## Problème
L'import semble réussir mais les planteurs ne sont pas créés dans la base de données.

## Étapes de Diagnostic

### Étape 1: Vérifier le statut de l'import

Exécutez dans Supabase SQL Editor:
```sql
SELECT 
  id,
  filename,
  import_status,
  (import_summary->>'created_count')::int as created,
  (import_summary->>'failed_count')::int as failed,
  (import_summary->>'errors') as errors
FROM planteur_import_files
ORDER BY created_at DESC
LIMIT 1;
```

**Résultats possibles:**
- `import_status = 'completed'` et `created_count > 0` → Les planteurs devraient être dans la BD
- `import_status = 'failed'` → Vérifier les erreurs dans `errors`
- `import_status = 'executing'` → L'import est bloqué

### Étape 2: Vérifier si les planteurs existent

```sql
SELECT COUNT(*) as total
FROM planteurs
WHERE created_at > NOW() - INTERVAL '1 hour';
```

**Si count = 0:** Les planteurs n'ont pas été créés → Problème d'insertion
**Si count > 0:** Les planteurs existent → Problème de RLS/visibilité

### Étape 3: Tester l'insertion manuelle

Essayez d'insérer un planteur manuellement:
```sql
INSERT INTO planteurs (
  name,
  code,
  phone,
  cni,
  cooperative_id,
  chef_planteur_id,
  superficie_hectares,
  is_active,
  created_by
) VALUES (
  'TEST PLANTEUR',
  'TEST001',
  '+237600000000',
  'CM123456',
  NULL,
  NULL,
  10.5,
  true,
  auth.uid()
);
```

**Si ça échoue:** Notez l'erreur exacte
**Si ça réussit:** Le problème est dans le code d'import

### Étape 4: Vérifier les contraintes

```sql
SELECT 
  conname,
  contype,
  pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.planteurs'::regclass;
```

Vérifiez si `chef_planteur_id` ou `cooperative_id` ont des contraintes NOT NULL.

### Étape 5: Vérifier les logs du serveur

Dans votre terminal Next.js, cherchez des erreurs comme:
```
[planteurs/import/execute] Error processing row:
```

### Étape 6: Vérifier la réponse de l'API

Dans le navigateur (DevTools → Network):
1. Trouvez la requête POST vers `/api/planteurs/import/[id]/execute`
2. Vérifiez la réponse:
   - Status 200 → Vérifier le body pour `created_count`
   - Status 4xx/5xx → Lire le message d'erreur

## Solutions Possibles

### Solution 1: Contrainte NOT NULL sur chef_planteur_id

**Symptôme:** Erreur "null value in column chef_planteur_id violates not-null constraint"

**Solution:** Appliquer la migration:
```sql
ALTER TABLE public.planteurs
ALTER COLUMN chef_planteur_id DROP NOT NULL;
```

### Solution 2: Contrainte NOT NULL sur cooperative_id

**Symptôme:** Erreur "null value in column cooperative_id violates not-null constraint"

**Solution:** Appliquer la migration:
```sql
ALTER TABLE public.planteurs
ALTER COLUMN cooperative_id DROP NOT NULL;
```

### Solution 3: Problème de RLS (planteurs créés mais invisibles)

**Symptôme:** `import_summary` montre `created_count > 0` mais SELECT ne retourne rien

**Solution:** Appliquer `v2/APPLY_PLANTEURS_RLS_FIX.sql`

### Solution 4: Trigger bloquant l'insertion

**Symptôme:** Erreur liée à `sync_planteur_cooperative_id`

**Solution:** Vérifier le trigger:
```sql
SELECT 
  tgname,
  tgenabled,
  pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid = 'public.planteurs'::regclass;
```

Si le trigger `sync_planteur_cooperative_id_trigger` cause des problèmes:
```sql
ALTER TABLE planteurs DISABLE TRIGGER sync_planteur_cooperative_id_trigger;
-- Réessayer l'import
ALTER TABLE planteurs ENABLE TRIGGER sync_planteur_cooperative_id_trigger;
```

## Script de Diagnostic Complet

Exécutez `v2/DEBUG_IMPORT_EXECUTION.sql` pour un diagnostic complet.

## Prochaines Étapes

1. Exécutez les requêtes de diagnostic ci-dessus
2. Notez les résultats et erreurs
3. Appliquez la solution correspondante
4. Réessayez l'import
