'use client';

// CocoaTrack V2 - PlanteurParcellesTab Component
// Displays a planteur's parcelles with mini-map, KPIs, and table
// Used in the planteur detail page as a tab

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

import { parcellesApi } from '@/lib/api/parcelles';
import type { Parcelle, ParcelleWithPlanteur } from '@/types/parcelles';
import {
  CONFORMITY_STATUS_LABELS,
  CONFORMITY_STATUS_COLORS,
} from '@/types/parcelles';

// Dynamically import ParcelleMap to avoid SSR issues with Leaflet
const ParcelleMap = dynamic(
  () => import('@/components/parcelles/ParcelleMap').then((mod) => mod.ParcelleMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto mb-2"></div>
          <p className="text-xs text-gray-500">Chargement de la carte...</p>
        </div>
      </div>
    ),
  }
);

export interface PlanteurParcellesTabProps {
  /** UUID of the planteur */
  planteurId: string;
  /** Name of the planteur (for display) */
  planteurName?: string;
  /** Whether the user can create new parcelles */
  canCreate?: boolean;
}

interface ParcelleStats {
  total: number;
  totalHectares: number;
  conformes: number;
  nonConformes: number;
  enCours: number;
  infoManquantes: number;
}

/**
 * PlanteurParcellesTab - Tab component showing a planteur's parcelles
 * 
 * Features:
 * - Mini-map with all planteur's parcelles
 * - KPI summary: nb parcelles / total hectares
 * - Table of parcelles with code, surface, status
 * - "Ajouter parcelle" button
 * - Click row → navigate to parcelle detail
 */
export function PlanteurParcellesTab({
  planteurId,
  planteurName,
  canCreate = false,
}: PlanteurParcellesTabProps) {
  const router = useRouter();
  const [parcelles, setParcelles] = useState<ParcelleWithPlanteur[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedParcelleId, setSelectedParcelleId] = useState<string | undefined>();

  // Calculate stats from parcelles
  const stats: ParcelleStats = {
    total: parcelles.length,
    totalHectares: parcelles.reduce((sum, p) => sum + (p.surface_hectares || 0), 0),
    conformes: parcelles.filter((p) => p.conformity_status === 'conforme').length,
    nonConformes: parcelles.filter((p) => p.conformity_status === 'non_conforme').length,
    enCours: parcelles.filter((p) => p.conformity_status === 'en_cours').length,
    infoManquantes: parcelles.filter((p) => p.conformity_status === 'informations_manquantes').length,
  };

  // Fetch parcelles for this planteur
  const fetchParcelles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await parcellesApi.list({
        planteur_id: planteurId,
        is_active: true,
        pageSize: 100, // Get all parcelles for this planteur
      });
      setParcelles(result.data);
    } catch (err) {
      console.error('Failed to fetch parcelles:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des parcelles');
    } finally {
      setLoading(false);
    }
  }, [planteurId]);

  useEffect(() => {
    fetchParcelles();
  }, [fetchParcelles]);

  // Handle parcelle selection from map
  const handleParcelleSelect = useCallback((parcelle: Parcelle) => {
    setSelectedParcelleId(parcelle.id);
  }, []);

  // Handle row click - navigate to parcelle detail
  const handleRowClick = useCallback((parcelleId: string) => {
    router.push(`/parcelles/${parcelleId}`);
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-48 rounded-lg bg-gray-200" />
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="h-20 rounded-lg bg-gray-200" />
            <div className="h-20 rounded-lg bg-gray-200" />
          </div>
          <div className="mt-4 h-32 rounded-lg bg-gray-200" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-700">{error}</p>
        <button
          onClick={fetchParcelles}
          className="mt-2 text-sm text-red-600 underline hover:text-red-800"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with action button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Parcelles</h3>
        {canCreate && (
          <Link
            href={`/parcelles/new?planteur_id=${planteurId}`}
            className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Ajouter parcelle
          </Link>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4">
        <KPICard
          title="Parcelles"
          value={stats.total.toString()}
          icon={<MapIcon className="h-5 w-5" />}
          color="primary"
        />
        <KPICard
          title="Surface totale"
          value={`${stats.totalHectares.toFixed(2)} ha`}
          icon={<AreaIcon className="h-5 w-5" />}
          color="green"
        />
      </div>

      {/* Mini-map */}
      {parcelles.length > 0 ? (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <ParcelleMap
            parcelles={parcelles}
            selectedId={selectedParcelleId}
            onSelect={handleParcelleSelect}
            height="250px"
            zoomToFit={true}
            enableFullscreen={false}
            showCentroids={false}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <MapIcon className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">Aucune parcelle enregistrée</p>
          {canCreate && (
            <Link
              href={`/parcelles/new?planteur_id=${planteurId}`}
              className="mt-4 inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
            >
              <PlusIcon className="h-4 w-4" />
              Ajouter une parcelle
            </Link>
          )}
        </div>
      )}

      {/* Parcelles Table */}
      {parcelles.length > 0 && (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Surface
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {parcelles.map((parcelle) => (
                <tr
                  key={parcelle.id}
                  onClick={() => handleRowClick(parcelle.id)}
                  className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedParcelleId === parcelle.id ? 'bg-primary-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{parcelle.code}</div>
                    {parcelle.label && (
                      <div className="text-xs text-gray-500">{parcelle.label}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {parcelle.surface_hectares?.toFixed(2)} ha
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={parcelle.conformity_status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <Link
                      href={`/parcelles/${parcelle.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                    >
                      Voir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Status summary */}
      {parcelles.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <StatusSummaryItem
            label="Conformes"
            count={stats.conformes}
            color={CONFORMITY_STATUS_COLORS.conforme}
          />
          <StatusSummaryItem
            label="En cours"
            count={stats.enCours}
            color={CONFORMITY_STATUS_COLORS.en_cours}
          />
          <StatusSummaryItem
            label="Non conformes"
            count={stats.nonConformes}
            color={CONFORMITY_STATUS_COLORS.non_conforme}
          />
          <StatusSummaryItem
            label="Info. manquantes"
            count={stats.infoManquantes}
            color={CONFORMITY_STATUS_COLORS.informations_manquantes}
          />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

interface KPICardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: 'primary' | 'green' | 'orange' | 'red';
}

function KPICard({ title, value, icon, color }: KPICardProps) {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="rounded-lg bg-white border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${colorClasses[color]}`}>{icon}</div>
        <div>
          <p className="text-xs text-gray-500">{title}</p>
          <p className="text-lg font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const color = CONFORMITY_STATUS_COLORS[status as keyof typeof CONFORMITY_STATUS_COLORS] || '#9ca3af';
  const label = CONFORMITY_STATUS_LABELS[status as keyof typeof CONFORMITY_STATUS_LABELS] || status;

  return (
    <span
      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `${color}20`,
        color: color,
      }}
    >
      {label}
    </span>
  );
}

interface StatusSummaryItemProps {
  label: string;
  count: number;
  color: string;
}

function StatusSummaryItem({ label, count, color }: StatusSummaryItemProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-gray-600">{label}:</span>
      <span className="font-medium text-gray-900">{count}</span>
    </div>
  );
}

// =============================================================================
// Icons
// =============================================================================

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
      />
    </svg>
  );
}

function AreaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
      />
    </svg>
  );
}

export default PlanteurParcellesTab;
