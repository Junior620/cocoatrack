/**
 * CacheManagementPanel Component
 * 
 * Displays cache statistics and provides cache management controls.
 * Allows users to view cache status, clear cache, and refresh cache for selected parcelles.
 * 
 * Requirements: Task 6.1.5
 */

'use client';

import React, { useState } from 'react';
import { useCacheManagement } from '@/hooks/satellite/useCacheManagement';
import { Trash2, RefreshCw, Database, HardDrive, Clock, TrendingUp } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface CacheManagementPanelProps {
  /** Optional parcelle ID to show cache status for */
  parcelleId?: string;
  /** Whether to show detailed statistics */
  showDetails?: boolean;
  /** Callback when cache is cleared */
  onCacheCleared?: () => void;
  /** Callback when cache is refreshed */
  onCacheRefreshed?: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * CacheManagementPanel Component
 * 
 * Provides a UI for managing satellite data cache including:
 * - Cache statistics display (size, count, hit rate)
 * - Clear cache button
 * - Refresh cache button
 * - Cache status indicators
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <CacheManagementPanel />
 * 
 * // With parcelle-specific cache status
 * <CacheManagementPanel parcelleId="abc-123" />
 * 
 * // With callbacks
 * <CacheManagementPanel
 *   onCacheCleared={() => console.log('Cache cleared')}
 *   onCacheRefreshed={() => console.log('Cache refreshed')}
 * />
 * ```
 */
export function CacheManagementPanel({
  parcelleId,
  showDetails = true,
  onCacheCleared,
  onCacheRefreshed,
}: CacheManagementPanelProps) {
  // Cache management hook
  const {
    stats,
    loading,
    error,
    refreshStats,
    clearAllCache,
    clearParcelleCache,
    clearExpiredCache,
    cacheHitRate,
  } = useCacheManagement({
    autoFetch: true,
    refreshInterval: 30000, // Refresh every 30 seconds
  });

  // Local state
  const [clearing, setClearing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Handle clear all cache
   */
  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all cached satellite data? This cannot be undone.')) {
      return;
    }

    setClearing(true);
    try {
      const success = await clearAllCache();
      if (success) {
        onCacheCleared?.();
      }
    } finally {
      setClearing(false);
    }
  };

  /**
   * Handle clear parcelle cache
   */
  const handleClearParcelle = async () => {
    if (!parcelleId) return;

    if (!confirm('Are you sure you want to clear cached data for this parcelle?')) {
      return;
    }

    setClearing(true);
    try {
      const success = await clearParcelleCache(parcelleId);
      if (success) {
        onCacheCleared?.();
      }
    } finally {
      setClearing(false);
    }
  };

  /**
   * Handle clear expired cache
   */
  const handleClearExpired = async () => {
    setClearing(true);
    try {
      const count = await clearExpiredCache();
      if (count > 0) {
        onCacheCleared?.();
      }
    } finally {
      setClearing(false);
    }
  };

  /**
   * Handle refresh cache stats
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshStats();
      onCacheRefreshed?.();
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Format bytes to human-readable string
   */
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  /**
   * Format date to relative time
   */
  const formatRelativeTime = (date: Date | null): string => {
    if (!date) return 'Never';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  /**
   * Get cache status color
   */
  const getCacheStatusColor = (hitRate: number): string => {
    if (hitRate >= 70) return 'text-green-600';
    if (hitRate >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Loading state
  if (loading && !stats) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">Loading cache statistics...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center text-red-600">
          <Database className="h-5 w-5 mr-2" />
          <span>Error loading cache statistics: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Database className="h-5 w-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Cache Management</h3>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
            title="Refresh statistics"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Entries */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Entries</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats?.totalEntries || 0}
                </p>
              </div>
              <Database className="h-8 w-8 text-gray-400" />
            </div>
          </div>

          {/* Cache Size */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cache Size</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatBytes(stats?.totalSizeBytes || 0)}
                </p>
              </div>
              <HardDrive className="h-8 w-8 text-gray-400" />
            </div>
          </div>

          {/* Cached Parcelles */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cached Parcelles</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats?.uniqueParcelles || 0}
                  <span className="text-sm text-gray-500 ml-1">/ 50</span>
                </p>
              </div>
              <div className="relative">
                <div className="h-8 w-8 rounded-full border-4 border-gray-300">
                  <div
                    className="absolute inset-0 rounded-full border-4 border-blue-500"
                    style={{
                      clipPath: `polygon(50% 50%, 50% 0%, ${
                        50 + 50 * Math.sin((2 * Math.PI * (stats?.uniqueParcelles || 0)) / 50)
                      }% ${
                        50 - 50 * Math.cos((2 * Math.PI * (stats?.uniqueParcelles || 0)) / 50)
                      }%, 50% 50%)`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cache Hit Rate */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Hit Rate</p>
                <p className={`text-2xl font-bold mt-1 ${getCacheStatusColor(cacheHitRate)}`}>
                  {cacheHitRate}%
                </p>
              </div>
              <TrendingUp className={`h-8 w-8 ${getCacheStatusColor(cacheHitRate)}`} />
            </div>
          </div>
        </div>

        {/* Detailed Statistics */}
        {showDetails && stats && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Entries by Type */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Entries by Type</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Imagery:</span>
                  <span className="font-medium text-gray-900">{stats.entriesByType.imagery}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">NDVI:</span>
                  <span className="font-medium text-gray-900">{stats.entriesByType.ndvi}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Bands:</span>
                  <span className="font-medium text-gray-900">{stats.entriesByType.bands}</span>
                </div>
              </div>
            </div>

            {/* Cache Age */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Cache Age</h4>
              <div className="space-y-2">
                <div className="flex items-center text-sm">
                  <Clock className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Oldest:</span>
                  <span className="ml-auto font-medium text-gray-900">
                    {formatRelativeTime(stats.oldestEntry)}
                  </span>
                </div>
                <div className="flex items-center text-sm">
                  <Clock className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-600">Newest:</span>
                  <span className="ml-auto font-medium text-gray-900">
                    {formatRelativeTime(stats.newestEntry)}
                  </span>
                </div>
              </div>
            </div>

            {/* Cache Status */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Cache Status</h4>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className={`h-3 w-3 rounded-full mr-2 ${
                    (stats.uniqueParcelles || 0) < 40 ? 'bg-green-500' :
                    (stats.uniqueParcelles || 0) < 48 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`} />
                  <span className="text-sm text-gray-600">
                    {(stats.uniqueParcelles || 0) < 40 ? 'Healthy' :
                     (stats.uniqueParcelles || 0) < 48 ? 'Near Limit' :
                     'At Capacity'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {50 - (stats.uniqueParcelles || 0)} parcelle slots available
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex flex-wrap gap-3">
          {/* Clear Expired */}
          <button
            onClick={handleClearExpired}
            disabled={clearing || loading}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Clock className="h-4 w-4 mr-2" />
            Clear Expired
          </button>

          {/* Clear Parcelle Cache (if parcelleId provided) */}
          {parcelleId && (
            <button
              onClick={handleClearParcelle}
              disabled={clearing || loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-orange-700 bg-white border border-orange-300 rounded-md hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear This Parcelle
            </button>
          )}

          {/* Clear All Cache */}
          <button
            onClick={handleClearAll}
            disabled={clearing || loading || (stats?.totalEntries || 0) === 0}
            className="flex items-center px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-auto"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {clearing ? 'Clearing...' : 'Clear All Cache'}
          </button>
        </div>
      </div>
    </div>
  );
}
