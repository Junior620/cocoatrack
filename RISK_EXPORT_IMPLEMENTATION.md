# Implémentation du Système d'Export par Risque des Parcelles

## 📋 Vue d'Ensemble

Cette implémentation permet d'**identifier, filtrer et exporter** les parcelles selon leur niveau de risque basé sur :
- **Statut de santé NDVI** (excellent, bon, moyen, faible, critique)
- **Tendance temporelle** (amélioration, stable, déclin)
- **Alertes de déforestation**
- **Changements significatifs** dans les données NDVI

## 🎯 Objectifs Réalisés

### 1. **Classification des Parcelles par Risque**

Le système classe automatiquement les parcelles en **5 catégories** :

| Catégorie | Critères | Couleur |
|-----------|----------|---------|
| **À Risque Élevé** | Santé critique/faible OU déforestation OU déclin | Rouge (#ef4444) |
| **À Surveiller** | Santé moyenne OU déclin avec bonne santé | Orange (#f59e0b) |
| **Santé Correcte** | Santé bonne/excellente + tendance stable/amélioration | Vert (#10b981) |
| **Excellente Santé** | Excellente santé + amélioration + aucune alerte | Vert Foncé (#2d5016) |
| **Non Évalué** | Données NDVI insuffisantes | Gris (#6b7280) |

### 2. **Export Complet avec Informations Détaillées**

L'export CSV inclut **21 colonnes** avec toutes les données pertinentes :

#### Informations Parcelle
- Code Parcelle
- Libellé
- Village
- Région
- Surface (ha)

#### Informations Planteur
- Code Planteur
- Nom Planteur

#### Évaluation des Risques
- Catégorie de Risque
- Statut Santé Actuel
- NDVI Actuel
- Tendance (amélioration/stable/déclin)
- Taux de Changement

#### Alertes et Anomalies
- Nombre d'Alertes de Déforestation
- Nombre de Changements Significatifs

#### Statistiques Temporelles
- Dernière Date d'Analyse
- Nombre de Points Temporels
- NDVI Moyen (période analysée)
- NDVI Min
- NDVI Max

#### Contexte et Actions
- Facteurs de Risque (liste détaillée)
- Recommandations (actions suggérées)

### 3. **Interface Utilisateur Intuitive**

#### **Boutons d'Export Rapide**
- **"Exporter Parcelles à Risque"** (rouge) : Export direct des parcelles à risque élevé
- **"Exporter Bonnes Parcelles"** (vert) : Export direct des parcelles en excellente santé/santé correcte

#### **Filtres Avancés**
Modal avec options complètes :
- ✅ Sélection multiple de catégories de risque
- ✅ Filtrage par région
- ✅ Filtrage par surface (min/max)
- ✅ Filtrage par présence de déforestation
- ✅ Choix du format (CSV ou JSON)

## 🔧 Architecture Technique

### 1. **Service d'Évaluation des Risques**

**Fichier:** `lib/satellite/services/risk-assessment.service.ts`

#### Méthodes Principales

##### `assessRisk(parcelleId, supabase)`
Évalue le risque pour une parcelle individuelle.

**Processus :**
1. Récupère le dernier résultat NDVI
2. Analyse les données temporelles (90 derniers jours)
3. Compte les alertes de déforestation
4. Calcule la tendance (régression linéaire)
5. Détermine la catégorie de risque
6. Identifie les facteurs de risque
7. Génère des recommandations

**Retourne :** `RiskAssessment` complet

##### `getParcellesByRisk(filters, supabase)`
Récupère et filtre les parcelles par catégorie de risque.

**Processus :**
1. Applique les filtres de base (région, surface, planteur)
2. Évalue chaque parcelle individuellement
3. Filtre par catégories de risque
4. Filtre par déforestation si demandé
5. Retourne les parcelles avec détails complets

##### `analyzeTemporalData(data)`
Analyse temporelle des données NDVI.

**Calcule :**
- Tendance (régression linéaire sur les valeurs NDVI)
- Taux de changement (pente de la régression)
- Statistiques (moyenne, min, max)
- Nombre de changements significatifs (Δ > 0.15)

##### `determineRiskCategory(healthStatus, trend, deforestation, changes)`
Logique de classification du risque.

**Règles de Décision :**
```
SI santé critique/faible OU déforestation OU (déclin + santé non excellente)
  → À RISQUE ÉLEVÉ

SI santé excellente + (amélioration OU stable) + pas d'alertes
  → EXCELLENTE SANTÉ

SI santé bonne/excellente + (amélioration OU stable)
  → SANTÉ CORRECTE

SINON
  → À SURVEILLER
```

### 2. **API d'Export**

**Fichier:** `app/api/satellite/risk-export/route.ts`

#### Endpoint
```
GET /api/satellite/risk-export
```

#### Paramètres Query
| Paramètre | Type | Description | Exemple |
|-----------|------|-------------|---------|
| `category` | string | Catégories séparées par virgules | `high_risk,medium_risk` |
| `format` | enum | `csv` ou `json` | `csv` |
| `region` | string | Filtrer par région | `Aboisso` |
| `minSurface` | number | Surface minimale (ha) | `0.5` |
| `maxSurface` | number | Surface maximale (ha) | `5` |
| `hasDeforestation` | boolean | Avec/sans déforestation | `true` |
| `planteurId` | uuid | Filtrer par planteur | `uuid-here` |

#### Réponse CSV
Format standardisé avec 21 colonnes, valeurs échappées correctement, encoding UTF-8.

#### Réponse JSON
```json
{
  "count": 42,
  "filters": { ... },
  "data": [ ... ],
  "exportDate": "2026-06-30T10:30:00Z"
}
```

### 3. **Composant Interface**

**Fichier:** `components/satellite/RiskExportButton.tsx`

#### Props
```typescript
interface RiskExportButtonProps {
  regions?: string[];           // Liste des régions disponibles
  defaultFilters?: RiskExportFilters;
  showQuickActions?: boolean;   // Afficher boutons rapides
  className?: string;
}
```

#### Fonctionnalités
- ✅ Boutons d'action rapide (À Risque / Bonnes Parcelles)
- ✅ Modal de filtres avancés
- ✅ Gestion d'état de chargement
- ✅ Affichage d'erreurs
- ✅ Téléchargement automatique du fichier
- ✅ Noms de fichiers générés automatiquement

## 📊 Analyse des Risques

### Seuils NDVI (Calibrés pour le Cacao)

| Statut | Plage NDVI | Description |
|--------|------------|-------------|
| Excellent | 0.65 - 1.0 | Cacaoyers très vigoureux, ombrage optimal |
| Bon | 0.55 - 0.65 | Cacaoyers sains, bon développement foliaire |
| Moyen | 0.45 - 0.55 | Santé acceptable, surveillance recommandée |
| Faible | 0.30 - 0.45 | Stress hydrique ou nutritionnel probable |
| Critique | 0.0 - 0.30 | Défoliation sévère, intervention urgente |

### Analyse de Tendance

**Méthode:** Régression linéaire sur les 90 derniers jours

**Classification:**
- **Amélioration:** Pente > 0.001
- **Stable:** |Pente| ≤ 0.001
- **Déclin:** Pente < -0.001

### Détection de Changements Significatifs

Un changement est significatif si **Δ NDVI > 0.15** entre deux points temporels consécutifs.

### Alertes de Déforestation

Basées sur :
- Comparaison avec le baseline EUDR (31 décembre 2020)
- Diminution NDVI > 0.3
- Zone affectée > 0.5 hectares

## 💡 Recommandations Générées

Le système génère automatiquement des recommandations contextuelles :

### À Risque Élevé
- Visite terrain urgente requise
- Intervention immédiate pour défoliation sévère (si critique)
- Vérifier conformité EUDR (si déforestation)
- Analyser causes du déclin (stress hydrique, maladies)

### À Surveiller
- Surveillance accrue recommandée
- Planifier visite terrain sous 2 semaines (si déclin)
- Vérifier irrigation et nutrition

### Santé Correcte
- Maintenir pratiques culturales actuelles
- Surveillance mensuelle standard

### Excellente Santé
- Excellente performance, continuer
- Partager bonnes pratiques avec autres planteurs

### Non Évalué
- Collecter données NDVI pour évaluation

## 🚀 Utilisation

### 1. Export Rapide - Parcelles à Risque

```typescript
// Dans la page des parcelles
<RiskExportButton
  regions={villages}
  showQuickActions={true}
/>

// L'utilisateur clique sur "Exporter Parcelles à Risque"
// → Télécharge automatiquement : parcelles-risque-eleve-2026-06-30.csv
```

### 2. Export Rapide - Bonnes Parcelles

```typescript
// L'utilisateur clique sur "Exporter Bonnes Parcelles"
// → Télécharge automatiquement : parcelles-excellente-sante-2026-06-30.csv
```

### 3. Export avec Filtres Avancés

```typescript
// L'utilisateur clique sur "Filtres Avancés"
// → Ouvre le modal
// → Sélectionne catégories multiples
// → Applique filtres de région, surface, déforestation
// → Clique "Exporter"
// → Télécharge : parcelles-<categories>-2026-06-30.csv
```

### 4. Appel API Direct

```bash
# Export parcelles à risque de la région Aboisso
curl -X GET \
  "https://app.cocoatrack.com/api/satellite/risk-export?category=high_risk&region=Aboisso&format=csv" \
  -H "Authorization: Bearer <token>"

# Export JSON pour analyse programmatique
curl -X GET \
  "https://app.cocoatrack.com/api/satellite/risk-export?category=high_risk,medium_risk&format=json" \
  -H "Authorization: Bearer <token>"
```

## 📁 Fichiers Créés/Modifiés

### Nouveaux Fichiers

1. **`lib/satellite/services/risk-assessment.service.ts`** (563 lignes)
   - Service principal d'évaluation des risques
   - Classification automatique
   - Analyse temporelle
   - Génération de recommandations

2. **`app/api/satellite/risk-export/route.ts`** (372 lignes)
   - Endpoint API d'export
   - Génération CSV/JSON
   - Validation des paramètres
   - Gestion des erreurs

3. **`components/satellite/RiskExportButton.tsx`** (387 lignes)
   - Composant UI principal
   - Boutons d'action rapide
   - Modal de filtres avancés
   - Gestion du téléchargement

### Fichiers Modifiés

1. **`app/(dashboard)/parcelles/page.tsx`**
   - Import du composant `RiskExportButton`
   - Intégration dans la section d'export
   - Section visuelle distinctive (gradient bleu)

## 🧪 Exemples d'Export CSV

### Parcelle à Risque Élevé

```csv
Code Parcelle,Libellé,Village,Région,Surface (ha),Code Planteur,Nom Planteur,Catégorie de Risque,Statut Santé Actuel,NDVI Actuel,Tendance,Taux de Changement,Alertes Déforestation,Changements Significatifs,Dernière Analyse,Points Temporels,NDVI Moyen,NDVI Min,NDVI Max,Facteurs de Risque,Recommandations
P001,Parcelle Nord,Ebilassokro,Aboisso,2.50,PL001,Jean Kouassi,À Risque Élevé,poor,0.350,En déclin,-0.0025,1,2,30/06/2026,12,0.420,0.350,0.580,"Santé faible; Tendance en déclin; Alertes de déforestation","Visite terrain urgente requise; Vérifier conformité EUDR; Analyser causes du déclin (stress hydrique, maladies)"
```

### Parcelle en Excellente Santé

```csv
Code Parcelle,Libellé,Village,Région,Surface (ha),Code Planteur,Nom Planteur,Catégorie de Risque,Statut Santé Actuel,NDVI Actuel,Tendance,Taux de Changement,Alertes Déforestation,Changements Significatifs,Dernière Analyse,Points Temporels,NDVI Moyen,NDVI Min,NDVI Max,Facteurs de Risque,Recommandations
P042,Parcelle Est,Adiaké,Aboisso,3.20,PL012,Aya Kouamé,Excellente Santé,excellent,0.720,En amélioration,0.0018,0,0,30/06/2026,15,0.680,0.620,0.720,"Aucun facteur de risque identifié","Excellente performance, continuer; Partager bonnes pratiques avec autres planteurs"
```

## 🎨 Interface Utilisateur

### Section d'Export par Risque

La section est visuellement distinctive avec :
- Fond dégradé bleu clair (from-blue-50 to-indigo-50)
- Bordure bleue subtile
- Titre explicatif
- Boutons d'action proéminents avec icônes

### Boutons d'Action Rapide

- **Parcelles à Risque** : Rouge, icône AlertTriangle
- **Bonnes Parcelles** : Vert, icône CheckCircle
- **Filtres Avancés** : Blanc/gris, icône Filter

### Modal de Filtres Avancés

Interface complète avec :
- Checkboxes pour catégories multiples
- Sélection de région (dropdown)
- Plage de surface (inputs numériques)
- Filtre de déforestation (dropdown)
- Sélection de format (radio buttons)
- Boutons d'action (Annuler / Exporter)

## 📈 Cas d'Usage

### 1. Gestion Coopérative

**Scénario:** Le gérant veut identifier les parcelles nécessitant une intervention urgente.

**Action:**
1. Cliquer sur "Exporter Parcelles à Risque"
2. Ouvrir le CSV dans Excel
3. Trier par "Alertes Déforestation" descendant
4. Planifier visites terrain prioritaires

### 2. Rapport de Performance

**Scénario:** Préparation d'un rapport mensuel sur les meilleures parcelles.

**Action:**
1. Cliquer sur "Exporter Bonnes Parcelles"
2. Analyser les facteurs de succès
3. Identifier les bonnes pratiques
4. Organiser sessions de partage avec autres planteurs

### 3. Ciblage par Région

**Scénario:** Intervention spécifique dans la région d'Aboisso.

**Action:**
1. Cliquer sur "Filtres Avancés"
2. Sélectionner "À Risque Élevé" + "À Surveiller"
3. Choisir région "Aboisso"
4. Exporter et planifier intervention

### 4. Analyse Programmatique

**Scénario:** Intégration avec système externe d'analyse.

**Action:**
```bash
# API call pour récupérer données JSON
curl -X GET \
  "https://app.cocoatrack.com/api/satellite/risk-export?format=json" \
  -H "Authorization: Bearer <token>" \
  > risk_data.json

# Traitement avec script Python/R
python analyze_risks.py risk_data.json
```

## 🔒 Sécurité

- ✅ Authentification requise (Supabase Auth)
- ✅ Vérification des permissions (RLS Supabase)
- ✅ Validation des paramètres (Zod schema)
- ✅ Échappement CSV (injection prevention)
- ✅ Gestion d'erreurs robuste

## 🚦 Performance

### Optimisations

1. **Évaluation par lot** : Parcelles évaluées en parallèle avec `Promise.all`
2. **Requêtes ciblées** : Filtres appliqués en base de données
3. **Limitation temporelle** : Analyse sur 90 jours (réduit volume de données)
4. **Caching potentiel** : Structure prête pour ajout de cache Redis

### Benchmarks Estimés

| Nombre de Parcelles | Temps d'Export |
|---------------------|----------------|
| 100 parcelles | ~3-5 secondes |
| 500 parcelles | ~10-15 secondes |
| 1000 parcelles | ~20-30 secondes |

## 📚 Évolutions Futures

### Court Terme
- [ ] Ajout d'un cache Redis pour évaluations récentes
- [ ] Export PDF avec visualisations graphiques
- [ ] Notifications automatiques pour nouvelles parcelles à risque
- [ ] Historique des exports

### Moyen Terme
- [ ] Dashboard dédié aux risques avec graphiques
- [ ] Prédiction des risques par Machine Learning
- [ ] Intégration avec système de ticketing pour interventions
- [ ] Export multi-format (Excel avec graphiques, KML annoté)

### Long Terme
- [ ] Application mobile pour visites terrain
- [ ] Géolocalisation des interventions
- [ ] Suivi de l'évolution post-intervention
- [ ] Analyse comparative inter-régions

## 🎓 Informations Complémentaires

### Calibration NDVI pour le Cacao

Les seuils NDVI utilisés sont calibrés spécifiquement pour la culture du cacao en système agroforestier (avec ombrage). Le cacao cultivé sous ombrage présente naturellement des valeurs NDVI plus basses que les cultures en plein soleil, d'où les seuils ajustés.

### EUDR (EU Deforestation Regulation)

La date baseline du 31 décembre 2020 est conforme au règlement européen sur la déforestation, exigeant la preuve que le cacao n'a pas été cultivé sur des terres déforestées après cette date.

### Régression Linéaire

La tendance temporelle est calculée par régression linéaire simple (méthode des moindres carrés) sur les valeurs NDVI de la période d'analyse. La pente indique le taux de changement quotidien.

## 📞 Support

Pour toute question ou problème :
- Documentation complète : `/docs/api/satellite.md`
- Tests : `tests/satellite/services/risk-assessment.service.test.ts` (à créer)
- Issues : GitHub repository

---

**Date de création :** 30 juin 2026  
**Version :** 1.0.0  
**Auteur :** CocoaTrack Development Team
