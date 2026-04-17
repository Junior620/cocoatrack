# Fichiers de Test - Import Planteurs CSV

## Colonnes Attendues

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
