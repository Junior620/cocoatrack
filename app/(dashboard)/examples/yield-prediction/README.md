# Page d'Exemples - Prédiction de Rendement

## 📸 Page de Démonstration pour Captures d'Écran Mémoire

Cette page affiche tous les états visuels du composant `YieldPredictionDisplay` pour faciliter la prise de captures d'écran pour le mémoire académique.

---

## 🚀 Comment Utiliser

### 1. Lancer l'Application

```bash
cd /home/lagauche/Bureau/app-suivi/v2
npm run dev
```

### 2. Ouvrir la Page d'Exemples

Naviguer vers : **http://localhost:3000/examples/yield-prediction**

### 3. Prendre les Captures

**Outils recommandés** :
- Linux : `gnome-screenshot -a` (sélection zone)
- Ou : `Ctrl + Shift + PrtScn` puis sélectionner zone
- Ou : Extension navigateur "Awesome Screenshot"

---

## 📷 Captures d'Écran à Faire

### ✅ Figure 3.X.1 : Interface de Demande de Prédiction
**Section** : "État Initial - Aucune Prédiction"
**Contenu** : 
- Carte vide avec message "Aucune prévision disponible"
- Bouton vert "Générer Prévision"
- Icône graphique

**Légende mémoire** :
> "Figure 3.X.1 : Interface de demande de prédiction de rendement. Le gestionnaire accède à cette fonctionnalité depuis la page de détail de la parcelle."

---

### ✅ Figure 3.X.2 : Résultat de Prédiction Complet
**Section** : "Résultat Prédiction - Confiance Élevée"
**Contenu** :
- Rendement prévu : **865 kg/ha** (gros chiffre)
- Badge vert "Confiance: Élevée"
- Intervalle : 778 - 952 kg/ha
- Comparaison coopérative avec flèche verte (+73%)
- Saison : Q4-2024
- Date prédiction
- Section "Informations sur le modèle" (collapsible)

**Légende mémoire** :
> "Figure 3.X.2 : Résultat d'une prédiction de rendement pour une parcelle. Le système affiche le rendement estimé (865 kg/ha), l'intervalle de confiance (±10%), le niveau de confiance (ÉLEVÉ) avec ses critères, ainsi qu'une comparaison avec la moyenne coopérative (500 kg/ha)."

---

### ✅ Figure 3.X.4 : Comparaison Niveaux de Confiance
**Section** : "Comparaison Niveaux de Confiance"
**Contenu** : 3 cartes côte à côte
- 🟢 Confiance ÉLEVÉE (±10%)
- 🟡 Confiance MOYENNE (±20%)
- 🔴 Confiance FAIBLE (±30%)
Avec critères et intervalles différents

**Légende mémoire** :
> "Figure 3.X.4 : Comparaison visuelle des trois niveaux de confiance. Le niveau HIGH (±10%) est obtenu avec au moins 6 mois de données NDVI et un historique de rendements, permettant une utilisation opérationnelle. Le niveau LOW (±30%) indique une prédiction trop incertaine pour la planification."

---

### 🔹 BONUS - Figures Optionnelles

#### Comparaison Coopérative
**Section** : "Bonus - Comparaison Coopérative"
- 2 cartes : Au-dessus moyenne (+35%) et En-dessous (-10%)

#### Rendement Réel
**Section** : "Bonus - Rendement Réel Enregistré"
- Carte verte avec rendement réel vs prédit
- Montre la précision du modèle après récolte

---

## 📐 Paramètres Capture Recommandés

### Résolution
- **Largeur** : 1920px (pleine largeur écran)
- **Crop ensuite** à 1400-1600px largeur pour Word

### Format
- **PNG** (meilleure qualité, pas de compression)
- Ou **JPG 90%** si fichier trop lourd

### Zoom Navigateur
- **100%** (zoom par défaut)
- Vérifier que tout le contenu est visible

---

## 🎨 Édition Post-Capture

### Outils Recommandés
- **GIMP** (Linux, gratuit) : redimensionner, crop, annoter
- **Krita** : annotations professionnelles
- Ou directement **Word** : insertion puis ajustement taille

### Annotations (optionnelles)
- Ajouter flèches rouges pointant vers éléments clés
- Numéroter zones importantes (1, 2, 3...)
- Surligner badge confiance avec rectangle coloré

---

## 📝 Intégration dans Word

```
1. Insertion → Image → Depuis fichier
2. Clic droit → Habillage texte → "Haut et bas"
3. Redimensionner : Largeur 16 cm (max pour A4 avec marges)
4. Centrer l'image
5. Ajouter légende sous l'image :
   Format → Insérer une légende → Position "Sous l'objet"
```

---

## ⚠️ Figure 3.X.3 (Graphique NDVI)

**Non disponible sur cette page d'exemples** car nécessite vraies données temporelles.

**Comment obtenir** :
1. Aller sur vraie page parcelle : `/parcelles/[id]`
2. Section "Analyse Satellitaire"
3. Vérifier que `TemporalDataChart` est affiché
4. Capturer le graphique ligne NDVI avec tendance

**Si pas de données** :
- Utiliser des données test (voir `test-data/satellite-test-data.sql`)
- Ou créer un mockup avec Excel/Google Sheets puis capture

---

## 🔧 Dépannage

### La page ne s'affiche pas
```bash
# Vérifier que le serveur tourne
npm run dev

# Vérifier l'URL
http://localhost:3000/examples/yield-prediction
```

### Erreur "Component not found"
```bash
# Vérifier que les exemples existent
ls components/satellite/YieldPredictionDisplay.examples.tsx

# Relancer le serveur
Ctrl+C puis npm run dev
```

### Composants ne chargent pas
- Vérifier console navigateur (F12) pour erreurs
- Vérifier que Supabase est accessible (pas nécessaire pour exemples mockés)

---

## 📚 Fichiers Liés

- **Component** : `components/satellite/YieldPredictionDisplay.tsx`
- **Examples** : `components/satellite/YieldPredictionDisplay.examples.tsx`
- **Service** : `lib/satellite/services/yield-prediction.service.ts`
- **API** : `app/api/satellite/yield-prediction/route.ts`

---

## ✅ Checklist Captures Mémoire

- [ ] Figure 3.X.1 : État initial (PNG, 1600px)
- [ ] Figure 3.X.2 : Résultat complet HIGH (PNG, 1600px)
- [ ] Figure 3.X.4 : Comparaison 3 niveaux (PNG, 1800px large)
- [ ] Figure 3.X.3 : Graphique NDVI (depuis vraie parcelle)
- [ ] Légendes rédigées pour chaque figure
- [ ] Images redimensionnées 16cm largeur dans Word
- [ ] Numérotation figures cohérente dans texte

---

**Bon courage pour ton mémoire ! 🎓📊**
