# Comment Utiliser les Données de Test Satellite

## 🎯 Objectif

Tester les fonctionnalités satellite de CocoaTrack (NDVI, analyse temporelle, déforestation) avec des parcelles dans des régions où la couverture satellite est excellente.

---

## 📋 Étape 1 : Installation des données

### Option A : Installation rapide (3 parcelles) ⚡

**Temps estimé** : 2 minutes

1. Ouvrez votre projet Supabase
2. Cliquez sur **"SQL Editor"** dans le menu de gauche
3. Cliquez sur **"New query"**
4. Ouvrez le fichier `test-data/quick-satellite-test.sql`
5. Copiez tout le contenu
6. Collez dans l'éditeur SQL
7. Cliquez sur **"Run"** (ou Ctrl+Enter)

**Résultat attendu** :
```
✅ Quick test data created successfully!

Created:
  - 3 test planteurs (Brazil, Ecuador, Spain)
  - 3 test parcelles

Test parcelles:
  🇧🇷 PAR-BR-TEST - Amazon forest (deforestation testing)
  🇪🇨 PAR-EC-TEST - Cocoa plantation (NDVI testing)
  🇪🇸 PAR-ES-TEST - Agricultural land (clear imagery)
```

### Option B : Installation complète (11 parcelles) 🌍

**Temps estimé** : 3 minutes

Même procédure mais avec le fichier `test-data/satellite-test-data.sql`

**Résultat attendu** :
```
✅ Test data creation complete!

Summary:
  - 10 planteurs created
  - 11 parcelles created
  - Regions: Brazil (3), Ecuador (2), Spain (2), Italy (2), Indonesia (2)
```

---

## 🔍 Étape 2 : Trouver les parcelles de test

1. Ouvrez CocoaTrack dans votre navigateur
2. Connectez-vous avec votre compte
3. Allez sur la page **"Parcelles"**
4. Dans la barre de recherche, tapez : `TEST`
5. Vous verrez toutes les parcelles de test apparaître

**Astuce** : Les parcelles de test ont des codes qui commencent par `TEST-` ou finissent par `-TEST`

---

## 🛰️ Étape 3 : Tester l'analyse NDVI

### Test 1 : NDVI sur une plantation de cacao (Équateur)

**Parcelle recommandée** : `PAR-EC-TEST`

1. Cliquez sur la parcelle `PAR-EC-TEST` dans la liste
2. Sur la page de détail, cherchez le bouton **"Analyse NDVI"** ou **"Satellite"**
3. Cliquez dessus
4. Attendez quelques secondes (le système récupère l'imagerie Sentinel-2)

**Ce que vous devriez voir** :
- 🗺️ Une carte colorée de la parcelle (rouge → jaune → vert)
- 📊 Valeur NDVI moyenne (attendu : **0.5 - 0.7**)
- 🏷️ Badge de statut : **"Bon"** ou **"Moyen"** (vert ou jaune)
- 📈 Statistiques : min, max, écart-type

**Interprétation** :
- **Vert foncé** = Végétation dense et saine (NDVI > 0.6)
- **Vert clair** = Végétation modérée (NDVI 0.4-0.6)
- **Jaune** = Végétation clairsemée (NDVI 0.2-0.4)
- **Rouge** = Sol nu ou végétation très faible (NDVI < 0.2)

### Test 2 : NDVI sur une forêt dense (Brésil)

**Parcelle recommandée** : `PAR-BR-TEST`

Même procédure que Test 1.

**Ce que vous devriez voir** :
- 📊 Valeur NDVI moyenne : **0.7 - 0.9** (très élevé)
- 🏷️ Badge de statut : **"Excellent"** (vert foncé)
- 🗺️ Carte presque entièrement vert foncé

**Pourquoi ?** C'est une forêt amazonienne dense avec beaucoup de végétation.

### Test 3 : NDVI sur agriculture méditerranéenne (Espagne)

**Parcelle recommandée** : `PAR-ES-TEST`

**Ce que vous devriez voir** :
- 📊 Valeur NDVI moyenne : **0.4 - 0.6**
- 🏷️ Badge de statut : **"Moyen"** (jaune)
- 🗺️ Carte avec mélange de vert et jaune

**Pourquoi ?** Agriculture méditerranéenne avec végétation moins dense qu'une forêt tropicale.

---

## 📅 Étape 4 : Tester l'analyse temporelle

### Voir l'évolution du NDVI sur 12 mois

**Parcelle recommandée** : `PAR-EC-TEST` ou `PAR-BR-TEST`

1. Ouvrez la parcelle
2. Cherchez le bouton **"Analyse temporelle"** ou **"Historique"**
3. Cliquez dessus

**Ce que vous devriez voir** :
- 📊 Un graphique montrant l'évolution du NDVI sur 12 mois
- 🎚️ Un curseur temporel en bas
- 📅 Des dates marquées sur le curseur

**Comment utiliser le curseur** :
1. Faites glisser le curseur vers la gauche (passé) ou droite (présent)
2. La carte se met à jour pour afficher l'imagerie de cette date
3. La valeur NDVI change selon la date sélectionnée

**Astuce** : Utilisez les flèches du clavier (← →) pour naviguer entre les dates

**Ce que vous pouvez observer** :
- 📈 **Tendance à la hausse** : Végétation qui s'améliore
- ➡️ **Tendance stable** : Végétation constante
- 📉 **Tendance à la baisse** : Végétation qui décline (⚠️ attention)

### Dates importantes marquées

Le système met en évidence les dates où un **changement significatif** a été détecté (variation NDVI > 0.15). Ces dates apparaissent en surbrillance sur le curseur.

---

## 🌳 Étape 5 : Tester la détection de déforestation

### Test sur une parcelle amazonienne

**Parcelle recommandée** : `PAR-BR-TEST` (Brésil)

1. Ouvrez la parcelle `PAR-BR-TEST`
2. Cherchez la section **"Alertes de déforestation"** ou **"EUDR"**
3. Cliquez sur **"Vérifier la déforestation"** ou **"Analyser"**

**Ce que le système fait** :
1. Récupère l'imagerie de la baseline EUDR (31 décembre 2020)
2. Récupère l'imagerie actuelle
3. Compare les deux NDVI
4. Si perte > 0.3 NDVI sur > 0.5 hectares → 🚨 Alerte

**Résultats possibles** :

### ✅ Cas 1 : Pas de déforestation
```
Statut : Conforme EUDR
NDVI baseline (2020) : 0.75
NDVI actuel : 0.72
Changement : -0.03 (normal)
```

### 🚨 Cas 2 : Déforestation détectée
```
⚠️ ALERTE DE DÉFORESTATION

NDVI baseline (2020) : 0.75
NDVI actuel : 0.22
Changement : -0.53
Zone affectée : 2.3 hectares (44%)

Statut : Non conforme EUDR
Action requise : Investigation immédiate
```

**Actions disponibles** :
- 📝 **Reconnaître l'alerte** : Confirmer que vous avez vu l'alerte
- ❌ **Contester l'alerte** : Si vous pensez que c'est une fausse alerte
- 📄 **Générer un rapport** : Créer un rapport de certification

---

## 📤 Étape 6 : Tester l'export KML

### Exporter pour visualiser dans Google Earth

1. Sélectionnez une ou plusieurs parcelles de test
2. Cliquez sur **"Exporter"** ou **"Actions"**
3. Choisissez **"Exporter KML"**
4. Cochez les options :
   - ☑️ Inclure NDVI
   - ☑️ Inclure données temporelles
   - ☑️ Inclure alertes de déforestation
5. Cliquez sur **"Télécharger"**

**Résultat** : Un fichier `.kml` est téléchargé

### Visualiser dans Google Earth

1. Ouvrez [Google Earth Web](https://earth.google.com/web/)
2. Cliquez sur **"Projets"** (icône en haut à gauche)
3. Cliquez sur **"Importer un fichier KML"**
4. Sélectionnez le fichier téléchargé
5. Explorez la parcelle en 3D avec les données NDVI

---

## 🎨 Comprendre les couleurs NDVI

### Légende des couleurs

| Couleur | NDVI | Signification | Exemple |
|---------|------|---------------|---------|
| 🟫 Brun | < 0.0 | Eau, sol nu | Rivière, chemin |
| 🔴 Rouge | 0.0 - 0.2 | Très faible | Sol dégradé |
| 🟠 Orange | 0.2 - 0.4 | Faible | Végétation clairsemée |
| 🟡 Jaune | 0.4 - 0.6 | Modéré | Jeune plantation |
| 🟢 Vert | 0.6 - 0.8 | Bon | Plantation mature |
| 🌲 Vert foncé | 0.8 - 1.0 | Excellent | Forêt dense |

### Statuts de santé

| Badge | NDVI | Signification | Action |
|-------|------|---------------|--------|
| 🟢 **Excellent** | 0.7-1.0 | Végétation très saine | Continuer |
| 🟩 **Bon** | 0.6-0.7 | Végétation saine | Surveiller |
| 🟡 **Moyen** | 0.5-0.6 | Attention requise | Vérifier |
| 🟠 **Faible** | 0.3-0.5 | Intervention recommandée | Agir |
| 🔴 **Critique** | 0.0-0.3 | Action immédiate | Urgence |

---

## 🌍 Comparaison des régions de test

### Disponibilité des images

| Région | Couverture nuageuse | Images/mois | Meilleure période |
|--------|---------------------|-------------|-------------------|
| 🇧🇷 Brésil | Élevée (60-80%) | 2-4 | Août-Octobre |
| 🇪🇨 Équateur | Moyenne (40-60%) | 4-8 | Juin-Septembre |
| 🇪🇸 Espagne | Faible (10-20%) | 12-15 | Toute l'année |
| 🇮🇹 Italie | Faible (15-25%) | 10-12 | Avril-Septembre |
| 🇮🇩 Indonésie | Élevée (50-70%) | 3-6 | Juin-Septembre |

### NDVI typique

| Région | Type de végétation | NDVI attendu |
|--------|-------------------|--------------|
| 🇧🇷 Brésil | Forêt amazonienne | 0.7 - 0.9 |
| 🇪🇨 Équateur | Plantation cacao | 0.5 - 0.7 |
| 🇪🇸 Espagne | Agriculture méditerranéenne | 0.4 - 0.6 |
| 🇮🇹 Italie | Vignobles | 0.3 - 0.5 |
| 🇮🇩 Indonésie | Plantation tropicale | 0.6 - 0.8 |

---

## ❓ Problèmes courants

### Problème 1 : "No imagery available"

**Cause** : Pas d'image Sentinel-2 récente avec < 20% de nuages

**Solutions** :
1. Essayez une date différente avec le curseur temporel
2. Augmentez le seuil de couverture nuageuse (si option disponible)
3. Utilisez une parcelle en Espagne ou Italie (moins de nuages)

### Problème 2 : "NDVI calculation failed"

**Cause** : Problème avec l'API Google Earth Engine

**Solutions** :
1. Vérifiez que les credentials GEE sont configurés dans `.env.local`
2. Vérifiez les logs de l'API dans la console du navigateur (F12)
3. Attendez quelques minutes et réessayez

### Problème 3 : NDVI très bas sur une forêt

**Cause possible** : Image prise en saison sèche ou avec des nuages

**Solutions** :
1. Vérifiez la date de l'image (affichée sur la carte)
2. Essayez une date différente avec le curseur temporel
3. Vérifiez le pourcentage de couverture nuageuse

### Problème 4 : Parcelles de test non trouvées

**Cause** : Script SQL pas encore exécuté

**Solutions** :
1. Retournez à l'Étape 1 et exécutez le script SQL
2. Vérifiez que le script s'est exécuté sans erreur
3. Rafraîchissez la page des parcelles (F5)

---

## 🧹 Nettoyage

### Supprimer les données de test

Quand vous avez fini de tester :

```sql
-- Supprimer les parcelles de test
DELETE FROM parcelles 
WHERE code LIKE 'TEST-%' OR code LIKE 'PAR-%-TEST';

-- Supprimer les planteurs de test
DELETE FROM planteurs 
WHERE code LIKE 'TEST-%';
```

**⚠️ Attention** : Cette opération supprimera aussi toutes les données satellite associées (NDVI, imagerie, alertes).

---

## 📚 Ressources

- **Guide utilisateur NDVI** : `docs/user-guide/ndvi-analysis.md`
- **Documentation technique** : `docs/satellite/ndvi-calculation.md`
- **API Satellite** : `docs/api/satellite.md`
- **README complet** : `test-data/SATELLITE_TEST_DATA_README.md`

---

## ✅ Checklist de test

Cochez au fur et à mesure :

- [ ] Installation des données de test (Étape 1)
- [ ] Parcelles trouvées dans l'interface (Étape 2)
- [ ] NDVI calculé sur PAR-EC-TEST (Étape 3.1)
- [ ] NDVI calculé sur PAR-BR-TEST (Étape 3.2)
- [ ] NDVI calculé sur PAR-ES-TEST (Étape 3.3)
- [ ] Analyse temporelle testée (Étape 4)
- [ ] Détection déforestation testée (Étape 5)
- [ ] Export KML testé (Étape 6)
- [ ] Visualisation dans Google Earth (Étape 6)
- [ ] Nettoyage des données de test (optionnel)

---

**Bon test ! 🚀**

Si vous rencontrez des problèmes, consultez `test-data/SATELLITE_TEST_DATA_README.md` pour plus de détails.
