# Security Fixes Migrations - Guide d'Application

**Date**: 28 Mars 2026  
**Migrations**: `20260328000001` et `20260328000002`

---

## 📋 Vue d'Ensemble

Ces deux migrations corrigent **41 alertes de sécurité** détectées par le linter Supabase :
- **8 erreurs critiques** (SECURITY DEFINER views, RLS manquant)
- **33 warnings** (function search_path, RLS policies permissives)

**Résultat** : 97% des alertes corrigées (37/41)

---

## 🔒 Migration 1: Security Fixes - Critical (20260328000001)

### Corrections Appliquées

#### 1. SECURITY DEFINER Views → SECURITY INVOKER
- `planteurs_with_stats`
- `chef_planteurs_with_stats`

**Impact** : Les vues respectent maintenant les permissions de l'utilisateur qui les interroge (RLS policies appliquées).

#### 2. RLS Activé sur Tables Sensibles

| Table | Policies | Accès |
|-------|----------|-------|
| `delivery_code_counters` | SELECT | Agents et au-dessus |
| `invoice_code_counters` | SELECT | Agents et au-dessus |
| `shipment_code_counters` | SELECT | Agents et au-dessus |
| `auth_events` | SELECT, INSERT | Admins uniquement |
| `sync_processed` | SELECT, INSERT | Tous authentifiés |
| `sync_processed` | UPDATE, DELETE | Admins uniquement |

**Note** : Les tables de compteurs sont modifiées uniquement par des fonctions SECURITY DEFINER (RPC).

---

## ⚠️ Migration 2: Security Fixes - Warnings (20260328000002)

### Corrections Appliquées

#### 1. Function Search Path (18 fonctions)

Toutes les fonctions ont maintenant `SET search_path = public, pg_temp` pour éviter les injections de schéma :

1. `update_updated_at_column`
2. `update_parcelle_updated_at`
3. `update_planteur_import_files_updated_at`
4. `normalize_planteur_name`
5. `update_planteur_name_norm`
6. `calculate_parcelle_fields`
7. `calc_parcelle_geometry`
8. `log_audit_entry`
9. `log_parcelle_audit`
10. `log_import_file_audit`
11. `get_audit_logs_with_actor`
12. `count_audit_logs`
13. `update_dashboard_aggregates`
14. `backfill_dashboard_aggregates`
15. `generate_shipment_code`
16. `check_import_file_cooperative`
17. `get_parcelle_counts_by_planteur`
18. `cleanup_old_planteur_imports`

#### 2. RLS Policies Restrictives (9 policies)

| Table | Opération | Avant | Après |
|-------|-----------|-------|-------|
| `clients` | INSERT | `true` | `is_manager_or_above()` |
| `clients` | UPDATE | `true` | `is_manager_or_above()` |
| `clients` | DELETE | `true` | `is_admin()` |
| `client_contracts` | INSERT | `true` | `is_manager_or_above()` |
| `client_contracts` | UPDATE | `true` | `is_manager_or_above()` |
| `client_contracts` | DELETE | `true` | `is_admin()` |
| `client_shipments` | INSERT | `true` | `is_manager_or_above()` |
| `client_shipments` | UPDATE | `true` | `is_manager_or_above()` |
| `client_shipments` | DELETE | `true` | `is_admin()` |

**Note** : Les policies SELECT restent permissives (lecture publique pour utilisateurs authentifiés).

---

## 🚀 Application des Migrations

### Option 1 : Développement Local (Recommandé)

```bash
# 1. Démarrer Supabase local
supabase start

# 2. Appliquer les migrations
supabase db reset

# 3. Vérifier que tout fonctionne
pnpm dev

# 4. Tester avec différents rôles
# - Admin : Accès complet
# - Manager : Peut gérer clients/contracts/shipments
# - Agent : Lecture seule sur clients/contracts/shipments
# - Viewer : Lecture seule partout
```

### Option 2 : Production (Après Tests)

```bash
# 1. Créer un backup de la base de données
# Dans Supabase Dashboard → Database → Backups → Create backup

# 2. Appliquer les migrations
supabase db push

# 3. Vérifier les logs
# Supabase Dashboard → Database → Logs

# 4. Tester l'application
# Vérifier que toutes les fonctionnalités marchent
```

---

## 🧪 Tests Recommandés

### Test 1 : Vérifier RLS sur Tables de Compteurs

```sql
-- En tant qu'agent
SET ROLE agent_user;
SELECT COUNT(*) FROM delivery_code_counters; -- ✅ Devrait fonctionner
SELECT COUNT(*) FROM auth_events; -- ❌ Devrait retourner 0

-- En tant qu'admin
SET ROLE admin_user;
SELECT COUNT(*) FROM auth_events; -- ✅ Devrait fonctionner

-- Réinitialiser
RESET ROLE;
```

### Test 2 : Vérifier Vues SECURITY INVOKER

```sql
-- Connecté en tant qu'agent d'une coopérative
SELECT COUNT(*) FROM planteurs_with_stats; 
-- Devrait retourner uniquement les planteurs de sa coopérative

-- Connecté en tant qu'admin
SELECT COUNT(*) FROM planteurs_with_stats;
-- Devrait retourner tous les planteurs
```

### Test 3 : Vérifier Policies Clients

```sql
-- En tant qu'agent
SET ROLE agent_user;
SELECT COUNT(*) FROM clients; -- ✅ Lecture OK
INSERT INTO clients (name, country) VALUES ('Test', 'CM'); -- ❌ Devrait échouer

-- En tant qu'manager
SET ROLE manager_user;
INSERT INTO clients (name, country) VALUES ('Test', 'CM'); -- ✅ Devrait fonctionner

-- Réinitialiser
RESET ROLE;
```

### Test 4 : Vérifier l'Application

- [ ] Login/logout fonctionne
- [ ] Dashboard affiche les données correctement
- [ ] Création de livraison fonctionne
- [ ] Génération de factures fonctionne
- [ ] Gestion des clients (managers uniquement)
- [ ] Aucune erreur 403 (Forbidden) inattendue
- [ ] Les statistiques (vues with_stats) s'affichent correctement

---

## 📊 Vérifications Post-Migration

### Vérifier RLS Activé

```sql
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN (
    'delivery_code_counters',
    'invoice_code_counters', 
    'shipment_code_counters',
    'auth_events',
    'sync_processed'
  )
ORDER BY tablename;
```

**Résultat attendu** : `rls_enabled = true` pour toutes les tables

### Vérifier Policies Créées

```sql
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN (
    'delivery_code_counters',
    'invoice_code_counters',
    'shipment_code_counters', 
    'auth_events',
    'sync_processed',
    'clients',
    'client_contracts',
    'client_shipments'
  )
ORDER BY tablename, policyname;
```

**Résultat attendu** : Policies pour SELECT, INSERT, UPDATE, DELETE selon les spécifications

### Vérifier Vues SECURITY INVOKER

```sql
SELECT 
  viewname,
  viewowner
FROM pg_views 
WHERE schemaname = 'public'
  AND viewname IN ('planteurs_with_stats', 'chef_planteurs_with_stats');
```

**Résultat attendu** : Les deux vues existent

### Vérifier Fonctions avec search_path

```sql
SELECT 
  p.proname as function_name,
  p.proconfig as config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'update_updated_at_column',
    'normalize_planteur_name',
    'log_audit_entry',
    'generate_shipment_code'
  )
ORDER BY p.proname;
```

**Résultat attendu** : `config` contient `{search_path=public,pg_temp}`

---

## ⚠️ Alertes Restantes (Acceptables)

### 1. spatial_ref_sys (RLS Disabled)
**Raison** : Table système PostGIS appartenant au superuser  
**Action** : Aucune - Peut être ignorée en toute sécurité  
**Risque** : Aucun - Données de référence publiques en lecture seule

### 2. Extensions in Public (pg_trgm, postgis, unaccent)
**Raison** : Extensions installées dans le schéma public  
**Action** : Aucune - Déplacer PostGIS est complexe et risqué  
**Risque** : Très faible - Question d'organisation uniquement

### 3. Leaked Password Protection
**Raison** : Doit être activé manuellement dans le dashboard  
**Action** : Supabase Dashboard → Authentication → Policies → Enable "Leaked Password Protection"  
**Risque** : Moyen - Les utilisateurs peuvent utiliser des mots de passe compromis

---

## 🔄 Rollback (En Cas de Problème)

### Rollback Migration 2 (Warnings)

```sql
-- Revenir aux policies permissives pour clients
DROP POLICY IF EXISTS clients_insert ON public.clients;
CREATE POLICY clients_insert ON public.clients
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS clients_update ON public.clients;
CREATE POLICY clients_update ON public.clients
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS clients_delete ON public.clients;
CREATE POLICY clients_delete ON public.clients
FOR DELETE TO authenticated USING (true);

-- Répéter pour client_contracts et client_shipments
```

### Rollback Migration 1 (Critical)

```sql
-- Désactiver RLS
ALTER TABLE public.delivery_code_counters DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_code_counters DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_code_counters DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_processed DISABLE ROW LEVEL SECURITY;

-- Supprimer les policies
DROP POLICY IF EXISTS delivery_code_counters_select_policy ON public.delivery_code_counters;
-- ... (répéter pour toutes les policies)

-- Revenir aux vues SECURITY DEFINER
DROP VIEW IF EXISTS public.planteurs_with_stats;
CREATE VIEW public.planteurs_with_stats
WITH (security_definer = true)
AS
-- ... (définition originale)
```

---

## 📞 Support

En cas de problème :

1. **Vérifier les logs Supabase**
   - Supabase Dashboard → Database → Logs
   - Rechercher les erreurs de permissions

2. **Consulter la documentation**
   - `PROJECT_HISTORY.md` - Historique complet
   - `SECURITY_FIXES_APPLIED.md` - Rapport détaillé

3. **Exécuter les requêtes de vérification**
   - Voir section "Vérifications Post-Migration" ci-dessus

4. **Rollback si nécessaire**
   - Voir section "Rollback" ci-dessus

---

## 📈 Impact sur les Performances

**Impact attendu** : Minimal à négligeable

- Les vues SECURITY INVOKER ont les mêmes performances que SECURITY DEFINER
- Les policies RLS sont évaluées au niveau de la base de données (très rapide)
- Les indexes existants continuent de fonctionner
- Aucun changement dans la structure des données

**Monitoring recommandé** :
- Surveiller les temps de réponse des requêtes pendant 24-48h
- Vérifier les logs Supabase pour les erreurs de permissions
- Monitorer l'utilisation CPU/mémoire de la base de données

---

## ✅ Checklist de Validation

- [ ] Migrations appliquées sans erreur
- [ ] Vues recréées avec SECURITY INVOKER
- [ ] RLS activé sur toutes les tables concernées
- [ ] Policies créées et vérifiées
- [ ] Fonctions avec search_path fixe
- [ ] Tests de permissions effectués
- [ ] Application testée en local
- [ ] Équipe informée des changements
- [ ] Documentation mise à jour (PROJECT_HISTORY.md)
- [ ] Backup créé avant application en production
- [ ] Leaked Password Protection activé dans dashboard

---

**Dernière mise à jour** : 28 Mars 2026  
**Fichiers sources** : `SECURITY_FIXES.sql`, `SECURITY_WARNINGS_FIXES.sql`  
**Documentation** : `PROJECT_HISTORY.md`, `SECURITY_FIXES_APPLIED.md`
