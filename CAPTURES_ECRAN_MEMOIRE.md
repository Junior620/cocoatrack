# 📸 Captures d'Écran Mémoire - Guide Rapide

## ✅ MISE À JOUR - 1er juillet 2026

**PROBLÈME RÉSOLU** : Le cache Turbopack causait une erreur `HighConfidencePrediction is not defined`. 

**SOLUTION** : Nouveau component créé → `YieldPredictionMockStates.tsx`

**STATUS** : ✅ Page fonctionnelle. Tu peux prendre les captures immédiatement.

**EN CAS DE PROBLÈME** : Voir `CAPTURES_ECRAN_FIX.md` pour détails.

---

## ✅ Setup Terminé !

Tous les fichiers nécessaires ont été créés. Tu peux maintenant prendre tes captures d'écran pour le mémoire.

---

## 🚀 Démarrage Rapide (3 étapes)

### 1️⃣ Lancer l'Application

```bash
cd /home/lagauche/Bureau/app-suivi/v2
npm run dev
```

**Attendre** : Message "Ready on http://localhost:3000"

---

### 2️⃣ Ouvrir la Page d'Exemples

**Navigateur** : http://localhost:3000/examples/yield-prediction

Tu verras :
- ✅ Instructions pour captures
- ✅ Tous les exemples visuels
- ✅ Badges indiquant quelles figures capturer (Figure 3.X.1, 3.X.2, etc.)

---

### 3️⃣ Prendre les Captures

**Méthode Simple** :
1. Appuyer sur `Ctrl + Shift + PrtScn`
2. Sélectionner zone avec souris
3. Image copiée → Coller dans fichier
4. Sauvegarder : `docs/memoir/captures/figure_3_X_1_interface_demande.png`

**Méthode Terminal** :
```bash
gnome-screenshot -a
# Cliquer-glisser pour sélectionner zone
# Choisir nom fichier et enregistrer
```

---

## 📋 Captures à Faire (4 essentielles)

| # | Figure | Section Page Exemples | Dimensions |
|---|--------|----------------------|------------|
| 1 | **3.X.1** | "État Initial" | 600×400px |
| 2 | **3.X.2** | "Confiance Élevée (Complet)" | 700×800px |
| 3 | **3.X.3** | ⚠️ Parcelle réelle (graphique NDVI) | 900×400px |
| 4 | **3.X.4** | "Comparaison Niveaux" (3 cartes) | 1400×600px |

---

## 📁 Où Sauvegarder

**Dossier** : `/home/lagauche/Bureau/app-suivi/v2/docs/memoir/captures/`

**Noms fichiers** :
```
figure_3_X_1_interface_demande.png
figure_3_X_2_resultat_complet.png
figure_3_X_3_graphique_ndvi.png
figure_3_X_4_comparaison_niveaux.png
```

---

## 🔧 Outils Disponibles

### Vérifier Setup

```bash
cd /home/lagauche/Bureau/app-suivi/v2
./scripts/check-screenshots-setup.sh
```

### Outil Capture (si pas installé)

```bash
sudo apt install gnome-screenshot
```

### GIMP pour Édition (optionnel)

```bash
sudo apt install gimp
```

---

## 📚 Documentation Complète

| Document | Chemin | Description |
|----------|--------|-------------|
| **Guide Complet** | `docs/memoir/GUIDE_CAPTURES_ECRAN.md` | Toutes instructions détaillées |
| **README Exemples** | `app/(dashboard)/examples/yield-prediction/README.md` | Utilisation page exemples |
| **README Captures** | `docs/memoir/captures/README.md` | Organisation dossier captures |

---

## ⚡ Raccourcis Clavier

| Action | Linux | Description |
|--------|-------|-------------|
| Capture zone | `Ctrl + Shift + PrtScn` | Sélection manuelle |
| Capture fenêtre | `Alt + PrtScn` | Fenêtre active |
| Capture écran | `PrtScn` | Écran complet |

---

## ✅ Checklist Rapide

Avant de commencer :
- [ ] `npm run dev` lancé
- [ ] Page http://localhost:3000/examples/yield-prediction ouverte
- [ ] Zoom navigateur à 100%
- [ ] Dossier `docs/memoir/captures/` existe

Captures essentielles :
- [ ] Figure 3.X.1 (État initial)
- [ ] Figure 3.X.2 (Résultat complet HIGH)
- [ ] Figure 3.X.3 (Graphique NDVI temporel)
- [ ] Figure 3.X.4 (Comparaison 3 niveaux)

Post-capture :
- [ ] Format PNG (pas JPG)
- [ ] Noms fichiers cohérents
- [ ] Sauvegardées dans `/docs/memoir/captures/`
- [ ] Backup sur clé USB / Google Drive

---

## 🎯 Résultat Attendu

Après ces étapes, tu auras :
- ✅ 4 captures d'écran PNG haute qualité
- ✅ Prêtes pour insertion dans Word
- ✅ Légendes déjà rédigées dans le guide
- ✅ Dimensions optimales pour document A4

---

## 💡 Astuces

**Astuce 1** : Prendre plusieurs captures de chaque figure
- Tu choisiras la meilleure après

**Astuce 2** : Vérifier contenu avant capture
- Zoom 100%
- Tout visible sans scroll
- Pas de popups/notifications

**Astuce 3** : Nommer immédiatement
- Renommer juste après capture
- Éviter "Capture d'écran 2024-06-15..."

**Astuce 4** : Backup immédiat
- Copier sur clé USB
- Upload Google Drive
- Ne pas perdre ton travail !

---

## 🆘 Problèmes Courants

### Page exemples ne charge pas

```bash
# Solution : Relancer serveur
Ctrl+C (dans terminal npm)
npm run dev
```

### Captures floues

- Vérifier zoom navigateur = 100%
- Augmenter résolution écran si possible
- Utiliser PNG (pas JPG)

### Graphique NDVI pas disponible

- Figure 3.X.3 nécessite vraie parcelle avec données
- Alternative : Mockup Excel (voir guide complet)

---

## 📞 Support

**Guides détaillés** :
- `docs/memoir/GUIDE_CAPTURES_ECRAN.md` ← **LIS MOI EN CAS DE PROBLÈME**
- `app/(dashboard)/examples/yield-prediction/README.md`

**Fichiers créés** :
- ✅ Page exemples : `app/(dashboard)/examples/yield-prediction/page.tsx`
- ✅ Dossier captures : `docs/memoir/captures/`
- ✅ Script vérification : `scripts/check-screenshots-setup.sh`
- ✅ 3 guides README complets

---

## 🎓 Pour Ton Mémoire

**Dans Word** :
1. Insertion → Images
2. Sélectionner PNG
3. Habillage : "Haut et bas"
4. Largeur : 16 cm
5. Centrer
6. Insérer légende sous image

**Légendes disponibles** :
- Voir `docs/memoir/GUIDE_CAPTURES_ECRAN.md`
- Sections "Légende pour mémoire"
- Copier-coller directement

---

**Tout est prêt ! Bon courage pour les captures ! 📸🎓**

---

**Créé le** : 2024-06-15  
**Fichiers créés** : 8 (page, READMEs, guides, script)  
**Temps estimé captures** : 15-30 minutes  
**Résultat** : 4-7 figures pour Chapitre 3
