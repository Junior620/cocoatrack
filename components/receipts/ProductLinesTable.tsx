'use client';

import { useState } from 'react';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import type { ProductLine } from '@/types/receipts';

interface ProductLinesTableProps {
  lines: ProductLine[];
  onChange: (lines: ProductLine[]) => void;
}

/**
 * ProductLinesTable Component
 *
 * Dynamic table for managing product lines in a collection receipt.
 * Features:
 * - Add/remove rows dynamically
 * - Automatic net weight calculation: netWeight = PB × (100 - Hmes) / (100 - Href)
 * - Manual override of net weight (recalculates amount only)
 * - Automatic amount calculation: amount = netWeight * pricePerKg
 * - Display total amount (sum of all line amounts)
 * - Field validation for each input
 *
 * @see Requirements 5.5, 5.6, 5.7, 5.8, 5.9
 */
export function ProductLinesTable({ lines, onChange }: ProductLinesTableProps) {
  const [errors, setErrors] = useState<Record<number, Record<string, string>>>({});
  // Tracks which lines have a manually overridden net weight
  const [netWeightOverrides, setNetWeightOverrides] = useState<Record<number, boolean>>({});

  /**
   * Reference humidity for cacao export (contractual target < 8%)
   */
  const HUMIDITY_REF = 8;

  /**
   * Calculate net weight (point net) adjusted to reference humidity
   * Formula: netWeight = grossWeight × (100 - humidity) / (100 - humidityRef)
   *
   * @see Property 2: Net Weight Calculation
   * @see Requirement 5.7
   */
  const calculateNetWeight = (grossWeight: number, humidity: number): number => {
    if (isNaN(grossWeight) || isNaN(humidity) || grossWeight <= 0) return 0;
    return Math.round((grossWeight * (100 - humidity)) / (100 - HUMIDITY_REF) * 100) / 100;
  };

  /**
   * Calculate line amount from net weight and price per kg
   * Formula: amount = netWeight * pricePerKg
   * 
   * @see Property 3: Line Amount Calculation
   * @see Requirement 5.8
   */
  const calculateLineAmount = (netWeight: number, pricePerKg: number): number => {
    if (isNaN(netWeight) || isNaN(pricePerKg)) return 0;
    return netWeight * pricePerKg;
  };

  /**
   * Calculate total amount from all product lines
   * Formula: total = sum of all line amounts
   * 
   * @see Property 4: Total Amount Calculation
   * @see Requirement 5.9
   */
  const calculateTotalAmount = (): number => {
    return lines.reduce((sum, line) => sum + (line.amount || 0), 0);
  };

  /**
   * Validate a single field value
   */
  const validateField = (
    index: number,
    field: keyof ProductLine,
    value: number | string
  ): string | null => {
    if (field === 'commercialType') {
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return 'Le type commercial est obligatoire';
      }
      return null;
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numValue)) {
      return 'Valeur invalide';
    }

    switch (field) {
      case 'grossWeight':
        if (numValue <= 0) {
          return 'Le poids brut doit être supérieur à zéro';
        }
        break;
      case 'humidity':
        if (numValue < 0 || numValue > 100) {
          return "L'humidité doit être entre 0% et 100%";
        }
        break;
      case 'pricePerKg':
        if (numValue <= 0) {
          return 'Le prix doit être supérieur à zéro';
        }
        break;
    }

    return null;
  };

  /**
   * Update a field in a product line
   */
  const updateLine = (
    index: number,
    field: keyof ProductLine,
    value: string | number
  ) => {
    const newLines = [...lines];
    const line = { ...newLines[index] };

    // Update the field
    if (field === 'commercialType') {
      line[field] = value as string;
    } else {
      const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
      line[field as keyof Omit<ProductLine, 'commercialType'>] = numValue;
    }

    // Recalculate dependent fields
    if (field === 'grossWeight' || field === 'humidity') {
      // Auto-recalculate net weight only if not manually overridden
      if (!netWeightOverrides[index]) {
        line.netWeight = calculateNetWeight(line.grossWeight, line.humidity);
      }
      line.amount = calculateLineAmount(line.netWeight, line.pricePerKg);
    } else if (field === 'netWeight') {
      // Manual override — mark this line and recalculate amount only
      setNetWeightOverrides((prev) => ({ ...prev, [index]: true }));
      line.amount = calculateLineAmount(line.netWeight, line.pricePerKg);
    } else if (field === 'pricePerKg') {
      line.amount = calculateLineAmount(line.netWeight, line.pricePerKg);
    }

    // Validate the field
    const error = validateField(index, field, value);
    const newErrors = { ...errors };
    if (error) {
      if (!newErrors[index]) newErrors[index] = {};
      newErrors[index][field] = error;
    } else {
      if (newErrors[index]) {
        delete newErrors[index][field];
        if (Object.keys(newErrors[index]).length === 0) {
          delete newErrors[index];
        }
      }
    }
    setErrors(newErrors);

    newLines[index] = line;
    onChange(newLines);
  };

  /**
   * Reset net weight to auto-calculated value for a line
   */
  const resetNetWeight = (index: number) => {
    setNetWeightOverrides((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    const newLines = [...lines];
    const line = { ...newLines[index] };
    line.netWeight = calculateNetWeight(line.grossWeight, line.humidity);
    line.amount = calculateLineAmount(line.netWeight, line.pricePerKg);
    newLines[index] = line;
    onChange(newLines);
  };

  /**
   * Add a new empty product line
   */
  const addLine = () => {
    const newLine: ProductLine = {
      commercialType: '',
      grossWeight: 0,
      humidity: 0,
      netWeight: 0,
      pricePerKg: 0,
      amount: 0,
    };
    onChange([...lines, newLine]);
  };

  /**
   * Remove a product line by index
   */
  const removeLine = (index: number) => {
    const newLines = lines.filter((_, i) => i !== index);
    const newErrors = { ...errors };
    delete newErrors[index];
    
    // Reindex errors
    const reindexedErrors: Record<number, Record<string, string>> = {};
    Object.keys(newErrors).forEach((key) => {
      const oldIndex = parseInt(key);
      if (oldIndex > index) {
        reindexedErrors[oldIndex - 1] = newErrors[oldIndex];
      } else {
        reindexedErrors[oldIndex] = newErrors[oldIndex];
      }
    });
    
    setErrors(reindexedErrors);
    onChange(newLines);
  };

  const totalAmount = calculateTotalAmount();

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type commercial
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Poids brut (kg)
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Humidité (%)
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Poids net (kg)
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prix/kg (XAF)
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Montant (XAF)
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {lines.map((line, index) => (
              <tr key={index}>
                <td className="px-3 py-2">
                  <div>
                    <input
                      type="text"
                      value={line.commercialType}
                      onChange={(e) => updateLine(index, 'commercialType', e.target.value)}
                      className={`w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-[#6FAF3D] ${
                        errors[index]?.commercialType ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Ex: Tout Venant"
                    />
                    {errors[index]?.commercialType && (
                      <p className="mt-1 text-xs text-red-600">{errors[index].commercialType}</p>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div>
                    <input
                      type="number"
                      value={line.grossWeight || ''}
                      onChange={(e) => updateLine(index, 'grossWeight', e.target.value)}
                      className={`w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-[#6FAF3D] ${
                        errors[index]?.grossWeight ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="0"
                      step="0.01"
                      min="0"
                    />
                    {errors[index]?.grossWeight && (
                      <p className="mt-1 text-xs text-red-600">{errors[index].grossWeight}</p>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div>
                    <input
                      type="number"
                      value={line.humidity || ''}
                      onChange={(e) => updateLine(index, 'humidity', e.target.value)}
                      className={`w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-[#6FAF3D] ${
                        errors[index]?.humidity ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="0"
                      step="0.1"
                      min="0"
                      max="100"
                    />
                    {errors[index]?.humidity && (
                      <p className="mt-1 text-xs text-red-600">{errors[index].humidity}</p>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={line.netWeight || ''}
                      onChange={(e) => updateLine(index, 'netWeight', e.target.value)}
                      className={`w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-[#6FAF3D] ${
                        netWeightOverrides[index]
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-gray-200 bg-gray-50 text-gray-700'
                      }`}
                      placeholder="0"
                      step="0.01"
                      min="0"
                      title={netWeightOverrides[index] ? 'Valeur saisie manuellement' : 'Calculé automatiquement'}
                    />
                    {netWeightOverrides[index] && (
                      <button
                        type="button"
                        onClick={() => resetNetWeight(index)}
                        className="flex-shrink-0 text-amber-600 hover:text-amber-800 transition-colors"
                        title="Recalculer automatiquement"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div>
                    <input
                      type="number"
                      value={line.pricePerKg || ''}
                      onChange={(e) => updateLine(index, 'pricePerKg', e.target.value)}
                      className={`w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-[#6FAF3D] ${
                        errors[index]?.pricePerKg ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="0"
                      step="1"
                      min="0"
                    />
                    {errors[index]?.pricePerKg && (
                      <p className="mt-1 text-xs text-red-600">{errors[index].pricePerKg}</p>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="px-2 py-1 bg-gray-50 rounded text-gray-700 font-medium">
                    {line.amount.toLocaleString('fr-FR')}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="text-red-600 hover:text-red-800 transition-colors"
                    title="Supprimer cette ligne"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan={5} className="px-3 py-3 text-right font-medium text-gray-700">
                Total général:
              </td>
              <td className="px-3 py-3 font-bold text-gray-900">
                {totalAmount.toLocaleString('fr-FR')} XAF
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <button
        type="button"
        onClick={addLine}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#6FAF3D] transition-colors"
      >
        <Plus className="h-4 w-4 mr-2" />
        Ajouter une ligne
      </button>
    </div>
  );
}
