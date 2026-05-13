// Satellite Hooks - Centralized Exports
// This file provides centralized exports for all satellite hooks
// Hooks are not lazy-loaded as they are lightweight and need to be available immediately

export { useSatelliteImagery } from './useSatelliteImagery';
export { useNDVI } from './useNDVI';
export { useTemporalAnalysis } from './useTemporalAnalysis';
export { useDeforestation } from './useDeforestation';
export { useBatchNDVICalculation } from './useBatchNDVICalculation';
export { useBatchReports } from './useBatchReports';
export { useCacheManagement } from './useCacheManagement';
export { useRequestQueue, usePendingRequestCount } from './useRequestQueue';
export { useProgressiveImagery } from './useProgressiveImagery';

// Type re-exports
export type { UseSatelliteImageryOptions, UseSatelliteImageryReturn } from './useSatelliteImagery';
export type { UseNDVIOptions, UseNDVIReturn } from './useNDVI';
export type { UseTemporalAnalysisOptions, UseTemporalAnalysisReturn } from './useTemporalAnalysis';
export type { UseDeforestationOptions, UseDeforestationReturn } from './useDeforestation';
