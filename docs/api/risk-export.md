# API Documentation: Risk Export

## Overview

L'API Risk Export permet d'identifier, filtrer et exporter les parcelles selon leur niveau de risque basé sur l'analyse NDVI, les tendances temporelles et les alertes de déforestation.

## Base URL

```
https://app.cocoatrack.com/api/satellite
```

## Authentication

Toutes les requêtes nécessitent une authentification via Bearer token (Supabase Auth).

```http
Authorization: Bearer <access_token>
```

---

## Endpoints

### GET /risk-export

Exporte une liste de parcelles filtrées par catégorie de risque avec leurs détails complets.

#### Request

**URL Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `category` | string | No | Catégories de risque séparées par virgules | `high_risk,medium_risk` |
| `format` | string | No | Format d'export (`csv` ou `json`) | `csv` (default) |
| `region` | string | No | Filtrer par région | `Aboisso` |
| `minSurface` | number | No | Surface minimale en hectares | `0.5` |
| `maxSurface` | number | No | Surface maximale en hectares | `10` |
| `hasDeforestation` | boolean | No | Filtrer par présence de déforestation | `true` |
| `planteurId` | uuid | No | Filtrer par ID planteur | `uuid-string` |
| `cooperativeId` | uuid | No | Filtrer par ID coopérative | `uuid-string` |

**Risk Categories:**

- `high_risk` - Parcelles à risque élevé (santé critique/faible, déforestation, déclin)
- `medium_risk` - Parcelles à surveiller (santé moyenne, déclin modéré)
- `low_risk` - Parcelles en santé correcte
- `excellent` - Parcelles en excellente santé
- `unknown` - Parcelles non évaluées (données insuffisantes)

#### Response

**Format: CSV**

Headers:
```csv
Code Parcelle,Libellé,Village,Région,Surface (ha),Code Planteur,Nom Planteur,Catégorie de Risque,Statut Santé Actuel,NDVI Actuel,Tendance,Taux de Changement,Alertes Déforestation,Changements Significatifs,Dernière Analyse,Points Temporels,NDVI Moyen,NDVI Min,NDVI Max,Facteurs de Risque,Recommandations
```

**Format: JSON**

```json
{
  "count": 42,
  "filters": {
    "riskCategories": ["high_risk"],
    "regions": ["Aboisso"],
    "minSurfaceHectares": 0.5,
    "maxSurfaceHectares": 10,
    "hasDeforestation": true
  },
  "data": [
    {
      "id": "uuid-string",
      "code": "P001",
      "label": "Parcelle Nord",
      "village": "Ebilassokro",
      "region": "Aboisso",
      "surface_hectares": 2.5,
      "planteur_id": "uuid-string",
      "planteur_name": "Jean Kouassi",
      "planteur_code": "PL001",
      "risk_category": "high_risk",
      "current_health_status": "poor",
      "current_ndvi": 0.35,
      "trend": "declining",
      "trend_change_rate": -0.0025,
      "deforestation_alert_count": 1,
      "significant_change_count": 2,
      "last_calculation_date": "2026-06-30T10:30:00Z",
      "temporal_data_points": 12,
      "average_ndvi": 0.42,
      "min_ndvi": 0.35,
      "max_ndvi": 0.58,
      "risk_factors": "Santé faible; Tendance en déclin; Alertes de déforestation",
      "recommendations": "Visite terrain urgente requise; Vérifier conformité EUDR; Analyser causes du déclin (stress hydrique, maladies)"
    }
  ],
  "exportDate": "2026-06-30T10:30:00.000Z"
}
```

#### Status Codes

- `200 OK` - Export réussi
- `400 Bad Request` - Paramètres invalides
- `401 Unauthorized` - Non authentifié
- `403 Forbidden` - Permissions insuffisantes
- `500 Internal Server Error` - Erreur serveur

---

## Examples

### Export Parcelles à Risque (CSV)

```bash
curl -X GET \
  'https://app.cocoatrack.com/api/satellite/risk-export?category=high_risk&format=csv' \
  -H 'Authorization: Bearer <token>' \
  --output parcelles-risque.csv
```

### Export Bonnes Parcelles (JSON)

```bash
curl -X GET \
  'https://app.cocoatrack.com/api/satellite/risk-export?category=excellent,low_risk&format=json' \
  -H 'Authorization: Bearer <token>'
```

### Export avec Filtres Multiples

```bash
curl -X GET \
  'https://app.cocoatrack.com/api/satellite/risk-export?category=high_risk&region=Aboisso&minSurface=1&hasDeforestation=true&format=csv' \
  -H 'Authorization: Bearer <token>' \
  --output parcelles-risque-aboisso.csv
```

### JavaScript/TypeScript Example

```typescript
async function exportHighRiskParcelles() {
  const params = new URLSearchParams({
    category: 'high_risk',
    format: 'json',
    region: 'Aboisso'
  });

  const response = await fetch(
    `https://app.cocoatrack.com/api/satellite/risk-export?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Export failed');
  }

  const data = await response.json();
  console.log(`Exported ${data.count} parcelles`);
  return data;
}
```

### Python Example

```python
import requests
import csv

def export_risk_parcelles(access_token, category='high_risk', region=None):
    """Export risk parcelles to CSV"""
    
    params = {
        'category': category,
        'format': 'csv'
    }
    
    if region:
        params['region'] = region
    
    response = requests.get(
        'https://app.cocoatrack.com/api/satellite/risk-export',
        params=params,
        headers={'Authorization': f'Bearer {access_token}'}
    )
    
    response.raise_for_status()
    
    # Save to file
    with open('parcelles_export.csv', 'wb') as f:
        f.write(response.content)
    
    print(f"Export saved to parcelles_export.csv")

# Usage
export_risk_parcelles(
    access_token='your-token',
    category='high_risk',
    region='Aboisso'
)
```

---

## Data Fields

### Parcelle Information

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Identifiant unique de la parcelle |
| `code` | string | Code de la parcelle |
| `label` | string | Libellé de la parcelle |
| `village` | string | Village où se trouve la parcelle |
| `region` | string | Région administrative |
| `surface_hectares` | number | Surface en hectares |

### Planteur Information

| Field | Type | Description |
|-------|------|-------------|
| `planteur_id` | uuid | Identifiant du planteur |
| `planteur_name` | string | Nom complet du planteur |
| `planteur_code` | string | Code du planteur |

### Risk Assessment

| Field | Type | Description |
|-------|------|-------------|
| `risk_category` | string | Catégorie de risque (voir Risk Categories) |
| `current_health_status` | string | Statut de santé actuel (`excellent`, `good`, `fair`, `poor`, `critical`) |
| `current_ndvi` | number | Valeur NDVI actuelle (-1 à 1) |
| `trend` | string | Tendance temporelle (`improving`, `stable`, `declining`) |
| `trend_change_rate` | number | Taux de changement quotidien (pente régression) |

### Alerts and Changes

| Field | Type | Description |
|-------|------|-------------|
| `deforestation_alert_count` | integer | Nombre d'alertes de déforestation actives |
| `significant_change_count` | integer | Nombre de changements significatifs (Δ > 0.15) |

### Temporal Statistics

| Field | Type | Description |
|-------|------|-------------|
| `last_calculation_date` | datetime | Date de la dernière analyse NDVI |
| `temporal_data_points` | integer | Nombre de points de données disponibles |
| `average_ndvi` | number | NDVI moyen sur la période d'analyse |
| `min_ndvi` | number | NDVI minimum observé |
| `max_ndvi` | number | NDVI maximum observé |

### Context

| Field | Type | Description |
|-------|------|-------------|
| `risk_factors` | string | Facteurs de risque identifiés (séparés par `;`) |
| `recommendations` | string | Recommandations d'action (séparées par `;`) |

---

## Risk Classification Logic

### High Risk (`high_risk`)

Parcelle classée à risque élevé si :
- Santé critique (NDVI < 0.30) **OU**
- Santé faible (NDVI 0.30-0.45) **OU**
- Alertes de déforestation présentes **OU**
- Tendance en déclin + santé non excellente

**Recommandations typiques :**
- Visite terrain urgente
- Intervention immédiate (si critique)
- Vérification conformité EUDR (si déforestation)
- Analyse des causes de déclin

### Medium Risk (`medium_risk`)

Parcelle à surveiller si :
- Santé moyenne (NDVI 0.45-0.55) **OU**
- Santé bonne mais en déclin **OU**
- Autres situations non classées high/low/excellent

**Recommandations typiques :**
- Surveillance accrue
- Visite terrain sous 2 semaines (si déclin)
- Vérification irrigation et nutrition

### Low Risk (`low_risk`)

Parcelle en santé correcte si :
- Santé bonne/excellente (NDVI > 0.55) **ET**
- Tendance stable ou en amélioration

**Recommandations typiques :**
- Maintenir pratiques actuelles
- Surveillance mensuelle standard

### Excellent (`excellent`)

Parcelle en excellente santé si :
- Santé excellente (NDVI ≥ 0.65) **ET**
- Tendance stable ou en amélioration **ET**
- Aucune alerte de déforestation **ET**
- Aucun changement significatif

**Recommandations typiques :**
- Continuer les bonnes pratiques
- Partager avec autres planteurs

### Unknown (`unknown`)

Parcelle non évaluée :
- Données NDVI insuffisantes **OU**
- Aucun calcul NDVI effectué

**Recommandations typiques :**
- Collecter données NDVI

---

## NDVI Thresholds (Cocoa-Calibrated)

| Status | NDVI Range | Description |
|--------|------------|-------------|
| **Excellent** | 0.65 - 1.0 | Cacaoyers très vigoureux, ombrage optimal |
| **Good** | 0.55 - 0.65 | Cacaoyers sains, bon développement foliaire |
| **Fair** | 0.45 - 0.55 | Santé acceptable, surveillance recommandée |
| **Poor** | 0.30 - 0.45 | Stress hydrique ou nutritionnel probable |
| **Critical** | 0.0 - 0.30 | Défoliation sévère, intervention urgente |

> **Note:** Ces seuils sont calibrés pour la culture du cacao en système agroforestier avec ombrage. Les valeurs sont plus basses que pour les cultures en plein soleil.

---

## Temporal Analysis

### Analysis Window

- **Période:** 90 derniers jours
- **Méthode:** Régression linéaire simple (moindres carrés)
- **Output:** Tendance + taux de changement

### Trend Classification

- **Improving:** Pente > 0.001 (NDVI augmente)
- **Stable:** |Pente| ≤ 0.001 (NDVI constant)
- **Declining:** Pente < -0.001 (NDVI diminue)

### Significant Changes

Un changement est significatif si :
```
|NDVI_current - NDVI_previous| > 0.15
```

---

## Deforestation Alerts

### EUDR Baseline

- **Date:** 31 décembre 2020
- **Règlement:** EU Deforestation Regulation

### Detection Thresholds

- **NDVI decrease:** > 0.3 (30% perte végétation)
- **Affected area:** > 0.5 hectares

### Alert Status

- `pending` - En attente de vérification
- `acknowledged` - Reconnue par le gestionnaire
- `disputed` - Contestée
- `resolved` - Résolue

---

## Error Responses

### 400 Bad Request

```json
{
  "error": "Invalid query parameters",
  "details": [
    {
      "code": "invalid_type",
      "expected": "number",
      "received": "string",
      "path": ["minSurface"],
      "message": "Expected number, received string"
    }
  ]
}
```

### 401 Unauthorized

```json
{
  "error": "Unauthorized"
}
```

### 500 Internal Server Error

```json
{
  "error": "Failed to export risk data"
}
```

---

## Rate Limits

- **Requests per minute:** 60
- **Max export size:** 10,000 parcelles per request
- **Timeout:** 30 seconds

---

## Performance

### Expected Response Times

| Parcelles | Time |
|-----------|------|
| 1-100 | ~3-5s |
| 100-500 | ~10-15s |
| 500-1000 | ~20-30s |
| 1000+ | Contact support |

### Optimization Tips

1. **Use specific filters** to reduce dataset size
2. **Request CSV** for large datasets (smaller than JSON)
3. **Cache results** if exporting frequently
4. **Use pagination** for very large cooperatives

---

## Best Practices

### 1. Filter Appropriately

```bash
# Good: Specific filters
?category=high_risk&region=Aboisso

# Better: Multiple filters
?category=high_risk&minSurface=1&hasDeforestation=true
```

### 2. Choose Right Format

- **CSV:** Best for Excel analysis, data import
- **JSON:** Best for programmatic processing, APIs

### 3. Handle Errors Gracefully

```typescript
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json();
    console.error('Export failed:', error);
  }
  // Process response
} catch (error) {
  console.error('Network error:', error);
}
```

### 4. Parse CSV Correctly

```python
import csv
from io import StringIO

# Read CSV response
csv_content = response.text
reader = csv.DictReader(StringIO(csv_content))

for row in reader:
    parcelle_code = row['Code Parcelle']
    risk = row['Catégorie de Risque']
    # Process row...
```

---

## Support & Resources

- **Main Documentation:** `/docs/api/satellite.md`
- **Implementation Guide:** `/RISK_EXPORT_IMPLEMENTATION.md`
- **Tests:** `/tests/satellite/services/risk-assessment.service.test.ts`
- **GitHub Issues:** [Project Repository]

---

**Version:** 1.0.0  
**Last Updated:** June 30, 2026  
**Maintainer:** CocoaTrack Development Team
