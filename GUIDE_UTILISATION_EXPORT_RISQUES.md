# Guide d'Utilisation : Export des Parcelles à Risque

## 🚀 Démarrage Rapide (3 étapes)

### Étape 1 : Accéder à la page Parcelles
```
Menu → Parcelles
```

### Étape 2 : Localiser la section "Export par Catégorie de Risque"
Descendre légèrement la page, section avec fond bleu clair

### Étape 3 : Choisir votre export
- **Bouton Rouge** : Parcelles à risque
- **Bouton Vert** : Bonnes parcelles
- **Bouton Gris** : Filtres personnalisés

---

## 📖 Mode d'Emploi Détaillé

### Export 1 : Parcelles à Risque (Le plus utilisé ⭐)

#### Quand l'utiliser ?
- Planification des visites terrain hebdomadaires
- Identification des urgences
- Suivi des parcelles problématiques

#### Comment faire ?
1. Cliquer sur **"Exporter Parcelles à Risque"** (bouton rouge)
2. Attendre 3-10 secondes (selon nombre de parcelles)
3. Le fichier CSV se télécharge automatiquement
4. Ouvrir avec Excel/LibreOffice

#### Que contient l'export ?
Toutes les parcelles classées **"À Risque Élevé"** avec :
- Informations parcelle et planteur
- Statut de santé actuel
- Alertes de déforestation
- Recommandations d'action

#### Exemple de ligne exportée :
```
P001 | Parcelle Nord | Ebilassokro | Aboisso | 2.50 ha | Jean Kouassi | 
À Risque Élevé | NDVI: 0.35 (Faible) | En déclin | 1 alerte déforestation |
"Visite terrain urgente requise; Vérifier conformité EUDR"
```

---

### Export 2 : Bonnes Parcelles

#### Quand l'utiliser ?
- Rapport mensuel de performance
- Identification des bonnes pratiques
- Reconnaissance des meilleurs planteurs

#### Comment faire ?
1. Cliquer sur **"Exporter Bonnes Parcelles"** (bouton vert)
2. Attendre le téléchargement
3. Ouvrir le fichier CSV

#### Que contient l'export ?
Parcelles classées **"Excellente Santé"** ou **"Santé Correcte"** avec :
- Parcelles performantes (NDVI > 0.55)
- Tendances positives ou stables
- Aucune alerte de déforestation

#### Utilisation suggérée :
1. Ouvrir dans Excel
2. Trier par "NDVI Actuel" (descendant)
3. Identifier les 10 meilleures parcelles
4. Contacter les planteurs pour partage d'expérience

---

### Export 3 : Filtres Avancés (Pour utilisateurs experts)

#### Quand l'utiliser ?
- Analyse spécifique par région
- Filtrage par surface
- Recherche multicritères
- Export pour analyse externe (JSON)

#### Comment faire ?

**Étape 1 : Ouvrir le modal**
1. Cliquer sur **"Filtres Avancés"** (bouton gris)
2. Un formulaire s'affiche

**Étape 2 : Configurer les filtres**

##### Catégories de Risque (Cocher plusieurs si besoin)
- [ ] À Risque Élevé
- [ ] À Surveiller
- [ ] Santé Correcte
- [ ] Excellente Santé
- [ ] Non Évalué

##### Région (Liste déroulante)
```
Toutes les régions ▼
  Aboisso
  Adiaké
  Ayamé
  ...
```

##### Surface (Hectares)
```
Min: [____] ha   Max: [____] ha
```

##### Déforestation
```
Toutes ▼
  Avec alertes
  Sans alertes
```

##### Format d'Export
```
○ CSV (recommandé pour Excel)
○ JSON (pour analyse programmatique)
```

**Étape 3 : Exporter**
1. Cliquer sur **"Exporter"** (bouton bleu)
2. Le fichier se télécharge selon vos critères

---

## 💡 Exemples de Cas d'Usage

### Cas 1 : Visite Terrain Hebdomadaire

**Objectif :** Préparer la tournée de la semaine

**Actions :**
1. Exporter parcelles à risque (bouton rouge)
2. Ouvrir dans Excel
3. Trier par "Région" puis "Village"
4. Regrouper par zone géographique
5. Créer un itinéraire optimisé

**Résultat :** Liste de visite prête avec adresses et recommandations

---

### Cas 2 : Urgence Déforestation

**Objectif :** Identifier toutes les parcelles avec déforestation

**Actions :**
1. Cliquer "Filtres Avancés"
2. Cocher toutes les catégories
3. Sélectionner "Déforestation : Avec alertes"
4. Exporter

**Résultat :** Liste complète pour conformité EUDR

---

### Cas 3 : Rapport Mensuel Management

**Objectif :** Présenter les performances de la région Aboisso

**Actions :**
1. Cliquer "Filtres Avancés"
2. Sélectionner "Région : Aboisso"
3. Cocher toutes les catégories
4. Exporter

**Résultat :** Vue complète de toutes les parcelles d'Aboisso avec statistiques

---

### Cas 4 : Focus Petites Parcelles

**Objectif :** Analyser les parcelles < 1 hectare

**Actions :**
1. Cliquer "Filtres Avancés"
2. Surface Max : 1
3. Cocher "À Risque Élevé" + "À Surveiller"
4. Exporter

**Résultat :** Petites parcelles à problème pour programme d'accompagnement

---

### Cas 5 : Bonnes Pratiques à Partager

**Objectif :** Identifier planteurs modèles pour formation

**Actions :**
1. Exporter bonnes parcelles (bouton vert)
2. Ouvrir dans Excel
3. Trier par "NDVI Actuel" (descendant)
4. Sélectionner top 20
5. Extraire noms des planteurs

**Résultat :** Liste d'experts à inviter pour session de formation

---

## 📊 Comprendre les Données Exportées

### Colonnes Principales (21 au total)

#### 🏷️ Identification
| Colonne | Exemple | Signification |
|---------|---------|---------------|
| Code Parcelle | P001 | Identifiant unique |
| Libellé | Parcelle Nord | Nom de la parcelle |
| Village | Ebilassokro | Localisation |
| Région | Aboisso | Zone administrative |
| Surface (ha) | 2.50 | Taille en hectares |

#### 👤 Planteur
| Colonne | Exemple | Signification |
|---------|---------|---------------|
| Code Planteur | PL001 | Identifiant planteur |
| Nom Planteur | Jean Kouassi | Propriétaire |

#### 🔍 Évaluation Risque
| Colonne | Exemple | Signification |
|---------|---------|---------------|
| Catégorie de Risque | À Risque Élevé | Classification automatique |
| Statut Santé Actuel | Faible | État actuel (Excellent/Bon/Moyen/Faible/Critique) |
| NDVI Actuel | 0.350 | Indice de végétation (0-1) |
| Tendance | En déclin | Évolution (Amélioration/Stable/Déclin) |
| Taux de Changement | -0.0025 | Vitesse d'évolution quotidienne |

#### 🚨 Alertes
| Colonne | Exemple | Signification |
|---------|---------|---------------|
| Alertes Déforestation | 1 | Nombre d'alertes actives |
| Changements Significatifs | 2 | Variations importantes détectées |

#### 📈 Statistiques (90 derniers jours)
| Colonne | Exemple | Signification |
|---------|---------|---------------|
| Dernière Analyse | 30/06/2026 | Date du dernier calcul |
| Points Temporels | 12 | Nombre de mesures disponibles |
| NDVI Moyen | 0.420 | Moyenne sur la période |
| NDVI Min | 0.350 | Valeur minimale observée |
| NDVI Max | 0.580 | Valeur maximale observée |

#### 💡 Contexte et Actions
| Colonne | Exemple | Signification |
|---------|---------|---------------|
| Facteurs de Risque | Santé faible; Tendance en déclin | Liste des problèmes identifiés |
| Recommandations | Visite terrain urgente requise | Actions suggérées |

---

## 🎯 Interpréter les Résultats

### Code Couleur Mental (pour tri rapide)

#### NDVI (Indice de Santé)
```
0.65 - 1.0   🟢🟢🟢  Excellent  → Continuer
0.55 - 0.65  🟢🟢    Bon        → Maintenir
0.45 - 0.55  🟡      Moyen      → Surveiller
0.30 - 0.45  🟠      Faible     → Agir sous 2 semaines
0.0  - 0.30  🔴      Critique   → Urgence immédiate
```

#### Tendance
```
En amélioration  ↗️  → Bonnes pratiques, continuer
Stable           ➡️  → Situation maîtrisée
En déclin        ↘️  → Intervention nécessaire
```

#### Alertes Déforestation
```
0 alertes   ✅  → Conforme EUDR
1+ alertes  ⚠️  → Vérification terrain requise
```

---

## 🔧 Astuces Excel

### Après avoir ouvert le CSV :

#### 1. Tri Multi-Niveaux
```
1. Sélectionner toutes les données
2. Données → Trier
3. Niveau 1 : Catégorie de Risque (A→Z)
4. Niveau 2 : Alertes Déforestation (descendant)
5. Niveau 3 : NDVI Actuel (ascendant)
```
**Résultat :** Parcelles les plus urgentes en haut

#### 2. Filtres Automatiques
```
1. Sélectionner ligne de headers
2. Données → Filtrer
3. Cliquer sur ▼ dans "Région"
4. Cocher seulement "Aboisso"
```
**Résultat :** Vue filtrée par région

#### 3. Mise en Forme Conditionnelle
```
1. Sélectionner colonne "NDVI Actuel"
2. Accueil → Mise en forme conditionnelle
3. Échelle de couleurs → Rouge-Jaune-Vert
```
**Résultat :** Visualisation couleur de la santé

#### 4. Tableau Croisé Dynamique
```
1. Sélectionner toutes les données
2. Insertion → Tableau croisé dynamique
3. Lignes : Région
4. Valeurs : Nombre de Code Parcelle
5. Colonnes : Catégorie de Risque
```
**Résultat :** Statistiques par région et catégorie

---

## ❓ FAQ (Questions Fréquentes)

### Q1 : Combien de temps prend un export ?
**R :** 3-5 secondes pour 100 parcelles, 10-15 secondes pour 500 parcelles

### Q2 : Peut-on exporter plusieurs régions en même temps ?
**R :** Pas directement avec les boutons rapides, mais possible via "Filtres Avancés" (ne pas sélectionner de région = toutes les régions)

### Q3 : Les données sont-elles en temps réel ?
**R :** Les données reflètent le dernier calcul NDVI effectué (voir colonne "Dernière Analyse")

### Q4 : Pourquoi certaines parcelles sont "Non Évalué" ?
**R :** Données NDVI insuffisantes (calcul jamais effectué ou échoué)

### Q5 : Peut-on modifier le fichier CSV et le réimporter ?
**R :** Le CSV est en lecture seule pour export. Les modifications doivent être faites dans le système.

### Q6 : Comment partager l'export avec mon équipe ?
**R :** 
- Email : Joindre le fichier CSV
- Drive : Uploader sur Google Drive/Dropbox
- Impression : Possible depuis Excel (paysage recommandé)

### Q7 : Y a-t-il une limite de parcelles exportables ?
**R :** Limite technique à 10,000 parcelles par export (largement suffisant)

### Q8 : Peut-on programmer des exports automatiques ?
**R :** Pas encore implémenté. Pour l'instant, export manuel uniquement.

### Q9 : Les recommandations sont-elles personnalisées ?
**R :** Oui, générées automatiquement selon la situation spécifique de chaque parcelle

### Q10 : Format JSON, c'est quoi ?
**R :** Format pour développeurs/systèmes externes. Utiliser CSV pour Excel.

---

## ⚠️ Points d'Attention

### ❌ À NE PAS FAIRE
- Ne pas ouvrir le CSV avec Notepad/Bloc-notes (illisible)
- Ne pas modifier les codes parcelle dans l'export
- Ne pas considérer l'export comme une sauvegarde système

### ✅ BONNES PRATIQUES
- Nommer vos exports avec la date (ex: risques_2026-06-30.csv)
- Archiver les exports pour historique mensuel
- Croiser avec observations terrain
- Partager les conclusions avec l'équipe

---

## 📅 Calendrier d'Utilisation Suggéré

### Hebdomadaire
- **Lundi matin** : Export parcelles à risque
- **Lundi après-midi** : Planification tournée de la semaine
- **Vendredi** : Mise à jour post-visites

### Mensuel
- **1ère semaine** : Export bonnes parcelles
- **2ème semaine** : Analyse bonnes pratiques
- **3ème semaine** : Export complet par région (filtres avancés)
- **4ème semaine** : Rapport management

### Trimestriel
- Export historique pour analyse évolution
- Identification tendances long terme
- Rapports partenaires/financeurs

---

## 📞 Besoin d'Aide ?

### Documentation Complète
- **Technique** : `RISK_EXPORT_IMPLEMENTATION.md`
- **API** : `docs/api/risk-export.md`
- **Résumé exécutif** : `RESUME_EXPORT_RISQUES_PARCELLES.md`

### Support Technique
- **Email** : support@cocoatrack.com
- **Téléphone** : +225 XX XX XX XX XX
- **Documentation en ligne** : app.cocoatrack.com/docs

---

## ✨ Raccourcis Clavier (Navigateur)

```
Ctrl + F     : Rechercher dans la page
Ctrl + S     : Sauvegarder la page (garder URL de l'export)
Ctrl + R     : Rafraîchir (mettre à jour les données)
F11          : Plein écran (pour focus)
```

---

## 🎓 Formation Recommandée

### Session 1 : Bases (30 min)
- Accès à la fonctionnalité
- Export simple (boutons rouge et vert)
- Ouverture dans Excel

### Session 2 : Avancé (45 min)
- Filtres avancés
- Interprétation des données
- Astuces Excel

### Session 3 : Maîtrise (60 min)
- Création de tableaux de bord Excel
- Analyse de tendances
- Rapports automatisés

---

**🎉 Félicitations ! Vous êtes prêt à utiliser l'export des parcelles à risque !**

---

**Version :** 1.0.0  
**Date :** 30 juin 2026  
**Auteur :** CocoaTrack Support Team

💚 **Bonne utilisation et excellents résultats terrain !**
