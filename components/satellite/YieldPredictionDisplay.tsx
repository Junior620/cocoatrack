/**
 * YieldPredictionDisplay Component
 * 
 * Displays yield prediction information for a parcelle including:
 * - Predicted yield in kg/ha
 * - Confidence interval and level
 * - Comparison with cooperative average
 * - Form to update actual yield after harvest
 * 
 * Task 5.5.4: Add yield prediction to parcelle detail page
 */

'use client';

import { useState, useEffect } from 'react';
import type { YieldPrediction } from '@/lib/satellite/types';

// ============================================================================
// Types
// ============================================================================

interface YieldPredictionDisplayProps {
  parcelleId: string;
  cooperativeAverage?: number; // kg/ha
  canEdit?: boolean;
  onActualYieldUpdate?: (actualYield: number) => void;
}

interface YieldPredictionData extends YieldPrediction {
  cooperativeAverage?: number;
}

// ============================================================================
// Component
// ============================================================================

export default function YieldPredictionDisplay({
  parcelleId,
  cooperativeAverage,
  canEdit = false,
  onActualYieldUpdate,
}: YieldPredictionDisplayProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<YieldPredictionData | null>(null);
  const [showActualYieldForm, setShowActualYieldForm] = useState(false);
  const [actualYield, setActualYield] = useState<string>('');
  const [submittingActualYield, setSubmittingActualYield] = useState(false);

  // Fetch yield prediction
  useEffect(() => {
    fetchYieldPrediction();
  }, [parcelleId]);

  const fetchYieldPrediction = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch the most recent yield prediction for this parcelle
      const response = await fetch(`/api/satellite/yield-prediction?parcelleId=${parcelleId}`);

      if (response.status === 404) {
        // No prediction available yet
        setPrediction(null);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch yield prediction');
      }

      const result = await response.json();

      if (result.success && result.data?.prediction) {
        setPrediction({
          ...result.data.prediction,
          cooperativeAverage,
        });
      }
    } catch (err) {
      console.error('Error fetching yield prediction:', err);
      setError(err instanceof Error ? err.message : 'Failed to load yield prediction');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePrediction = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/satellite/yield-prediction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parcelleId,
          storePrediction: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate yield prediction');
      }

      const result = await response.json();

      if (result.success && result.data?.prediction) {
        setPrediction({
          ...result.data.prediction,
          cooperativeAverage,
        });
      }
    } catch (err) {
      console.error('Error generating yield prediction:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate yield prediction');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitActualYield = async (e: React.FormEvent) => {
    e.preventDefault();

    const yieldValue = parseFloat(actualYield);
    if (isNaN(yieldValue) || yieldValue <= 0) {
      alert('Veuillez entrer un rendement valide');
      return;
    }

    setSubmittingActualYield(true);

    try {
      const response = await fetch('/api/satellite/yield-prediction/actual', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          predictionId: prediction?.id,
          actualYieldKgPerHa: yieldValue,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update actual yield');
      }

      // Refresh prediction data
      await fetchYieldPrediction();
      setShowActualYieldForm(false);
      setActualYield('');

      if (onActualYieldUpdate) {
        onActualYieldUpdate(yieldValue);
      }

      alert('Rendement réel enregistré avec succès');
    } catch (err) {
      console.error('Error updating actual yield:', err);
      alert(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement du rendement');
    } finally {
      setSubmittingActualYield(false);
    }
  };

  // Calculate comparison with cooperative average
  const getComparisonWithAverage = () => {
    if (!prediction || !cooperativeAverage) return null;

    const difference = prediction.predictedYieldKgPerHa - cooperativeAverage;
    const percentDifference = (difference / cooperativeAverage) * 100;

    return {
      difference,
      percentDifference,
      isAbove: difference > 0,
    };
  };

  const comparison = getComparisonWithAverage();

  // Get confidence level color
  const getConfidenceLevelColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'text-green-700 bg-green-100';
      case 'medium':
        return 'text-yellow-700 bg-yellow-100';
      case 'low':
        return 'text-orange-700 bg-orange-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  const getConfidenceLevelLabel = (level: string) => {
    switch (level) {
      case 'high':
        return 'Élevée';
      case 'medium':
        return 'Moyenne';
      case 'low':
        return 'Faible';
      default:
        return level;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Prévision de Rendement</h2>
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner className="h-8 w-8 text-primary-600" />
          <span className="ml-3 text-sm text-gray-500">Chargement de la prévision...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Prévision de Rendement</h2>
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <div className="flex items-start gap-2">
            <svg
              className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-red-900">Erreur de chargement</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                onClick={fetchYieldPrediction}
                className="mt-2 text-sm font-medium text-red-600 hover:text-red-700 underline"
              >
                Réessayer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No prediction available
  if (!prediction) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Prévision de Rendement</h2>
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="mt-2 text-sm font-medium text-gray-900">
            Aucune prévision de rendement disponible
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Générez une prévision basée sur les données NDVI de cette parcelle.
          </p>
          {canEdit && (
            <button
              onClick={handleGeneratePrediction}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Générer Prévision
            </button>
          )}
        </div>
      </div>
    );
  }

  // Display prediction
  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Prévision de Rendement</h2>
        {canEdit && (
          <button
            onClick={handleGeneratePrediction}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            title="Régénérer la prévision"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Actualiser
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Predicted Yield */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-sm text-gray-500">Rendement Prévu</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {prediction.predictedYieldKgPerHa.toFixed(0)}
                <span className="ml-2 text-lg font-normal text-gray-600">kg/ha</span>
              </p>
            </div>
            <div
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getConfidenceLevelColor(
                prediction.confidenceLevel
              )}`}
            >
              Confiance: {getConfidenceLevelLabel(prediction.confidenceLevel)}
            </div>
          </div>

          {/* Confidence Interval */}
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <span>Intervalle de confiance:</span>
            <span className="font-medium">
              {prediction.confidenceIntervalLower.toFixed(0)} - {prediction.confidenceIntervalUpper.toFixed(0)} kg/ha
            </span>
          </div>
        </div>

        {/* Comparison with Cooperative Average */}
        {comparison && (
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Comparaison avec la Moyenne Coopérative
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm text-gray-500">Moyenne Coopérative</p>
                <p className="text-lg font-semibold text-gray-900">
                  {cooperativeAverage?.toFixed(0)} kg/ha
                </p>
              </div>
              <div className="flex items-center gap-2">
                {comparison.isAbove ? (
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                )}
                <div className="text-right">
                  <p className={`text-lg font-bold ${comparison.isAbove ? 'text-green-600' : 'text-red-600'}`}>
                    {comparison.isAbove ? '+' : ''}
                    {comparison.difference.toFixed(0)} kg/ha
                  </p>
                  <p className={`text-xs ${comparison.isAbove ? 'text-green-600' : 'text-red-600'}`}>
                    ({comparison.isAbove ? '+' : ''}
                    {comparison.percentDifference.toFixed(1)}%)
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Harvest Season */}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">Saison de récolte:</span>
          <span className="font-medium text-gray-900">{prediction.harvestSeason}</span>
        </div>

        {/* Prediction Date */}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">Date de prévision:</span>
          <span className="font-medium text-gray-900">
            {new Date(prediction.predictionDate).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>

        {/* Actual Yield Section */}
        {prediction.actualYieldKgPerHa !== null ? (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-start gap-2">
              <svg
                className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-green-900">Rendement Réel Enregistré</h3>
                <p className="mt-1 text-2xl font-bold text-green-900">
                  {prediction.actualYieldKgPerHa.toFixed(0)} kg/ha
                </p>
                <p className="mt-1 text-sm text-green-700">
                  Écart: {(prediction.actualYieldKgPerHa - prediction.predictedYieldKgPerHa).toFixed(0)} kg/ha
                  ({(((prediction.actualYieldKgPerHa - prediction.predictedYieldKgPerHa) / prediction.predictedYieldKgPerHa) * 100).toFixed(1)}%)
                </p>
              </div>
            </div>
          </div>
        ) : canEdit ? (
          <div className="mt-4">
            {!showActualYieldForm ? (
              <button
                onClick={() => setShowActualYieldForm(true)}
                className="w-full rounded-md border-2 border-dashed border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:border-primary-500 hover:text-primary-600 transition-colors"
              >
                + Enregistrer le Rendement Réel
              </button>
            ) : (
              <form onSubmit={handleSubmitActualYield} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Enregistrer le Rendement Réel</h3>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="actualYield" className="block text-sm font-medium text-gray-700 mb-1">
                      Rendement (kg/ha)
                    </label>
                    <input
                      type="number"
                      id="actualYield"
                      value={actualYield}
                      onChange={(e) => setActualYield(e.target.value)}
                      placeholder="Ex: 520"
                      min="0"
                      step="0.01"
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-primary-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={submittingActualYield}
                      className="flex-1 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                    >
                      {submittingActualYield ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowActualYieldForm(false);
                        setActualYield('');
                      }}
                      disabled={submittingActualYield}
                      className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        ) : null}

        {/* Model Information */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
              Informations sur le modèle
            </summary>
            <div className="mt-2 space-y-2 text-gray-600">
              <p>
                <span className="font-medium">Version du modèle:</span> {prediction.modelVersion}
              </p>
              <p>
                <span className="font-medium">NDVI moyen:</span> {prediction.inputFeatures.meanNDVI.toFixed(3)}
              </p>
              <p>
                <span className="font-medium">Tendance NDVI:</span> {prediction.inputFeatures.ndviTrend.toFixed(3)}
              </p>
              <p>
                <span className="font-medium">Surface:</span> {prediction.inputFeatures.surfaceHectares.toFixed(2)} ha
              </p>
              {prediction.inputFeatures.historicalYield.length > 0 && (
                <p>
                  <span className="font-medium">Rendements historiques:</span>{' '}
                  {prediction.inputFeatures.historicalYield.map((y) => y.toFixed(0)).join(', ')} kg/ha
                </p>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
