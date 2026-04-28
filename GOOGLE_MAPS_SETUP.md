# Configuration Google Maps pour CocoaTrack

## 📋 Prérequis

Vous avez déjà une clé API Google Maps. Suivez ces étapes pour la configurer dans CocoaTrack.

## 🔧 Configuration

### 1. Ajouter la clé API dans .env.local

```bash
# Copier le fichier d'exemple si ce n'est pas déjà fait
cp .env.local.example .env.local

# Éditer .env.local et ajouter votre clé
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=votre-cle-api-ici
```

### 2. Vérifier les APIs activées dans Google Cloud Console

Assurez-vous que ces APIs sont activées :
- ✅ **Maps JavaScript API** (obligatoire)
- ✅ **Geocoding API** (optionnel, pour recherche d'adresses)
- ✅ **Places API** (optionnel, pour recherche de lieux)

**Lien :** https://console.cloud.google.com/google/maps-apis

### 3. Configurer les restrictions de clé API (Recommandé)

Pour sécuriser votre clé API :

#### Option A : Restriction par domaine (Production)
```
Domaines autorisés :
- https://votre-domaine.com/*
- https://www.votre-domaine.com/*
```

#### Option B : Restriction par IP (Développement)
```
Adresses IP autorisées :
- Votre IP de développement
```

#### Option C : Restriction par API
```
APIs autorisées :
- Maps JavaScript API
- Geocoding API (si utilisé)
```

## 🚀 Utilisation

### Composant MapViewSwitcher (Recommandé)

Permet de basculer entre OpenStreetMap et Google Maps :

```typescript
import { MapViewSwitcher } from '@/components/parcelles';

<MapViewSwitcher
  parcelles={parcelles}
  selectedParcelleId={selectedId}
  onParcelleClick={handleClick}
  height="600px"
  defaultProvider="leaflet" // ou "google"
/>
```

### Composant GoogleMapView (Direct)

Pour utiliser uniquement Google Maps :

```typescript
import { GoogleMapView } from '@/components/parcelles';

<GoogleMapView
  parcelles={parcelles}
  selectedParcelleId={selectedId}
  onParcelleClick={handleClick}
  center={{ lat: 4.0511, lng: 9.7679 }}
  zoom={12}
/>
```

## 📊 Quotas et coûts

### Quotas gratuits (par mois)
- ✅ **Map loads** : ILLIMITÉ
- ✅ **Static Maps** : 10 000
- ✅ **Geocoding** : 40 000

### Après dépassement
- Map loads : $7 par 1000 chargements
- Static Maps : $2 par 1000 images
- Geocoding : $5 par 1000 requêtes

### Estimation CocoaTrack
```
Utilisateurs : 50
Chargements/jour : 200
Chargements/mois : 6 000

Coût estimé : 0 XAF/mois (dans le quota gratuit)
```

## 🎨 Fonctionnalités disponibles

### Vue satellite
```typescript
// Activé par défaut dans GoogleMapView
mapTypeId: 'satellite'
```

### Types de cartes disponibles
- `roadmap` : Carte routière classique
- `satellite` : Vue satellite (par défaut)
- `hybrid` : Satellite + noms de lieux
- `terrain` : Relief et végétation

### Contrôles de carte
- ✅ Zoom (+/-)
- ✅ Type de carte (satellite/routière)
- ✅ Échelle
- ✅ Plein écran
- ❌ Street View (désactivé)
- ❌ Rotation (désactivée)

## 🔍 Dépannage

### Erreur : "Google Maps JavaScript API error: InvalidKeyMapError"
**Solution :** Vérifiez que :
1. La clé API est correcte dans `.env.local`
2. L'API Maps JavaScript est activée
3. La facturation est activée sur votre projet Google Cloud

### Erreur : "This page can't load Google Maps correctly"
**Solution :** Vérifiez les restrictions de domaine/IP de votre clé API

### La carte ne charge pas
**Solution :** Ouvrez la console du navigateur (F12) pour voir les erreurs détaillées

### Parcelles ne s'affichent pas
**Solution :** Vérifiez que les coordonnées sont au format GeoJSON valide

## 📚 Ressources

- [Documentation Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript)
- [Console Google Cloud](https://console.cloud.google.com)
- [Calculateur de prix](https://mapsplatform.google.com/pricing/)
- [Support Google Maps](https://developers.google.com/maps/support)

## 🆘 Support

En cas de problème, vérifiez :
1. La clé API est bien dans `.env.local`
2. Le fichier `.env.local` est à la racine du projet
3. Vous avez redémarré le serveur de développement après modification
4. La console du navigateur pour les erreurs JavaScript

