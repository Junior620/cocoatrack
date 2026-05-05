# Implémentation du Calcul NDVI en Batch

## Date
2026-05-04

## Résumé
Ajout d'une fonctionnalité de calcul NDVI en batch pour calculer la santé de toutes les parcelles affichées dans la liste.

## Fichiers Créés

### 1. `/app/api/satellite/ndvi/batch/route.ts`
**Endpoint API pour le calcul NDVI en batch**

- **Route**: `POST /api/satellite/ndvi/batch`
- **Fonctionnalités**:
  - Calcule le NDVI pour plusieurs parcelles en parallèle
  - Limite de concurrence: 5 calculs simultanés
  - Limite de batch: 100 parcelles maximum par requête
  - Utilise le cache si disponible (sauf si `forceRecalculate=true`)
  - Retourne les résultats avec statut succès/échec pour chaque parcelle

- **Request Body**:
  ```json
  {
    "parcelleIds": ["uuid1", "uuid2", ...],
    "date": "2024-01-15T00:00:00Z",  // Optionnel
    "forceRecalculate": false         // Optionnel
  }
  ```

- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "totalRequested": 10,
      "successful": 8,
      "failed": 2,
      "results": [
        {
          "parcelleId": "uuid1",
          "success": true,
          "healthStatus": "good",
          "meanNDVI": 0.65,
          "cached": false
        },
        {
          "parcelleId": "uuid2",
          "success": false,
          "error": "Geometry not found"
        }
      ]
    }
  }
  ```

### 2. `/hooks/satellite/useBatchNDVICalculation.ts`
**Hook React pour gérer le calcul batch côté frontend**

- **Fonctionnalités**:
  - Gère l'état du calcul (en cours, progression, résultats)
  - Divise automatiquement les requêtes en batches de 100 parcelles
  - Affiche la progression en temps réel
  - Gère les erreurs
  - Permet de réinitialiser l'état

- **API du Hook**:
  ```typescript
  const {
    calculating,      // boolean: calcul en cours
    progress,         // number: pourcentage (0-100)
    processed,        // number: parcelles traitées
    total,           // number: total de parcelles
    error,           // string | null: message d'erreur
    result,          // BatchCalculationResult | null: résultat final
    calculate,       // function: démarrer le calcul
    reset,           // function: réinitialiser l'état
  } = useBatchNDVICalculation();
  ```

## Fichiers Modifiés

### 3. `/app/(dashboard)/parcelles/page.tsx`
**Page liste des parcelles - Ajout du bouton de calcul batch**

**Modifications**:
1. Import du hook `useBatchNDVICalculation`
2. Import des icônes `Activity`, `CheckCircle`, `XCircle`
3. Ajout de l'état du calcul batch
4. Ajout de la fonction `handleBatchCalculate()`
5. Ajout du bouton "Calculer la santé" dans la barre de filtres
6. Ajout de la barre de progression pendant le calcul
7. Ajout de l'affichage des résultats après le calcul

**Nouveau Bouton**:
- Positionné à côté des boutons d'export (CSV/Excel)
- Couleur verte pour indiquer une action de santé
- Désactivé pendant le calcul ou si aucune parcelle n'est affichée
- Affiche "Calcul en cours..." pendant l'exécution

**Barre de Progression**:
- Affichée pendant le calcul
- Montre le nombre de parcelles traitées (X / Y)
- Barre de progression visuelle (0-100%)
- Animation de pulsation sur l'icône

**Affichage des Résultats**:
- Résumé: Total, Réussis, Échecs
- Liste déroulante des erreurs (si échecs)
- Bouton "Fermer" pour masquer les résultats
- Rafraîchissement automatique de la liste après succès

## Flux de Fonctionnement

1. **Utilisateur clique sur "Calculer la santé"**
   - Le hook récupère les IDs de toutes les parcelles affichées
   - Divise en batches de 100 si nécessaire

2. **Pour chaque batch**:
   - Envoie une requête POST à `/api/satellite/ndvi/batch`
   - L'API traite 5 parcelles en parallèle
   - Met à jour la progression en temps réel

3. **Pour chaque parcelle**:
   - Vérifie le cache (si pas de forceRecalculate)
   - Si pas en cache: récupère la géométrie et calcule le NDVI
   - Stocke le résultat en base de données
   - Retourne le statut (succès/échec)

4. **Après le calcul**:
   - Affiche les résultats (succès/échecs)
   - Rafraîchit la liste des parcelles
   - Les badges de santé apparaissent dans la colonne "Santé"

## Avantages

1. **Performance**:
   - Calcul en parallèle (5 parcelles simultanées)
   - Utilisation du cache pour éviter les recalculs
   - Batching automatique pour les grandes listes

2. **UX**:
   - Progression en temps réel
   - Feedback immédiat sur les succès/échecs
   - Pas de blocage de l'interface
   - Résultats détaillés avec liste des erreurs

3. **Robustesse**:
   - Gestion des erreurs par parcelle
   - Pas d'interruption si une parcelle échoue
   - Logs détaillés côté serveur

## Utilisation

1. Aller sur la page `/parcelles`
2. Filtrer les parcelles si nécessaire
3. Cliquer sur le bouton "Calculer la santé" (icône Activity, fond vert)
4. Attendre la fin du calcul (barre de progression)
5. Consulter les résultats
6. Les badges de santé apparaissent dans la colonne "Santé"

## Notes Techniques

- **Limite de concurrence**: 5 calculs simultanés pour éviter de surcharger le serveur
- **Limite de batch**: 100 parcelles par requête API
- **Cache**: Utilise les résultats existants si disponibles (< 24h)
- **Service role**: Utilise `SUPABASE_SERVICE_KEY` pour bypasser les RLS lors du stockage
- **Mock imagery**: Fonctionne avec le service mock si `NEXT_PUBLIC_USE_MOCK_IMAGERY=true`

## Prochaines Étapes Possibles

1. Ajouter un bouton "Forcer le recalcul" pour ignorer le cache
2. Ajouter un filtre pour ne calculer que les parcelles sans données NDVI
3. Ajouter une notification toast au lieu de l'affichage inline
4. Ajouter un historique des calculs batch
5. Permettre l'annulation d'un calcul en cours
6. Ajouter un calcul automatique en arrière-plan (cron job)

## Problème Résolu

**Problème initial**: La colonne "Santé" affichait "Pas de données" pour toutes les parcelles car aucun calcul NDVI n'avait été effectué.

**Solution**: Bouton de calcul batch qui permet de calculer le NDVI pour toutes les parcelles affichées en une seule action, avec progression en temps réel et gestion des erreurs.
