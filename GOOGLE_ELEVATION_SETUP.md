# Google Elevation API - Setup Guide

## 📋 Vue d'ensemble

L'intégration de Google Elevation API permet de calculer automatiquement:
- **Altitude moyenne** de chaque parcelle (en mètres)
- **Pente moyenne** (en pourcentage)
- **Altitude min/max** pour analyser le dénivelé

## 🔑 Configuration API

### 1. Activer l'API dans Google Cloud Console

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionner votre projet (ou créer un nouveau)
3. Aller dans **APIs & Services** > **Library**
4. Chercher "Elevation API"
5. Cliquer sur **Enable**

### 2. Vérifier la clé API

Votre clé API Google Maps (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) doit avoir accès à:
- ✅ Maps JavaScript API (déjà activé)
- ✅ Elevation API (à activer)

## 💰 Quota et Tarification

- **Gratuit**: 5,000 requêtes/mois
- **Au-delà**: $5 par 1,000 requêtes supplémentaires
- **CocoaTrack**: ~20 points par parcelle = 238 parcelles = 1 requête par parcelle

## 🗄️ Migration Base de Données

### Appliquer la migration

1. Ouvrir [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql)
2. Copier le contenu de `supabase/migrations/20260427000001_add_elevation_to_parcelles.sql`
3. Exécuter la requête

### Colonnes ajoutées

```sql
-- Altitude moyenne en mètres
elevation_meters DECIMAL(8, 2)

-- Pente moyenne en pourcentage
slope_percent DECIMAL(5, 2)

-- Date du dernier calcul
elevation_calculated_at TIMESTAMPTZ
```

## 🧪 Test de l'API

### Test manuel avec curl

```bash
# Remplacer {PARCELLE_ID} par un ID réel
curl -X POST http://localhost:3000/api/parcelles/{PARCELLE_ID}/elevation \
  -H "Content-Type: application/json"
```

### Réponse attendue

```json
{
  "success": true,
  "data": {
    "elevation_meters": 456.78,
    "slope_percent": 12.34,
    "min_elevation": 445.20,
    "max_elevation": 468.50,
    "points_sampled": 20
  }
}
```

## 📊 Interprétation des Données

### Altitude pour le Cacao

| Altitude | Qualité | Recommandation |
|----------|---------|----------------|
| < 200m | Faible | Trop chaud, risque de maladies |
| 200-800m | **Optimale** | ✅ Meilleure qualité |
| > 800m | Moyenne | Trop froid, croissance lente |

### Pente

| Pente | Niveau | Impact |
|-------|--------|--------|
| 0-5% | Plat | ✅ Facile à cultiver |
| 5-15% | Modéré | ⚠️ Attention drainage |
| 15-30% | Fort | ⚠️ Risque d'érosion |
| > 30% | Très fort | ❌ Difficile, érosion importante |

## 🎯 Utilisation dans CocoaTrack

### 1. Calculer l'élévation d'une parcelle

Dans la page de détail d'une parcelle, un bouton "Calculer Élévation" apparaîtra.

### 2. Calcul en masse

Pour calculer l'élévation de toutes les parcelles:

```typescript
// À implémenter: Bouton "Calculer toutes les élévations"
// Attention: 238 parcelles = 238 requêtes API
```

### 3. Affichage

Les données d'élévation s'affichent:
- Dans la fiche parcelle
- Dans la liste des parcelles (colonnes optionnelles)
- Dans les filtres (filtrer par altitude/pente)

## ⚠️ Limitations

1. **Précision**: ±10m selon la zone géographique
2. **Pente**: Calcul approximatif (basé sur échantillonnage)
3. **Quota**: Surveiller l'utilisation mensuelle
4. **Coût**: Prévoir budget si > 5000 parcelles/mois

## 📝 Prochaines Étapes

1. ✅ Migration appliquée
2. ✅ API créée
3. 🔄 Ajouter bouton dans l'interface
4. 🔄 Afficher les données
5. ⏳ Calcul en masse (optionnel)
6. ⏳ Filtres par altitude/pente (optionnel)

## 🔗 Ressources

- [Google Elevation API Docs](https://developers.google.com/maps/documentation/elevation)
- [Pricing Calculator](https://mapsplatform.google.com/pricing/)
