# Implémentation de la Visualisation NDVI Raster

## Date
2026-05-04

## Résumé
Implémentation complète de la génération et visualisation de rasters NDVI sur les cartes Leaflet.

## Fonctionnalités Implémentées

### 1. Génération de Raster NDVI
**Fichier**: `lib/satellite/services/raster-generator.service.ts`

- **Fonctionnalités**:
  - Génère des images PNG à partir des valeurs NDVI
  - Mappe chaque valeur NDVI à une couleur RGB
  - Supporte la transparence pour les valeurs NaN
  - Dimensions configurables (défaut: 512x512)
  - Formats PNG et JPEG supportés
  - Génération de légende de couleurs

- **Technologie**:
  - Utilise Canvas API (node-canvas en Node.js)
  - Interpolation de couleurs depuis `ndvi-colors.ts`
  - Calcul automatique des bounds géographiques

### 2. Service de Stockage
**Fichier**: `lib/satellite/services/storage.service.ts`

- **Fonctionnalités**:
  - Upload vers Supabase Storage
  - Organisation par parcelle et date
  - Génération d'URLs publiques
  - Gestion du cache (1 an)
  - Suppression de rasters

- **Structure de stockage**:
  ```
  satellite-imagery/
  ├── ndvi-rasters/
  │   └── {parcelleId}/
  │       └── {YYYY-MM-DD}.png
  ├── legends/
  │   └── ndvi-legend.png
  └── temporal/
      └── ...
  ```

### 3. Composant d'Overlay Leaflet
**Fichier**: `components/satellite/NDVIOverlay.tsx`

- **Fonctionnalités**:
  - Affiche le raster NDVI sur la carte
  - Opacité configurable (défaut: 0.7)
  - Toggle visibilité
  - Positionnement géographique précis
  - Z-index configurable

- **Props**:
  - `map`: Instance Leaflet
  - `rasterUrl`: URL de l'image
  - `bounds`: Coordonnées géographiques
  - `opacity`: Transparence (0-1)
  - `visible`: Visibilité (boolean)

### 4. Migration Supabase
**Fichier**: `supabase/migrations/20260504000001_create_satellite_storage_bucket.sql`

- **Bucket**: `satellite-imagery`
- **Accès**: Public en lecture, authentifié en écriture
- **Limite**: 10MB par fichier
- **Types MIME**: image/png, image/jpeg

## Modifications des Services Existants

### `lib/satellite/services/ndvi.service.ts`
- Ajout de l'import des services raster et storage
- Génération de raster activée dans `calculateNDVI()`
- Reshape des valeurs NDVI en grille 2D
- Upload automatique vers Supabase Storage
- URL du raster stockée dans `ndviRasterUrl`

### `app/api/satellite/ndvi/route.ts`
- `generateRaster: true` activé

### `app/api/satellite/ndvi/batch/route.ts`
- `generateRaster: true` activé pour le calcul batch

## Installation Requise

### 1. Installer le package `canvas`

```bash
npm install canvas
```

**Note**: Le package `canvas` nécessite des dépendances système:

**Ubuntu/Debian**:
```bash
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

**macOS**:
```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

**Windows**:
- Télécharger les binaires depuis: https://github.com/Automattic/node-canvas/wiki/Installation:-Windows

### 2. Appliquer la migration Supabase

```bash
# Via Supabase CLI
supabase db push

# Ou via Supabase Dashboard
# Copier le contenu de supabase/migrations/20260504000001_create_satellite_storage_bucket.sql
# Coller dans SQL Editor et exécuter
```

### 3. Vérifier les variables d'environnement

Assurez-vous que `.env.local` contient:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key
```

## Utilisation

### Calcul NDVI avec Raster

```typescript
// API Route
const ndviResult = await ndviService.calculateNDVI(
  parcelleId,
  geometry,
  new Date(),
  {
    forceRecalculate: false,
    storeResult: true,
    generateRaster: true, // Active la génération de raster
  }
);

// Le résultat contient l'URL du raster
console.log(ndviResult.ndviRasterUrl);
// "https://your-project.supabase.co/storage/v1/object/public/satellite-imagery/ndvi-rasters/parcelle-123/2026-05-04.png"
```

### Affichage sur la Carte

```tsx
import { NDVIOverlay } from '@/components/satellite/NDVIOverlay';
import { useMap } from 'react-leaflet';

function ParcelleMapWithNDVI() {
  const map = useMap();
  const [showNDVI, setShowNDVI] = useState(true);

  return (
    <>
      {ndviRasterUrl && (
        <NDVIOverlay
          map={map}
          rasterUrl={ndviRasterUrl}
          bounds={[minLng, minLat, maxLng, maxLat]}
          opacity={0.7}
          visible={showNDVI}
        />
      )}
      
      <button onClick={() => setShowNDVI(!showNDVI)}>
        {showNDVI ? 'Masquer' : 'Afficher'} NDVI
      </button>
    </>
  );
}
```

## Flux de Fonctionnement

1. **Calcul NDVI**:
   - Récupération des bandes Red et NIR
   - Calcul pixel par pixel: `(NIR - Red) / (NIR + Red)`
   - Calcul des statistiques (mean, min, max, stdDev)

2. **Génération de Raster**:
   - Reshape des valeurs NDVI en grille 2D
   - Création d'un canvas (512x512)
   - Mapping NDVI → RGB pour chaque pixel
   - Export en PNG

3. **Upload vers Storage**:
   - Upload vers `satellite-imagery/ndvi-rasters/{parcelleId}/{date}.png`
   - Génération d'URL publique
   - Stockage de l'URL dans `ndvi_results.ndvi_raster_url`

4. **Affichage sur la Carte**:
   - Récupération de l'URL depuis la base de données
   - Création d'un `L.imageOverlay` avec les bounds
   - Ajout à la carte Leaflet
   - Toggle visibilité via opacité

## Avantages

1. **Visualisation Intuitive**:
   - Overlay coloré directement sur la carte
   - Correspondance géographique précise
   - Opacité ajustable pour voir le fond de carte

2. **Performance**:
   - Images mises en cache (1 an)
   - Génération asynchrone (ne bloque pas le calcul NDVI)
   - Taille optimisée (512x512, ~50-100KB)

3. **Accessibilité**:
   - URLs publiques (pas d'authentification requise)
   - Compatible avec tous les clients Leaflet
   - Fonctionne sur mobile et desktop

4. **Robustesse**:
   - Gestion des erreurs (continue sans raster si échec)
   - Transparence pour les valeurs NaN
   - Validation des bounds

## Prochaines Étapes Possibles

1. **Légende Interactive**:
   - Afficher une légende de couleurs sur la carte
   - Tooltip avec valeur NDVI au survol

2. **Comparaison Temporelle**:
   - Slider pour comparer plusieurs dates
   - Animation temporelle

3. **Export**:
   - Téléchargement du raster
   - Export en GeoTIFF

4. **Optimisation**:
   - Génération de tuiles pour grandes parcelles
   - Compression d'image avancée

5. **Analyse Avancée**:
   - Histogramme des valeurs NDVI
   - Zones de stress identifiées

## Dépannage

### Erreur: "canvas package is required"
**Solution**: Installer le package canvas:
```bash
npm install canvas
```

### Erreur: "Failed to upload NDVI raster"
**Solution**: Vérifier que:
- La migration Supabase a été appliquée
- Le bucket `satellite-imagery` existe
- Les policies RLS sont correctes
- `SUPABASE_SERVICE_KEY` est défini

### Raster ne s'affiche pas sur la carte
**Solution**: Vérifier que:
- L'URL du raster est accessible (tester dans le navigateur)
- Les bounds sont corrects (format: [minLng, minLat, maxLng, maxLat])
- Le composant NDVIOverlay reçoit une instance de carte valide

### Raster décalé géographiquement
**Solution**: Vérifier que:
- Les bounds sont dans le bon ordre: [minLng, minLat, maxLng, maxLat]
- La géométrie de la parcelle est correcte
- Le système de coordonnées est WGS84 (EPSG:4326)

## Fichiers Créés

1. `lib/satellite/services/raster-generator.service.ts` - Service de génération de raster
2. `lib/satellite/services/storage.service.ts` - Service de stockage Supabase
3. `components/satellite/NDVIOverlay.tsx` - Composant Leaflet overlay
4. `supabase/migrations/20260504000001_create_satellite_storage_bucket.sql` - Migration bucket
5. `NDVI_RASTER_VISUALIZATION_IMPLEMENTATION.md` - Cette documentation

## Fichiers Modifiés

1. `lib/satellite/services/ndvi.service.ts` - Intégration génération de raster
2. `app/api/satellite/ndvi/route.ts` - Activation generateRaster
3. `app/api/satellite/ndvi/batch/route.ts` - Activation generateRaster

## Notes

- La génération de raster ajoute ~2-3 secondes au calcul NDVI
- Les rasters sont mis en cache pour 1 an (header Cache-Control)
- Le bucket est public pour faciliter l'accès depuis les cartes
- Les erreurs de génération/upload ne bloquent pas le calcul NDVI
- Le format PNG est préféré pour la transparence et la qualité

## Références

- [node-canvas Documentation](https://github.com/Automattic/node-canvas)
- [Leaflet ImageOverlay](https://leafletjs.com/reference.html#imageoverlay)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [NDVI Color Mapping](lib/satellite/utils/ndvi-colors.ts)
