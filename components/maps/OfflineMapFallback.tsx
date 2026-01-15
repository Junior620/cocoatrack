'use client';

// CocoaTrack V2 - Offline Map Fallback
// List view with coordinates when map is unavailable

import { useState } from 'react';
import { MapPinOff } from 'lucide-react';

import { MARKER_COLORS } from './types';
import type { MapMarker, MarkerType } from './types';

interface OfflineMapFallbackProps {
  markers: MapMarker[];
  className?: string;
  error?: string;
}

export function OfflineMapFallback({
  markers,
  className = '',
  error,
}: OfflineMapFallbackProps) {
  const [filter, setFilter] = useState<MarkerType | 'all'>('all');
  const [search, setSearch] = useState('');

  // Filter markers
  const filteredMarkers = markers.filter((marker) => {
    if (filter !== 'all' && marker.type !== filter) return false;
    if (search && !marker.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Group by type
  const groupedMarkers = filteredMarkers.reduce(
    (acc, marker) => {
      if (!acc[marker.type]) acc[marker.type] = [];
      acc[marker.type].push(marker);
      return acc;
    },
    {} as Record<MarkerType, MapMarker[]>
  );

  return (
    <div className={`rounded-lg bg-white shadow ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPinOff className="h-5 w-5 text-gray-400" />
            <h3 className="font-semibold text-gray-900">Mode hors ligne</h3>
          </div>
          <span className="text-sm text-gray-500">{filteredMarkers.length} éléments</span>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
        <p className="mt-1 text-sm text-gray-500">
          La carte n&apos;est pas disponible. Voici la liste des emplacements.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row">
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as MarkerType | 'all')}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="all">Tous les types</option>
          <option value="planteur">Planteurs</option>
          <option value="chef_planteur">Chef Planteurs</option>
          <option value="warehouse">Entrepôts</option>
        </select>
      </div>

      {/* List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredMarkers.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Aucun emplacement trouvé
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredMarkers.map((marker) => (
              <li key={marker.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start gap-3">
                  <div
                    className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: MARKER_COLORS[marker.type] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{marker.name}</p>
                    {marker.code && (
                      <p className="text-sm text-gray-500">Code: {marker.code}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {marker.coordinates[1].toFixed(6)}, {marker.coordinates[0].toFixed(6)}
                    </p>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 capitalize">
                    {marker.type.replace('_', ' ')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Summary by type */}
      <div className="border-t border-gray-200 p-4">
        <p className="mb-2 text-xs font-semibold text-gray-700">Résumé</p>
        <div className="flex flex-wrap gap-4">
          {Object.entries(groupedMarkers).map(([type, items]) => (
            <div key={type} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: MARKER_COLORS[type as MarkerType] }}
              />
              <span className="text-sm text-gray-600">
                {items.length} {type.replace('_', ' ')}
                {items.length > 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
