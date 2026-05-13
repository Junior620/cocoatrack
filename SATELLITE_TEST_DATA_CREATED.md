# Données de Test Satellite - Créées ✅

## Résumé

J'ai créé des scripts SQL pour générer des données de test permettant de tester les fonctionnalités satellite de CocoaTrack dans des régions avec une excellente couverture Sentinel-2.

## Fichiers créés

### 1. `test-data/satellite-test-data.sql` (Script complet)
- **Contenu** : 10 planteurs + 11 parcelles
- **Régions** : Brésil, Équateur, Espagne, Italie, Indonésie
- **Utilisation** : Test complet de toutes les fonctionnalités

### 2. `test-data/quick-satellite-test.sql` (Script rapide)
- **Contenu** : 3 planteurs + 3 parcelles
- **Régions** : Brésil, Équateur, Espagne
- **Utilisation** : Test rapide des fonctionnalités principales

### 3. `test-data/SATELLITE_TEST_DATA_README.md` (Documentation)
- Guide complet d'utilisation
- Explications des régions choisies
- Instructions de test
- Dépannage

## Pourquoi ces régions ?

### 🇧🇷 Brésil (Amazonie)
- **Avantage** : Zone de déforestation active → parfait pour tester les alertes
- **NDVI attendu** : 0.7-0.9 (forêt dense)
- **Couverture nuageuse** : Élevée mais données disponibles en saison sèche

### 🇪🇨 Équateur
- **Avantage** : Vraies plantations de cacao → test réaliste du NDVI
- **NDVI attendu** : 0.5-0.7 (plantation mature)
- **Couverture nuageuse** : Moyenne

### 🇪🇸 Espagne
- **Avantage** : Excellente couverture satellite, peu de nuages
- **NDVI attendu** : 0.4-0.6 (agriculture méditerranéenne)
- **Couverture nuageuse** : Très faible (10-20%)

### 🇮🇹 Italie
- **Avantage** : Bonne couverture, agriculture variée
- **NDVI attendu** : 0.3-0.5 (vignobles, saisonnier)
- **Couverture nuageuse** : Faible (15-25%)

### 🇮🇩 Indonésie
- **Avantage** : Plantations de cacao tropicales
- **NDVI attendu** : 0.6-0.8 (végétation dense)
- **Couverture nuageuse** : Élevée mais gérable

## Installation rapide

### Option 1 : Script rapide (3 parcelles)

```bash
# 1. Ouvrir Supabase SQL Editor
# 2. Copier le contenu de test-data/quick-satellite-test.sql
# 3. Coller et exécuter
```

### Option 2 : Script complet (11 parcelles)

```bash
# 1. Ouvrir Supabase SQL Editor
# 2. Copier le contenu de test-data/satellite-test-data.sql
# 3. Coller et exécuter
```

## Utilisation

### 1. Trouver les parcelles de test

Dans CocoaTrack :
1. Aller sur **Parcelles**
2. Chercher `TEST-` dans la barre de recherche
3. Toutes les parcelles de test apparaîtront

### 2. Tester NDVI

1. Cliquer sur une parcelle (ex: `PAR-EC-TEST`)
2. Cliquer sur **"Analyse NDVI"**
3. Observer :
   - Carte colorée (rouge → vert)
   - Valeur NDVI moyenne
   - Statut de santé (Excellent, Bon, Moyen, Faible, Critique)

**Parcelles recommandées** :
- `PAR-EC-TEST` (Équateur) - Cacao mature
- `PAR-BR-TEST` (Brésil) - Forêt dense
- `PAR-ES-TEST` (Espagne) - Agriculture

### 3. Tester l'analyse temporelle

1. Ouvrir une parcelle
2. Cliquer sur **"Analyse temporelle"**
3. Utiliser le curseur pour naviguer dans le temps
4. Observer l'évolution du NDVI

### 4. Tester la détection de déforestation

1. Ouvrir `PAR-BR-TEST` (Brésil)
2. Aller dans **"Alertes de déforestation"**
3. Le système compare avec la baseline (31 déc 2020)
4. Si perte > 0.3 NDVI détectée → alerte

## Données attendues

| Parcelle | Région | NDVI attendu | Statut | Meilleure période |
|----------|--------|--------------|--------|-------------------|
| PAR-BR-TEST | Brésil | 0.7-0.9 | Excellent | Août-Octobre |
| PAR-EC-TEST | Équateur | 0.5-0.7 | Bon | Juin-Septembre |
| PAR-ES-TEST | Espagne | 0.4-0.6 | Moyen | Toute l'année |

## Nettoyage

Pour supprimer les données de test :

```sql
-- Supprimer les parcelles de test
DELETE FROM parcelles WHERE code LIKE 'TEST-%' OR code LIKE 'PAR-%-TEST';

-- Supprimer les planteurs de test
DELETE FROM planteurs WHERE code LIKE 'TEST-%';
```

## Avantages de ces données

✅ **Couverture satellite excellente** - Images disponibles tous les 5 jours  
✅ **Moins de nuages** - Surtout en Espagne et Italie  
✅ **Végétation variée** - Forêts, plantations, agriculture  
✅ **Zones de déforestation** - Amazonie pour tester les alertes  
✅ **Vraies plantations de cacao** - Équateur et Indonésie  
✅ **Données réalistes** - Coordonnées GPS réelles  

## Comparaison avec le Cameroun

| Critère | Cameroun | Régions de test |
|---------|----------|-----------------|
| Couverture nuageuse | 60-80% | 10-50% |
| Images exploitables/mois | 2-4 | 8-15 |
| NDVI cacao typique | 0.5-0.7 | 0.5-0.7 (Équateur) |
| Déforestation | Faible | Élevée (Brésil) |
| Disponibilité données | Variable | Excellente |

## Prochaines étapes

1. ✅ **Exécuter le script** dans Supabase
2. ✅ **Chercher les parcelles** avec le code `TEST-`
3. ✅ **Tester NDVI** sur `PAR-EC-TEST`
4. ✅ **Tester analyse temporelle** sur `PAR-BR-TEST`
5. ✅ **Tester déforestation** sur les parcelles brésiliennes
6. ✅ **Exporter KML** pour visualiser dans Google Earth

## Support

- **Documentation** : `test-data/SATELLITE_TEST_DATA_README.md`
- **Guide NDVI** : `docs/user-guide/ndvi-analysis.md`
- **API Satellite** : `docs/api/satellite.md`

---

**Créé le** : 13 mai 2026  
**Pour** : CocoaTrack - Test des fonctionnalités satellite  
**Régions** : 🇧🇷 🇪🇨 🇪🇸 🇮🇹 🇮🇩
