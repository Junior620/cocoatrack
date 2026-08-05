// Satellite Library - Centralized Exports
// This file provides centralized exports for satellite utilities and types

// Type exports
export type {
  ImageryData,
  NDVIResult,
  DeforestationEvent,
  TemporalDataPoint,
  YieldPrediction,
  KMLExportOptions,
  ReportOptions,
  HealthStatus,
  CacheMetadata,
  CacheStats,
} from './types';

// Utility exports
export {
  ndviToColorString as getNDVIColor,
  getNDVILegendColors,
  ndviToHex as getNDVIColorForValue,
} from './utils/ndvi-colors';

export {
  exportTemporalDataAsCSV,
} from './utils/csv-export';

export {
  detectEVIEarlyAlert,
  calculateNdviEviGap,
  interpretNdviEviGap,
  NDVI_EVI_GAP_TIERS,
} from './evi-alerts';

export {
  detectNDMIEarlyAlert,
  resolveNDMIThresholds,
  NDMI_THRESHOLDS_CACAO,
  NDMI_DROP_WATCH,
  NDMI_DROP_ALERT,
  NDMI_LOW_THRESHOLD,
} from './ndmi-alerts';

export {
  combineVegetationAlerts,
} from './combined-alerts';

export {
  interpretNDMILevel,
  NDMI_BAND_OK_MIN,
  NDMI_BAND_WATCH_MIN,
} from './ndmi-levels';

export {
  getCocoaSeason,
  getCocoaSeasonContext,
} from './seasonality';

export {
  compareNdmiToVillage,
} from './village-ndmi';

export {
  buildRainfallContext,
  classifyRainBand,
  getRainfallContextForPoint,
} from './rainfall';

export {
  interpretNdviEviCurves,
  verdictTone,
} from './curve-interpretation';

export {
  toReflectance01,
  calculatePixelEVIAuto,
  calculatePixelWiseEVI,
} from './evi';

export {
  calculatePixelNDMI,
  calculatePixelWiseNDMI,
} from './ndmi';

export {
  detectNDWIEarlyAlert,
  NDWI_THRESHOLDS_CACAO,
  NDWI_RISE_WATCH,
  NDWI_RISE_ALERT,
  NDWI_HIGH_THRESHOLD,
} from './ndwi-alerts';

export {
  interpretNDWILevel,
  NDWI_BAND_WATER_MIN,
  NDWI_BAND_WET_MIN,
  NDWI_BAND_NORMAL_MIN,
} from './ndwi-levels';

export {
  calculatePixelNDWI,
  calculatePixelWiseNDWI,
} from './ndwi';

export {
  calculatePixelSAVI,
  calculatePixelWiseSAVI,
  SAVI_L,
} from './savi';

export {
  shouldShowSavi,
  interpretSAVILevel,
  SAVI_SPARSE_NDVI_MAX,
  SAVI_SPARSE_GAP_MAX,
  SAVI_BAND_GOOD_MIN,
  SAVI_BAND_FAIR_MIN,
} from './savi-context';

export {
  formatFileSize,
} from './utils/imagery-optimization';

export {
  isOffline,
  getCacheAgeString,
  formatCacheDate,
} from './utils/offline-detection';

// Service exports (for server-side use only)
// Note: These should not be imported in client components
// Commented out to avoid import errors in tests
// export { ImageryService } from './services/imagery.service';
// export { NDVIService } from './services/ndvi.service';
// export { DeforestationService } from './services/deforestation.service';
// export { CacheService } from './services/cache.service';
// export { ExportService } from './services/export.service';

export {
  detectSAVIEarlyAlert,
} from './savi-alerts';

export {
  calculatePixelNDRE,
  calculatePixelWiseNDRE,
} from './ndre';

export {
  detectNDREEarlyAlert,
  interpretNDRELevel,
  NDRE_LOW,
  NDRE_BAND_OK_MIN,
} from './ndre-alerts';

export {
  compareEviToVillage,
  compareSaviToVillage,
  compareIndexToVillage,
} from './village-index';

export {
  calibrateNdmiThresholdsFromFeedback,
} from './ndmi-calibration';

export {
  applyRegionalNdmiThresholds,
} from './regional-thresholds';

export {
  buildIndexLegendSentence,
  isIndexUnreliable,
} from './index-legend';

export {
  SAVI_YOUNG_MAX_AGE_YEARS,
  SAVI_LOW_DENSITY_MAX,
  plantationAgeYears,
} from './savi-context';

export {
  computeVisitPriority,
  visitPrioritySortKey,
} from './visit-priority';
