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
