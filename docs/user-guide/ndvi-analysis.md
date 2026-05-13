# Guide d'Analyse NDVI — CocoaTrack
# NDVI Analysis User Guide — CocoaTrack

> **Public cible / Target audience**: Gestionnaires de coopératives, Planteurs, Agronomes  
> **Langue principale / Primary language**: Français  
> **Plateforme / Platform**: CocoaTrack — Suivi de la traçabilité du cacao au Cameroun

---

## Table des matières / Table of Contents

1. [Qu'est-ce que le NDVI ?](#1-quest-ce-que-le-ndvi)
2. [Les 5 indicateurs de santé des parcelles](#2-les-5-indicateurs-de-santé-des-parcelles)
3. [Comment lire la carte colorée NDVI](#3-comment-lire-la-carte-colorée-ndvi)
4. [Actions recommandées selon le statut de santé](#4-actions-recommandées-selon-le-statut-de-santé)
5. [Utiliser le curseur temporel pour suivre l'évolution](#5-utiliser-le-curseur-temporel-pour-suivre-lévolution)
6. [Exemples pratiques — Cacaoculture au Cameroun](#6-exemples-pratiques--cacaoculture-au-cameroun)
7. [Questions fréquentes](#7-questions-fréquentes)

---

## 1. Qu'est-ce que le NDVI ?

### En termes simples

Le **NDVI** (Indice de Végétation par Différence Normalisée) est une mesure de la **santé et de la vigueur de la végétation** d'une parcelle, calculée à partir d'images satellites.

Imaginez que le satellite prend une photo de votre plantation depuis l'espace. Cette photo capture non seulement les couleurs visibles, mais aussi des informations invisibles à l'œil nu — notamment la quantité de lumière que les feuilles absorbent pour la photosynthèse. Plus les feuilles sont vertes et saines, plus elles absorbent cette lumière. Le NDVI transforme cette information en un chiffre simple entre **-1 et +1** :

- **Proche de 1** → Végétation dense et très saine (feuilles vertes, actives)
- **Proche de 0** → Sol nu, végétation très clairsemée ou stressée
- **Négatif** → Eau, sol nu, zones sans végétation

Pour les cacaoyers au Cameroun, une plantation en bonne santé affiche généralement un NDVI entre **0,5 et 0,8**.

---

### En anglais / In English

**What is NDVI?**

The **NDVI** (Normalized Difference Vegetation Index) is a measure of the **health and vigor of vegetation** on a plot, calculated from satellite images.

Think of it as a satellite "health check" for your cocoa farm. The satellite captures how much light the leaves absorb for photosynthesis — healthy green leaves absorb more. NDVI converts this into a simple number between **-1 and +1**:

- **Close to 1** → Dense, very healthy vegetation
- **Close to 0** → Bare soil, very sparse or stressed vegetation
- **Negative** → Water, bare soil, non-vegetated areas

For cocoa trees in Cameroon, a healthy plantation typically shows NDVI between **0.5 and 0.8**.

---

## 2. Les 5 indicateurs de santé des parcelles

CocoaTrack classe automatiquement chaque parcelle dans l'une des 5 catégories de santé, basées sur la valeur NDVI moyenne de la parcelle.

### Tableau des statuts de santé / Health Status Table

| Statut | Status | Plage NDVI | Couleur du badge | Signification pour le cacao |
|--------|--------|-----------|-----------------|------------------------------|
| 🟢 **Excellent** | Excellent | 0,7 – 1,0 | Vert foncé `#2d5016` | Végétation très dense et saine. Les cacaoyers sont en pleine vigueur, feuillage abondant, bonne photosynthèse. |
| 🟩 **Bon** | Good | 0,6 – 0,7 | Vert `#6FAF3D` | Végétation saine avec une bonne couverture. Les cacaoyers se portent bien, production normale attendue. |
| 🟡 **Moyen** | Fair | 0,5 – 0,6 | Jaune `#fbbf24` | Végétation modérée. Les cacaoyers montrent des signes de légère faiblesse — surveillance recommandée. |
| 🟠 **Faible** | Poor | 0,3 – 0,5 | Orange `#E68A1F` | Végétation clairsemée ou stressée. Intervention recommandée pour éviter une dégradation. |
| 🔴 **Critique** | Critical | 0,0 – 0,3 | Rouge `#ef4444` | Végétation très faible ou absente. Action immédiate nécessaire — risque de perte de récolte. |

> **Note** : Les valeurs NDVI inférieures à 0 (eau, sol nu) apparaissent en brun sur la carte et ne sont pas classées dans les catégories de santé.

---

### Détail de chaque statut / Detailed Status Descriptions

#### 🟢 Excellent (NDVI 0,7 – 1,0)

**Ce que cela signifie** : Votre plantation est en excellente santé. Le feuillage est dense, les arbres sont actifs et la photosynthèse est maximale. C'est le signe d'une bonne gestion agronomique.

**Pour le cacao** : Attendez-vous à une bonne production. Les cabosses se développent dans de bonnes conditions. Continuez vos pratiques actuelles.

*In English: Your plantation is in excellent health. Dense foliage, active trees, maximum photosynthesis. Expect good yields. Continue current practices.*

---

#### 🟩 Bon (NDVI 0,6 – 0,7)

**Ce que cela signifie** : La plantation est en bonne santé avec une couverture végétale satisfaisante. Quelques zones peuvent être légèrement moins denses, mais l'ensemble est positif.

**Pour le cacao** : Production normale attendue. Une surveillance régulière est suffisante.

*In English: Plantation is in good health with satisfactory vegetation cover. Normal production expected. Regular monitoring is sufficient.*

---

#### 🟡 Moyen (NDVI 0,5 – 0,6)

**Ce que cela signifie** : La végétation est modérée. Les cacaoyers peuvent être sous stress léger — manque d'eau, déficit nutritionnel, ou début d'infestation. Une attention particulière est recommandée.

**Pour le cacao** : La production peut être légèrement réduite. Une visite de terrain est conseillée pour identifier la cause.

*In English: Moderate vegetation. Cocoa trees may be under mild stress — water deficit, nutrient deficiency, or early infestation. A field visit is recommended.*

---

#### 🟠 Faible (NDVI 0,3 – 0,5)

**Ce que cela signifie** : La végétation est clairsemée ou stressée. Les cacaoyers souffrent probablement d'un problème identifiable : sécheresse, maladie, mauvaises herbes envahissantes, ou sol appauvri.

**Pour le cacao** : Risque de réduction significative de la production. Une intervention agronomique est recommandée rapidement.

*In English: Sparse or stressed vegetation. Cocoa trees are likely suffering from drought, disease, invasive weeds, or depleted soil. Agronomic intervention is recommended.*

---

#### 🔴 Critique (NDVI 0,0 – 0,3)

**Ce que cela signifie** : La végétation est très faible ou quasi absente. Cela peut indiquer une déforestation, une maladie grave, une sécheresse sévère, ou un abandon de la parcelle.

**Pour le cacao** : Risque élevé de perte totale de récolte. Action immédiate requise. Contactez votre agronome ou votre coopérative.

*In English: Very sparse or absent vegetation. May indicate deforestation, severe disease, drought, or plot abandonment. Immediate action required.*

---

## 3. Comment lire la carte colorée NDVI

### La légende des couleurs / Color Map Legend

La carte NDVI affiche chaque parcelle avec un dégradé de couleurs allant du brun au vert foncé. Voici comment interpréter chaque couleur :

| Couleur | Code hex | Plage NDVI | Interprétation |
|---------|----------|-----------|----------------|
| 🟫 Brun | `#a52a2a` | < 0,0 | Eau, sol nu, zones sans végétation |
| 🟧 Orange | `#e66100` | 0,0 – 0,2 | Végétation très faible (Très Faible) |
| 🟨 Jaune | `#ffc107` | 0,2 – 0,4 | Végétation faible (Faible) |
| 🟩 Vert clair | `#92d050` | 0,4 – 0,6 | Végétation modérée (Modéré) |
| 🟢 Vert | `#38a800` | 0,6 – 0,8 | Bonne végétation (Bon) |
| 🌲 Vert foncé | `#228b22` | 0,8 – 1,0 | Excellente végétation (Excellent) |

### Comment lire la carte / How to Read the Map

1. **Ouvrez la vue satellite** de votre parcelle dans CocoaTrack
2. **Activez la couche NDVI** en cliquant sur le bouton "Analyse NDVI"
3. **Observez les couleurs** sur votre parcelle :
   - Une parcelle entièrement verte foncée = plantation très saine
   - Des zones jaunes ou oranges = zones à surveiller ou à traiter
   - Des zones brunes = sol nu, chemins, ou zones sans végétation (normal)
4. **Consultez le badge de statut** en haut de la fiche parcelle pour un résumé rapide

### Zones normalement brunes / Normally Brown Areas

Il est normal de voir des zones brunes sur votre parcelle. Cela peut représenter :
- Les chemins et allées entre les arbres
- Les zones récemment défrichées pour replantation
- Les cours d'eau ou zones humides
- Les bâtiments ou infrastructures

*In English: Brown areas on your plot are normal — they represent paths, recently cleared areas for replanting, waterways, or buildings.*

---

## 4. Actions recommandées selon le statut de santé

### Guide d'intervention / Intervention Guide

| Statut | Actions recommandées |
|--------|---------------------|
| 🟢 **Excellent** | ✅ Continuer les pratiques actuelles. Documenter les bonnes pratiques pour les partager. |
| 🟩 **Bon** | ✅ Surveillance mensuelle. Maintenir l'entretien régulier (taille, désherbage). |
| 🟡 **Moyen** | ⚠️ Visite de terrain dans les 2 semaines. Vérifier l'irrigation, la fertilisation, et les signes de maladie. |
| 🟠 **Faible** | 🚨 Intervention recommandée sous 1 semaine. Contacter l'agronome. Envisager l'irrigation, le traitement phytosanitaire, ou la fertilisation. |
| 🔴 **Critique** | 🆘 Action immédiate. Contacter la coopérative et l'agronome. Évaluer les causes (maladie, sécheresse, déforestation). |

---

### Actions détaillées par statut / Detailed Actions by Status

#### Statut Moyen (Fair) — Que faire ?

- **Vérifier l'irrigation** : En saison sèche (novembre–mars), un manque d'eau est souvent la cause principale
- **Inspecter le feuillage** : Chercher des signes de maladies (pourriture brune, mirides)
- **Contrôler les mauvaises herbes** : Une végétation concurrente peut réduire le NDVI
- **Vérifier la fertilisation** : Un déficit en azote ou potassium peut affaiblir les arbres

#### Statut Faible (Poor) — Que faire ?

- **Envisager l'irrigation** si la saison sèche est en cours
- **Traitement phytosanitaire** si des maladies ou ravageurs sont détectés
- **Fertilisation d'urgence** avec un engrais adapté au cacao
- **Taille sanitaire** pour éliminer les branches malades
- **Contacter votre agronome** pour un diagnostic de terrain

#### Statut Critique (Critical) — Que faire ?

- **Visite immédiate** de la parcelle pour évaluer la situation
- **Signaler à la coopérative** pour obtenir un soutien technique
- **Documenter les dommages** avec des photos pour le rapport de certification
- **Évaluer la replantation** si les arbres sont irrémédiablement perdus
- **Vérifier les alertes de déforestation** dans CocoaTrack

---

### En anglais / In English — Recommended Actions

| Status | Recommended Actions |
|--------|---------------------|
| 🟢 **Excellent** | ✅ Continue current practices. Document good practices to share. |
| 🟩 **Good** | ✅ Monthly monitoring. Maintain regular upkeep (pruning, weeding). |
| 🟡 **Fair** | ⚠️ Field visit within 2 weeks. Check irrigation, fertilization, and disease signs. |
| 🟠 **Poor** | 🚨 Intervention recommended within 1 week. Contact agronomist. Consider irrigation, phytosanitary treatment, or fertilization. |
| 🔴 **Critical** | 🆘 Immediate action. Contact cooperative and agronomist. Assess causes (disease, drought, deforestation). |

---

## 5. Utiliser le curseur temporel pour suivre l'évolution

### Qu'est-ce que le curseur temporel ? / What is the Temporal Slider?

Le **curseur temporel** vous permet de voyager dans le temps pour voir comment votre parcelle a évolué au cours des 12 derniers mois. C'est un outil puissant pour :

- Détecter une dégradation progressive avant qu'elle ne devienne critique
- Identifier la période exacte où un problème a commencé
- Vérifier l'efficacité d'une intervention agronomique
- Préparer les rapports de certification EUDR

### Comment utiliser le curseur / How to Use the Slider

1. **Ouvrez la fiche de votre parcelle** dans CocoaTrack
2. **Cliquez sur "Analyse temporelle"** pour afficher le curseur
3. **Faites glisser le curseur** vers la gauche (passé) ou la droite (présent)
4. **Observez les changements** de couleur sur la carte et la valeur NDVI affichée
5. **Comparez deux dates** en utilisant le mode comparaison (deux curseurs)

### Interpréter les tendances / Interpreting Trends

CocoaTrack calcule automatiquement la **tendance** de votre parcelle sur les 3 derniers mois :

| Tendance | Signification |
|----------|---------------|
| 📈 **En amélioration** | Le NDVI augmente — la plantation se porte de mieux en mieux |
| ➡️ **Stable** | Le NDVI reste constant — situation stable |
| 📉 **En déclin** | Le NDVI diminue — surveillance accrue recommandée |

### Dates importantes à surveiller / Important Dates to Monitor

Pour les cacaoyers au Cameroun, surveillez particulièrement :

- **Novembre – Mars** (saison sèche) : Le NDVI peut naturellement baisser. Un NDVI inférieur à 0,4 en saison sèche est préoccupant.
- **Avril – Juin** (grande saison des pluies) : Le NDVI devrait remonter. Si ce n'est pas le cas, une intervention est nécessaire.
- **Juillet – Septembre** (petite saison sèche) : Légère baisse normale.
- **Octobre** (petite saison des pluies) : Remontée attendue avant la récolte principale.

*In English: Monitor the temporal slider especially during the dry season (Nov–Mar) when NDVI naturally dips. If NDVI stays below 0.4 during the rainy season (Apr–Jun), intervention is needed.*

### Alertes de changement significatif / Significant Change Alerts

CocoaTrack met en évidence automatiquement les dates où un **changement significatif** a été détecté (variation NDVI > 0,15). Ces dates apparaissent en surbrillance sur le curseur temporel. Cliquez dessus pour voir l'image satellite correspondante.

---

## 6. Exemples pratiques — Cacaoculture au Cameroun

### Exemple 1 : Plantation saine dans la région du Centre

**Situation** : Une parcelle de 3 hectares à Mbalmayo, région Centre.

**Résultats NDVI** :
- NDVI moyen : **0,72**
- Statut : 🟢 **Excellent**
- Tendance : 📈 En amélioration

**Interprétation** : La plantation est en excellente santé. Le NDVI de 0,72 indique une végétation dense et active. La tendance à la hausse suggère que les récentes pluies ont bien profité aux arbres. Aucune action corrective n'est nécessaire.

---

### Exemple 2 : Stress hydrique en saison sèche — Région du Sud-Ouest

**Situation** : Une parcelle de 5 hectares à Kumba, région Sud-Ouest, en janvier.

**Résultats NDVI** :
- NDVI moyen : **0,42**
- Statut : 🟠 **Faible**
- Tendance : 📉 En déclin depuis novembre

**Interprétation** : La baisse du NDVI depuis novembre coïncide avec le début de la saison sèche. Les zones orange sur la carte correspondent aux parties de la parcelle les plus exposées au soleil et les moins bien irriguées.

**Actions recommandées** :
1. Vérifier les systèmes d'irrigation ou envisager un arrosage d'appoint
2. Appliquer un paillage (mulching) pour conserver l'humidité du sol
3. Surveiller les signes de stress hydrique sur les feuilles (jaunissement, chute prématurée)
4. Réévaluer le NDVI dans 3 semaines après intervention

---

### Exemple 3 : Détection précoce d'une maladie — Région du Littoral

**Situation** : Une parcelle de 2 hectares à Nkongsamba, région du Littoral.

**Résultats NDVI** :
- NDVI moyen : **0,38** (était 0,65 il y a 2 mois)
- Statut : 🟠 **Faible** (était 🟩 **Bon**)
- Tendance : 📉 Déclin rapide

**Interprétation** : Une chute de 0,27 points en 2 mois est un signal d'alarme. Le curseur temporel montre que la dégradation a commencé en septembre. Les zones rouges sur la carte sont concentrées dans un coin de la parcelle, ce qui suggère une origine localisée (maladie, ravageur, ou problème de sol).

**Actions recommandées** :
1. Visite immédiate de la parcelle, en commençant par les zones rouges
2. Inspecter les cabosses et les feuilles pour détecter la pourriture brune (*Phytophthora*) ou les mirides
3. Contacter l'agronome de la coopérative pour un diagnostic
4. Isoler les arbres malades si une maladie contagieuse est confirmée

---

### Exemple 4 : Suivi post-intervention — Région de l'Ouest

**Situation** : Une parcelle à Bafoussam, région de l'Ouest, après traitement phytosanitaire en mars.

**Évolution NDVI** :
| Date | NDVI | Statut |
|------|------|--------|
| Janvier | 0,28 | 🔴 Critique |
| Février | 0,31 | 🔴 Critique |
| Mars | 0,35 (traitement) | 🟠 Faible |
| Avril | 0,48 | 🟠 Faible |
| Mai | 0,58 | 🟡 Moyen |
| Juin | 0,67 | 🟩 Bon |

**Interprétation** : Le curseur temporel montre clairement l'efficacité du traitement. Après 3 mois, la parcelle est passée de Critique à Bon. Cette progression valide l'intervention et permet de documenter la récupération pour les rapports de certification.

---

### Exemple 5 : Alerte de déforestation — Région de l'Est

**Situation** : Une parcelle à Bertoua, région de l'Est.

**Résultats** :
- NDVI moyen : **0,15** (était 0,68 il y a 6 mois)
- Statut : 🔴 **Critique**
- Alerte : ⚠️ **Événement de déforestation détecté**

**Interprétation** : Une chute aussi brutale du NDVI (de 0,68 à 0,15) sur une grande surface indique une perte de couverture végétale significative. CocoaTrack a automatiquement généré une alerte de déforestation. Cette situation peut avoir des implications pour la conformité EUDR.

**Actions recommandées** :
1. Vérifier immédiatement la parcelle sur le terrain
2. Documenter la situation avec des photos géolocalisées
3. Contacter la coopérative et le responsable de certification
4. Si la déforestation est confirmée, préparer un rapport explicatif pour les auditeurs

---

## 7. Questions fréquentes

### Pourquoi mon NDVI est-il bas en saison sèche ?

C'est normal. En saison sèche (novembre–mars), les cacaoyers réduisent leur activité photosynthétique. Un NDVI entre 0,4 et 0,6 en saison sèche peut être acceptable. Comparez toujours avec la même période de l'année précédente via le curseur temporel.

*In English: This is normal. During the dry season (Nov–Mar), cocoa trees reduce photosynthetic activity. Compare with the same period from the previous year using the temporal slider.*

---

### Pourquoi y a-t-il des zones brunes sur ma parcelle ?

Les zones brunes (NDVI < 0) représentent des surfaces sans végétation : chemins, bâtiments, cours d'eau, ou zones récemment défrichées. Ce n'est pas nécessairement un problème si ces zones sont limitées.

*In English: Brown areas (NDVI < 0) represent non-vegetated surfaces: paths, buildings, waterways, or recently cleared areas. This is not necessarily a problem if these areas are limited.*

---

### À quelle fréquence les données NDVI sont-elles mises à jour ?

Les satellites Sentinel-2 passent au-dessus du Cameroun tous les **5 jours**. Cependant, la couverture nuageuse fréquente en zone tropicale peut réduire la disponibilité d'images exploitables. CocoaTrack utilise les images les plus récentes avec moins de 20% de nuages.

*In English: Sentinel-2 satellites pass over Cameroon every 5 days. However, frequent cloud cover in tropical zones can reduce the availability of usable images. CocoaTrack uses the most recent images with less than 20% cloud cover.*

---

### Que faire si aucune image satellite n'est disponible ?

Si aucune image récente n'est disponible (souvent en grande saison des pluies), CocoaTrack affiche les dernières données en cache avec la date correspondante. Un message d'avertissement indique que les données peuvent ne pas être à jour.

*In English: If no recent image is available (often during the heavy rainy season), CocoaTrack displays the last cached data with the corresponding date. A warning message indicates the data may not be current.*

---

### Comment exporter mes données NDVI ?

Vous pouvez exporter vos données NDVI en format CSV depuis la page d'analyse temporelle. Ce fichier contient les dates, les valeurs NDVI moyennes, et les indicateurs de changement. Vous pouvez également exporter en format KML pour visualiser dans Google Earth.

*In English: You can export your NDVI data in CSV format from the temporal analysis page. This file contains dates, mean NDVI values, and change indicators. You can also export in KML format for visualization in Google Earth.*

---

### Le NDVI peut-il détecter toutes les maladies du cacao ?

Le NDVI détecte le **stress végétatif** en général, mais ne peut pas identifier la cause spécifique. Une baisse du NDVI peut être due à une maladie, un manque d'eau, un déficit nutritionnel, ou d'autres facteurs. Une visite de terrain reste indispensable pour un diagnostic précis.

*In English: NDVI detects general vegetation stress but cannot identify the specific cause. A drop in NDVI may be due to disease, water deficit, nutritional deficiency, or other factors. A field visit remains essential for an accurate diagnosis.*

---

## Ressources supplémentaires / Additional Resources

- **Documentation technique** : [API Satellite CocoaTrack](../api/satellite.md)
- **Guide de déploiement** : [Configuration Google Earth Engine](../deployment/vercel-gee-setup.md)
- **Support** : Contactez votre gestionnaire de coopérative ou l'équipe CocoaTrack

---

*Document créé pour la plateforme CocoaTrack — Traçabilité du cacao au Cameroun*  
*Document created for the CocoaTrack platform — Cocoa traceability in Cameroon*
