# Guide Complet - Captures d'Écran pour le Mémoire

## 📸 Vue d'Ensemble

Ce guide détaille comment obtenir **toutes les captures d'écran** nécessaires pour le **Chapitre 3 : Résultats et Discussion** du mémoire CocoaTrack.

---

## 🎯 Captures Nécessaires - Section Analyse Prédictive

### Figure 3.X.1 : Interface de Demande de Prédiction ⭐ ESSENTIELLE

**Source** : Page d'exemples `/examples/yield-prediction`  
**Section** : "État Initial - Aucune Prédiction"

**Contenu à capturer** :
- ✅ Carte vide avec icône graphique
- ✅ Message "Aucune prévision de rendement disponible"
- ✅ Texte explicatif "Générez une prévision basée sur..."
- ✅ **Bouton vert "Générer Prévision"** (élément principal)

**Dimensions** : ~600 × 400 px  
**Format** : PNG

**Légende pour mémoire** :
```
Figure 3.X.1 : Interface de demande de prédiction de rendement. 
Le gestionnaire accède à cette fonctionnalité depuis la page de 
détail de la parcelle, dans l'onglet Analyse Satellitaire.
```

---

### Figure 3.X.2 : Résultat de Prédiction Complet ⭐ ESSENTIELLE

**Source** : Page d'exemples `/examples/yield-prediction`  
**Section** : "Résultat Prédiction - Confiance Élevée"

**Contenu à capturer** :
- ✅ **Rendement Prévu : 865 kg/ha** (gros chiffre en haut)
- ✅ Badge vert **"Confiance: Élevée"**
- ✅ Intervalle de confiance : **778 - 952 kg/ha**
- ✅ **Comparaison Coopérative** :
  - Moyenne Coopérative : 500 kg/ha
  - Flèche verte ↑
  - **+365 kg/ha (+73%)**
- ✅ Saison de récolte : **Q4-2024**
- ✅ Date de prévision
- ✅ Section "Informations sur le modèle" (peut être fermée ou ouverte)

**Dimensions** : ~700 × 800 px  
**Format** : PNG

**Légende pour mémoire** :
```
Figure 3.X.2 : Résultat d'une prédiction de rendement pour la parcelle 
Foumban-Nord-12. Le système affiche le rendement estimé (865 kg/ha), 
l'intervalle de confiance (±10%), le niveau de confiance (ÉLEVÉ) avec 
ses critères, ainsi qu'une comparaison avec la moyenne coopérative 
(500 kg/ha). L'interface permet également d'enregistrer le rendement 
réel après la récolte.
```

---

### Figure 3.X.3 : Graphique Évolution NDVI ⭐ IMPORTANTE

**Source** : Page parcelle réelle `/parcelles/[id]`  
**Section** : Scroll vers "TemporalDataChart"

**Contenu à capturer** :
- ✅ **Courbe NDVI temporelle** (ligne bleue avec points)
- ✅ Axe X : Dates (Jan - Juin 2024)
- ✅ Axe Y : Valeurs NDVI (0.00 - 1.00)
- ✅ **Ligne de tendance** visible (régression)
- ✅ **Point actuel** mis en évidence
- ✅ Métriques affichées :
  - Moyenne NDVI
  - Min/Max
  - Changements significatifs
- ✅ Légende claire

**Dimensions** : ~900 × 400 px  
**Format** : PNG

**Légende pour mémoire** :
```
Figure 3.X.3 : Évolution temporelle du NDVI de la parcelle Foumban-Nord-12 
sur 6 mois (Janvier-Juin 2024). La ligne de tendance montre une amélioration 
continue (+0.018 NDVI/mois), indicateur favorable pour le rendement futur. 
Les points représentent les mesures Sentinel-2 (résolution temporelle 5-10 jours).
```

**⚠️ Si pas de données NDVI disponibles** :
- Utiliser les données test : `test-data/satellite-test-data.sql`
- Ou créer un graphique mockup avec Excel/Google Sheets

---

### Figure 3.X.4 : Comparaison Niveaux de Confiance ⭐ IMPORTANTE

**Source** : Page d'exemples `/examples/yield-prediction`  
**Section** : "Comparaison Niveaux de Confiance"

**Contenu à capturer** : **3 cartes côte à côte**

**Carte 1 - Confiance ÉLEVÉE** :
- Badge 🟢 vert "Confiance: Élevée"
- Rendement : 865 kg/ha
- Intervalle : **[778 - 952]** (±10%)
- Encadré vert en bas :
  - Critères : ≥6 mois NDVI + historique
  - Usage : Planification opérationnelle

**Carte 2 - Confiance MOYENNE** :
- Badge 🟡 jaune "Confiance: Moyenne"
- Rendement : 720 kg/ha
- Intervalle : **[576 - 864]** (±20%)
- Encadré jaune en bas :
  - Critères : ≥3 mois NDVI OU historique
  - Usage : Indicatif, prudence requise

**Carte 3 - Confiance FAIBLE** :
- Badge 🔴 orange "Confiance: Faible"
- Rendement : 580 kg/ha
- Intervalle : **[406 - 754]** (±30%)
- Encadré orange en bas :
  - Critères : <3 mois NDVI + pas d'historique
  - Usage : Exploratoire uniquement

**Dimensions** : ~1400 × 600 px (large car 3 colonnes)  
**Format** : PNG

**Légende pour mémoire** :
```
Figure 3.X.4 : Comparaison visuelle des trois niveaux de confiance. 
Le niveau HIGH (±10%, badge vert) est obtenu avec au moins 6 mois de 
données NDVI et un historique de rendements, permettant une utilisation 
opérationnelle. Le niveau MEDIUM (±20%, badge jaune) offre une estimation 
indicative. Le niveau LOW (±30%, badge orange) indique une prédiction trop 
incertaine pour la planification et nécessite plus de données.
```

---

## 🎨 Captures BONUS (Optionnelles)

### Figure 3.X.5 : Dashboard Multi-Parcelles (si temps)

**Source** : Pas encore implémenté  
**Alternative** : Mockup PowerPoint/Figma

**Contenu attendu** :
- Tableau listant 5-10 parcelles
- Colonnes : Nom, Surface, Rendement, Production, Confiance
- Total en bas : 186 tonnes estimées
- Badges colorés par niveau confiance

---

### Figure BONUS 1 : Comparaison Coopérative

**Source** : Page exemples, section "Bonus - Comparaison Coopérative"

**Contenu** : 2 cartes côte à côte
- Gauche : Parcelle **au-dessus** moyenne (+35%, flèche verte ↑)
- Droite : Parcelle **en-dessous** moyenne (-10%, flèche rouge ↓)

---

### Figure BONUS 2 : Rendement Réel vs Prédit

**Source** : Page exemples, section "Bonus - Rendement Réel Enregistré"

**Contenu** :
- Carte avec encadré vert
- Rendement Réel : 530 kg/ha
- Rendement Prédit : 520 kg/ha
- Écart : +10 kg/ha (+1.9%)
- Icône ✅ "Rendement Réel Enregistré"

---

### Figure BONUS 3 : Formulaire Saisie

**Source** : Page exemples, section "Bonus - Formulaire Saisie"

**Contenu** :
- Bouton "+ Enregistrer le Rendement Réel"
- OU formulaire ouvert avec :
  - Champ "Rendement (kg/ha)"
  - Boutons "Enregistrer" / "Annuler"

---

## 🛠️ Outils et Procédure

### Étape 1 : Lancer l'Application

```bash
cd /home/lagauche/Bureau/app-suivi/v2
npm run dev
```

**Attendre** : "Ready on http://localhost:3000"

---

### Étape 2 : Ouvrir la Page d'Exemples

**URL** : http://localhost:3000/examples/yield-prediction

**Navigation alternative** :
1. Ouvrir http://localhost:3000
2. Connexion (si nécessaire)
3. Dans la barre d'adresse : `/examples/yield-prediction`

---

### Étape 3 : Prendre les Captures

#### Option A : Outil Système Linux

**Méthode 1 - Sélection Zone** (RECOMMANDÉ) :
```bash
# Terminal
gnome-screenshot -a

# Puis : cliquer-glisser pour sélectionner zone
```

**Méthode 2 - Raccourci Clavier** :
- `Ctrl + Shift + PrtScn`
- Sélectionner zone avec souris
- Image copiée dans presse-papier

**Méthode 3 - Outil Capture Complet** :
- Chercher "Screenshot" dans applications
- Mode "Sélection zone"
- Enregistrer en PNG

#### Option B : Extension Navigateur (Chrome/Firefox)

**Extension recommandée** : "Awesome Screenshot"
1. Installer depuis Chrome Web Store / Firefox Add-ons
2. Icône extension → "Capture selected area"
3. Sélectionner zone
4. Sauvegarder PNG

---

### Étape 4 : Nommer les Fichiers

**Convention de nommage** :
```
figure_3_X_1_interface_demande_prediction.png
figure_3_X_2_resultat_prediction_complet.png
figure_3_X_3_graphique_ndvi_temporel.png
figure_3_X_4_comparaison_niveaux_confiance.png
```

**Dossier de sauvegarde** :
```
/home/lagauche/Bureau/app-suivi/v2/docs/memoir/captures/
```

---

## ✂️ Post-Traitement (Optionnel)

### Redimensionnement

**Dimensions cibles pour Word** :
- Largeur : **16 cm** (max pour A4 avec marges 2cm)
- Hauteur : Proportionnelle

**Outil** : GIMP
```bash
# Installer GIMP si pas déjà fait
sudo apt install gimp

# Ouvrir image
gimp figure_3_X_2_resultat_prediction_complet.png

# Image → Scale Image
# Largeur : 1600 pixels (≈16cm @ 100 DPI)
# Conserver proportions : ✓
# Interpolation : Cubic

# File → Export As → PNG
```

---

### Annotations (si nécessaire)

**Outils** :
- **GIMP** : Texte, flèches, rectangles
- **Krita** : Plus professionnel
- **Draw.io** : Import image puis annotation

**Annotations utiles** :
- Flèche rouge → Badge confiance
- Numéro ① ② ③ → Éléments clés
- Rectangle coloré → Mettre en évidence intervalle

---

## 📄 Intégration dans Word

### Insertion Image

```
1. Positionner curseur dans le document
2. Insertion → Images → Depuis un fichier
3. Sélectionner figure_3_X_1_interface_demande_prediction.png
4. Clic droit sur image → Habillage du texte → "Haut et bas"
5. Redimensionner : Clic droit → Taille et position → Largeur 16 cm
6. Centrer : Clic sur image → Accueil → Centrer
```

### Ajouter Légende

```
1. Clic droit sur image → Insérer une légende
2. Étiquette : "Figure"
3. Position : "Sous l'objet sélectionné"
4. Texte : "Figure 3.X.1 : Interface de demande de prédiction..."
5. OK

OU

1. Sous l'image, taper texte légende
2. Format : Italique, taille 10pt, centré
3. Style : "Légende"
```

---

## ✅ Checklist Finale

**Avant Captures** :
- [ ] Application lancée (`npm run dev`)
- [ ] Page exemples accessible (http://localhost:3000/examples/yield-prediction)
- [ ] Zoom navigateur à 100%
- [ ] Outil capture prêt (gnome-screenshot, extension)

**Captures Essentielles** :
- [ ] Figure 3.X.1 : Interface demande (PNG, 600×400px)
- [ ] Figure 3.X.2 : Résultat complet (PNG, 700×800px)
- [ ] Figure 3.X.3 : Graphique NDVI (PNG, 900×400px)
- [ ] Figure 3.X.4 : Comparaison 3 niveaux (PNG, 1400×600px)

**Captures Bonus (optionnelles)** :
- [ ] Comparaison coopérative
- [ ] Rendement réel vs prédit
- [ ] Formulaire saisie

**Post-Traitement** :
- [ ] Images redimensionnées 16cm largeur
- [ ] Format PNG conservé
- [ ] Fichiers nommés clairement
- [ ] Sauvegardés dans `/docs/memoir/captures/`

**Intégration Word** :
- [ ] Images insérées dans document
- [ ] Habillage "Haut et bas" appliqué
- [ ] Largeur 16 cm
- [ ] Images centrées
- [ ] Légendes ajoutées sous chaque figure
- [ ] Numérotation cohérente (3.X.1, 3.X.2, 3.X.3, 3.X.4)
- [ ] Références dans texte ("voir Figure 3.X.2")

---

## 🆘 Dépannage

### Page d'exemples ne charge pas

**Erreur** : 404 Not Found

**Solution** :
```bash
# Vérifier que le fichier existe
ls app/\(dashboard\)/examples/yield-prediction/page.tsx

# Relancer le serveur
Ctrl+C
npm run dev
```

---

### Composants ne s'affichent pas

**Erreur** : Cartes vides ou erreurs console

**Solution** :
```bash
# Vérifier console navigateur (F12)
# Chercher erreurs en rouge

# Vérifier que les exemples existent
ls components/satellite/YieldPredictionDisplay.examples.tsx

# Rebuild
npm run build
npm run dev
```

---

### Graphique NDVI pas disponible

**Erreur** : Pas de données temporelles sur vraie parcelle

**Solution 1** : Importer données test
```bash
# Exécuter script SQL test
psql -U postgres -d cocoatrack -f test-data/satellite-test-data.sql
```

**Solution 2** : Mockup Excel
1. Créer graphique ligne dans Excel/Google Sheets
2. Axe X : Jan, Fév, Mar, Avr, Mai, Jun
3. Axe Y : 0.58, 0.61, 0.64, 0.66, 0.67, 0.68
4. Ajouter ligne de tendance linéaire
5. Capture graphique

---

## 📚 Ressources

**Fichiers Projet** :
- Component : `components/satellite/YieldPredictionDisplay.tsx`
- Examples : `components/satellite/YieldPredictionDisplay.examples.tsx`
- Page : `app/(dashboard)/examples/yield-prediction/page.tsx`
- Service : `lib/satellite/services/yield-prediction.service.ts`

**Documentation** :
- Architecture : `docs/architecture/ARCHITECTURE_ANALYSE_PREDICTIVE.md`
- Chapitre 3 : `docs/memoir/CHAPITRE_3_RESULTATS_ET_DISCUSSION.md`

**Support** :
- README : `app/(dashboard)/examples/yield-prediction/README.md`
- Ce guide : `docs/memoir/GUIDE_CAPTURES_ECRAN.md`

---

**Bon courage pour les captures ! 📸🎓**
