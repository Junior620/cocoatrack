// CocoaTrack V2 - Lazy Loaded Components
// Task 8.11: Performance Optimization
// Task 24.1: Map lazy loading with IntersectionObserver
// Validates: Requirements 13.3, 13.4, 13.5, REQ-PERF-005

import dynamic from 'next/dynamic';
import { ChartSkeleton, MapSkeleton, TableSkeleton } from '@/lib/utils/lazy-load';

// Lazy load Recharts components (heavy library)
export const LazyTrendChart = dynamic(
  () => import('@/components/dashboard/TrendChart').then((mod) => mod.TrendChart),
  {
    loading: () => ChartSkeleton({ height: 300 }),
    ssr: false,
  }
);

// Lazy load Map components (Mapbox is heavy)
export const LazyDeliveryHeatmap = dynamic(
  () => import('@/components/dashboard/DeliveryHeatmap').then((mod) => mod.DeliveryHeatmap),
  {
    loading: () => MapSkeleton(),
    ssr: false,
  }
);

// Lazy load MapView component
export const LazyMapView = dynamic(
  () => import('@/components/maps/MapView').then((mod) => mod.MapView),
  {
    loading: () => MapSkeleton(),
    ssr: false,
  }
);

// Lazy load TopPerformers chart
export const LazyTopPerformers = dynamic(
  () => import('@/components/dashboard/TopPerformers').then((mod) => mod.TopPerformers),
  {
    loading: () => ChartSkeleton({ height: 400 }),
    ssr: false,
  }
);

// Lazy load KPIGrid (contains animations)
export const LazyKPIGrid = dynamic(
  () => import('@/components/dashboard/KPIGrid').then((mod) => mod.KPIGrid),
  {
    ssr: false,
  }
);

// Lazy load ParcelleMap (Leaflet is heavy)
export const LazyParcelleMap = dynamic(
  () => import('@/components/parcelles/ParcelleMap').then((mod) => mod.ParcelleMap),
  {
    loading: () => MapSkeleton(),
    ssr: false,
  }
);

// Lazy load LeafletMap (internal Leaflet implementation)
export const LazyLeafletMap = dynamic(
  () => import('@/components/parcelles/LeafletMap').then((mod) => mod.LeafletMap),
  {
    loading: () => MapSkeleton(),
    ssr: false,
  }
);

// Lazy load LazyMapContainer (IntersectionObserver wrapper)
export const LazyMapContainer = dynamic(
  () => import('@/components/maps/LazyMapContainer').then((mod) => mod.LazyMapContainer),
  {
    ssr: false,
  }
);
