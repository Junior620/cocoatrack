# Dossier Captures d'Écran - Mémoire CocoaTrack

## 📁 Organisation

Ce dossier contient toutes les captures d'écran utilisées dans le mémoire académique.

### Structure Recommandée

```
captures/
├── analyse_predictive/
│   ├── figure_3_X_1_interface_demande.png
│   ├── figure_3_X_2_resultat_complet.png
│   ├── figure_3_X_3_graphique_ndvi.png
│   └── figure_3_X_4_comparaison_niveaux.png
│
├── cartographie/
│   ├── carte_parcelles_overview.png
│   ├── import_shapefile.png
│   └── ndvi_overlay.png
│
├── livraisons/
│   ├── detail_livraison.png
│   └── liste_livraisons.png
│
└── dashboard/
    ├── dashboard_principal.png
    └── statistiques_kpi.png
```

---

## 📸 Captures Prioritaires (à faire en premier)

### Section Analyse Prédictive

| Figure | Nom Fichier | Dimensions | Statut |
|--------|-------------|------------|--------|
| 3.X.1 | `figure_3_X_1_interface_demande.png` | 600×400 | ⬜ À faire |
| 3.X.2 | `figure_3_X_2_resultat_complet.png` | 700×800 | ⬜ À faire |
| 3.X.3 | `figure_3_X_3_graphique_ndvi.png` | 900×400 | ⬜ À faire |
| 3.X.4 | `figure_3_X_4_comparaison_niveaux.png` | 1400×600 | ⬜ À faire |

---

## ✅ Checklist Qualité

Pour chaque capture :

- [ ] Format : PNG (pas JPG)
- [ ] Résolution : Minimum 1200px largeur
- [ ] Zoom navigateur : 100%
- [ ] Contenu complet visible (pas de scroll)
- [ ] Pas de données sensibles (si prod)
- [ ] Nom fichier clair et cohérent
- [ ] Sauvegardée dans bon sous-dossier

---

## 🎨 Standards Visuels

### Résolution

- **Écran capture** : 1920×1080 minimum
- **Largeur finale Word** : 16 cm (≈1600px @ 100 DPI)
- **Format** : PNG (pas de compression)

### Couleurs

- Mode couleur : RVB (pas CMJN)
- Pas de filtre/effet ajouté
- Couleurs fidèles à l'interface

### Contenu

- Pas d'éléments personnels (nom réel, email)
- Données exemple/test uniquement
- Interface propre (pas de notifications/popups)

---

## 📝 Métadonnées

Pour chaque capture, noter :

```yaml
Fichier: figure_3_X_2_resultat_complet.png
Source: /examples/yield-prediction
Section Mémoire: 3.X.3 Exemple de Prédiction
Date Capture: 2024-06-15
Dimensions: 700×800 px
Format: PNG
Taille: 156 KB
Légende: "Figure 3.X.2 : Résultat d'une prédiction..."
```

---

## 🔄 Workflow Capture → Mémoire

```
1. CAPTURE
   └─ gnome-screenshot -a
   └─ Sauvegarder ici : captures/analyse_predictive/

2. POST-TRAITEMENT (optionnel)
   └─ GIMP : Redimensionner 1600px largeur
   └─ Annotations si nécessaire

3. INSERTION WORD
   └─ Insertion → Images → Depuis fichier
   └─ Habillage : Haut et bas
   └─ Largeur : 16 cm
   └─ Centrer

4. LÉGENDE
   └─ Insérer légende sous image
   └─ Format : Italique, 10pt
   └─ Numérotation auto
```

---

## 📏 Dimensions Recommandées par Type

| Type Capture | Largeur | Hauteur | Ratio | Usage |
|--------------|---------|---------|-------|-------|
| Dashboard complet | 1600px | 900px | 16:9 | Vue d'ensemble |
| Carte seule | 1200px | 800px | 3:2 | Cartographie |
| Formulaire | 800px | 1000px | 4:5 | Interface saisie |
| Graphique | 1400px | 600px | 7:3 | Graphiques larges |
| Modal/Dialog | 600px | 400px | 3:2 | Petits éléments |

---

## 🚫 À Éviter

❌ Captures floues (zoom trop élevé)  
❌ JPG avec artefacts de compression  
❌ Données de production réelles  
❌ Informations confidentielles visibles  
❌ Interface cassée/erreurs visibles  
❌ Popups/notifications non pertinentes  
❌ Barre de scroll visible (crop mal fait)

---

## ✅ Bonnes Pratiques

✅ PNG haute qualité  
✅ Données exemple cohérentes  
✅ Interface propre et professionnelle  
✅ Contenu pertinent et lisible  
✅ Légendes descriptives  
✅ Numérotation cohérente  
✅ Noms fichiers explicites

---

## 📧 Backup

**Important** : Sauvegarder aussi dans :
- Google Drive / Dropbox
- Clé USB
- Cloud backup

Ne pas perdre les captures après des heures de travail !

---

## 📚 Ressources

- **Guide complet** : `docs/memoir/GUIDE_CAPTURES_ECRAN.md`
- **Page exemples** : http://localhost:3000/examples/yield-prediction
- **README exemples** : `app/(dashboard)/examples/yield-prediction/README.md`

---

**Créé le** : 2024-06-15  
**Dernière MAJ** : 2024-06-15
