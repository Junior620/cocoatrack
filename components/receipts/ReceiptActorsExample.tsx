'use client';

// CocoaTrack V2 - Receipt Actors Example
// Example component showing how to use PlanteurAutocomplete and ChefPlanteurAutocomplete together
// with cooperative consistency validation (Requirement 6.9)

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { PlanteurAutocomplete, type PlanteurOption } from './PlanteurAutocomplete';
import { ChefPlanteurAutocomplete, type ChefPlanteurOption } from './ChefPlanteurAutocomplete';

/**
 * Example component demonstrating the usage of both autocomplete components
 * with cooperative consistency validation
 */
export function ReceiptActorsExample() {
  const [planteurId, setPlanteurId] = useState<string | null>(null);
  const [selectedPlanteur, setSelectedPlanteur] = useState<PlanteurOption | null>(null);
  
  const [chefPlanteurId, setChefPlanteurId] = useState<string | null>(null);
  const [selectedChefPlanteur, setSelectedChefPlanteur] = useState<ChefPlanteurOption | null>(null);
  
  const [cooperativeWarning, setCooperativeWarning] = useState<string | null>(null);

  // Handle planteur selection
  const handlePlanteurChange = (id: string | null, planteur: PlanteurOption | null) => {
    setPlanteurId(id);
    setSelectedPlanteur(planteur);
    
    // Check cooperative consistency (Requirement 6.9)
    if (planteur && selectedChefPlanteur && planteur.cooperative_id !== selectedChefPlanteur.cooperative_id) {
      setCooperativeWarning('Le planteur et le collecteur ne sont pas de la même coopérative');
    } else {
      setCooperativeWarning(null);
    }
  };

  // Handle chef planteur selection
  const handleChefPlanteurChange = (id: string | null, chefPlanteur: ChefPlanteurOption | null) => {
    setChefPlanteurId(id);
    setSelectedChefPlanteur(chefPlanteur);
    
    // Check cooperative consistency (Requirement 6.9)
    if (chefPlanteur && selectedPlanteur && chefPlanteur.cooperative_id !== selectedPlanteur.cooperative_id) {
      setCooperativeWarning('Le planteur et le collecteur ne sont pas de la même coopérative');
    } else {
      setCooperativeWarning(null);
    }
  };

  // Handle create new planteur
  const handleCreateNewPlanteur = (name: string) => {
    console.log('Create new planteur:', name);
    // In a real implementation, this would open a modal or form to create a new planteur
    alert(`Créer un nouveau planteur: ${name}`);
  };

  // Handle create new chef planteur
  const handleCreateNewChefPlanteur = (name: string) => {
    console.log('Create new chef planteur:', name);
    // In a real implementation, this would open a modal or form to create a new chef planteur
    alert(`Créer un nouveau chef planteur: ${name}`);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Sélection des Acteurs du Reçu
        </h2>
        <p className="text-sm text-gray-600">
          Exemple d&apos;utilisation des composants PlanteurAutocomplete et ChefPlanteurAutocomplete
        </p>
      </div>

      {/* Planteur Selection */}
      <PlanteurAutocomplete
        value={planteurId || undefined}
        onChange={handlePlanteurChange}
        onCreateNew={handleCreateNewPlanteur}
        label="Planteur (Vendeur)"
        placeholder="Rechercher un planteur..."
        helpText="Recherchez par nom ou créez un nouveau planteur"
        required
      />

      {/* Chef Planteur Selection */}
      <ChefPlanteurAutocomplete
        value={chefPlanteurId || undefined}
        onChange={handleChefPlanteurChange}
        onCreateNew={handleCreateNewChefPlanteur}
        label="Chef Planteur (Acheteur)"
        placeholder="Rechercher un chef planteur..."
        helpText="Recherchez par nom ou créez un nouveau chef planteur"
        warning={cooperativeWarning || undefined}
        required
      />

      {/* Cooperative Warning (Requirement 6.9) */}
      {cooperativeWarning && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800 mb-1">
                Avertissement de Coopérative
              </h3>
              <p className="text-sm text-yellow-700">
                {cooperativeWarning}
              </p>
              <p className="text-xs text-yellow-600 mt-2">
                Veuillez vérifier que les deux acteurs appartiennent bien à la même coopérative.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Selected Values Display */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Valeurs Sélectionnées</h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium text-gray-700">Planteur ID:</span>{' '}
            <span className="text-gray-600">{planteurId || 'Non sélectionné'}</span>
          </div>
          {selectedPlanteur && (
            <div className="ml-4 text-xs text-gray-500">
              {selectedPlanteur.name} ({selectedPlanteur.code}) - Coopérative: {selectedPlanteur.cooperative_id}
            </div>
          )}
          <div>
            <span className="font-medium text-gray-700">Chef Planteur ID:</span>{' '}
            <span className="text-gray-600">{chefPlanteurId || 'Non sélectionné'}</span>
          </div>
          {selectedChefPlanteur && (
            <div className="ml-4 text-xs text-gray-500">
              {selectedChefPlanteur.name} ({selectedChefPlanteur.code}) - Coopérative: {selectedChefPlanteur.cooperative_id}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReceiptActorsExample;
