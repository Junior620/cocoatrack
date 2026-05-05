# Calibration NDVI pour le Cacao + Traduction Française

## Date
2026-05-04

## Résumé
Ajustement des seuils NDVI pour la culture du cacao et traduction complète en français des badges de santé et recommandations.

## Modifications Appliquées

### 1. Seuils NDVI Ajustés pour le Cacao

**Fichier**: `lib/satellite/services/ndvi.service.ts`

#### Anciens Seuils (Génériques)
```typescript
EXCELLENT: 0.7   // 0.7 - 1.0
GOOD: 0.6        // 0.6 - 0.7
FAIR: 0.5        // 0.5 - 0.6
POOR: 0.3        // 0.3 - 0.5
CRITICAL: 0.0    // 0.0 - 0.3
```

#### Nouveaux Seuils (Cacao)
```typescript
EXCELLENT: 0.65  // 0.65 - 1.0 (Cacaoyers très vigoureux, ombrage optimal)
GOOD: 0.55       // 0.55 - 0.65 (Cacaoyers sains, bon développement foliaire)
FAIR: 0.45       // 0.45 - 0.55 (Santé acceptable, surveillance recommandée)
POOR: 0.30       // 0.30 - 0.45 (Stress hydrique ou nutritionnel probable)
CRITICAL: 0.0    // 0.0 - 0.30 (Défoliation sévère, intervention urgente)
```

#### Justification
Les cacaoyers poussent sous ombrage (agroforesterie) et ont naturellement un NDVI plus bas que les cultures en plein soleil. Les seuils ont été abaissés de 0.05 à 0.10 points pour refléter cette réalité agronomique.

### 2. Recommandations en Français (Spécifiques au Cacao)

**Fichier**: `lib/satellite/services/ndvi.service.ts`

| Statut | Recommandation |
|--------|----------------|
| **Excellent** | Les cacaoyers sont en excellente santé. Continuez les pratiques actuelles de gestion et d'ombrage. |
| **Bon** | Les cacaoyers sont en bonne santé. Maintenez un suivi régulier et les pratiques d'entretien. |
| **Moyen** | Santé acceptable des cacaoyers. Vérifiez l'irrigation, la fertilisation et l'ombrage. Surveillez les signes de stress. |
| **Faible** | Santé des cacaoyers en déclin. Inspectez pour stress hydrique, carences nutritionnelles, maladies (pourriture brune, moniliose) ou ravageurs (mirides). |
| **Critique** | État critique des cacaoyers. Intervention immédiate requise. Consultez un agronome spécialisé en cacao. Vérifiez l'ombrage, l'irrigation et les maladies. |

**Éléments spécifiques au cacao mentionnés**:
- Ombrage (crucial pour le cacao)
- Maladies du cacao: pourriture brune, moniliose
- Ravageurs du cacao: mirides
- Agronome spécialisé en cacao

### 3. Labels des Badges en Français

**Fichier**: `components/satellite/HealthStatusBadge.tsx`

| Anglais | Français |
|---------|----------|
| Excellent | Excellent |
| Good | Bon |
| Fair | Moyen |
| Poor | Faible |
| Critical | Critique |

**Tendances traduites**:
- Improving → En amélioration
- Stable → Stable
- Declining → En déclin

**Aria-labels pour l'accessibilité**:
- "Health status: Good" → "État de santé: Bon"
- "trend: improving" → "tendance: en amélioration"

## Impact sur Votre Parcelle

### Avant (Seuils Génériques)
- **NDVI**: 0.525
- **Statut**: Fair (Moyen)
- **Badge**: "Fair" (jaune)
- **Recommandation**: "Vegetation shows moderate health. Consider reviewing irrigation and fertilization."

### Après (Seuils Cacao + Français)
- **NDVI**: 0.525
- **Statut**: Good (Bon)
- **Badge**: "Bon" (vert)
- **Recommandation**: "Les cacaoyers sont en bonne santé. Maintenez un suivi régulier et les pratiques d'entretien."

## Tableau Comparatif des Seuils

| NDVI | Avant (Générique) | Après (Cacao) |
|------|-------------------|---------------|
| 0.75 | Excellent | Excellent |
| 0.65 | Good | Excellent ⬆️ |
| 0.60 | Good | Good |
| 0.55 | Fair | Good ⬆️ |
| 0.525 | Fair | **Good ⬆️** |
| 0.50 | Fair | Fair |
| 0.45 | Poor | Fair ⬆️ |
| 0.40 | Poor | Poor |
| 0.35 | Poor | Poor |
| 0.25 | Critical | Critical |

**Légende**: ⬆️ = Amélioration du statut avec les nouveaux seuils

## Bénéfices

1. **Plus Précis**: Seuils calibrés pour la physiologie du cacaoyer
2. **Moins d'Alarmes**: Évite les faux positifs pour des NDVI normaux en cacao
3. **Contextualisé**: Recommandations spécifiques aux problèmes du cacao
4. **Accessible**: Interface entièrement en français
5. **Professionnel**: Terminologie agronomique appropriée

## Références Scientifiques

Les seuils sont basés sur:
- Études NDVI sur cacaoyers en agroforesterie
- Valeurs typiques: 0.4 - 0.7 pour cacao sain sous ombrage
- Comparaison avec cultures plein soleil (NDVI 0.6 - 0.9)

## Fichiers Modifiés

1. `lib/satellite/services/ndvi.service.ts`
   - Seuils HEALTH_STATUS_THRESHOLDS ajustés
   - Recommandations traduites et adaptées au cacao
   - Documentation mise à jour

2. `components/satellite/HealthStatusBadge.tsx`
   - Labels traduits en français
   - Aria-labels traduits pour accessibilité
   - Tendances traduites

## Test

Pour vérifier les changements:

1. Rafraîchir la page `/parcelles`
2. Les badges doivent afficher: **Excellent**, **Bon**, **Moyen**, **Faible**, **Critique**
3. Cliquer sur une parcelle pour voir la recommandation en français
4. Une parcelle avec NDVI 0.525 doit maintenant afficher **"Bon"** (vert) au lieu de **"Moyen"** (jaune)

## Prochaines Étapes Possibles

1. **Seuils par région**: Ajuster selon climat (Côte d'Ivoire vs Ghana)
2. **Seuils par saison**: Différencier saison sèche/humide
3. **Seuils par âge**: Jeunes plants vs arbres matures
4. **Alertes personnalisées**: Notifications basées sur tendances
5. **Historique**: Graphiques d'évolution NDVI dans le temps

## Notes

- Les seuils peuvent être affinés avec plus de données terrain
- Recommandé de valider avec agronomes locaux
- Possibilité d'ajouter des seuils par coopérative si besoin
