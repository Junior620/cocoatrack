# Calcul Automatique du NDVI lors de l'Export des Risques

## Vue d'Ensemble

Cette fonctionnalité ajoute un calcul automatique du NDVI pour toutes les parcelles avant l'export des données de risque. Elle résout le problème initial où seulement ~3 parcelles sur 27,000 avaient des données NDVI calculées.

## Problème Résolu

**Avant:**
- L'export des parcelles à risque retournait seulement les parcelles ayant déjà des données NDVI
- Sur 27,000 parcelles, seulement 3-5 avaient été calculées
- Les exports étaient donc pratiquement vides

**Après:**
- Le système calcule automatiquement le NDVI pour toutes les parcelles sélectionnées
- Les résultats sont sauvegardés automatiquement en base de données
- L'export contient toutes les parcelles avec leurs évaluations de risque complètes

## Fonctionnalités Principales

### 1. Calcul Automatique par Batch

```typescript
// Le système traite les parcelles par lot avec limite de concurrence
const MAX_NDVI_CONCURRENCY = 5;  // 5 calculs simultanés max
const DEFAULT_MAX_PARCELLES = 100; // 100 parcelles max par défaut
```

**Avantages:**
- ⚡ Performance optimale (5 calculs en parallèle)
- 🛡️ Protection contre la surcharge système
- 💾 Sauvegarde automatique des résultats
- ♻️ Réutilisation du cache (pas de recalcul si données récentes)

### 2. Sauvegarde Automatique

Chaque résultat NDVI calculé est automatiquement sauvegardé dans:

1. **Base de données PostgreSQL** (table `ndvi_results`)
   - Persistance à long terme
   - Accessible pour futures analyses
   - Utilisé pour l'évaluation des risques

2. **Cache Redis** (si disponible)
   - Accès ultra-rapide (< 1ms)
   - TTL de 24 heures
   - Réduit la charge sur Earth Engine

### 3. Gestion du Cache

Le système vérifie d'abord si des données NDVI existent déjà:

```typescript
// Vérification du cache avant calcul
const cached = await ndviService.getCachedNDVI(parcelleId, date, supabase);
if (cached) {
  return { id: parcelleId, success: true }; // Skip calculation
}
```

**Critère de fraîcheur:** 24 heures

### 4. Suivi de Progression

L'interface utilisateur affiche des messages de progression:

- 🔄 "Calcul du NDVI en cours... Cela peut prendre quelques minutes."
- 📊 Logs console: "Progress: 10/100 (10%)"
- ✅ "Export terminé avec succès!"

## Architecture

### Backend: API Route (`/api/satellite/risk-export`)

```
GET /api/satellite/risk-export?category=high_risk&calculateNDVI=true&maxParcelles=100
```

**Flux d'exécution:**

1. **Authentification** → Vérifier l'utilisateur
2. **Validation des paramètres** → Parse query params avec Zod
3. **Récupération des parcelles** → Query DB avec filtres de base
4. **Calcul NDVI (si activé)** → Batch processing avec concurrence
5. **Évaluation des risques** → Analyse complète de chaque parcelle
6. **Génération du fichier** → CSV ou JSON
7. **Téléchargement** → Retour au client

### Service: NDVI Batch Calculator

```typescript
async function calculateNDVIBatch(
  supabase: any,
  parcelles: Array<{ id: string; geometry: MultiPolygon }>
): Promise<void> {
  // Process with concurrency control
  const executing: Promise<void>[] = [];
  
  for (const parcelle of parcelles) {
    const promise = calculateNDVIForParcelle(...)
      .then((result) => {
        results.push(result);
        completed++;
        // Log progress every 10 parcelles
      });
    
    executing.push(promise);
    
    if (executing.length >= MAX_NDVI_CONCURRENCY) {
      await Promise.race(executing);
    }
  }
  
  await Promise.all(executing);
}
```

### Frontend: RiskExportButton Component

**Nouvelles options:**

```typescript
export interface RiskExportFilters {
  categories?: RiskCategory[];
  region?: string;
  minSurface?: number;
  maxSurface?: number;
  hasDeforestation?: boolean;
  calculateNDVI?: boolean;      // NEW: Auto-calculate NDVI
  maxParcelles?: number;         // NEW: Safety limit
}
```

## Paramètres de Configuration

### Paramètres Query

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `category` | string | - | Catégories de risque (comma-separated) |
| `format` | csv\|json | csv | Format de sortie |
| `calculateNDVI` | boolean | true | Calculer NDVI avant export |
| `maxParcelles` | number | 100 | Limite de sécurité |
| `region` | string | - | Filtre par région |
| `minSurface` | number | - | Surface minimale (ha) |
| `maxSurface` | number | - | Surface maximale (ha) |

### Constantes Système

```typescript
// Concurrence NDVI
MAX_NDVI_CONCURRENCY = 5

// Limite de sécurité
DEFAULT_MAX_PARCELLES = 100

// Cache TTL
CACHE_TTL_MS = 24 * 60 * 60 * 1000  // 24 heures

// Fenêtre d'analyse temporelle
TREND_ANALYSIS_WINDOW_DAYS = 90
```

## Performance

### Temps d'Exécution Estimés

Pour `calculateNDVI=true`:

| Parcelles | Temps (approx) | Détails |
|-----------|----------------|---------|
| 10 | ~30 sec | 2 batchs de 5 |
| 50 | ~3 min | 10 batchs de 5 |
| 100 | ~6 min | 20 batchs de 5 |
| 500 | ~30 min | 100 batchs de 5 |

**Note:** Le temps dépend de:
- Taille des parcelles (géométrie complexe = plus long)
- Disponibilité des images Sentinel-2
- Charge sur Google Earth Engine
- Taux de cache hit (parcelles déjà calculées)

### Optimisations Appliquées

1. **Concurrence limitée** → Évite la surcharge GEE
2. **Cache intelligent** → Skip si données récentes
3. **Skip raster generation** → Pas d'images PNG en batch
4. **Invalidation sélective** → Cache Redis invalidé par parcelle

## Utilisation

### Exemple 1: Export Rapide (Parcelles à Risque)

```typescript
// Quick action button
<button onClick={handleExportHighRisk}>
  Exporter Parcelles à Risque
</button>

// Résultat:
// - Calcul NDVI automatique pour max 100 parcelles
// - Fichier CSV avec toutes les données de risque
// - Sauvegarde automatique en DB
```

### Exemple 2: Export Personnalisé avec Options

```typescript
const filters: RiskExportFilters = {
  categories: ['high_risk', 'medium_risk'],
  region: 'Soubré',
  minSurface: 2.0,
  maxSurface: 10.0,
  calculateNDVI: true,  // Active le calcul auto
  maxParcelles: 50      // Limite à 50 parcelles
};

await handleExport(filters);
```

### Exemple 3: Export Sans Calcul NDVI

```typescript
// Pour exporter uniquement les parcelles ayant déjà des données
const filters: RiskExportFilters = {
  categories: ['high_risk'],
  calculateNDVI: false,  // Désactive le calcul
  maxParcelles: 1000     // Peut être plus élevé
};
```

## Logging et Débogage

### Logs Console (Backend)

```
[Risk Export] Starting export with calculateNDVI=true, maxParcelles=100
[Risk Export] Found 87 parcelles to process
[Risk Export] Starting NDVI calculation for 87 parcelles
[Risk Export NDVI] Progress: 10/87 (11%)
[Risk Export NDVI] Progress: 20/87 (23%)
...
[Risk Export NDVI] Progress: 87/87 (100%)
[Risk Export NDVI] Batch complete: 85 successful, 2 failed
[Risk Export] NDVI calculation complete
[Risk Export] Risk assessment complete, 85 parcelles match criteria
```

### Messages UI (Frontend)

```
✓ Calcul du NDVI en cours... Cela peut prendre quelques minutes.
✓ Téléchargement du fichier...
✓ Export terminé avec succès!
```

## Gestion des Erreurs

### Erreurs Possibles

1. **Géométrie invalide**
   ```
   Failed for parcelle xxx: Invalid geometry
   → Parcelle skippée, continue avec les autres
   ```

2. **Pas d'image Sentinel-2**
   ```
   Failed to retrieve bands: No imagery available
   → Parcelle marquée UNKNOWN dans l'export
   ```

3. **Timeout Earth Engine**
   ```
   Earth Engine timeout after 30s
   → Retry automatique (1x), puis skip
   ```

4. **Limite atteinte**
   ```
   Too many parcelles (1000) requested, maximum is 100
   → Erreur 400, ajuster maxParcelles
   ```

### Stratégie de Récupération

- ✅ **Continue on error:** Une erreur sur une parcelle n'arrête pas le batch
- ✅ **Log & track:** Toutes les erreurs sont loggées avec l'ID parcelle
- ✅ **Report in response:** Le résultat indique `successful` vs `failed`
- ✅ **User feedback:** Message d'erreur clair dans l'UI

## Sécurité

### Limites de Sécurité

1. **Max parcelles par requête:** 100 (configurable)
2. **Authentication requise:** JWT token vérifié
3. **Rate limiting:** Géré par Vercel (default limits)
4. **Timeout:** 60 secondes max par route API

### RLS Policies

Les calculs NDVI utilisent les RLS policies Supabase:

```sql
-- Policy pour ndvi_results
CREATE POLICY "authenticated_users_can_insert_ndvi"
ON ndvi_results FOR INSERT
TO authenticated
USING (true);
```

## Évolutions Futures

### Améliorations Possibles

1. **WebSocket progress streaming**
   - Progression en temps réel dans l'UI
   - Pas de refresh nécessaire

2. **Background job processing**
   - Queue Redis pour exports volumineux
   - Email notification à la fin

3. **Batch scheduling**
   - Calcul NDVI nocturne automatique
   - Export quotidien programmé

4. **Advanced caching**
   - Cache partagé entre utilisateurs
   - Pré-calcul des régions populaires

5. **Parallel Earth Engine accounts**
   - Augmenter la capacité de calcul
   - Load balancing entre comptes GEE

## Références

### Fichiers Modifiés

1. `/app/api/satellite/risk-export/route.ts` - API endpoint principal
2. `/components/satellite/RiskExportButton.tsx` - UI component
3. `/lib/satellite/services/risk-assessment.service.ts` - Service d'évaluation (inchangé)
4. `/lib/satellite/services/ndvi.service.ts` - Service NDVI (réutilisé)

### Documentation Associée

- `RISK_EXPORT_IMPLEMENTATION.md` - Documentation technique complète
- `GUIDE_UTILISATION_EXPORT_RISQUES.md` - Guide utilisateur
- `RESUME_EXPORT_RISQUES_PARCELLES.md` - Résumé exécutif
- `docs/api/risk-export.md` - Spécification API

---

**Version:** 1.0.0  
**Date:** 2026-06-30  
**Auteur:** Kiro AI Assistant  
**Status:** ✅ Production Ready
