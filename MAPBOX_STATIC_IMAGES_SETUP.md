# Mapbox Static Images API - Configuration et Utilisation

## Vue d'ensemble

L'**API Mapbox Static Images** génère des images PNG haute résolution des parcelles de cacao avec overlay satellite. Parfait pour les rapports, présentations et exports.

## Fonctionnalités

✅ **Mondial** : Fonctionne partout (Cameroun inclus)  
✅ **Instantané** : Génération en < 1 seconde  
✅ **Haute résolution** : Jusqu'à 1280x1280 pixels + @2x Retina  
✅ **Overlay automatique** : Parcelles dessinées avec couleurs de conformité  
✅ **Gratuit** : 50,000 images/mois incluses  
✅ **Simple** : Pas de polling, pas d'attente  

## Configuration

### 1. Créer un compte Mapbox

1. Aller sur [Mapbox](https://account.mapbox.com/auth/signup/)
2. Créer un compte gratuit
3. Vérifier votre email

### 2. Obtenir un Access Token

1. Aller sur [Access Tokens](https://account.mapbox.com/access-tokens/)
2. Copier votre **Default public token**
3. Ou créer un nouveau token avec les scopes :
   - `styles:tiles` (requis)
   - `styles:read` (requis)

### 3. Configurer l'environnement

Ajouter dans `.env.local` :

```bash
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbHh4eHh4eHgifQ.xxxxxxxxxxxxx
```

⚠️ **Important** : Le token doit commencer par `pk.` (public token)

### 4. Vérifier la configuration

```bash
# Démarrer le serveur
pnpm dev

# Aller sur une parcelle
# Cliquer sur "Image Satellite"
# L'image devrait s'afficher instantanément
```

## Utilisation

### Dans l'interface

1. Aller sur la page de détail d'une parcelle
2. Cliquer sur **"Image Satellite"** (bouton bleu)
3. L'image s'affiche instantanément dans un modal
4. Télécharger en Standard (800x600) ou HD (1280x960)

### Comportement

- **Instantané** : Pas d'attente, image générée en temps réel
- **Cache navigateur** : Images mises en cache 24h
- **Couleurs automatiques** : Basées sur le statut de conformité
- **Formats disponibles** :
  - Standard : 800x600 pixels
  - HD : 1280x960 pixels
  - Retina @2x : Double résolution pour écrans haute densité

## Architecture Technique

### API Route

**GET /api/parcelles/[id]/static-image**

Query parameters :
- `width` : Largeur (défaut: 800, max: 1280)
- `height` : Hauteur (défaut: 600, max: 1280)
- `retina` : @2x pour Retina (défaut: true)
- `style` : Style de carte (défaut: satellite-v9)

Exemple :
```
GET /api/parcelles/abc123/static-image?width=1280&height=960&retina=true
```

### Composant UI

**StaticImageButton.tsx**
- Bouton "Image Satellite" pour visualiser
- Bouton "Download" pour téléchargement rapide
- Modal avec preview et options de téléchargement
- Gestion d'erreurs

### Format de l'URL Mapbox

```
https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/
  geojson({
    "type": "Feature",
    "geometry": {...},
    "properties": {
      "stroke": "%236FAF3D",
      "stroke-width": 3,
      "fill": "%236FAF3D",
      "fill-opacity": 0.35
    }
  })/auto/800x600@2x?access_token=xxx
```

### Couleurs par statut

Les parcelles sont colorées selon leur statut de conformité :

| Statut | Couleur | Hex |
|--------|---------|-----|
| Conforme | Vert | #6FAF3D |
| En cours | Orange | #E68A1F |
| Non conforme | Rouge | #ef4444 |
| Infos manquantes | Gris | #9ca3af |

## Cas d'usage

### 1. Rapports PDF
Générer des images pour inclure dans les rapports de conformité.

```typescript
// Exemple : Générer image pour rapport
const imageUrl = `/api/parcelles/${parcelleId}/static-image?width=1280&height=960`;
// Utiliser dans un PDF generator
```

### 2. Présentations
Télécharger des images HD pour PowerPoint/Google Slides.

### 3. Exports Excel
Inclure des miniatures de parcelles dans les exports.

### 4. Emails
Envoyer des images de parcelles aux planteurs.

### 5. Archives
Sauvegarder des snapshots des parcelles à une date donnée.

## Limites et Quotas

### Gratuit (Tier Free)
- **50,000 requêtes/mois** incluses
- Parfait pour usage normal
- Pas de carte de crédit requise

### Payant (au-delà)
- **$0.50 pour 1000 images** supplémentaires
- Soit $0.0005 par image
- Très abordable

### Limites techniques
- **Taille max** : 1280x1280 pixels
- **Format** : PNG (avec transparence)
- **GeoJSON max** : 8192 caractères dans l'URL
- **Cache** : 24 heures côté client

### Recommandations
- Utiliser le cache navigateur efficacement
- Générer à la demande (pas de pré-génération)
- Utiliser @2x uniquement si nécessaire

## Styles de carte disponibles

Mapbox propose plusieurs styles :

| Style | ID | Description |
|-------|-----|-------------|
| Satellite | `satellite-v9` | Images satellite (défaut) |
| Streets | `streets-v12` | Carte routière |
| Outdoors | `outdoors-v12` | Carte topographique |
| Light | `light-v11` | Carte claire |
| Dark | `dark-v11` | Carte sombre |

Pour changer le style :
```
/api/parcelles/[id]/static-image?style=streets-v12
```

## Monitoring

### Vérifier l'usage

1. Aller sur [Mapbox Dashboard](https://account.mapbox.com/)
2. **Statistics** > **API Usage**
3. Voir "Static Images API" requests

### Alertes

Configurer des alertes email :
1. **Account** > **Notifications**
2. Activer "Usage threshold alerts"
3. Définir seuil : 45,000 requêtes (90% du quota)

## Dépannage

### Erreur "Invalid access token"
```bash
# Vérifier que le token commence par pk.
# Vérifier qu'il est bien dans .env.local
# Redémarrer le serveur : pnpm dev
```

### Image ne s'affiche pas
```bash
# Vérifier la console navigateur pour erreurs
# Vérifier que la parcelle a une géométrie valide
# Tester l'URL directement dans le navigateur
```

### Erreur "Request too long"
```bash
# La géométrie de la parcelle est trop complexe
# Solution : Simplifier la géométrie avant l'envoi
# Ou utiliser un style personnalisé dans Mapbox Studio
```

### Quota dépassé
```bash
# Vérifier l'usage dans Mapbox Dashboard
# Attendre le mois prochain
# Ou activer la facturation pour payer au-delà
```

## Optimisations

### 1. Cache côté serveur
Actuellement, les images sont générées à la demande. Pour optimiser :

```typescript
// Sauvegarder l'image dans Supabase Storage
// Servir depuis le storage au lieu de régénérer
```

### 2. Simplification de géométrie
Pour les parcelles très complexes :

```typescript
// Utiliser turf.js pour simplifier
import { simplify } from '@turf/turf';
const simplified = simplify(geometry, { tolerance: 0.0001 });
```

### 3. Styles personnalisés
Créer un style dans Mapbox Studio avec les parcelles pré-chargées.

## Comparaison avec alternatives

| Feature | Mapbox Static | Google Static | Leaflet Screenshot |
|---------|---------------|---------------|-------------------|
| Cameroun | ✅ | ✅ | ✅ |
| Gratuit | 50k/mois | 25k/mois | Illimité |
| Qualité | Excellente | Excellente | Moyenne |
| Vitesse | < 1s | < 1s | 2-3s |
| Overlay | GeoJSON | Polyline | Canvas |
| Retina | ✅ | ✅ | ❌ |

## Exemples de code

### Générer une image simple
```typescript
const imageUrl = `/api/parcelles/${parcelleId}/static-image`;
```

### Générer une image HD
```typescript
const imageUrl = `/api/parcelles/${parcelleId}/static-image?width=1280&height=960&retina=true`;
```

### Télécharger programmatiquement
```typescript
const response = await fetch(`/api/parcelles/${parcelleId}/static-image?width=1280&height=960`);
const blob = await response.blob();
const url = URL.createObjectURL(blob);
// Utiliser l'URL pour téléchargement ou affichage
```

### Inclure dans un email
```typescript
// Générer l'image
const imageUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/parcelles/${parcelleId}/static-image`;

// Dans le template email
<img src="${imageUrl}" alt="Parcelle ${code}" />
```

## Fichiers créés

- `app/api/parcelles/[id]/static-image/route.ts` - API route
- `components/parcelles/StaticImageButton.tsx` - Composant UI
- `.env.local.example` - Variable d'environnement ajoutée
- `MAPBOX_STATIC_IMAGES_SETUP.md` - Cette documentation

## Support

Pour plus d'informations :
- [Documentation Mapbox Static Images](https://docs.mapbox.com/api/maps/static-images/)
- [Pricing](https://www.mapbox.com/pricing)
- [Mapbox Studio](https://studio.mapbox.com/)

---

**Status** : ✅ Prêt pour production  
**Testé** : ⏳ À tester avec token Mapbox  
**Date** : 28 Avril 2026
