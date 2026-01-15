'use client';

// CocoaTrack V2 - Chef Planteur Detail Page
// Displays detailed information about a chef_planteur with validation workflow

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth, hasPermission } from '@/lib/auth';
import { chefPlanteursApi } from '@/lib/api/chef-planteurs';
import type { ChefPlanteurWithRelations, ChefPlanteurStats } from '@/lib/validations/chef-planteur';
import type { PaginatedResult } from '@/types';
import type { Database } from '@/types/database.gen';

type Planteur = Database['public']['Tables']['planteurs']['Row'];

const VALIDATION_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'bg-yellow-100 text-yellow-800' },
  validated: { label: 'Validé', className: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejeté', className: 'bg-red-100 text-red-800' },
};

export default function ChefPlanteurDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const chefPlanteurId = params.id as string;

  const [chefPlanteur, setChefPlanteur] = useState<ChefPlanteurWithRelations | null>(null);
  const [stats, setStats] = useState<ChefPlanteurStats | null>(null);
  const [planteurs, setPlanteurs] = useState<PaginatedResult<Planteur> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Validation modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [validating, setValidating] = useState(false);

  const canEdit = user && hasPermission(user.role, 'chef_planteurs:update');
  const canValidate = user && hasPermission(user.role, 'chef_planteurs:validate');

  // Fetch chef_planteur data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [chefData, statsData, planteursData] = await Promise.all([
        chefPlanteursApi.get(chefPlanteurId),
        chefPlanteursApi.getStats(chefPlanteurId),
        chefPlanteursApi.getAssociatedPlanters(chefPlanteurId, { page: 1, pageSize: 10 }),
      ]);

      if (!chefData) {
        setError('Chef planteur non trouvé');
        return;
      }

      setChefPlanteur(chefData);
      setStats(statsData);
      setPlanteurs(planteursData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chef_planteur');
    } finally {
      setLoading(false);
    }
  }, [chefPlanteurId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle validation
  const handleValidate = async () => {
    setValidating(true);
    try {
      await chefPlanteursApi.validate(chefPlanteurId);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate');
    } finally {
      setValidating(false);
    }
  };

  // Handle rejection
  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      return;
    }
    setValidating(true);
    try {
      await chefPlanteursApi.reject(chefPlanteurId, rejectionReason);
      setShowRejectModal(false);
      setRejectionReason('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setValidating(false);
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

  if (error || !chefPlanteur) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <p className="text-sm text-red-700">{error || 'Chef planteur non trouvé'}</p>
        <Link href="/chef-planteurs" className="mt-2 text-sm text-red-600 underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const statusInfo = VALIDATION_STATUS_LABELS[chefPlanteur.validation_status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/chef-planteurs" className="text-gray-500 hover:text-gray-700">
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{chefPlanteur.name}</h1>
            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusInfo.className}`}>
              {statusInfo.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">Code: {chefPlanteur.code}</p>
        </div>
        <div className="flex gap-2">
          {canValidate && chefPlanteur.validation_status === 'pending' && (
            <>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={validating}
                className="rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
              >
                Rejeter
              </button>
              <button
                onClick={handleValidate}
                disabled={validating}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {validating ? 'Validation...' : 'Valider'}
              </button>
            </>
          )}
          {canEdit && (
            <Link
              href={`/chef-planteurs/${chefPlanteurId}/edit`}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Modifier
            </Link>
          )}
        </div>
      </div>

      {/* Quantity warning */}
      {stats && stats.is_quantity_exceeded && (
        <div className="rounded-md bg-orange-50 border border-orange-200 p-4">
          <div className="flex items-center gap-2">
            <WarningIcon className="h-5 w-5 text-orange-500" />
            <p className="text-sm font-medium text-orange-800">
              Quantité maximale dépassée de {Math.abs(stats.quantity_remaining_kg).toLocaleString()} kg
            </p>
          </div>
        </div>
      )}

      {/* Stats cards */}
      {stats && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Planteurs"
            value={`${stats.active_planteurs} / ${stats.total_planteurs}`}
            subtitle="actifs"
            icon={<UsersIcon />}
          />
          <StatCard
            title="Livraisons"
            value={stats.total_deliveries.toString()}
            icon={<TruckIcon />}
          />
          <StatCard
            title="Poids total"
            value={`${stats.total_weight_kg.toLocaleString()} kg`}
            subtitle={`sur ${Number(chefPlanteur.quantite_max_kg).toLocaleString()} kg max`}
            icon={<ScaleIcon />}
            warning={stats.is_quantity_exceeded}
          />
          <StatCard
            title="Montant total"
            value={`${stats.total_amount_xaf.toLocaleString()} XAF`}
            icon={<CurrencyIcon />}
          />
        </div>
      )}

      {/* Details grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Chef planteur info */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900">Informations</h2>
          <dl className="mt-4 space-y-4">
            <DetailRow label="Téléphone" value={chefPlanteur.phone || '-'} />
            <DetailRow label="CNI" value={chefPlanteur.cni || '-'} />
            <DetailRow label="Coopérative" value={chefPlanteur.cooperative?.name || '-'} />
            <DetailRow label="Région" value={chefPlanteur.region || '-'} />
            <DetailRow label="Département" value={chefPlanteur.departement || '-'} />
            <DetailRow label="Localité" value={chefPlanteur.localite || '-'} />
            {chefPlanteur.latitude && chefPlanteur.longitude && (
              <DetailRow
                label="Coordonnées"
                value={`${chefPlanteur.latitude.toFixed(6)}, ${chefPlanteur.longitude.toFixed(6)}`}
              />
            )}
          </dl>
        </div>

        {/* Contract info */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900">Contrat</h2>
          <dl className="mt-4 space-y-4">
            <DetailRow
              label="Début"
              value={chefPlanteur.contract_start 
                ? new Date(chefPlanteur.contract_start).toLocaleDateString('fr-FR') 
                : '-'}
            />
            <DetailRow
              label="Fin"
              value={chefPlanteur.contract_end 
                ? new Date(chefPlanteur.contract_end).toLocaleDateString('fr-FR') 
                : '-'}
            />
            <DetailRow
              label="Quantité max"
              value={`${Number(chefPlanteur.quantite_max_kg).toLocaleString()} kg`}
            />
            {chefPlanteur.termination_reason && (
              <DetailRow label="Raison de fin" value={chefPlanteur.termination_reason} />
            )}
          </dl>

          {/* Validation info */}
          <h3 className="mt-6 text-md font-semibold text-gray-900">Validation</h3>
          <dl className="mt-4 space-y-4">
            <DetailRow label="Statut" value={statusInfo.label} />
            {chefPlanteur.validated_by_profile && (
              <DetailRow
                label="Validé par"
                value={chefPlanteur.validated_by_profile.full_name}
              />
            )}
            {chefPlanteur.validated_at && (
              <DetailRow
                label="Date validation"
                value={new Date(chefPlanteur.validated_at).toLocaleDateString('fr-FR')}
              />
            )}
            {chefPlanteur.rejection_reason && (
              <DetailRow label="Raison du rejet" value={chefPlanteur.rejection_reason} />
            )}
          </dl>
        </div>
      </div>

      {/* Associated planteurs */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Planteurs associés</h2>
          {planteurs && planteurs.total > 0 && (
            <span className="text-sm text-gray-500">{planteurs.total} au total</span>
          )}
        </div>
        {planteurs && planteurs.data.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Nom</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Code</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Téléphone</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Statut</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {planteurs.data.map((planteur) => (
                  <tr key={planteur.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{planteur.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{planteur.code}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{planteur.phone || '-'}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        planteur.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {planteur.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/planteurs/${planteur.id}`}
                        className="text-sm text-primary-600 hover:text-primary-900"
                      >
                        Voir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">Aucun planteur associé</p>
        )}
      </div>

      {/* Rejection modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Rejeter le chef planteur</h3>
            <p className="mt-2 text-sm text-gray-500">
              Veuillez indiquer la raison du rejet.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Raison du rejet..."
              rows={4}
              className="mt-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || validating}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {validating ? 'Rejet...' : 'Confirmer le rejet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Stat card component
function StatCard({
  title,
  value,
  subtitle,
  icon,
  warning,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <div className={`rounded-lg bg-white p-6 shadow ${warning ? 'ring-2 ring-orange-400' : ''}`}>
      <div className="flex items-center gap-4">
        <div className={`rounded-lg p-3 ${warning ? 'bg-orange-50 text-orange-600' : 'bg-primary-50 text-primary-600'}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className={`text-xl font-semibold ${warning ? 'text-orange-600' : 'text-gray-900'}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
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

function UsersIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
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

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}
