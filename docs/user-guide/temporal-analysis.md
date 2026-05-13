# Guide d'Analyse Temporelle — CocoaTrack
# Temporal Analysis User Guide — CocoaTrack

> **Public cible / Target audience**: Gestionnaires de coopératives, Agronomes, Auditeurs de certification  
> **Langue principale / Primary language**: Français  
> **Plateforme / Platform**: CocoaTrack — Suivi de la traçabilité du cacao au Cameroun

---

## Table des matières / Table of Contents

1. [Qu'est-ce que l'analyse temporelle ?](#1-quest-ce-que-lanalyse-temporelle)
2. [Le curseur temporel — Comment l'utiliser](#2-le-curseur-temporel--comment-lutiliser)
3. [Le graphique d'évolution NDVI](#3-le-graphique-dévolution-ndvi)
4. [Interpréter les changements](#4-interpréter-les-changements)
5. [Exporter les données temporelles](#5-exporter-les-données-temporelles)
6. [Exemples pratiques](#6-exemples-pratiques)
7. [Questions fréquentes](#7-questions-fréquentes)

---

## 1. Qu'est-ce que l'analyse temporelle ?

### En termes simples

L'**analyse temporelle** vous permet de voir comment votre parcelle a évolué au fil du temps, en comparant des images satellites prises à différentes dates. C'est comme feuilleter un album photo de votre plantation — mais avec des données scientifiques précises sur la santé de la végétation.

Grâce à l'analyse temporelle dans CocoaTrack, vous pouvez :

- **Suivre l'évolution** de la santé de vos cacaoyers mois par mois
- **Détecter les problèmes tôt** avant qu'ils ne deviennent critiques
- **Mesurer l'efficacité** d'une intervention agronomique (traitement, irrigation, fertilisation)
- **Préparer les rapports EUDR** en comparant l'état actuel avec la référence de décembre 2020
- **Identifier les tendances saisonnières** propres à votre région

### En anglais / In English

**What is Temporal Analysis?**

Temporal analysis lets you see how your parcelle has changed over time by comparing satellite images taken on different dates. It's like a photo album of your plantation — but with precise scientific data on vegetation health.

With temporal analysis in CocoaTrack, you can:

- **Track evolution** of your cocoa trees' health month by month
- **Detect problems early** before they become critical
- **Measure the effectiveness** of agronomic interventions (treatment, irrigation, fertilization)
- **Prepare EUDR reports** by comparing current state with the December 2020 baseline
- **Identify seasonal trends** specific to your region

---

## 2. Le curseur temporel — Comment l'utiliser

### Accéder à l'analyse temporelle / Accessing Temporal Analysis

1. **Ouvrez la fiche d'une parcelle** dans CocoaTrack
2. **Cliquez sur l'onglet "Analyse temporelle"** dans le menu de la parcelle
3. Le curseur temporel et le graphique s'affichent automatiquement avec les données des 12 derniers mois

*In English: Open a parcelle detail page, then click the "Temporal Analysis" tab. The slider and chart load automatically with the last 12 months of data.*

---

### Naviguer dans le temps / Navigating Through Time

Le curseur temporel est la barre horizontale en bas de la carte. Chaque point sur la barre représente une date pour laquelle des données satellites sont disponibles.

**Pour naviguer :**

| Action | Comment faire |
|--------|---------------|
| Aller à une date précise | Cliquez sur le point correspondant sur la barre |
| Avancer d'une date | Cliquez sur la flèche droite `→` ou appuyez sur la touche `→` du clavier |
| Reculer d'une date | Cliquez sur la flèche gauche `←` ou appuyez sur la touche `←` du clavier |
| Aller au début | Cliquez sur le bouton `|◀` ou appuyez sur la touche `Début` (Home) |
| Aller à la fin | Cliquez sur le bouton `▶|` ou appuyez sur la touche `Fin` (End) |
| Lancer l'animation | Cliquez sur le bouton `▶ Lecture` ou appuyez sur la barre `Espace` |
| Arrêter l'animation | Cliquez sur `⏸ Pause` ou appuyez sur `Espace` |

*In English: The temporal slider is the horizontal bar at the bottom of the map. Each dot represents a date with available satellite data. Use the arrow buttons or keyboard shortcuts to navigate.*

---

### Sur mobile / On Mobile

Sur un téléphone ou une tablette, utilisez les gestes tactiles :

| Geste | Action |
|-------|--------|
| Glisser vers la gauche | Avancer à la date suivante |
| Glisser vers la droite | Reculer à la date précédente |
| Appuyer sur un point | Sélectionner cette date |
| Appuyer sur `▶` | Lancer/arrêter l'animation |

*In English: On mobile, swipe left to go forward in time, swipe right to go back. Tap any dot to jump to that date.*

---

### Informations affichées / Information Displayed

Pour chaque date sélectionnée, le curseur affiche :

- **La date** de l'image satellite (ex. : "3 mai 2024")
- **La valeur NDVI** moyenne de la parcelle (ex. : "NDVI : 0,68")
- **Le statut de santé** avec son badge coloré (ex. : 🟩 Bon)
- **La couverture nuageuse** en pourcentage (ex. : "☁ 12%")
- **Un indicateur de changement significatif** si le NDVI a varié de plus de 0,15 par rapport à la date précédente

*In English: For each selected date, the slider shows the acquisition date, mean NDVI value, health status badge, cloud cover percentage, and a significant change indicator when applicable.*

---

### Points orange — Changements significatifs / Orange Dots — Significant Changes

Les **points orange** sur la barre du curseur signalent des dates où un **changement significatif** a été détecté — c'est-à-dire une variation du NDVI supérieure à 0,15 par rapport à la mesure précédente.

Ces points méritent une attention particulière car ils peuvent indiquer :
- Une amélioration soudaine (pluies abondantes, intervention réussie)
- Une dégradation rapide (début de maladie, sécheresse, déforestation)

> **Conseil** : Cliquez sur un point orange pour voir l'image satellite correspondante et comparer avec la date précédente.

*In English: Orange dots on the slider mark dates with significant NDVI changes (> 0.15 from the previous measurement). These warrant attention as they may indicate sudden improvement or rapid decline.*

---

## 3. Le graphique d'évolution NDVI

### Lire le graphique / Reading the Chart

Le graphique au-dessus du curseur montre l'évolution du NDVI dans le temps sous forme de courbe. L'axe horizontal représente le temps, l'axe vertical représente la valeur NDVI (de 0 à 1).

**Éléments du graphique :**

| Élément | Description |
|---------|-------------|
| **Courbe bleue** | Évolution du NDVI dans le temps |
| **Points colorés** | Chaque mesure, colorée selon le statut de santé |
| **Points orange avec cercle** | Dates avec changement significatif |
| **Ligne verticale** | Date actuellement sélectionnée sur le curseur |
| **Lignes horizontales pointillées** | Seuils de santé (Excellent, Moyen, Faible) |

**Lignes de référence :**
- **Vert foncé (0,70)** : Seuil Excellent
- **Jaune (0,50)** : Seuil Moyen
- **Orange (0,30)** : Seuil Faible

*In English: The chart shows NDVI evolution over time. Colored dots represent each measurement, orange circles mark significant changes, and the vertical line shows the currently selected date. Dashed reference lines indicate health status thresholds.*

---

### Statistiques résumées / Summary Statistics

Sous le graphique, CocoaTrack affiche un résumé statistique de la période analysée :

| Statistique | Signification |
|-------------|---------------|
| **NDVI moyen** | Valeur NDVI moyenne sur toute la période |
| **NDVI min / max** | Valeurs extrêmes observées |
| **Changements significatifs** | Nombre de dates avec variation > 0,15 |
| **Tendance** | Direction générale : 📈 Amélioration, ➡️ Stable, 📉 Déclin |

*In English: Below the chart, summary statistics show the mean NDVI, min/max values, count of significant changes, and the overall trend direction for the analyzed period.*

---

### Interagir avec le graphique / Interacting with the Chart

- **Survolez un point** pour voir le détail (date, NDVI, statut, couverture nuageuse)
- **Cliquez sur un point** pour sélectionner cette date sur le curseur et mettre à jour la carte
- **Cliquez sur "Exporter CSV"** pour télécharger les données (voir section 5)

*In English: Hover over any data point to see details. Click a point to select that date on the slider and update the map. Use the "Export CSV" button to download the data.*

---

## 4. Interpréter les changements

### Les trois tendances / The Three Trends

CocoaTrack calcule automatiquement la tendance de votre parcelle sur les 3 derniers mois :

| Tendance | Icône | Signification | Action recommandée |
|----------|-------|---------------|-------------------|
| **En amélioration** | 📈 | Le NDVI augmente régulièrement | Continuer les pratiques actuelles |
| **Stable** | ➡️ | Le NDVI reste constant | Surveillance régulière suffisante |
| **En déclin** | 📉 | Le NDVI diminue régulièrement | Intervention recommandée |

*In English: CocoaTrack automatically calculates the 3-month trend. "Improving" means NDVI is rising, "Stable" means it's constant, and "Declining" means it's falling and may require intervention.*

---

### Changements normaux vs. préoccupants / Normal vs. Concerning Changes

Tous les changements ne sont pas alarmants. Voici comment distinguer les variations normales des signaux d'alerte :

#### Variations normales / Normal Variations

| Situation | Variation NDVI attendue | Explication |
|-----------|------------------------|-------------|
| Début de saison sèche (nov.–mars) | Baisse de 0,05 à 0,15 | Réduction naturelle de l'activité des arbres |
| Retour des pluies (avr.–juin) | Hausse de 0,10 à 0,20 | Reprise de la végétation |
| Après la récolte | Légère baisse | Stress temporaire des arbres |
| Petite saison sèche (juil.–sept.) | Légère baisse | Variation saisonnière normale |

*In English: Some NDVI changes are normal — a drop at the start of the dry season (Nov–Mar) or a rise when rains return (Apr–Jun) are expected. These are seasonal patterns, not problems.*

#### Signaux d'alerte / Warning Signs

| Signal | Variation NDVI | Cause possible | Action |
|--------|---------------|----------------|--------|
| Chute rapide hors saison sèche | > -0,15 en 1 mois | Maladie, ravageur, sécheresse anormale | Visite de terrain urgente |
| Déclin progressif sur 3+ mois | > -0,20 au total | Appauvrissement du sol, stress chronique | Diagnostic agronomique |
| Chute brutale sur grande surface | > -0,30 | Déforestation possible | Alerte EUDR — contacter la coopérative |
| NDVI < 0,3 en saison des pluies | Valeur absolue | Problème grave | Action immédiate |

*In English: Warning signs include rapid drops outside the dry season, progressive decline over 3+ months, sudden large drops (possible deforestation), or NDVI below 0.3 during the rainy season.*

---

### Comparer deux périodes / Comparing Two Periods

Pour mesurer l'impact d'une intervention ou vérifier la conformité EUDR :

1. **Notez la valeur NDVI** à la date de référence (ex. : avant traitement, ou décembre 2020)
2. **Naviguez à la date actuelle** avec le curseur
3. **Comparez les valeurs** affichées — CocoaTrack calcule automatiquement la différence absolue et le pourcentage de changement

**Formule de calcul :**
- Changement absolu = NDVI actuel − NDVI référence
- Changement en % = ((NDVI actuel − NDVI référence) / NDVI référence) × 100

*In English: To compare two periods, note the NDVI at your reference date, then navigate to the current date. CocoaTrack automatically calculates the absolute and percentage change between the two values.*

---

### Saisons au Cameroun / Seasons in Cameroon

Pour interpréter correctement les données temporelles, tenez compte du calendrier saisonnier :

| Période | Saison | Impact sur le NDVI |
|---------|--------|-------------------|
| Novembre – Mars | Saison sèche | Baisse naturelle du NDVI (normal jusqu'à -0,15) |
| Avril – Juin | Grande saison des pluies | Hausse du NDVI — période optimale pour l'analyse |
| Juillet – Septembre | Petite saison sèche | Légère baisse (moins marquée que nov.–mars) |
| Octobre | Petite saison des pluies | Remontée avant la récolte principale |

> **Conseil EUDR** : Pour les comparaisons de conformité, utilisez des images de la même saison (ex. : décembre 2020 vs. décembre 2024) pour éviter les biais saisonniers.

*In English: Cameroon's seasonal calendar affects NDVI. The dry season (Nov–Mar) naturally lowers NDVI. For EUDR compliance comparisons, always compare images from the same season to avoid seasonal bias.*

---

## 5. Exporter les données temporelles

### Export CSV

Vous pouvez télécharger toutes les données temporelles de votre parcelle au format CSV pour les analyser dans Excel, Google Sheets, ou tout autre logiciel.

**Pour exporter :**
1. Ouvrez l'onglet "Analyse temporelle" de votre parcelle
2. Cliquez sur le bouton **"Exporter CSV"** en haut du graphique
3. Le fichier se télécharge automatiquement

**Nom du fichier** : `temporal-ndvi-{id-parcelle}-{date-début}-{date-fin}.csv`

*In English: Click the "Export CSV" button above the chart to download all temporal data. The file downloads automatically.*

---

### Contenu du fichier CSV / CSV File Contents

Le fichier CSV contient les colonnes suivantes :

| Colonne | Description | Exemple |
|---------|-------------|---------|
| `date` | Date de la mesure (format ISO) | `2024-05-03` |
| `ndvi` | Valeur NDVI moyenne | `0.680` |
| `min_ndvi` | NDVI minimum sur la parcelle | `0.520` |
| `max_ndvi` | NDVI maximum sur la parcelle | `0.830` |
| `cloud_cover` | Couverture nuageuse (%) | `15` |
| `health_status` | Statut de santé | `good` |
| `significant_change` | Changement significatif détecté | `true` |

**Exemple de fichier :**

```
date,ndvi,min_ndvi,max_ndvi,cloud_cover,health_status,significant_change
2024-01-01,0.620,0.480,0.760,18,good,false
2024-02-01,0.610,0.470,0.750,22,good,false
2024-03-01,0.580,0.440,0.720,15,fair,true
2024-04-01,0.650,0.510,0.790,8,good,true
2024-05-01,0.720,0.590,0.860,5,excellent,true
```

*In English: The CSV file contains date, mean/min/max NDVI, cloud cover percentage, health status, and a flag for significant changes. Use it in Excel or any spreadsheet software for further analysis.*

---

### Utilisations du fichier CSV / Uses for the CSV File

- **Rapports de gestion** : Intégrez les données dans vos rapports mensuels ou annuels
- **Certification EUDR** : Fournissez des preuves documentées de l'évolution de la végétation
- **Analyse comparative** : Comparez plusieurs parcelles côte à côte dans Excel
- **Archivage** : Conservez un historique long terme des données de santé
- **Partage** : Transmettez les données à votre agronome ou auditeur

*In English: Use the CSV for management reports, EUDR certification evidence, comparative analysis across parcelles, long-term archiving, or sharing with your agronomist or auditor.*

---

## 6. Exemples pratiques

### Exemple 1 : Suivi d'une intervention agronomique

**Situation** : Un agronome a appliqué un traitement fongicide sur une parcelle de 4 hectares à Bafoussam en mars 2024, suite à une détection de pourriture brune.

**Utilisation du curseur temporel :**

| Date | NDVI | Statut | Observation |
|------|------|--------|-------------|
| Janvier 2024 | 0,62 | 🟩 Bon | Situation normale |
| Février 2024 | 0,48 | 🟠 Faible | Début de dégradation |
| Mars 2024 | 0,35 | 🟠 Faible | Traitement appliqué |
| Avril 2024 | 0,42 | 🟠 Faible | Légère amélioration |
| Mai 2024 | 0,55 | 🟡 Moyen | Récupération en cours |
| Juin 2024 | 0,67 | 🟩 Bon | Retour à la normale |

**Comment lire cet exemple :**
- Le curseur temporel montre clairement la dégradation en février (point orange = changement significatif)
- La remontée progressive après le traitement de mars est visible sur le graphique
- En juin, la parcelle est revenue à son niveau de janvier — le traitement a été efficace

**Conclusion** : L'analyse temporelle confirme l'efficacité de l'intervention. Ce graphique peut être inclus dans le rapport de certification.

*In English: The temporal slider clearly shows the February decline (orange dot = significant change) and the progressive recovery after the March treatment. By June, the parcelle returned to its January level — confirming the treatment was effective.*

---

### Exemple 2 : Vérification de conformité EUDR

**Situation** : Un auditeur de certification doit vérifier qu'une parcelle à Bertoua n'a pas subi de déforestation après le 31 décembre 2020.

**Étapes avec le curseur temporel :**

1. **Sélectionnez décembre 2020** sur le curseur → NDVI : 0,71 (🟢 Excellent)
2. **Naviguez jusqu'à la date actuelle** → NDVI : 0,68 (🟩 Bon)
3. **Observez le graphique** : La courbe reste stable entre 0,60 et 0,75 sur toute la période
4. **Vérifiez les points orange** : Aucun changement significatif négatif détecté
5. **Exportez le CSV** pour inclure dans le dossier de certification

**Résultat** : Aucune déforestation détectée. La parcelle est conforme EUDR. Le CSV exporté constitue une preuve documentée.

*In English: To verify EUDR compliance, select December 2020 on the slider (NDVI: 0.71), then navigate to the current date (NDVI: 0.68). The stable chart with no significant negative changes confirms no deforestation occurred. Export the CSV as documented evidence.*

---

### Exemple 3 : Détection précoce d'un problème

**Situation** : Un gestionnaire de coopérative surveille 15 parcelles dans la région du Littoral. Il remarque qu'une parcelle à Nkongsamba affiche une tendance 📉 "En déclin" dans la liste.

**Investigation avec le curseur temporel :**

1. **Ouvrez la parcelle** et accédez à l'analyse temporelle
2. **Observez le graphique** : Le NDVI est passé de 0,70 en janvier à 0,52 en avril (3 mois)
3. **Identifiez les points orange** : Deux changements significatifs en février et mars
4. **Sélectionnez février** sur le curseur → La carte montre des zones jaunes dans le coin nord-est
5. **Sélectionnez mars** → Les zones jaunes se sont étendues

**Conclusion** : La dégradation est localisée dans le coin nord-est et progresse. Une visite de terrain ciblée dans cette zone est recommandée.

*In English: The temporal slider reveals that NDVI dropped from 0.70 in January to 0.52 in April, with two significant changes in February and March. Selecting those dates on the slider shows the degradation starting in the northeast corner and spreading — enabling a targeted field visit.*

---

### Exemple 4 : Analyse saisonnière sur 2 ans

**Situation** : Un agronome veut comprendre le comportement saisonnier d'une parcelle à Kumba pour optimiser le calendrier d'interventions.

**Utilisation du curseur sur 24 mois :**

En sélectionnant un intervalle mensuel sur 2 ans, le graphique révèle un schéma répétitif :

- **Novembre–Janvier** : Baisse régulière du NDVI (saison sèche)
- **Avril–Juin** : Remontée forte (grande saison des pluies)
- **Août–Septembre** : Légère baisse (petite saison sèche)
- **Octobre** : Remontée avant la récolte

**Observation clé** : En 2023, la remontée d'avril n'a pas eu lieu — le NDVI est resté bas jusqu'en juin. Cela correspond à une sécheresse anormale signalée dans la région cette année-là.

**Utilité** : Ce profil saisonnier permet de planifier les interventions (fertilisation, irrigation) aux moments les plus critiques.

*In English: A 2-year monthly analysis reveals the seasonal pattern: NDVI drops in the dry season (Nov–Jan), rises with the rains (Apr–Jun), dips slightly in the small dry season (Aug–Sep), then rises before harvest (Oct). Deviations from this pattern — like the missing April 2023 recovery — signal abnormal events worth investigating.*

---

## 7. Questions fréquentes

### Combien de temps d'historique est disponible ?

CocoaTrack affiche par défaut les **12 derniers mois** de données. Pour les analyses de conformité EUDR, les données remontent jusqu'à **décembre 2020** (date de référence EUDR). Contactez votre gestionnaire de coopérative pour accéder aux données historiques complètes.

*In English: CocoaTrack shows the last 12 months by default. For EUDR compliance, data goes back to December 2020. Contact your cooperative manager for full historical access.*

---

### Pourquoi certaines dates manquent-elles sur le curseur ?

Les dates manquantes correspondent à des périodes où aucune image satellite exploitable n'était disponible — généralement à cause d'une couverture nuageuse trop importante (> 20%). C'est fréquent en grande saison des pluies (avril–juin) au Cameroun.

*In English: Missing dates mean no usable satellite image was available — usually due to cloud cover exceeding 20%. This is common during the heavy rainy season (April–June) in Cameroon.*

---

### Que signifie le pourcentage de couverture nuageuse affiché ?

C'est le pourcentage de la surface de votre parcelle couvert par des nuages sur l'image satellite. Une couverture nuageuse élevée (> 30%) peut affecter la précision du NDVI calculé. CocoaTrack affiche un avertissement "couverture partielle" dans ce cas.

*In English: This is the percentage of your parcelle covered by clouds in the satellite image. High cloud cover (> 30%) can affect NDVI accuracy. CocoaTrack displays a "partial coverage" warning in such cases.*

---

### L'animation est-elle utile pour les présentations ?

Oui. L'animation du curseur temporel est particulièrement efficace pour les présentations aux coopératives ou aux auditeurs. Elle montre visuellement l'évolution de la végétation dans le temps. Utilisez le bouton `▶ Lecture` et ajustez la vitesse si nécessaire.

*In English: Yes. The temporal animation is effective for presentations to cooperatives or auditors, visually showing vegetation evolution over time. Use the Play button and adjust the speed as needed.*

---

### Comment utiliser les données temporelles pour un rapport de certification ?

1. Exportez le CSV de la période concernée (ex. : janvier 2021 à aujourd'hui)
2. Faites une capture d'écran du graphique montrant la stabilité du NDVI
3. Notez les valeurs NDVI à la date de référence EUDR (déc. 2020) et à la date actuelle
4. Incluez ces éléments dans votre rapport de certification CocoaTrack

*In English: Export the CSV for the relevant period, take a screenshot of the stable NDVI chart, note the NDVI values at the EUDR baseline date (Dec 2020) and current date, then include these in your CocoaTrack certification report.*

---

### Puis-je comparer deux parcelles côte à côte ?

La comparaison directe côte à côte n'est pas disponible dans l'interface actuelle. Cependant, vous pouvez :
- Exporter les CSV des deux parcelles et les comparer dans Excel
- Ouvrir deux onglets de navigateur avec les deux parcelles
- Utiliser la vue liste des parcelles qui affiche le statut de santé et la tendance pour toutes les parcelles simultanément

*In English: Direct side-by-side comparison is not available in the current interface. However, you can export CSVs from both parcelles and compare in Excel, or use the parcelle list view which shows health status and trend for all parcelles at once.*

---

### Les données temporelles sont-elles disponibles hors ligne ?

Oui, partiellement. CocoaTrack met en cache les données des parcelles récemment consultées. Si vous avez déjà ouvert l'analyse temporelle d'une parcelle avec une connexion internet, les données seront disponibles hors ligne pendant 30 jours. Un indicateur "données en cache" s'affiche dans ce cas.

*In English: Yes, partially. CocoaTrack caches recently viewed parcelle data. If you've previously opened a parcelle's temporal analysis with an internet connection, the data will be available offline for 30 days. A "cached data" indicator is shown.*

---

## Ressources supplémentaires / Additional Resources

- **Guide NDVI** : [Analyse NDVI — CocoaTrack](./ndvi-analysis.md)
- **Documentation technique** : [API Satellite CocoaTrack](../api/satellite.md)
- **Analyse temporelle (technique)** : [Temporal Analysis Documentation](../satellite/temporal-analysis.md)
- **Configuration GEE** : [Google Earth Engine Setup](../deployment/vercel-gee-setup.md)
- **Détection de déforestation** : [Deforestation Detection](../satellite/deforestation-detection.md)

---

*Document créé pour la plateforme CocoaTrack — Traçabilité du cacao au Cameroun*  
*Document created for the CocoaTrack platform — Cocoa traceability in Cameroon*
