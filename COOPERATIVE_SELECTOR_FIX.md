# Fix: Sélection de coopérative pour l'import de reçus

## Problème
L'erreur "cooperative_id requis" apparaissait lors de l'import de reçus car:
- Le wizard exigeait que l'utilisateur ait un `cooperative_id` dans son profil
- Les admins et managers peuvent gérer plusieurs coopératives et n'ont pas nécessairement un `cooperative_id` assigné
- Certains reçus peuvent ne pas appartenir à une coopérative spécifique

## Solution
Ajout d'une étape de sélection de coopérative au début du wizard d'import, avec option "Aucune coopérative".

## Changements effectués

### 1. Nouveau composant: `CooperativeSelector.tsx`
- Charge la liste des coopératives disponibles depuis la base de données
- Permet à l'utilisateur de sélectionner une coopérative OU "Aucune coopérative"
- Auto-sélectionne si une seule coopérative existe
- Gère les états de chargement et d'erreur

### 2. Modifications du `ReceiptImportWizard.tsx`
- Ajout d'une nouvelle étape `'cooperative'` au début du workflow
- Le prop `cooperativeId` est maintenant optionnel et peut être `null`
- Si fourni (utilisateur a un `cooperative_id` dans son profil), l'étape de sélection est ignorée
- Si non fourni, l'utilisateur doit sélectionner une coopérative ou "Aucune"
- Mise à jour de la barre de progression pour inclure l'étape "Coopérative"
- Gestion de la valeur "none" pour les reçus sans coopérative

### 3. Modifications du `ReceiptImportButton.tsx`
- Suppression de la validation qui bloquait l'ouverture du wizard
- Le `cooperative_id` du profil est passé au wizard s'il existe (optionnel)

### 4. Modifications de l'API `/api/receipts/upload`
- Accepte maintenant `cooperativeId` optionnel ou "none"
- Convertit "none" en `null` pour la base de données
- Suppression de la validation qui rejetait les requêtes sans `cooperative_id`

### 5. Modifications du service `receipt-upload-service.ts`
- La fonction `uploadPdf` accepte `cooperativeId: string | null`
- La fonction `generateStoragePath` gère le cas `null` en utilisant le dossier "unassigned"
- Chemin de stockage: `{cooperative_id}/receipts/{receipt_number}/{filename}` ou `unassigned/receipts/{receipt_number}/{filename}`

### 6. Migration de base de données: `20260324000004_optional_cooperative_receipts.sql`
- Rend la colonne `cooperative_id` optionnelle (suppression de `NOT NULL`)
- Mise à jour des contraintes d'unicité pour gérer les valeurs `NULL`
- Mise à jour des politiques RLS pour permettre l'accès aux reçus sans coopérative
- Les managers peuvent voir et créer des reçus sans coopérative

## Workflow mis à jour

### Avec cooperative_id dans le profil:
1. Upload → 2. Méthode → 3. Formulaire → 4. Confirmation

### Sans cooperative_id dans le profil:
1. **Coopérative** (avec option "Aucune") → 2. Upload → 3. Méthode → 4. Formulaire → 5. Confirmation

## Avantages
- Les admins/managers peuvent importer des reçus pour n'importe quelle coopérative
- Support des reçus non associés à une coopérative
- Pas besoin d'assigner un `cooperative_id` à chaque utilisateur
- Flexibilité pour gérer plusieurs coopératives
- UX améliorée avec auto-sélection si une seule coopérative existe

## Tests recommandés
1. Tester avec un utilisateur qui a un `cooperative_id` → devrait sauter l'étape de sélection
2. Tester avec un utilisateur sans `cooperative_id` → devrait afficher le sélecteur
3. Tester avec une seule coopérative → devrait auto-sélectionner
4. Tester avec plusieurs coopératives → devrait permettre la sélection manuelle
5. Tester la sélection "Aucune coopérative" → devrait créer un reçu avec `cooperative_id = NULL`
6. Tester le bouton "Retour" depuis l'étape Upload vers Coopérative
7. Vérifier que les reçus sans coopérative sont stockés dans le dossier "unassigned"
8. Vérifier que les managers peuvent voir les reçus sans coopérative

## Migration requise
Exécutez la migration `20260324000004_optional_cooperative_receipts.sql` dans l'éditeur SQL de Supabase pour permettre les reçus sans coopérative.
