/**
 * YieldPredictionDisplay Component Examples
 * 
 * Visual examples demonstrating different states and configurations
 * of the YieldPredictionDisplay component.
 */

'use client';

import YieldPredictionDisplay from './YieldPredictionDisplay';

/**
 * Example 1: Basic yield prediction display
 * Use case: Display prediction with all data available
 */
export function BasicYieldPrediction() {
  return (
    <div className="p-4 bg-gray-100">
      <h2 className="text-xl font-bold mb-4">Example 1: Basic Yield Prediction</h2>
      <YieldPredictionDisplay
        parcelleId="123e4567-e89b-12d3-a456-426614174000"
        canEdit={false}
      />
    </div>
  );
}

/**
 * Example 2: With cooperative average comparison
 * Use case: Show how parcelle compares to cooperative average
 */
export function WithCooperativeComparison() {
  return (
    <div className="p-4 bg-gray-100">
      <h2 className="text-xl font-bold mb-4">Example 2: With Cooperative Average</h2>
      <YieldPredictionDisplay
        parcelleId="123e4567-e89b-12d3-a456-426614174000"
        cooperativeAverage={500}
        canEdit={false}
      />
    </div>
  );
}

/**
 * Example 3: Editable with actual yield form
 * Use case: Allow user to record actual yield after harvest
 */
export function EditableWithActualYieldForm() {
  return (
    <div className="p-4 bg-gray-100">
      <h2 className="text-xl font-bold mb-4">Example 3: Editable (Can Record Actual Yield)</h2>
      <YieldPredictionDisplay
        parcelleId="123e4567-e89b-12d3-a456-426614174000"
        cooperativeAverage={500}
        canEdit={true}
        onActualYieldUpdate={(actualYield) => {
          console.log('Actual yield updated:', actualYield);
          alert(`Rendement réel enregistré: ${actualYield} kg/ha`);
        }}
      />
    </div>
  );
}

/**
 * Example 4: High confidence prediction
 * Use case: Display prediction with high confidence level
 */
export function HighConfidencePrediction() {
  return (
    <div className="p-4 bg-gray-100">
      <h2 className="text-xl font-bold mb-4">Example 4: High Confidence Prediction</h2>
      <p className="text-sm text-gray-600 mb-4">
        Confidence level: High (green badge)
      </p>
      <YieldPredictionDisplay
        parcelleId="123e4567-e89b-12d3-a456-426614174000"
        cooperativeAverage={500}
        canEdit={false}
      />
    </div>
  );
}

/**
 * Example 5: Medium confidence prediction
 * Use case: Display prediction with medium confidence level
 */
export function MediumConfidencePrediction() {
  return (
    <div className="p-4 bg-gray-100">
      <h2 className="text-xl font-bold mb-4">Example 5: Medium Confidence Prediction</h2>
      <p className="text-sm text-gray-600 mb-4">
        Confidence level: Medium (yellow badge)
      </p>
      <YieldPredictionDisplay
        parcelleId="123e4567-e89b-12d3-a456-426614174001"
        cooperativeAverage={500}
        canEdit={false}
      />
    </div>
  );
}

/**
 * Example 6: Low confidence prediction
 * Use case: Display prediction with low confidence level
 */
export function LowConfidencePrediction() {
  return (
    <div className="p-4 bg-gray-100">
      <h2 className="text-xl font-bold mb-4">Example 6: Low Confidence Prediction</h2>
      <p className="text-sm text-gray-600 mb-4">
        Confidence level: Low (orange badge)
      </p>
      <YieldPredictionDisplay
        parcelleId="123e4567-e89b-12d3-a456-426614174002"
        cooperativeAverage={500}
        canEdit={false}
      />
    </div>
  );
}

/**
 * Example 7: Above average prediction
 * Use case: Parcelle predicted to perform better than cooperative average
 */
export function AboveAveragePrediction() {
  return (
    <div className="p-4 bg-gray-100">
      <h2 className="text-xl font-bold mb-4">Example 7: Above Average Prediction</h2>
      <p className="text-sm text-gray-600 mb-4">
        Predicted yield: 550 kg/ha (above 500 kg/ha average)
      </p>
      <YieldPredictionDisplay
        parcelleId="123e4567-e89b-12d3-a456-426614174003"
        cooperativeAverage={500}
        canEdit={false}
      />
    </div>
  );
}

/**
 * Example 8: Below average prediction
 * Use case: Parcelle predicted to perform worse than cooperative average
 */
export function BelowAveragePrediction() {
  return (
    <div className="p-4 bg-gray-100">
      <h2 className="text-xl font-bold mb-4">Example 8: Below Average Prediction</h2>
      <p className="text-sm text-gray-600 mb-4">
        Predicted yield: 450 kg/ha (below 500 kg/ha average)
      </p>
      <YieldPredictionDisplay
        parcelleId="123e4567-e89b-12d3-a456-426614174004"
        cooperativeAverage={500}
        canEdit={false}
      />
    </div>
  );
}

/**
 * Example 9: With actual yield recorded
 * Use case: Display prediction accuracy after harvest
 */
export function WithActualYieldRecorded() {
  return (
    <div className="p-4 bg-gray-100">
      <h2 className="text-xl font-bold mb-4">Example 9: With Actual Yield Recorded</h2>
      <p className="text-sm text-gray-600 mb-4">
        Predicted: 520 kg/ha, Actual: 530 kg/ha (good accuracy!)
      </p>
      <YieldPredictionDisplay
        parcelleId="123e4567-e89b-12d3-a456-426614174005"
        cooperativeAverage={500}
        canEdit={false}
      />
    </div>
  );
}

/**
 * Example 10: No prediction available
 * Use case: First time viewing parcelle, no prediction generated yet
 */
export function NoPredictionAvailable() {
  return (
    <div className="p-4 bg-gray-100">
      <h2 className="text-xl font-bold mb-4">Example 10: No Prediction Available</h2>
      <p className="text-sm text-gray-600 mb-4">
        Empty state with generate button
      </p>
      <YieldPredictionDisplay
        parcelleId="123e4567-e89b-12d3-a456-426614174006"
        canEdit={true}
      />
    </div>
  );
}

/**
 * Example 11: Complete parcelle detail integration
 * Use case: How component appears in actual parcelle detail page
 */
export function ParcelleDetailIntegration() {
  return (
    <div className="space-y-6 p-4 bg-gray-50">
      <h2 className="text-xl font-bold">Example 11: Parcelle Detail Page Integration</h2>
      
      {/* Simulated parcelle header */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h1 className="text-2xl font-bold text-gray-900">PAR-001</h1>
        <p className="text-gray-600">Parcelle de Jean Dupont</p>
      </div>

      {/* Simulated map section */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Localisation</h2>
        <div className="h-64 bg-gray-200 rounded-lg flex items-center justify-center">
          <span className="text-gray-500">Carte de la parcelle</span>
        </div>
      </div>

      {/* Simulated health status section */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">État de Santé</h2>
        <div className="flex items-center gap-3">
          <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
            Excellent
          </span>
          <span className="text-sm text-gray-600">NDVI: 0.75</span>
        </div>
      </div>

      {/* Yield Prediction Component */}
      <YieldPredictionDisplay
        parcelleId="123e4567-e89b-12d3-a456-426614174000"
        cooperativeAverage={500}
        canEdit={true}
        onActualYieldUpdate={(actualYield) => {
          console.log('Actual yield updated:', actualYield);
        }}
      />

      {/* Simulated other sections */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Alertes de Déforestation</h2>
        <p className="text-sm text-gray-500">Aucune alerte</p>
      </div>
    </div>
  );
}

/**
 * Example 12: Mobile responsive view
 * Use case: How component adapts to mobile screens
 */
export function MobileResponsiveView() {
  return (
    <div className="max-w-sm mx-auto p-4 bg-gray-100">
      <h2 className="text-xl font-bold mb-4">Example 12: Mobile View</h2>
      <YieldPredictionDisplay
        parcelleId="123e4567-e89b-12d3-a456-426614174000"
        cooperativeAverage={500}
        canEdit={true}
      />
    </div>
  );
}

/**
 * All examples in a showcase grid
 */
export function AllExamples() {
  return (
    <div className="p-8 bg-gray-50">
      <h1 className="text-3xl font-bold mb-8">YieldPredictionDisplay Component Examples</h1>
      
      <div className="space-y-8">
        <BasicYieldPrediction />
        <WithCooperativeComparison />
        <EditableWithActualYieldForm />
        <HighConfidencePrediction />
        <MediumConfidencePrediction />
        <LowConfidencePrediction />
        <AboveAveragePrediction />
        <BelowAveragePrediction />
        <WithActualYieldRecorded />
        <NoPredictionAvailable />
        <ParcelleDetailIntegration />
        <MobileResponsiveView />
      </div>
    </div>
  );
}
