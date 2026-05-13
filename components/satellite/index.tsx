// Satellite Components - Lazy Loading Exports
// This file provides lazy-loaded exports for all satellite components
// to enable code splitting and reduce initial bundle size

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import React from 'react';

// Loading component for lazy-loaded satellite components
const SatelliteLoadingFallback = () => {
  return React.createElement('div', {
    className: 'flex items-center justify-center p-4'
  }, React.createElement('div', {
    className: 'animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600'
  }));
};

// ============================================================================
// Core Satellite Components (Lazy Loaded)
// ============================================================================

export const HealthStatusBadge = dynamic(
  () => import('./HealthStatusBadge'),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

export const NDVILayer = dynamic(
  () => import('./NDVILayer').then(mod => ({ default: mod.NDVILayer })),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

export const SatelliteImageryOverlay = dynamic(
  () => import('./SatelliteImageryOverlay').then(mod => ({ default: mod.SatelliteImageryOverlay })),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

export const TemporalSlider = dynamic(
  () => import('./TemporalSlider').then(mod => ({ default: mod.TemporalSlider })),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

export const TemporalDataChart = dynamic(
  () => import('./TemporalDataChart').then(mod => ({ default: mod.TemporalDataChart })),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

export const TemporalAnalysisView = dynamic(
  () => import('./TemporalAnalysisView').then(mod => ({ default: mod.TemporalAnalysisView })),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

// ============================================================================
// Deforestation Components (Lazy Loaded)
// ============================================================================

export const DeforestationAlert = dynamic(
  () => import('./DeforestationAlert'),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

export const DeforestationAlertList = dynamic(
  () => import('./DeforestationAlertList'),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

// ============================================================================
// Export and Report Components (Lazy Loaded)
// ============================================================================

export const KMLExportButton = dynamic(
  () => import('./KMLExportButton').then(mod => ({ default: mod.KMLExportButton })),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

export const ExportCSVButton = dynamic(
  () => import('./ExportCSVButton').then(mod => ({ default: mod.ExportCSVButton })),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

export const ReportOptionsModal = dynamic(
  () => import('./ReportOptionsModal'),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

export const ReportDownloadLink = dynamic(
  () => import('./ReportDownloadLink'),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

export const BatchReportGenerator = dynamic(
  () => import('./BatchReportGenerator').then(mod => ({ default: mod.BatchReportGenerator })),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

// ============================================================================
// Yield Prediction Components (Lazy Loaded)
// ============================================================================

export const YieldPredictionDisplay = dynamic(
  () => import('./YieldPredictionDisplay'),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

// ============================================================================
// Cache and Status Components (Lazy Loaded)
// ============================================================================

export const CacheStatusIndicator = dynamic(
  () => import('./CacheStatusIndicator').then(mod => ({ default: mod.CacheStatusIndicator })),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

export const CacheManagementPanel = dynamic(
  () => import('./CacheManagementPanel').then(mod => ({ default: mod.CacheManagementPanel })),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

export const RequestQueueIndicator = dynamic(
  () => import('./RequestQueueIndicator').then(mod => ({ default: mod.RequestQueueIndicator })),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

export const RequestQueueBadge = dynamic(
  () => import('./RequestQueueIndicator').then(mod => ({ default: mod.RequestQueueBadge })),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

export const SatelliteImageryWithStatus = dynamic(
  () => import('./SatelliteImageryWithStatus').then(mod => ({ default: mod.SatelliteImageryWithStatus })),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

// ============================================================================
// Notification Components (Lazy Loaded)
// ============================================================================

export const SatelliteNotificationPreferences = dynamic(
  () => import('./SatelliteNotificationPreferences').then(mod => ({ default: mod.SatelliteNotificationPreferences })),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

// ============================================================================
// Map Integration Components (Lazy Loaded)
// ============================================================================

export const ParcelleMapWithNDVI = dynamic(
  () => import('../parcelles/ParcelleMapWithNDVI').then(mod => ({ default: mod.ParcelleMapWithNDVI })),
  {
    loading: () => <SatelliteLoadingFallback />,
    ssr: false,
  }
);

// ============================================================================
// Type Re-exports
// ============================================================================

export type { HealthStatus, TrendDirection } from './HealthStatusBadge';
export type { KMLExportOptions } from '@/lib/satellite/types';
export type { ReportOptions } from './ReportOptionsModal';
export type { 
  DeforestationEvent,
  ImageryData,
  NDVIResult,
  TemporalDataPoint,
  YieldPrediction,
} from '@/lib/satellite/types';
