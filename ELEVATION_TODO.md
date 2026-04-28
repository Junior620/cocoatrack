# Élévation - Tâches Restantes

## ✅ Déjà fait
1. Migration SQL appliquée dans Supabase
2. API route créée (`/api/parcelles/[id]/elevation`)
3. Documentation complète

## 🔄 À faire maintenant

### 1. Afficher l'élévation dans la page de détail

Dans `app/(dashboard)/parcelles/[id]/page.tsx`, après la ligne 463 (après `<DetailRow label="Surface"...`), ajouter:

```tsx
{/* Elevation and Slope */}
{parcelle.elevation_meters && (
  <>
    <DetailRow 
      label="Altitude" 
      value={`${parcelle.elevation_meters} m`}
      className={
        parcelle.elevation_meters < 200 || parcelle.elevation_meters > 800
          ? 'text-orange-600'
          : 'text-green-600'
      }
    />
    {parcelle.slope_percent && (
      <DetailRow 
        label="Pente" 
        value={`${parcelle.slope_percent}%`}
        className={
          parcelle.slope_percent > 30
            ? 'text-red-600'
            : parcelle.slope_percent > 15
            ? 'text-orange-600'
            : 'text-green-600'
        }
      />
    )}
  </>
)}
```

### 2. Ajouter le bouton "Calculer Élévation"

Dans la même page, dans la section des boutons (après le bouton "Archiver"), ajouter:

```tsx
{/* Calculate Elevation Button */}
{canEdit && parcelle.is_active && (
  <button
    onClick={handleCalculateElevation}
    disabled={calculatingElevation}
    className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
  >
    {calculatingElevation ? (
      <>
        <LoadingSpinner className="mr-2 h-4 w-4" />
        Calcul en cours...
      </>
    ) : (
      <>
        <MountainIcon className="mr-2 h-4 w-4" />
        {parcelle.elevation_meters ? 'Recalculer Élévation' : 'Calculer Élévation'}
      </>
    )}
  </button>
)}
```

### 3. Ajouter la fonction handleCalculateElevation

Dans le composant, ajouter:

```tsx
const [calculatingElevation, setCalculatingElevation] = useState(false);

const handleCalculateElevation = async () => {
  if (!parcelle) return;
  
  setCalculatingElevation(true);
  setError(null);
  
  try {
    const response = await fetch(`/api/parcelles/${parcelleId}/elevation`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error('Erreur lors du calcul de l\'élévation');
    }
    
    const result = await response.json();
    
    // Refresh parcelle data to show new elevation
    await fetchParcelle();
    
    // Show success message
    alert(`Élévation calculée avec succès!\n\nAltitude: ${result.data.elevation_meters}m\nPente: ${result.data.slope_percent}%\nMin: ${result.data.min_elevation}m\nMax: ${result.data.max_elevation}m`);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Erreur lors du calcul de l\'élévation');
  } finally {
    setCalculatingElevation(false);
  }
};
```

### 4. Ajouter l'icône MountainIcon

En haut du fichier, ajouter:

```tsx
import { Mountain as MountainIcon } from 'lucide-react';
```

### 5. Mettre à jour le type Parcelle

Dans `types/parcelles.ts`, ajouter les champs:

```tsx
export interface Parcelle {
  // ... existing fields
  elevation_meters?: number | null;
  slope_percent?: number | null;
  elevation_calculated_at?: string | null;
}
```

## 🎯 Test

1. Ouvrir une parcelle: http://localhost:3000/parcelles/{ID}
2. Cliquer sur "Calculer Élévation"
3. Attendre ~2-3 secondes
4. Voir l'altitude et la pente s'afficher

## 📊 Interprétation

- **Altitude optimale cacao**: 200-800m (vert)
- **Altitude < 200m ou > 800m**: Orange (qualité réduite)
- **Pente < 15%**: Vert (facile)
- **Pente 15-30%**: Orange (attention érosion)
- **Pente > 30%**: Rouge (risque élevé)

## 💰 Coût

- 1 parcelle = 1 requête API
- Quota gratuit: 5,000/mois
- 238 parcelles = bien en dessous du quota

## ⏭️ Améliorations futures

1. Bouton "Calculer toutes les élévations" dans la liste
2. Filtres par altitude/pente
3. Graphique de profil d'élévation
4. Alertes automatiques pour parcelles à risque
