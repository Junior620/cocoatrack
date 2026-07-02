/**
 * YieldPredictionDisplay - Version Mockée pour Screenshots
 * 
 * Version simplifiée qui affiche des données mockées directement
 * sans faire d'appels API. Utilisée pour les captures d'écran du mémoire.
 */

'use client';

interface MockedYieldPredictionProps {
  state: 'empty' | 'high' | 'medium' | 'low' | 'above-average' | 'below-average' | 'with-actual';
}

export function MockedYieldPrediction({ state }: MockedYieldPredictionProps) {
  
  // État initial - Aucune prédiction
  if (state === 'empty') {
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
          <button
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
        </div>
      </div>
    );
  }

  // Données mockées selon l'état
  const mockData = {
    'high': {
      predicted: 865,
      lower: 778,
      upper: 952,
      confidence: 'high' as const,
      cooperativeAvg: 500,
      harvestSeason: 'Q4-2024',
      predictionDate: '15 juin 2024',
      meanNDVI: 0.67,
      ndviTrend: 0.018,
      historicalYield: [420, 465, 490],
      surfaceHa: 4.8,
    },
    'medium': {
      predicted: 720,
      lower: 576,
      upper: 864,
      confidence: 'medium' as const,
      cooperativeAvg: 500,
      harvestSeason: 'Q4-2024',
      predictionDate: '15 juin 2024',
      meanNDVI: 0.62,
      ndviTrend: 0.008,
      historicalYield: [],
      surfaceHa: 3.2,
    },
    'low': {
      predicted: 580,
      lower: 406,
      upper: 754,
      confidence: 'low' as const,
      cooperativeAvg: 500,
      harvestSeason: 'Q4-2024',
      predictionDate: '15 juin 2024',
      meanNDVI: 0.55,
      ndviTrend: 0.002,
      historicalYield: [],
      surfaceHa: 2.8,
    },
    'above-average': {
      predicted: 675,
      lower: 608,
      upper: 743,
      confidence: 'high' as const,
      cooperativeAvg: 500,
      harvestSeason: 'Q4-2024',
      predictionDate: '15 juin 2024',
      meanNDVI: 0.64,
      ndviTrend: 0.015,
      historicalYield: [550, 620, 680],
      surfaceHa: 5.5,
    },
    'below-average': {
      predicted: 450,
      lower: 405,
      upper: 495,
      confidence: 'medium' as const,
      cooperativeAvg: 500,
      harvestSeason: 'Q4-2024',
      predictionDate: '15 juin 2024',
      meanNDVI: 0.52,
      ndviTrend: -0.005,
      historicalYield: [430, 440, 460],
      surfaceHa: 3.5,
    },
    'with-actual': {
      predicted: 520,
      lower: 468,
      upper: 572,
      confidence: 'high' as const,
      cooperativeAvg: 500,
      harvestSeason: 'Q4-2024',
      predictionDate: '15 juin 2024',
      meanNDVI: 0.63,
      ndviTrend: 0.012,
      historicalYield: [490, 510, 530],
      surfaceHa: 4.2,
      actualYield: 530,
    },
  };

  const data = mockData[state];
  const comparison = data.cooperativeAvg ? {
    difference: data.predicted - data.cooperativeAvg,
    percentDifference: ((data.predicted - data.cooperativeAvg) / data.cooperativeAvg) * 100,
    isAbove: data.predicted > data.cooperativeAvg,
  } : null;

  const getConfidenceLevelColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-green-700 bg-green-100';
      case 'medium': return 'text-yellow-700 bg-yellow-100';
      case 'low': return 'text-orange-700 bg-orange-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getConfidenceLevelLabel = (level: string) => {
    switch (level) {
      case 'high': return 'Élevée';
      case 'medium': return 'Moyenne';
      case 'low': return 'Faible';
      default: return level;
    }
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Prévision de Rendement</h2>
        <button
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
      </div>

      <div className="space-y-4">
        {/* Predicted Yield */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-sm text-gray-500">Rendement Prévu</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">
                {data.predicted}
                <span className="ml-2 text-lg font-normal text-gray-600">kg/ha</span>
              </p>
            </div>
            <div
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getConfidenceLevelColor(
                data.confidence
              )}`}
            >
              Confiance: {getConfidenceLevelLabel(data.confidence)}
            </div>
          </div>

          {/* Confidence Interval */}
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <span>Intervalle de confiance:</span>
            <span className="font-medium">
              {data.lower} - {data.upper} kg/ha
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
                  {data.cooperativeAvg} kg/ha
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
          <span className="font-medium text-gray-900">{data.harvestSeason}</span>
        </div>

        {/* Prediction Date */}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">Date de prévision:</span>
          <span className="font-medium text-gray-900">{data.predictionDate}</span>
        </div>

        {/* Actual Yield if available */}
        {'actualYield' in data && data.actualYield && (
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
                  {data.actualYield} kg/ha
                </p>
                <p className="mt-1 text-sm text-green-700">
                  Écart: {(data.actualYield - data.predicted).toFixed(0)} kg/ha
                  ({(((data.actualYield - data.predicted) / data.predicted) * 100).toFixed(1)}%)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Model Information */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
              Informations sur le modèle
            </summary>
            <div className="mt-2 space-y-2 text-gray-600">
              <p>
                <span className="font-medium">Version du modèle:</span> v1.0.0-simple-regression
              </p>
              <p>
                <span className="font-medium">NDVI moyen:</span> {data.meanNDVI.toFixed(3)}
              </p>
              <p>
                <span className="font-medium">Tendance NDVI:</span> {data.ndviTrend.toFixed(3)}
              </p>
              <p>
                <span className="font-medium">Surface:</span> {data.surfaceHa.toFixed(2)} ha
              </p>
              {data.historicalYield.length > 0 && (
                <p>
                  <span className="font-medium">Rendements historiques:</span>{' '}
                  {data.historicalYield.map((y) => y.toFixed(0)).join(', ')} kg/ha
                </p>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
