# Fix: Rafraîchissement Automatique des Badges de Santé

## Date
2026-05-04

## Problème
Après avoir cliqué sur "Calculer la santé" et que le calcul batch se termine avec succès, les badges de santé dans la colonne "Santé" ne s'affichaient pas automatiquement. L'utilisateur devait rafraîchir manuellement la page (F5) pour voir les nouveaux badges.

## Cause
Le composant `ParcelleTable` utilise le hook `useParcelleHealthStatus` qui ne se rafraîchissait pas automatiquement après le calcul batch. Le hook gardait les anciennes données en cache même après que de nouvelles données NDVI aient été calculées et stockées en base de données.

## Solution Implémentée

### 1. Ajout d'un State `tableKey` dans la Page Parcelles
**Fichier**: `app/(dashboard)/parcelles/page.tsx`

Ajout d'un state pour forcer le remontage du composant `ParcelleTable`:

```typescript
// Key to force re-render of ParcelleTable after batch calculation
const [tableKey, setTableKey] = useState(0);
```

### 2. Rafraîchissement Automatique après Calcul Batch
**Fichier**: `app/(dashboard)/parcelles/page.tsx`

Ajout d'un `useEffect` qui détecte la fin du calcul batch et force le rafraîchissement:

```typescript
// Auto-refresh after successful batch calculation
useEffect(() => {
  if (result && result.successful > 0 && !calculating) {
    // Force refresh of the page to reload health status
    fetchParcelles();
    // Force re-render of ParcelleTable to refresh health status
    setTableKey(prev => prev + 1);
  }
}, [result, calculating, fetchParcelles]);
```

**Logique**:
- Attend que le calcul soit terminé (`!calculating`)
- Vérifie qu'au moins une parcelle a été calculée avec succès (`result.successful > 0`)
- Rafraîchit la liste des parcelles (`fetchParcelles()`)
- Incrémente `tableKey` pour forcer le remontage du composant `ParcelleTable`

### 3. Ajout de la Prop `key` au Composant ParcelleTable
**Fichier**: `app/(dashboard)/parcelles/page.tsx`

```typescript
<ParcelleTable
  key={tableKey}  // ← Force le remontage quand tableKey change
  parcelles={data?.data || []}
  loading={loading}
  sortConfig={sortConfig}
  onSortChange={handleSortChange}
  // ... autres props
/>
```

**Effet**:
- Quand `tableKey` change, React démonte complètement le composant `ParcelleTable`
- Le composant est remonté avec un nouveau hook `useParcelleHealthStatus`
- Le nouveau hook récupère les données NDVI fraîches depuis l'API
- Les badges de santé s'affichent automatiquement

## Flux de Fonctionnement

1. **Utilisateur clique sur "Calculer la santé"**
   - Le calcul batch démarre
   - Barre de progression affichée

2. **Calcul en cours**
   - Les parcelles sont traitées en parallèle
   - Les résultats NDVI sont stockés en base de données

3. **Calcul terminé avec succès**
   - `result.successful > 0` devient vrai
   - `calculating` devient faux
   - Le `useEffect` se déclenche

4. **Rafraîchissement automatique**
   - `fetchParcelles()` recharge la liste des parcelles
   - `setTableKey(prev => prev + 1)` incrémente la clé
   - React démonte et remonte `ParcelleTable`
   - Le hook `useParcelleHealthStatus` récupère les nouvelles données
   - Les badges de santé apparaissent automatiquement

## Avantages de cette Approche

1. **Pas de rafraîchissement manuel**: L'utilisateur voit immédiatement les résultats
2. **Propre et React-friendly**: Utilise le mécanisme de `key` de React
3. **Pas de polling**: Pas besoin de vérifier périodiquement les changements
4. **Performant**: Ne rafraîchit que quand nécessaire (après un calcul réussi)

## Alternative Considérée (Non Retenue)

Nous avons d'abord envisagé d'ajouter un `refetch()` dans le hook `useParcelleHealthStatus` et de l'appeler après le calcul. Cette approche a été abandonnée car:
- Plus complexe à implémenter
- Nécessite de passer `refetch` à travers plusieurs composants
- Le mécanisme de `key` est plus idiomatique en React

## Test

Pour tester que le fix fonctionne:

1. Aller sur `/parcelles`
2. Vérifier que la colonne "Santé" affiche "Pas de données"
3. Cliquer sur "Calculer la santé"
4. Attendre la fin du calcul (barre de progression à 100%)
5. **Vérifier que les badges de santé apparaissent AUTOMATIQUEMENT** sans rafraîchir la page
6. Les badges doivent afficher: Excellent (vert foncé), Good (vert), Fair (jaune), Poor (orange), ou Critical (rouge)

## Fichiers Modifiés

1. `app/(dashboard)/parcelles/page.tsx`
   - Ajout du state `tableKey`
   - Ajout du `useEffect` pour le rafraîchissement automatique
   - Ajout de la prop `key={tableKey}` sur `ParcelleTable`

## Notes Techniques

- **React Key**: Changer la `key` d'un composant force React à le démonter et le remonter complètement
- **useEffect Dependencies**: Le `useEffect` dépend de `result`, `calculating`, et `fetchParcelles`
- **Condition de Rafraîchissement**: Ne rafraîchit que si au moins une parcelle a été calculée avec succès

## Résultat

✅ Les badges de santé s'affichent maintenant automatiquement après le calcul batch, sans besoin de rafraîchir la page manuellement!
