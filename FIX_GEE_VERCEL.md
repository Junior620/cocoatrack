# 🔧 Fix Google Earth Engine Authentication on Vercel

## Problème

Erreur en production :
```
Error: error:1E08010C:DECODER routines::unsupported
GEE authentication failed
```

Cela signifie que la clé privée Google n'est pas correctement formatée sur Vercel.

## Solution Rapide

### Étape 1 : Formater la clé correctement

Utilise le script fourni pour extraire et formater ta clé :

```bash
# Remplace le chemin par celui de ton fichier JSON Google
node scripts/format-gee-key.js ~/Downloads/ste-scpb-xxxxx.json
```

Le script va afficher 3 valeurs à copier :
1. `GOOGLE_EARTH_ENGINE_PROJECT_ID`
2. `GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT`
3. `GOOGLE_EARTH_ENGINE_PRIVATE_KEY`

### Étape 2 : Mettre à jour sur Vercel

1. Va sur https://vercel.com/dashboard
2. Sélectionne ton projet CocoaTrack
3. Va dans **Settings** → **Environment Variables**
4. Pour chaque variable :
   - Clique sur **Edit** (ou **Add** si elle n'existe pas)
   - Colle la valeur affichée par le script
   - Sélectionne **Production, Preview, Development** (les 3)
   - Sauvegarde

### Étape 3 : Redéployer

Après avoir mis à jour les variables :

```bash
# Option 1 : Depuis Vercel dashboard
# Clique sur "Redeploy" sur le dernier déploiement

# Option 2 : Force un nouveau déploiement
git commit --allow-empty -m "chore: trigger redeploy for GEE config"
git push
```

## Points Critiques

### ✅ Format Correct de la Clé Privée

La clé doit être sur **UNE SEULE LIGNE** avec des `\n` littéraux :

```
"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----\n"
```

### ❌ Format Incorrect

Ne pas mettre de vrais retours à la ligne :

```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...
-----END PRIVATE KEY-----
```

## Vérification

Après le redéploiement :

1. Va sur ton site en production
2. Essaie d'accéder à une parcelle avec données satellite
3. Vérifie que l'imagerie se charge correctement
4. Regarde les logs Vercel pour confirmer qu'il n'y a plus d'erreur d'authentification

## Fichiers Créés

- `scripts/format-gee-key.js` - Script pour formater la clé
- `scripts/gee-credentials.txt` - Fichier temporaire avec les valeurs (à supprimer après usage)

## Sécurité

⚠️ **IMPORTANT** :
- Ne commite JAMAIS le fichier JSON de service account
- Supprime `scripts/gee-credentials.txt` après avoir copié les valeurs
- Les variables Vercel sont chiffrées et sécurisées

## Besoin d'Aide ?

Si l'erreur persiste après ces étapes :

1. Vérifie que le service account a bien accès à l'API Earth Engine
2. Vérifie que le projet Google Cloud a l'API Earth Engine activée
3. Regarde les logs Vercel pour plus de détails sur l'erreur
4. Contacte le support si nécessaire

## Ressources

- [Guide complet de déploiement](docs/deployment/vercel-gee-setup.md)
- [Documentation Google Earth Engine](https://developers.google.com/earth-engine/guides/service_account)
- [Documentation Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
