/**
 * CacheManagementPanel Examples
 * 
 * This file demonstrates various usage patterns for the CacheManagementPanel component.
 * 
 * Requirements: Task 6.1.5
 */

import React from 'react';
import { CacheManagementPanel } from './CacheManagementPanel';
import { CacheStatusIndicator } from './CacheStatusIndicator';

/**
 * Example 1: Basic Cache Management Panel
 * 
 * Shows cache statistics and management controls without any specific parcelle context.
 */
export function BasicCacheManagementExample() {
  return (
    <div className="p-6 bg-gray-100">
      <h2 className="text-2xl font-bold mb-4">Basic Cache Management</h2>
      <CacheManagementPanel />
    </div>
  );
}

/**
 * Example 2: Cache Management with Parcelle Context
 * 
 * Shows cache management panel with a specific parcelle ID,
 * enabling parcelle-specific cache clearing.
 */
export function ParcelleSpecificCacheExample() {
  const parcelleId = 'abc-123-def-456';

  return (
    <div className="p-6 bg-gray-100">
      <h2 className="text-2xl font-bold mb-4">Parcelle-Specific Cache Management</h2>
      <CacheManagementPanel parcelleId={parcelleId} />
    </div>
  );
}

/**
 * Example 3: Cache Management with Callbacks
 * 
 * Demonstrates using callbacks to respond to cache operations.
 */
export function CacheManagementWithCallbacksExample() {
  const handleCacheCleared = () => {
    console.log('Cache cleared successfully');
    // Optionally refresh data or show notification
  };

  const handleCacheRefreshed = () => {
    console.log('Cache statistics refreshed');
    // Optionally update UI or show notification
  };

  return (
    <div className="p-6 bg-gray-100">
      <h2 className="text-2xl font-bold mb-4">Cache Management with Callbacks</h2>
      <CacheManagementPanel
        onCacheCleared={handleCacheCleared}
        onCacheRefreshed={handleCacheRefreshed}
      />
    </div>
  );
}

/**
 * Example 4: Simplified Cache Management (No Details)
 * 
 * Shows a compact version without detailed statistics.
 */
export function SimplifiedCacheManagementExample() {
  return (
    <div className="p-6 bg-gray-100">
      <h2 className="text-2xl font-bold mb-4">Simplified Cache Management</h2>
      <CacheManagementPanel showDetails={false} />
    </div>
  );
}

/**
 * Example 5: Cache Status Indicators
 * 
 * Demonstrates using cache status indicators in different contexts.
 */
export function CacheStatusIndicatorsExample() {
  const parcelles = [
    { id: 'parcelle-1', name: 'Parcelle A' },
    { id: 'parcelle-2', name: 'Parcelle B' },
    { id: 'parcelle-3', name: 'Parcelle C' },
  ];

  return (
    <div className="p-6 bg-gray-100">
      <h2 className="text-2xl font-bold mb-4">Cache Status Indicators</h2>

      {/* Small indicators in a list */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-lg font-semibold mb-3">Parcelle List with Cache Status</h3>
        <div className="space-y-2">
          {parcelles.map((parcelle) => (
            <div key={parcelle.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
              <span className="font-medium">{parcelle.name}</span>
              <CacheStatusIndicator cached={true} size="sm" />
            </div>
          ))}
        </div>
      </div>

      {/* Medium indicators with labels */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-lg font-semibold mb-3">Cache Status with Labels</h3>
        <div className="space-y-3">
          {parcelles.map((parcelle) => (
            <div key={parcelle.id} className="flex items-center justify-between p-2">
              <span className="font-medium">{parcelle.name}</span>
              <CacheStatusIndicator cached={true} cachedAt={new Date()} size="md" showDetails />
            </div>
          ))}
        </div>
      </div>

      {/* Large indicators with tooltips */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-3">Detailed Cache Status</h3>
        <div className="grid grid-cols-3 gap-4">
          {parcelles.map((parcelle) => (
            <div key={parcelle.id} className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
              <CacheStatusIndicator cached={true} cachedAt={new Date()} size="lg" showDetails />
              <span className="mt-2 text-sm font-medium text-gray-700">{parcelle.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Example 6: Integrated Cache Management in Parcelle Detail Page
 * 
 * Shows how to integrate cache management into a parcelle detail view.
 */
export function IntegratedCacheManagementExample() {
  const parcelleId = 'abc-123-def-456';
  const parcelleName = 'Parcelle du Nord';

  return (
    <div className="p-6 bg-gray-100">
      <h2 className="text-2xl font-bold mb-4">Parcelle Detail with Cache Management</h2>

      {/* Parcelle Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{parcelleName}</h3>
            <p className="text-sm text-gray-600 mt-1">ID: {parcelleId}</p>
          </div>
          <CacheStatusIndicator cached={true} cachedAt={new Date()} size="lg" showDetails />
        </div>
      </div>

      {/* Cache Management Panel */}
      <CacheManagementPanel
        parcelleId={parcelleId}
        showDetails
        onCacheCleared={() => {
          console.log('Parcelle cache cleared, refreshing data...');
          // Refresh parcelle data here
        }}
      />
    </div>
  );
}

/**
 * Example 7: Admin Dashboard with Cache Management
 * 
 * Shows cache management in an admin dashboard context.
 */
export function AdminDashboardCacheExample() {
  return (
    <div className="p-6 bg-gray-100">
      <h2 className="text-2xl font-bold mb-4">Admin Dashboard - Cache Management</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cache Management Panel */}
        <div>
          <CacheManagementPanel
            showDetails
            onCacheCleared={() => {
              console.log('Cache cleared by admin');
              // Log admin action, send notification, etc.
            }}
            onCacheRefreshed={() => {
              console.log('Cache stats refreshed');
            }}
          />
        </div>

        {/* Additional Admin Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Cache Management Tips</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>Cache automatically evicts least recently used parcelles when limit is reached</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>Favorite parcelles are protected from automatic eviction</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-600 mr-2">✓</span>
              <span>Expired cache entries are automatically cleaned up</span>
            </li>
            <li className="flex items-start">
              <span className="text-yellow-600 mr-2">⚠</span>
              <span>Clearing cache will require re-downloading satellite data</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">ℹ</span>
              <span>Cache statistics refresh automatically every 30 seconds</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * Example 8: Mobile-Optimized Cache Management
 * 
 * Shows a mobile-friendly cache management interface.
 */
export function MobileCacheManagementExample() {
  return (
    <div className="p-4 bg-gray-100 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-3">Mobile Cache Management</h2>
      <CacheManagementPanel showDetails={false} />
    </div>
  );
}
