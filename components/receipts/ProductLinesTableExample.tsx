'use client';

import { useState } from 'react';
import { ProductLinesTable } from './ProductLinesTable';
import type { ProductLine } from '@/types/receipts';

/**
 * Example usage of ProductLinesTable component
 * 
 * This demonstrates:
 * - Initial state with sample product lines
 * - Handling onChange callback
 * - Displaying total amount
 * - Form integration
 */
export function ProductLinesTableExample() {
  const [productLines, setProductLines] = useState<ProductLine[]>([
    {
      commercialType: 'Tout Venant',
      grossWeight: 500,
      humidity: 8,
      netWeight: 460, // Calculated: 500 * (1 - 8/100) = 460
      pricePerKg: 1200,
      amount: 552000, // Calculated: 460 * 1200 = 552000
    },
    {
      commercialType: 'G2',
      grossWeight: 300,
      humidity: 7,
      netWeight: 279, // Calculated: 300 * (1 - 7/100) = 279
      pricePerKg: 1500,
      amount: 418500, // Calculated: 279 * 1500 = 418500
    },
  ]);

  const handleProductLinesChange = (newLines: ProductLine[]) => {
    setProductLines(newLines);
    console.log('Product lines updated:', newLines);
  };

  const totalAmount = productLines.reduce((sum, line) => sum + line.amount, 0);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Tableau des Produits - Exemple
        </h2>
        <p className="text-gray-600">
          Démonstration du composant ProductLinesTable avec calculs automatiques
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Produits collectés
        </h3>
        
        <ProductLinesTable
          lines={productLines}
          onChange={handleProductLinesChange}
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Informations</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Le poids net est calculé automatiquement: poids_brut × (1 - humidité/100)</li>
          <li>• Le montant est calculé automatiquement: poids_net × prix/kg</li>
          <li>• Le total général est la somme de tous les montants</li>
          <li>• Les champs sont validés en temps réel</li>
        </ul>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2">État actuel</h4>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Nombre de lignes:</span>{' '}
            {productLines.length}
          </div>
          <div>
            <span className="font-medium">Total général:</span>{' '}
            {totalAmount.toLocaleString('fr-FR')} XAF
          </div>
          <div>
            <span className="font-medium">Poids total net:</span>{' '}
            {productLines.reduce((sum, line) => sum + line.netWeight, 0).toFixed(2)} kg
          </div>
        </div>
      </div>

      <div className="bg-gray-100 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2">JSON (pour debug)</h4>
        <pre className="text-xs overflow-x-auto">
          {JSON.stringify(productLines, null, 2)}
        </pre>
      </div>
    </div>
  );
}
