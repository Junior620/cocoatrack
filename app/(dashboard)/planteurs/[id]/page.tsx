'use client';

// CocoaTrack V2 - Planteur Detail Page
// Displays detailed information about a planteur including delivery history and parcelles

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth, hasPermission } from '@/lib/auth';
import { planteursApi } from '@/lib/api/planteurs';
import { PlanteurParcellesTab } from '@/components/planteurs/PlanteurParcellesTab';
import type { PlanteurWithRelations, PlanteurStats } from '@/lib/validations/planteur';
import type { PaginatedResult } from '@/types';
import type { Database } from '@/types/database.gen';

type Delivery = Database['public']['Tables']['deliveries']['Row'];

// Tab types
type TabId = 'info' | 'parcelles';

export default function PlanteurDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const planteurId = params.id as string;

  const [planteur, setPlanteur] = useState<PlanteurWithRelations | null>(null);
  const [stats, setStats] = useState<PlanteurStats | null>(null);
  const [deliveries, setDeliveries] = useState<PaginatedResult<Delivery> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Tab state - default to 'info', or use URL param
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const tabParam = searchParams.get('tab');
    return tabParam === 'parcelles' ? 'parcelles' : 'info';
  });

  const canEdit = user && hasPermission(user.role, 'planteurs:update');
  const canDelete = user && hasPermission(user.role, 'planteurs:delete');
  const canCreateParcelle = user && hasPermission(user.role, 'parcelles:create');

  // Handle tab change
  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    // Update URL without navigation
    const url = new URL(window.location.href);
    if (tab === 'info') {
      url.searchParams.delete('tab');
    } else {
      url.searchParams.set('tab', tab);
    }
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Fetch planteur data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planteurData, statsData, deliveriesData] = await Promise.all([
        planteursApi.get(planteurId),
        planteursApi.getStats(planteurId),
        planteursApi.getDeliveryHistory(planteurId, { page: 1, pageSize: 10 }),
      ]);

      if (!planteurData) {
        setError('Planteur non trouvé');
        return;
      }

      setPlanteur(planteurData);
      setStats(statsData);
      setDeliveries(deliveriesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch planteur');
    } finally {
      setLoading(false);
    }
  }, [planteurId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle soft delete
  const handleToggleActive = async () => {
    if (!planteur) return;
    
    try {
      if (planteur.is_active) {
        await planteursApi.softDelete(planteurId);
      } else {
        await planteursApi.restore(planteurId);
      }
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update planteur');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-1/4 rounded bg-gray-200" />
          <div className="mt-4 h-4 w-1/2 rounded bg-gray-200" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg bg-white p-6 shadow">
              <div className="h-4 w-1/2 rounded bg-gray-200" />
              <div className="mt-2 h-8 w-3/4 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !planteur) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-700">{error || 'Planteur non trouvé'}</p>
        <Link href="/planteurs" className="mt-2 text-sm text-red-600 underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/planteurs" className="text-gray-500 hover:text-gray-700">
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{planteur.name}</h1>
            <span
              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                planteur.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {planteur.is_active ? 'Actif' : 'Inactif'}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">Code: {planteur.code}</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <button
              onClick={handleToggleActive}
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                planteur.is_active
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {planteur.is_active ? 'Désactiver' : 'Réactiver'}
            </button>
          )}
          {canEdit && (
            <Link
              href={`/planteurs/${planteurId}/edit`}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Modifier
            </Link>
          )}
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total livraisons"
            value={stats.total_deliveries.toString()}
            icon={<TruckIcon />}
          />
          <StatCard
            title="Poids total"
            value={`${stats.total_weight_kg.toLocaleString()} kg`}
            icon={<ScaleIcon />}
          />
          <StatCard
            title="Montant total"
            value={`${stats.total_amount_xaf.toLocaleString()} XAF`}
            icon={<CurrencyIcon />}
          />
          <StatCard
            title="Prix moyen/kg"
            value={`${stats.average_price_per_kg.toLocaleString()} XAF`}
            icon={<ChartIcon />}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => handleTabChange('info')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
              activeTab === 'info'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <InfoIcon className="h-4 w-4" />
              Informations
            </span>
          </button>
          <button
            onClick={() => handleTabChange('parcelles')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
              activeTab === 'parcelles'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <MapIcon className="h-4 w-4" />
              Parcelles
            </span>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Planteur info */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">Informations</h2>
            <dl className="mt-4 space-y-4">
              <DetailRow label="Téléphone" value={planteur.phone || '-'} />
              <DetailRow label="CNI" value={planteur.cni || '-'} />
              <DetailRow
                label="Chef Planteur"
                value={
                  planteur.chef_planteur ? (
                    <Link
                      href={`/chef-planteurs/${planteur.chef_planteur.id}`}
                      className="text-primary-600 hover:underline"
                    >
                      {planteur.chef_planteur.name}
                    </Link>
                  ) : (
                    '-'
                  )
                }
              />
              <DetailRow label="Coopérative" value={planteur.cooperative?.name || '-'} />
              {planteur.latitude && planteur.longitude && (
                <DetailRow
                  label="Coordonnées"
                  value={`${planteur.latitude.toFixed(6)}, ${planteur.longitude.toFixed(6)}`}
                />
              )}
              <DetailRow
                label="Créé le"
                value={new Date(planteur.created_at).toLocaleDateString('fr-FR')}
              />
              <DetailRow
                label="Créé par"
                value={planteur.created_by_profile?.full_name || '-'}
              />
            </dl>
          </div>

          {/* Recent deliveries */}
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Dernières livraisons</h2>
              {deliveries && deliveries.total > 0 && (
                <span className="text-sm text-gray-500">{deliveries.total} au total</span>
              )}
            </div>
            {deliveries && deliveries.data.length > 0 ? (
              <ul className="mt-4 divide-y divide-gray-200">
                {deliveries.data.map((delivery) => (
                  <li key={delivery.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{delivery.code}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(delivery.delivered_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {Number(delivery.weight_kg).toLocaleString()} kg
                        </p>
                        <p className="text-xs text-gray-500">
                          {Number(delivery.total_amount).toLocaleString()} XAF
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-gray-500">Aucune livraison</p>
            )}
          </div>
        </div>
      )}

      {/* Parcelles Tab */}
      {activeTab === 'parcelles' && (
        <div className="rounded-lg bg-white p-6 shadow">
          <PlanteurParcellesTab
            planteurId={planteurId}
            planteurName={planteur.name}
            canCreate={canCreateParcelle ?? false}
          />
        </div>
      )}
    </div>
  );
}

// Stat card component
function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="flex items-center gap-4">
        <div className="rounded-lg bg-primary-50 p-3 text-primary-600">{icon}</div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

// Detail row component
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}

// Icons
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  );
}

function CurrencyIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}
