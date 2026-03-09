# Fichiers CSV de Test - Import Planteurs

Ce dossier contient des fichiers CSV d'exemple pour tester la fonctionnalité d'import de planteurs.

## Fichiers Disponibles

### 1. `planteurs-import-valid.csv`
**Description:** Fichier CSV valide avec 10 planteurs  
**Format:** Virgule (,) comme délimiteur  
**Contenu:** Tous les champs remplis, données valides  
**Usage:** Test du flux d'import normal avec succès

**Colonnes:**
- nom (requis)
- prénoms (optionnel)
- CNI (optionnel)
- téléphone (optionnel)
- superficie (optionnel, en hectares)

---

### 2. `planteurs-import-semicolon.csv`
**Description:** Fichier CSV avec point-virgule comme délimiteur  
**Format:** Point-virgule (;) comme délimiteur  
**Contenu:** 5 planteurs avec virgule décimale pour superficie  
**Usage:** Test de la détection automatique du délimiteur européen

**Note:** Les superficies utilisent la virgule (,) comme séparateur décimal (format européen)

---

### 3. `planteurs-import-with-errors.csv`
**Description:** Fichier CSV contenant diverses erreurs de validation  
**Format:** Virgule (,) comme délimiteur  
**Erreurs incluses:**
- Ligne 2: Nom manquant (champ requis)
- Ligne 3: CNI invalide (caractères spéciaux)
- Ligne 4: Téléphone invalide (format incorrect)
- Ligne 5: Superficie négative
- Ligne 6: Superficie non numérique

**Usage:** Test de la validation des données et affichage des erreurs

---

### 4. `planteurs-import-minimal.csv`
**Description:** Fichier CSV avec champs optionnels vides  
**Format:** Virgule (,) comme délimiteur  
**Contenu:** 5 planteurs avec différentes combinaisons de champs remplis  
**Usage:** Test de la gestion des champs optionnels vides

**Scénarios:**
- Planteur avec seulement nom et téléphone
- Planteur avec nom, prénoms et superficie
- Planteur avec nom et CNI
- Planteur avec tous les champs
- Planteur avec seulement nom et téléphone

---

### 5. `planteurs-import-accents.csv`
**Description:** Fichier CSV avec caractères accentués  
**Format:** Virgule (,) comme délimiteur  
**Contenu:** 5 planteurs avec noms contenant des accents  
**Usage:** Test de la normalisation des noms et détection des doublons

**Caractéristiques:**
- Noms avec accents: Kônàn, Kôuassî, Trà Bï, etc.
- Test de la fonction `normalize_planteur_name()`
- Vérification que "Kônàn" = "Konan" après normalisation

---

### 6. `planteurs-import-large.csv`
**Description:** Fichier CSV avec 30 planteurs  
**Format:** Virgule (,) comme délimiteur  
**Contenu:** 30 planteurs avec données complètes  
**Usage:** Test de performance et import en masse

**Caractéristiques:**
- CNI séquentiels (CI001 à CI030)
- Téléphones séquentiels
- Superficies variées (3.3 à 8.6 hectares)

---

## Format CSV Attendu

### En-têtes Requis
```csv
nom,prénoms,CNI,téléphone,superficie
```

### Règles de Validation

1. **nom** (REQUIS)
   - Non vide
   - Maximum 200 caractères
   - Sera normalisé (minuscules, sans accents, espaces trimés)

2. **prénoms** (OPTIONNEL)
   - Maximum 200 caractères

3. **CNI** (OPTIONNEL)
   - Alphanumerique uniquement
   - Entre 1 et 50 caractères
   - Exemple: CI123456789

4. **téléphone** (OPTIONNEL)
   - Format international recommandé: +225XXXXXXXXXX
   - Peut contenir: chiffres, espaces, +, -, ()

5. **superficie** (OPTIONNEL)
   - Nombre positif
   - En hectares
   - Exemples: 5.5, 3.2, 7.8

---

## Délimiteurs Supportés

Le système détecte automatiquement:
- **Virgule (,)** - Format US/International
- **Point-virgule (;)** - Format Européen

---

## Encodages Supportés

- **UTF-8** (recommandé)
- **Latin-1** (ISO-8859-1)

---

## Exemples d'Utilisation

### Test Basique
```bash
# Utiliser planteurs-import-valid.csv
# Résultat attendu: 10 planteurs créés avec succès
```

### Test avec Erreurs
```bash
# Utiliser planteurs-import-with-errors.csv
# Résultat attendu: 
# - 3 lignes valides (lignes 1, 7)
# - 4 lignes invalides avec messages d'erreur
# - Import bloqué jusqu'à correction des erreurs
```

### Test de Doublons
```bash
# 1. Importer planteurs-import-valid.csv
# 2. Réimporter le même fichier
# Résultat attendu: 
# - Détection de 10 doublons
# - Options: Ignorer / Mettre à jour / Créer quand même
```

### Test de Normalisation
```bash
# 1. Importer planteurs-import-valid.csv (Konan)
# 2. Importer planteurs-import-accents.csv (Kônàn)
# Résultat attendu:
# - "Kônàn" détecté comme doublon de "Konan"
# - Grâce à la normalisation des noms
```

---

## Notes Importantes

1. **Première ligne = En-têtes**
   - La première ligne est toujours considérée comme les en-têtes
   - Elle ne sera pas importée comme donnée

2. **Ordre des Colonnes**
   - L'ordre des colonnes n'a pas d'importance
   - Le système mappe automatiquement par nom de colonne

3. **Colonnes Supplémentaires**
   - Les colonnes non reconnues sont ignorées
   - Pas d'erreur si colonnes supplémentaires présentes

4. **Taille Maximale**
   - Fichier: 10 MB maximum
   - Lignes: 10,000 lignes maximum recommandé

---

## Dépannage

### Erreur: "CSV file is empty"
- Vérifier que le fichier contient au moins une ligne de données (en plus des en-têtes)

### Erreur: "Missing required columns: nom"
- Vérifier que la première ligne contient bien "nom" comme en-tête

### Erreur: "Unable to read file"
- Vérifier l'encodage du fichier (UTF-8 ou Latin-1)
- Vérifier que le fichier n'est pas corrompu

### Erreur: "File too large"
- Réduire le nombre de lignes
- Diviser en plusieurs fichiers de moins de 10 MB

---

## Création de Vos Propres Fichiers

### Excel / LibreOffice Calc
1. Créer un tableau avec les colonnes: nom, prénoms, CNI, téléphone, superficie
2. Remplir les données
3. Enregistrer sous → CSV (UTF-8)

### Google Sheets
1. Créer un tableau avec les colonnes
2. Fichier → Télécharger → Valeurs séparées par des virgules (.csv)

### Éditeur de Texte
1. Créer un fichier .csv
2. Première ligne: nom,prénoms,CNI,téléphone,superficie
3. Lignes suivantes: données séparées par des virgules
4. Enregistrer en UTF-8
