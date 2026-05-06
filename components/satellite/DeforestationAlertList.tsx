'use client';

import React, { useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Filter, Calendar, Search } from 'lucide-react';
import type { DeforestationEvent } from '@/lib/satellite/types';
import DeforestationAlert from './DeforestationAlert';

interface DeforestationAlertListProps {
  alerts: DeforestationEvent[];
  onAcknowledge?: (alertId: string, notes: string) => void;
  onDispute?: (alertId: string, reason: string) => void;
  className?: string;
}

type StatusFilter = 'all' | 'pending' | 'acknowledged' | 'disputed' | 'resolved';

/**
 * DeforestationAlertList Component
 * 
 * Displays a list of deforestation alerts with filtering and grouping capabilities.
 * 
 * Features:
 * - Group alerts by status (pending, acknowledged, disputed, resolved)
 * - Filter by status and date range
 * - Show alert count badges
 * - Search functionality
 * - Responsive layout
 * 
 * Requirements: 4.3.2
 */
export default function DeforestationAlertList({
  alerts,
  onAcknowledge,
  onDispute,
  className = '',
}: DeforestationAlertListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Count alerts by status
  const alertCounts = useMemo(() => {
    return {
      all: alerts.length,
      pending: alerts.filter((a) => a.status === 'pending').length,
      acknowledged: alerts.filter((a) => a.status === 'acknowledged').length,
      disputed: alerts.filter((a) => a.status === 'disputed').length,
      resolved: alerts.filter((a) => a.status === 'resolved').length,
    };
  }, [alerts]);

  // Filter alerts based on status, date range, and search query
  const filteredAlerts = useMemo(() => {
    let filtered = alerts;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((alert) => alert.status === statusFilter);
    }

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter((alert) => new Date(alert.detectionDate) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include the entire end date
      filtered = filtered.filter((alert) => new Date(alert.detectionDate) <= end);
    }

    // Filter by search query (parcelle ID)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((alert) =>
        alert.parcelleId.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [alerts, statusFilter, startDate, endDate, searchQuery]);

  // Group alerts by status
  const groupedAlerts = useMemo(() => {
    const groups: Record<DeforestationEvent['status'], DeforestationEvent[]> = {
      pending: [],
      acknowledged: [],
      disputed: [],
      resolved: [],
    };

    filteredAlerts.forEach((alert) => {
      groups[alert.status].push(alert);
    });

    // Sort each group by detection date (newest first)
    Object.keys(groups).forEach((status) => {
      groups[status as DeforestationEvent['status']].sort(
        (a, b) => new Date(b.detectionDate).getTime() - new Date(a.detectionDate).getTime()
      );
    });

    return groups;
  }, [filteredAlerts]);

  // Status filter buttons configuration
  const statusFilters: Array<{
    value: StatusFilter;
    label: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    {
      value: 'all',
      label: 'Toutes',
      icon: <Filter className="h-4 w-4" />,
      color: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    },
    {
      value: 'pending',
      label: 'En attente',
      icon: <AlertTriangle className="h-4 w-4" />,
      color: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
    },
    {
      value: 'acknowledged',
      label: 'Reconnues',
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'bg-green-100 text-green-700 hover:bg-green-200',
    },
    {
      value: 'disputed',
      label: 'Contestées',
      icon: <XCircle className="h-4 w-4" />,
      color: 'bg-red-100 text-red-700 hover:bg-red-200',
    },
    {
      value: 'resolved',
      label: 'Résolues',
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    },
  ];

  // Group labels (French)
  const groupLabels: Record<DeforestationEvent['status'], string> = {
    pending: 'En attente',
    acknowledged: 'Reconnues',
    disputed: 'Contestées',
    resolved: 'Résolues',
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Alertes de déforestation
        </h2>
        <p className="text-sm text-gray-600">
          {filteredAlerts.length} alerte{filteredAlerts.length !== 1 ? 's' : ''} trouvée{filteredAlerts.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        {/* Status Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                ${
                  statusFilter === filter.value
                    ? 'ring-2 ring-blue-500 ' + filter.color
                    : filter.color
                }
              `}
              aria-pressed={statusFilter === filter.value}
            >
              {filter.icon}
              <span>{filter.label}</span>
              <span
                className={`
                  ml-1 px-2 py-0.5 rounded-full text-xs font-semibold
                  ${
                    statusFilter === filter.value
                      ? 'bg-white/50'
                      : 'bg-white/30'
                  }
                `}
              >
                {alertCounts[filter.value]}
              </span>
            </button>
          ))}
        </div>

        {/* Search and Date Range Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <label htmlFor="alert-search" className="sr-only">
              Rechercher par ID de parcelle
            </label>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="alert-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par ID de parcelle..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Start Date */}
          <div>
            <label htmlFor="start-date" className="sr-only">
              Date de début
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Date de début"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label htmlFor="end-date" className="sr-only">
              Date de fin
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Date de fin"
              />
            </div>
          </div>
        </div>

        {/* Active Filters Summary */}
        {(statusFilter !== 'all' || startDate || endDate || searchQuery) && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">Filtres actifs :</span>
            {statusFilter !== 'all' && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md">
                Statut : {statusFilters.find((f) => f.value === statusFilter)?.label}
              </span>
            )}
            {startDate && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md">
                Depuis : {new Date(startDate).toLocaleDateString('fr-FR')}
              </span>
            )}
            {endDate && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md">
                Jusqu'à : {new Date(endDate).toLocaleDateString('fr-FR')}
              </span>
            )}
            {searchQuery && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md">
                Recherche : {searchQuery}
              </span>
            )}
            <button
              onClick={() => {
                setStatusFilter('all');
                setStartDate('');
                setEndDate('');
                setSearchQuery('');
              }}
              className="ml-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              Réinitialiser
            </button>
          </div>
        )}
      </div>

      {/* Alert List */}
      {filteredAlerts.length === 0 ? (
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucune alerte trouvée
          </h3>
          <p className="text-sm text-gray-600">
            {alerts.length === 0
              ? 'Il n\'y a aucune alerte de déforestation pour le moment.'
              : 'Aucune alerte ne correspond aux filtres sélectionnés.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Grouped Alerts */}
          {(Object.keys(groupedAlerts) as Array<DeforestationEvent['status']>).map((status) => {
            const alertsInGroup = groupedAlerts[status];
            if (alertsInGroup.length === 0) return null;

            return (
              <div key={status} className="space-y-4">
                {/* Group Header */}
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {groupLabels[status]}
                  </h3>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                    {alertsInGroup.length}
                  </span>
                </div>

                {/* Alerts in Group */}
                <div className="space-y-4">
                  {alertsInGroup.map((alert) => (
                    <DeforestationAlert
                      key={alert.id}
                      alert={alert}
                      onAcknowledge={onAcknowledge}
                      onDispute={onDispute}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
