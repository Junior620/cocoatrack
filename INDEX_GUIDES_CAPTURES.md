# Index - Guides Captures d'Écran

**Dernière Mise à Jour** : 1er juillet 2026

## 📚 Tous les Guides Disponibles

### 🚀 Pour Démarrer (Choisis UN guide selon ton besoin)

| Fichier | Niveau | Temps | Quand l'Utiliser |
|---------|--------|-------|------------------|
| **`INSTRUCTIONS_CAPTURES.txt`** | Débutant | 2 min | Tu veux juste faire les captures rapidement |
| **`CAPTURES_PRET.md`** | Débutant | 3 min | Tu veux un récap markdown avec commandes |
| **`CAPTURES_ECRAN_MEMOIRE.md`** | Intermédiaire | 10 min | Tu veux guide illustré avec checklist |
| **`docs/memoir/GUIDE_CAPTURES_ECRAN.md`** | Avancé | 20 min | Tu veux TOUT savoir (légendes, dimensions, Word) |

**Recommandation** : Commence par `INSTRUCTIONS_CAPTURES.txt` (le plus simple)

---

### 🔧 En Cas de Problème

| Fichier | Problème | Solution |
|---------|----------|----------|
| **`CAPTURES_ECRAN_FIX.md`** | Erreur cache / Page ne charge pas | Fix technique expliqué |
| **`RESOLUTION_CACHE_TURBOPACK.md`** | Comprendre incident cache Turbopack | Documentation complète incident |
| **`app/(dashboard)/examples/yield-prediction/README.md`** | Utilisation page exemples | Guide détaillé fonctionnalités |

---

### 📊 Pour Comprendre le Système

| Fichier | Contenu |
|---------|---------|
| **`STATUS_CAPTURES_ECRAN.md`** | État global système, checklist, métriques |
| **`RECAP_SESSION_2026_07_01.md`** | Récapitulatif session, travail effectué |
| **`docs/memoir/captures/README.md`** | Organisation dossier captures, standards |

---

## 🎯 Workflow Recommandé

### Si Tu N'as Jamais Fait de Captures

```
1. Lis : INSTRUCTIONS_CAPTURES.txt (2 min)
2. Lance : npm run dev
3. Ouvre : http://localhost:3000/examples/yield-prediction
4. Capture : 3 figures avec Ctrl+Shift+PrtScn
5. Sauvegarde : docs/memoir/captures/
```

### Si Tu Veux Plus de Détails

```
1. Lis : CAPTURES_ECRAN_MEMOIRE.md (10 min)
2. Vérifie setup : ./scripts/check-screenshots-setup.sh
3. Lance serveur et fait captures
4. Consulte légendes : docs/memoir/GUIDE_CAPTURES_ECRAN.md
```

### Si Tu As un Problème

```
1. Page ne charge pas ?
   → Lis : CAPTURES_ECRAN_FIX.md
   → Execute : ./scripts/restart-dev-clean.sh
   
2. Erreur incompréhensible ?
   → Lis : RESOLUTION_CACHE_TURBOPACK.md
   
3. Besoin comprendre page exemples ?
   → Lis : app/(dashboard)/examples/yield-prediction/README.md
```

---

## 📁 Structure Fichiers

```
v2/
│
├── INSTRUCTIONS_CAPTURES.txt          ← ⭐ LE PLUS SIMPLE
├── CAPTURES_PRET.md                   ← ⭐ RAPIDE MARKDOWN
├── CAPTURES_ECRAN_MEMOIRE.md          ← Guide illustré
├── CAPTURES_ECRAN_FIX.md              ← Fix technique
├── RESOLUTION_CACHE_TURBOPACK.md      ← Incident détaillé
├── STATUS_CAPTURES_ECRAN.md           ← État système
├── RECAP_SESSION_2026_07_01.md        ← Récap session
├── INDEX_GUIDES_CAPTURES.md           ← Ce fichier
│
├── app/(dashboard)/examples/yield-prediction/
│   ├── page.tsx                       ← Page exemples
│   └── README.md                      ← Guide page
│
├── docs/memoir/
│   ├── GUIDE_CAPTURES_ECRAN.md        ← ⭐ GUIDE COMPLET
│   └── captures/
│       └── README.md                  ← Organisation dossier
│
└── scripts/
    ├── restart-dev-clean.sh            ← Nettoyage cache
    └── check-screenshots-setup.sh      ← Vérification setup
```

---

## 🎓 Pour Ton Mémoire

### Captures Nécessaires

| Figure | Section Page | Fichier à Créer |
|--------|--------------|-----------------|
| 3.X.1 | Section 1 "État Initial" | `figure_3_X_1_interface_demande.png` |
| 3.X.2 | Section 2 "Confiance Élevée" | `figure_3_X_2_resultat_complet.png` |
| 3.X.4 | Section 3 "Comparaison Niveaux" | `figure_3_X_4_comparaison_niveaux.png` |

**Légendes disponibles dans** : `docs/memoir/GUIDE_CAPTURES_ECRAN.md`

### Intégration Word

Voir section "Intégration dans Word" dans :
- `docs/memoir/GUIDE_CAPTURES_ECRAN.md` (détaillé)
- `CAPTURES_ECRAN_MEMOIRE.md` (rapide)

---

## ⚡ Commandes Rapides

```bash
# Vérifier setup
./scripts/check-screenshots-setup.sh

# Nettoyer cache si problème
./scripts/restart-dev-clean.sh

# Lancer serveur
npm run dev

# Créer dossier captures (si besoin)
mkdir -p docs/memoir/captures
```

---

## 🆘 Aide par Type de Question

### "Comment faire les captures ?"
→ `INSTRUCTIONS_CAPTURES.txt` (le plus direct)

### "La page ne marche pas !"
→ `CAPTURES_ECRAN_FIX.md` (solutions techniques)

### "Quelles légendes mettre dans Word ?"
→ `docs/memoir/GUIDE_CAPTURES_ECRAN.md` (section Légendes)

### "Qu'est-ce qui a été fait aujourd'hui ?"
→ `RECAP_SESSION_2026_07_01.md` (récap complet)

### "C'est quoi le statut global ?"
→ `STATUS_CAPTURES_ECRAN.md` (vue d'ensemble)

### "Comment utiliser la page exemples ?"
→ `app/(dashboard)/examples/yield-prediction/README.md`

### "Pourquoi il y avait un bug cache ?"
→ `RESOLUTION_CACHE_TURBOPACK.md` (analyse technique)

---

## ✅ Checklist Ultra-Rapide

Avant de commencer :
- [ ] J'ai lu `INSTRUCTIONS_CAPTURES.txt` (2 min)
- [ ] Mon serveur tourne : `npm run dev`
- [ ] J'ai ouvert : http://localhost:3000/examples/yield-prediction
- [ ] Je sais où sauvegarder : `docs/memoir/captures/`

Faire les captures :
- [ ] Figure 3.X.1 (Section 1) - État initial
- [ ] Figure 3.X.2 (Section 2) - Résultat HIGH
- [ ] Figure 3.X.4 (Section 3) - Comparaison 3 niveaux

Après captures :
- [ ] Format PNG (pas JPG)
- [ ] Noms fichiers corrects
- [ ] Backup (USB / Cloud)

---

## 📞 Support

**Premier réflexe** : `INSTRUCTIONS_CAPTURES.txt`

**Si bloqué** : Lire guides dans l'ordre :
1. `CAPTURES_ECRAN_FIX.md` (solutions communes)
2. `CAPTURES_ECRAN_MEMOIRE.md` (troubleshooting illustré)
3. `RESOLUTION_CACHE_TURBOPACK.md` (technique avancé)

**Scripts utiles** :
- Vérification : `./scripts/check-screenshots-setup.sh`
- Nettoyage : `./scripts/restart-dev-clean.sh`

---

## 💡 Astuce Principale

**Ne perds pas de temps à tout lire !**

1. Ouvre `INSTRUCTIONS_CAPTURES.txt`
2. Suis les 4 étapes
3. Prends tes 3 captures
4. Fini ! ✅

Les autres guides sont là SI tu as un problème ou besoin de plus d'infos.

---

**Créé le** : 1er juillet 2026  
**Guides disponibles** : 8  
**Temps captures** : 15 min  
**Difficulté** : Facile ✅
