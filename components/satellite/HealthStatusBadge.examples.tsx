/**
 * HealthStatusBadge Component Examples
 * 
 * This file demonstrates various usage patterns for the HealthStatusBadge component.
 * Use these examples as a reference for implementing the badge in your UI.
 */

import React from 'react';
import HealthStatusBadge from './HealthStatusBadge';

export function BasicUsageExample() {
  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-bold">Basic Usage</h2>
      <div className="flex gap-2 flex-wrap">
        <HealthStatusBadge status="excellent" />
        <HealthStatusBadge status="good" />
        <HealthStatusBadge status="fair" />
        <HealthStatusBadge status="poor" />
        <HealthStatusBadge status="critical" />
      </div>
    </div>
  );
}

export function SizeVariantsExample() {
  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-bold">Size Variants</h2>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-20 text-sm text-gray-600">Small:</span>
          <HealthStatusBadge status="good" size="sm" />
        </div>
        
        <div className="flex items-center gap-2">
          <span className="w-20 text-sm text-gray-600">Medium:</span>
          <HealthStatusBadge status="good" size="md" />
        </div>
        
        <div className="flex items-center gap-2">
          <span className="w-20 text-sm text-gray-600">Large:</span>
          <HealthStatusBadge status="good" size="lg" />
        </div>
      </div>
    </div>
  );
}

export function TrendIndicatorsExample() {
  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-bold">Trend Indicators</h2>
      
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-24 text-sm text-gray-600">Improving:</span>
          <HealthStatusBadge status="good" showTrend trend="improving" />
        </div>
        
        <div className="flex items-center gap-2">
          <span className="w-24 text-sm text-gray-600">Stable:</span>
          <HealthStatusBadge status="fair" showTrend trend="stable" />
        </div>
        
        <div className="flex items-center gap-2">
          <span className="w-24 text-sm text-gray-600">Declining:</span>
          <HealthStatusBadge status="poor" showTrend trend="declining" />
        </div>
      </div>
    </div>
  );
}

export function ParcelleListExample() {
  const parcelles = [
    { id: '1', name: 'Parcelle A', status: 'excellent' as const, trend: 'stable' as const },
    { id: '2', name: 'Parcelle B', status: 'good' as const, trend: 'improving' as const },
    { id: '3', name: 'Parcelle C', status: 'fair' as const, trend: 'declining' as const },
    { id: '4', name: 'Parcelle D', status: 'poor' as const, trend: 'declining' as const },
    { id: '5', name: 'Parcelle E', status: 'critical' as const, trend: 'stable' as const },
  ];

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-bold">Parcelle List Example</h2>
      
      <div className="border rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Parcelle
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Health Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {parcelles.map((parcelle) => (
              <tr key={parcelle.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {parcelle.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <HealthStatusBadge
                    status={parcelle.status}
                    showTrend
                    trend={parcelle.trend}
                    size="sm"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ParcelleDetailExample() {
  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-bold">Parcelle Detail Page Example</h2>
      
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold">Parcelle Alpha</h3>
          <HealthStatusBadge
            status="good"
            showTrend
            trend="improving"
            size="lg"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Surface:</span>
            <span className="ml-2 font-medium">2.5 hectares</span>
          </div>
          <div>
            <span className="text-gray-600">NDVI:</span>
            <span className="ml-2 font-medium">0.68</span>
          </div>
          <div>
            <span className="text-gray-600">Last Analysis:</span>
            <span className="ml-2 font-medium">May 3, 2026</span>
          </div>
          <div>
            <span className="text-gray-600">Trend:</span>
            <span className="ml-2 font-medium">Improving over 3 months</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MapPopupExample() {
  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-bold">Map Popup Example</h2>
      
      <div className="border rounded-lg p-4 bg-white shadow-lg max-w-xs">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Parcelle Beta</h4>
            <HealthStatusBadge status="excellent" size="sm" />
          </div>
          
          <div className="text-sm text-gray-600">
            <p>Surface: 3.2 ha</p>
            <p>NDVI: 0.82</p>
          </div>
          
          <button className="w-full mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}

export function AllExamples() {
  return (
    <div className="space-y-8 p-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8">HealthStatusBadge Component Examples</h1>
      
      <BasicUsageExample />
      <SizeVariantsExample />
      <TrendIndicatorsExample />
      <ParcelleListExample />
      <ParcelleDetailExample />
      <MapPopupExample />
    </div>
  );
}

export default AllExamples;
