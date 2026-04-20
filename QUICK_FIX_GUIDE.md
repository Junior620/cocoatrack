# 🚀 Fix Rapide: Import Reçu sans Coopérative

## ⚡ En 3 Étapes (2 minutes)

### 1️⃣ Ouvrir Supabase SQL Editor
Projet Supabase → SQL Editor → New query

### 2️⃣ Copier-Coller
Fichier: `FIX_RECEIPT_IMPORT_NULL_COOPERATIVE.sql`

### 3️⃣ Exécuter
Cliquer sur **Run** → Voir "✓ Fix applied successfully!"

## ✅ Terminé !

---

## 🔍 Que fait ce fix ?

**Avant**: ❌ Erreur "null value in column cooperative_id violates not-null constraint"  
**Après**: ✅ Import de reçus sans coopérative fonctionne

---

## 📚 Documentation

| Besoin | Fichier |
|--------|---------|
| Application rapide | `APPLY_RECEIPT_IMPORT_FIX.md` |
| Comprendre le problème | `RECEIPT_IMPORT_FIX_SUMMARY.md` |
| Détails techniques | `supabase/migrations/README_RECEIPT_IMPORT_FIX.md` |
| Historique complet | `SESSION_RECEIPT_IMPORT_FIX.md` |

---

## 🧪 Test

1. Importer un reçu sans coopérative
2. ✅ Devrait réussir

---

**Temps**: 2 minutes | **Risque**: Très faible | **Downtime**: Aucun
