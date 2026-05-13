# Fichiers de Test - CocoaTrack

Ce dossier contient des fichiers de test pour différentes fonctionnalités de CocoaTrack.

## 📂 Contenu

### 1. Import Planteurs CSV
Fichiers CSV pour tester l'import de planteurs.

### 2. Données de Test Satellite
Scripts SQL pour créer des parcelles de test dans des régions avec excellente couverture satellite.

---

## 🛰️ Données de Test Satellite

### Fichiers disponibles

#### `satellite-test-data.sql` (Script complet)
- **10 planteurs** + **11 parcelles**
- **Régions** : Brésil 🇧🇷, Équateur 🇪🇨, Espagne 🇪🇸, Italie 🇮🇹, Indonésie 🇮🇩
- **Utilisation** : Test complet NDVI, analyse temporelle, déforestation

#### `quick-satellite-test.sql` (Script rapide)
- **3 planteurs** + **3 parcelles**
- **Régions** : Brésil 🇧🇷, Équateur 🇪🇨, Espagne 🇪🇸
- **Utilisation** : Test rapide des fonctionnalités principales

#### `SATELLITE_TEST_DATA_README.md`
Documentation complète pour l'utilisation des données de test satellite.

### Pourquoi ces régions ?

Les parcelles au Cameroun ont souvent une couverture nuageuse élevée (60-80%) qui limite la disponibilité d'images satellites. Ces données de test utilisent des régions avec :

- ✅ Excellente couverture Sentinel-2 (passages tous les 5 jours)
- ✅ Moins de nuages (10-50% selon la région)
- ✅ Végétation variée (forêts, plantations, agriculture)
- ✅ Zones de déforestation connues (Amazonie)

### Installation rapide

```bash
# Option 1 : Script rapide (3 parcelles)
# Copier test-data/quick-satellite-test.sql dans Supabase SQL Editor

# Option 2 : Script complet (11 parcelles)
# Copier test-data/satellite-test-data.sql dans Supabase SQL Editor
```

### Parcelles de test créées

| Code | Région | Type | NDVI attendu | Utilité |
|------|--------|------|--------------|---------|
| PAR-BR-TEST | Brésil 🇧🇷 | Forêt dense | 0.7-0.9 | Déforestation |
| PAR-EC-TEST | Équateur 🇪🇨 | Cacao | 0.5-0.7 | NDVI réaliste |
| PAR-ES-TEST | Espagne 🇪🇸 | Agriculture | 0.4-0.6 | Images claires |

**Plus de détails** : Voir `SATELLITE_TEST_DATA_README.md`

---

## 📊 Import Planteurs CSV

### Colonnes Attendues

| Colonne | Obligatoire | Type | Description |
|---------|-------------|------|-------------|
| `nom` | ✅ Oui | Texte | Nom de famille |
| `prénoms` | Non | Texte | Prénom(s) |
| `CNI` | Non | Texte | Numéro de carte nationale d'identité |
| `téléphone` | Non | Texte | Numéro de téléphone (format +237...) |
| `superficie` | Non | Nombre | Superficie en hectares (ex: 5.5) |
| `age` | Non | Entier | Âge du planteur |
| `genre` | Non | `M` ou `F` | Genre du planteur |

**Séparateur** : virgule `,` ou point-virgule `;` (auto-détecté)  
**Encodage** : UTF-8

---

## Fichiers Disponibles

### `planteurs-import-valid.csv`
10 planteurs valides avec toutes les colonnes renseignées.  
Utiliser pour tester un import complet sans erreurs.

### `planteurs-import-minimal.csv`
5 planteurs avec seulement certaines colonnes renseignées.  
Utiliser pour tester la gestion des champs optionnels vides.

### `planteurs-import-large.csv`
30 planteurs valides avec toutes les colonnes.  
Utiliser pour tester les performances et la pagination.

### `planteurs-import-with-errors.csv`
7 lignes dont plusieurs avec des erreurs :
- Ligne 3 : `nom` vide (obligatoire)
- Ligne 4 : CNI invalide (caractères spéciaux)
- Ligne 5 : Téléphone invalide
- Ligne 6 : Superficie négative
- Ligne 7 : Superficie non numérique
- Ligne 8 : Age invalide (200) et genre invalide (X)

Utiliser pour tester la validation et l'affichage des erreurs.

### `planteurs-import-accents.csv`
5 planteurs avec des noms accentués.  
Utiliser pour tester la normalisation des noms (unaccent).

### `planteurs-import-semicolon.csv`
5 planteurs avec séparateur point-virgule `;` et décimales avec virgule.  
Utiliser pour tester la détection automatique du séparateur.

---

## Exemple Minimal

```csv
nom,prénoms,CNI,téléphone,superficie,age,genre
Nkomo,Paul,CM001,+237670000001,5.5,42,M
Mbarga,Marie,CM002,+237670000002,3.2,35,F
Fouda,Jean,CM003,,7.8,,M
```
