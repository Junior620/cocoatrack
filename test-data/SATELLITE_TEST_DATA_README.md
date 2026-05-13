# Données de Test pour l'Analyse Satellite

## Vue d'ensemble

Ce fichier SQL crée des données de test pour tester les fonctionnalités d'analyse satellite de CocoaTrack (NDVI, analyse temporelle, détection de déforestation) dans des régions avec une excellente couverture satellite Sentinel-2.

## Pourquoi ces régions ?

Les parcelles au Cameroun peuvent avoir une couverture nuageuse élevée (zone tropicale), ce qui limite la disponibilité d'images satellites exploitables. Ces données de test utilisent des régions avec :

- ✅ **Excellente couverture Sentinel-2** (passages fréquents)
- ✅ **Moins de nuages** (surtout en saison sèche)
- ✅ **Végétation variée** (forêts, agriculture, plantations)
- ✅ **Zones de déforestation connues** (Amazonie) pour tester les alertes

## Régions couvertes

### 🇧🇷 Brésil (3 parcelles)
- **Région** : Amazonie (Manaus, Santarém)
- **Utilité** : Test de détection de déforestation, NDVI de forêt dense
- **Planteurs** : João Silva, Maria Santos
- **Codes** : `TEST-BR-001`, `TEST-BR-002`

### 🇪🇨 Équateur (2 parcelles)
- **Région** : Esmeraldas, Los Ríos (zones cacaoyères)
- **Utilité** : Test NDVI sur vraies plantations de cacao
- **Planteurs** : Carlos Mendoza, Ana Rodríguez
- **Codes** : `TEST-EC-001`, `TEST-EC-002`

### 🇪🇸 Espagne (2 parcelles)
- **Région** : Andalousie (Córdoba), Valence
- **Utilité** : Test sur agriculture méditerranéenne (oliviers, agrumes)
- **Planteurs** : Miguel García, Carmen López
- **Codes** : `TEST-ES-001`, `TEST-ES-002`

### 🇮🇹 Italie (2 parcelles)
- **Région** : Sicile (Catane), Toscane (Florence)
- **Utilité** : Test sur vignobles et agriculture européenne
- **Planteurs** : Giuseppe Rossi, Francesca Bianchi
- **Codes** : `TEST-IT-001`, `TEST-IT-002`

### 🇮🇩 Indonésie (2 parcelles)
- **Région** : Sulawesi (Palu), Sumatra (Padang)
- **Utilité** : Test sur plantations de cacao tropicales
- **Planteurs** : Budi Santoso, Siti Nurhaliza
- **Codes** : `TEST-ID-001`, `TEST-ID-002`

## Installation

### Prérequis

Avant d'exécuter le script, assurez-vous d'avoir :
- ✅ Au moins une coopérative dans la base de données
- ✅ Au moins un chef planteur
- ✅ Au moins un profil utilisateur (vous)

### Étapes d'installation

1. **Ouvrez Supabase SQL Editor**
   - Allez sur votre projet Supabase
   - Cliquez sur "SQL Editor" dans le menu latéral

2. **Copiez le contenu du fichier**
   ```bash
   cat test-data/satellite-test-data.sql
   ```

3. **Collez dans l'éditeur SQL et exécutez**
   - Le script détectera automatiquement vos IDs existants
   - Il créera 10 planteurs et 11 parcelles

4. **Vérifiez les résultats**
   - Vous devriez voir des messages de confirmation dans la console
   - Exemple : `✅ Test data creation complete!`

## Utilisation

### 1. Trouver les parcelles de test

Dans CocoaTrack :
1. Allez sur la page **Parcelles**
2. Utilisez le filtre de recherche
3. Cherchez les codes commençant par `TEST-`
4. Vous verrez toutes les parcelles de test

### 2. Tester l'analyse NDVI

Pour chaque parcelle :
1. Cliquez sur une parcelle de test
2. Cliquez sur **"Analyse NDVI"** ou **"Satellite"**
3. Le système va :
   - Récupérer l'imagerie Sentinel-2 la plus récente
   - Calculer le NDVI
   - Afficher la carte colorée
   - Montrer le statut de santé

**Parcelles recommandées pour NDVI** :
- `PAR-EC-001` (Équateur) - Plantation de cacao mature
- `PAR-BR-001` (Brésil) - Forêt dense (NDVI élevé)
- `PAR-ES-001` (Espagne) - Oliveraie (NDVI modéré)

### 3. Tester l'analyse temporelle

1. Ouvrez une parcelle de test
2. Cliquez sur **"Analyse temporelle"**
3. Utilisez le curseur pour naviguer dans le temps
4. Observez l'évolution du NDVI sur 12 mois

**Parcelles recommandées pour analyse temporelle** :
- `PAR-BR-003` (Brésil Pará) - Zone à risque de déforestation
- `PAR-EC-002` (Équateur) - Jeune plantation (évolution visible)
- `PAR-IT-002` (Italie) - Agriculture saisonnière

### 4. Tester la détection de déforestation

1. Ouvrez une parcelle en Amazonie
2. Allez dans **"Alertes de déforestation"**
3. Le système compare avec la baseline EUDR (31 déc 2020)
4. Si une perte de végétation > 0.3 NDVI est détectée, une alerte apparaît

**Parcelles recommandées pour déforestation** :
- `PAR-BR-001` (Manaus) - Forêt dense
- `PAR-BR-003` (Santarém) - Zone à risque élevé

### 5. Tester l'export KML

1. Sélectionnez plusieurs parcelles de test
2. Cliquez sur **"Exporter KML"**
3. Téléchargez le fichier
4. Ouvrez dans Google Earth pour visualiser

## Données attendues

### NDVI typique par région

| Région | NDVI attendu | Statut de santé | Notes |
|--------|--------------|-----------------|-------|
| Brésil (forêt) | 0.7 - 0.9 | Excellent | Végétation très dense |
| Équateur (cacao) | 0.5 - 0.7 | Bon à Moyen | Plantation mature |
| Espagne (olives) | 0.4 - 0.6 | Moyen | Agriculture méditerranéenne |
| Italie (vignes) | 0.3 - 0.5 | Moyen à Faible | Saisonnier |
| Indonésie (cacao) | 0.6 - 0.8 | Bon | Tropical, végétation dense |

### Disponibilité des images

| Région | Fréquence Sentinel-2 | Couverture nuageuse | Meilleure période |
|--------|---------------------|---------------------|-------------------|
| Brésil | 5 jours | Élevée (60-80%) | Août - Octobre (saison sèche) |
| Équateur | 5 jours | Moyenne (40-60%) | Juin - Septembre |
| Espagne | 5 jours | Faible (10-20%) | Toute l'année |
| Italie | 5 jours | Faible (15-25%) | Avril - Septembre |
| Indonésie | 5 jours | Élevée (50-70%) | Juin - Septembre |

## Nettoyage

Pour supprimer les données de test :

```sql
-- Supprimer les parcelles de test
DELETE FROM parcelles 
WHERE code LIKE 'TEST-%';

-- Supprimer les planteurs de test
DELETE FROM planteurs 
WHERE code LIKE 'TEST-%';
```

**⚠️ Attention** : Cette opération supprimera également toutes les données satellite associées (NDVI, imagerie, alertes) grâce aux contraintes `ON DELETE CASCADE`.

## Dépannage

### Problème : "No imagery available"

**Cause** : Pas d'image Sentinel-2 récente avec < 20% de nuages

**Solutions** :
1. Augmentez le seuil de couverture nuageuse dans les paramètres
2. Essayez une date différente avec le curseur temporel
3. Utilisez une parcelle dans une région avec moins de nuages (Espagne, Italie)

### Problème : "NDVI calculation failed"

**Cause** : Problème avec l'API Google Earth Engine

**Solutions** :
1. Vérifiez que les credentials GEE sont configurés (`.env.local`)
2. Vérifiez les logs de l'API : `/api/satellite/ndvi`
3. Testez la connexion GEE avec le script de test

### Problème : "Missing required data: cooperative, chef_planteur, or user profile"

**Cause** : Votre base de données n'a pas les données de base requises

**Solutions** :
1. Créez d'abord une coopérative
2. Créez un chef planteur
3. Assurez-vous d'avoir un profil utilisateur
4. Relancez le script

## Exemples de tests

### Test 1 : NDVI d'une forêt dense

```sql
-- Vérifier le NDVI de la parcelle brésilienne
SELECT 
  p.code,
  p.label,
  n.mean_ndvi,
  n.health_status,
  n.calculation_date
FROM parcelles p
LEFT JOIN ndvi_results n ON n.parcelle_id = p.id
WHERE p.code = 'PAR-BR-001'
ORDER BY n.calculation_date DESC
LIMIT 1;
```

**Résultat attendu** : NDVI > 0.7, statut "excellent"

### Test 2 : Évolution temporelle

```sql
-- Voir l'évolution NDVI sur 6 mois
SELECT 
  p.code,
  n.calculation_date::date,
  n.mean_ndvi,
  n.health_status
FROM parcelles p
JOIN ndvi_results n ON n.parcelle_id = p.id
WHERE p.code = 'PAR-EC-001'
  AND n.calculation_date > NOW() - INTERVAL '6 months'
ORDER BY n.calculation_date DESC;
```

### Test 3 : Alertes de déforestation

```sql
-- Vérifier les alertes de déforestation
SELECT 
  p.code,
  p.label,
  d.detection_date,
  d.ndvi_change,
  d.affected_area_hectares,
  d.status
FROM parcelles p
JOIN deforestation_events d ON d.parcelle_id = p.id
WHERE p.code LIKE 'PAR-BR-%'
ORDER BY d.detection_date DESC;
```

## Support

Si vous rencontrez des problèmes :

1. **Vérifiez les logs** : Console du navigateur et logs Supabase
2. **Consultez la documentation** : `docs/satellite/`
3. **Testez l'API GEE** : `docs/satellite/gee-test-results.md`
4. **Contactez l'équipe** : Créez une issue avec les détails

## Ressources

- [Documentation NDVI](../docs/user-guide/ndvi-analysis.md)
- [API Satellite](../docs/api/satellite.md)
- [Configuration GEE](../docs/deployment/vercel-gee-setup.md)
- [Sentinel-2 User Guide](https://sentinel.esa.int/web/sentinel/user-guides/sentinel-2-msi)

---

**Créé pour** : CocoaTrack - Plateforme de traçabilité du cacao  
**Version** : 1.0  
**Date** : Mai 2026
