# Rapport de Session — 13 Mai 2026

## Projet : CocoaTrack V2
## Sujet : Correction de l'affichage des tuiles satellite GEE dans Leaflet

---

## 1. Contexte et problème initial

La route `/api/satellite/imagery` retournait bien un **200 OK**, le cache mémoire fonctionnait (plus d'appel `getMapId` répété), mais les **tuiles Sentinel-2 ne s'affichaient pas** dans la carte Leaflet.

### Symptômes observés
- Route imagery → 200, mais carte vide
- Log `[ImageryService] Tile URL (direct)` absent → cache mémoire retournait l'ancienne valeur
- Aucune tuile visible dans le navigateur

---

## 2. Diagnostic — Identification des causes racines

### Cause 1 — Déclaration dupliquée (erreur de compilation silencieuse)

Dans `app/api/satellite/tiles/[mapId]/[z]/[x]/[y]/route.ts`, la constante `GEE_TILES_BASE` était déclarée **deux fois** :

```typescript
const GEE_TILES_BASE = 'https://earthengine.googleapis.com/v1'; // ligne 14
// ...
const GEE_TILES_BASE = 'https://earthengine.googleapis.com/v1'; // ligne 22 — DOUBLON
```

Turbopack (Next.js 16) peut gérer ce cas sans crash visible, mais le comportement est indéfini.

---

### Cause 2 — CORS : URL GEE retournée directement au navigateur

Le SDK GEE (version récente) retourne un `urlFormat` dans `getMapId()` au lieu du couple `mapid + token` legacy. Le code précédent détectait ce cas et retournait l'URL GEE **directement** à Leaflet :

```typescript
// AVANT — INCORRECT
if (urlFormat && !token) {
  return urlFormat; // URL earthengine.googleapis.com → bloquée par CORS
}
```

Le navigateur ne peut pas charger directement `https://earthengine.googleapis.com/v1/...` — les requêtes cross-origin sont bloquées par la politique CORS de Google.

---

### Cause 3 — Cache périmé avec ancienne URL invalide

Le singleton `imageryService` maintient un **cache mémoire** (6h TTL) et un **cache Redis**. La route API vérifie aussi un **cache DB** (`satellite_imagery` table, 24h TTL).

Ces trois niveaux de cache contenaient l'ancienne `tileUrl` (soit une URL proxy cassée, soit une URL GEE directe). Même après correction du code, les caches retournaient l'ancienne valeur invalide.

---

### Cause 4 — Slashes dans le mapId et routing Next.js 16

Le path GEE complet ressemble à :
```
projects/earthengine-legacy/maps/97e7b774b33cb655b7aec0f6cb8d3620-3eae274238172f4d...
```

Dans Next.js 15+, les segments dynamiques `[mapId]` **normalisent les `%2F`** (slashes encodés) en `/`, ce qui casse le routing — le path serait interprété comme plusieurs segments au lieu d'un seul.

---

## 3. Architecture de la solution

### Vue d'ensemble du pipeline tuiles (après correction)

```
Navigateur (Leaflet)
        │
        │  GET /api/satellite/tiles/{base64url_mapId}/{z}/{x}/{y}
        ▼
┌─────────────────────────────────────────────────────┐
│  Next.js API Route (proxy)                          │
│  app/api/satellite/tiles/[mapId]/[z]/[x]/[y]/       │
│                                                     │
│  1. Décode base64url → GEE map path                 │
│  2. Génère/réutilise token OAuth (service account)  │
│  3. Fetch GEE côté serveur (pas de CORS)            │
│  4. Retourne l'image PNG au navigateur              │
└─────────────────────────────────────────────────────┘
        │
        │  GET https://earthengine.googleapis.com/v1/
        │      projects/.../maps/{mapId}/tiles/{z}/{x}/{y}
        │  Authorization: Bearer {oauth_token}
        ▼
   Google Earth Engine API
   (Sentinel-2 imagery)
```

### Flux complet de génération d'une imagery

```
LeafletMap.tsx
  │
  │  GET /api/satellite/imagery?parcelleId=...
  ▼
imagery/route.ts
  │  1. Auth Supabase
  │  2. Vérifie cache DB (satellite_imagery table)
  │     → Skip si tileUrl n'est pas une URL proxy (/api/satellite/tiles/...)
  │  3. Appelle imageryService.getImagery()
  ▼
ImageryService.getImagery()
  │  1. Vérifie cache mémoire → invalide si URL non-proxifiée
  │  2. Vérifie cache Redis → invalide si URL non-proxifiée
  │  3. getAvailableDates() via SDK GEE (fenêtre progressive 30/60/90j)
  │  4. generateTileUrl() → generateAndCacheTiles() → getGEEMapId()
  ▼
ImageryService.getGEEMapId()
  │  SDK GEE : image.getMapId({}, callback)
  │  Résultat : { mapid, token, urlFormat, ... }
  │
  │  Cas A (SDK récent) : urlFormat présent, token vide
  │    → retourne "DIRECT|||https://earthengine.googleapis.com/v1/..."
  │
  │  Cas B (SDK legacy) : mapid + token
  │    → retourne "mapid|||token"
  ▼
ImageryService.createTileUrlTemplate()
  │
  │  Cas A : extrait le GEE map path depuis urlFormat
  │    → encode en base64url
  │    → retourne "/api/satellite/tiles/{base64url}/{z}/{x}/{y}"
  │
  │  Cas B : encode mapid en base64url
  │    → retourne "/api/satellite/tiles/{base64url}/{z}/{x}/{y}?token=..."
  ▼
  tileUrl = "/api/satellite/tiles/cHJvamVjd.../{z}/{x}/{y}"
  (URL relative, proxy Next.js, pas de CORS)
```

---

## 4. Corrections apportées — Fichiers modifiés

### 4.1 `app/api/satellite/tiles/[mapId]/[z]/[x]/[y]/route.ts`

**Corrections :**
- Suppression du doublon `const GEE_TILES_BASE`
- Refactorisation : extraction de la logique fetch dans `fetchAndProxyTile()`
- Décodage base64url du `mapId` avec fallback percent-encoding pour rétrocompatibilité
- Log de debug : `[Tile Proxy] Serving tile {z}/{x}/{y} for mapId: ...`

```typescript
// Décodage robuste du mapId
let decodedMapId: string;
try {
  const decoded = Buffer.from(encodedMapId, 'base64url').toString('utf8');
  if (decoded.includes('projects/') || decoded.includes('maps/')) {
    decodedMapId = decoded; // base64url valide
  } else {
    decodedMapId = decodeURIComponent(encodedMapId); // fallback legacy
  }
} catch {
  decodedMapId = decodeURIComponent(encodedMapId);
}
```

---

### 4.2 `lib/satellite/services/imagery.service.ts`

**Corrections :**

**a) `createTileUrlTemplate()` — toujours proxifier**

```typescript
// AVANT
if (mapId.startsWith('DIRECT|||')) {
  return directUrl; // URL GEE directe → CORS ❌
}

// APRÈS
if (mapId.startsWith('DIRECT|||')) {
  // Extraire le GEE map path depuis l'urlFormat
  const match = urlFormat.match(/\/v1\/(projects\/[^/]+\/maps\/[^/]+)\/tiles/);
  if (match) {
    const geeMapPath = match[1];
    const encodedMapId = Buffer.from(geeMapPath).toString('base64url');
    return `/api/satellite/tiles/${encodedMapId}/{z}/{x}/{y}`; // proxy ✅
  }
}
```

**b) Encodage base64url pour les deux cas (DIRECT et legacy)**

```typescript
// Les slashes dans le mapId sont encodés en base64url
// pour éviter les problèmes de routing Next.js 16
const encodedMapId = Buffer.from(geeMapPath).toString('base64url');
```

**c) Invalidation automatique du cache périmé**

```typescript
private isTileUrlValid(tileUrl: string): boolean {
  // Valide uniquement si proxifié via notre API
  return tileUrl.startsWith('/api/satellite/tiles/');
}

// Dans getImagery() :
const memCached = this.imageryCache.get(cacheKey);
if (memCached && !this.isTileUrlValid(memCached.imagery.tileUrl)) {
  this.imageryCache.delete(cacheKey); // invalide l'ancienne URL directe
}
```

**d) Méthode `clearImageryCache()` exposée publiquement**

```typescript
clearImageryCache(): void {
  this.imageryCache.clear();
}
```

---

### 4.3 `app/api/satellite/imagery/route.ts`

**Correction :** Le cache DB est ignoré si le `tile_url` stocké est une URL GEE directe.

```typescript
// AVANT
if (cacheAge < cacheMaxAge) { ... }

// APRÈS
const isProxiedUrl = cachedImagery.tile_url.startsWith('/api/satellite/tiles/');
if (cacheAge < cacheMaxAge && isProxiedUrl) { ... }
```

---

### 4.4 `components/parcelles/LeafletMap.tsx`

**Ajout :** Log de debug pour confirmer l'URL reçue et l'ajout du TileLayer.

```typescript
console.log('[LeafletMap] tileUrl received:', data.imagery.tileUrl.substring(0, 120));
// ...
console.log('[LeafletMap] Adding satellite TileLayer with URL:', satelliteTileUrl.substring(0, 120));
```

---

## 5. Résultat

### Logs serveur après correction

```
[ImageryService] urlFormat available — will proxy via Next.js (avoids CORS)
[ImageryService] mapid=projects/earthengine-legacy/maps/97e7b774..., token=empty, urlFormat=present
[ImageryService] Proxying via /api/satellite/tiles/projects/.../maps/97e7b774.../{z}/{x}/{y}
[Tile Proxy] Serving tile 16/18267/32591 for mapId: projects/earthengine-legacy/maps/97e7b774...
GET /api/satellite/tiles/cHJvamVjd.../16/18267/32591 200 in 3.2s
GET /api/satellite/tiles/cHJvamVjd.../16/18268/32591 200 in 3.3s
...
```

### Résultat visuel

Les tuiles Sentinel-2 s'affichent correctement dans Leaflet sur la carte des parcelles, avec :
- Imagerie vraie couleur (RGB : B4/B3/B2)
- Slider d'opacité fonctionnel (75% par défaut)
- Attribution "© Sentinel-2 via Google Earth Engine"
- Tuiles chargées via le proxy Next.js (pas de CORS)

---

## 6. Points techniques notables

| Aspect | Détail |
|--------|--------|
| SDK GEE version | Retourne `urlFormat` (token embarqué) au lieu de `mapid + token` legacy |
| Encodage mapId | base64url — évite les slashes dans les segments dynamiques Next.js |
| Cache invalidation | Automatique à la lecture si `tileUrl` ne commence pas par `/api/satellite/tiles/` |
| Token OAuth | Généré par le proxy côté serveur, caché 50 min, jamais exposé au navigateur |
| Fallback tuiles | PNG transparent 1×1 retourné si GEE renvoie 404 (tuile hors zone) |
| Fenêtre de recherche | Progressive : 30j (cloud<20%) → 60j (cloud<40%) → 90j (cloud<80%) |

---

## 7. État du système en fin de session

- ✅ Imagerie satellite Sentinel-2 opérationnelle dans Leaflet
- ✅ Proxy tuiles GEE fonctionnel (base64url + OAuth serveur)
- ✅ Cache mémoire, Redis et DB avec invalidation automatique
- ✅ Zéro erreur de compilation TypeScript
- ✅ Import Shapefile (ZIP) disponible via `ShapefileUploader`
- ⏳ Import des vraies parcelles (Shapefile) — prochaine étape
