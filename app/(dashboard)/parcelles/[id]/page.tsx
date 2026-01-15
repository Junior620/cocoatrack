'use client';

// CocoaTrack V2 - Parcelle Detail Page
// Displays detailed information about a specific parcelle including map, attributes, and metadata

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ProtectedRoute } from '@/components/auth';
import { useAuth, hasPermission } from '@/lib/auth';
import type { ExtendedUserRole } from '@/lib/auth';
import { parcellesApi } from '@/lib/api/parcelles';
import { ParcelleMap } from '@/components/parcelles/ParcelleMap';
import { ConformityInfoBubble } from '@/components/parcelles/ConformityInfoBubble';
import type { Parcelle, ParcelleWithPlanteur, ConformityStatus, Certification, UpdateParcelleInput } from '@/types/parcelles';
import {
  CONFORMITY_STATUS_LABELS,
  CONFORMITY_STATUS_COLORS,
  CONFORMITY_STATUS_VALUES,
  CERTIFICATION_LABELS,
  CERTIFICATIONS_WHITELIST,
  PARCELLE_SOURCE_LABELS,
} from '@/types/parcelles';

export default function ParcelleDetailPage() {
  return (
    <ProtectedRoute requiredPermission="parcelles:read">
      <ParcelleDetailContent />
    </ProtectedRoute>
  );
}

function ParcelleDetailContent() {
  const params = useParams();
  const { user } = useAuth();
  const parcelleId = params.id as string;

  const [parcelle, setParcelle] = useState<ParcelleWithPlanteur | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Editable fields state
  const [editedLabel, setEditedLabel] = useState<string>('');
  const [editedVillage, setEditedVillage] = useState<string>('');
  const [editedCertifications, setEditedCertifications] = useState<Certification[]>([]);
  const [certDropdownOpen, setCertDropdownOpen] = useState(false);
  const certDropdownRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const canEdit = user && hasPermission(user.role as ExtendedUserRole, 'parcelles:update');
  const canArchive = user && hasPermission(user.role as ExtendedUserRole, 'parcelles:delete');

  // Check if there are unsaved changes
  const hasChanges = parcelle && (
    editedLabel !== (parcelle.label || '') ||
    editedVillage !== (parcelle.village || '') ||
    JSON.stringify([...editedCertifications].sort()) !== JSON.stringify([...parcelle.certifications].sort())
  );

  // Fetch parcelle data
  const fetchParcelle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await parcellesApi.get(parcelleId);
      if (!data) {
        setError('Parcelle non trouvée');
        return;
      }
      setParcelle(data);
      // Initialize editable fields
      setEditedLabel(data.label || '');
      setEditedVillage(data.village || '');
      setEditedCertifications(data.certifications || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement de la parcelle');
    } finally {
      setLoading(false);
    }
  }, [parcelleId]);

  useEffect(() => {
    fetchParcelle();
  }, [fetchParcelle]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownOpen(false);
      }
      if (certDropdownRef.current && !certDropdownRef.current.contains(event.target as Node)) {
        setCertDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle conformity status change
  const handleStatusChange = async (newStatus: ConformityStatus) => {
    if (!parcelle || newStatus === parcelle.conformity_status) {
      setStatusDropdownOpen(false);
      return;
    }

    setUpdatingStatus(true);
    setError(null);
    try {
      await parcellesApi.update(parcelleId, { conformity_status: newStatus });
      // Refresh parcelle data to get updated values
      await fetchParcelle();
      setStatusDropdownOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour du statut');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle certification toggle
  const handleCertificationToggle = (cert: Certification) => {
    setEditedCertifications(prev => {
      if (prev.includes(cert)) {
        return prev.filter(c => c !== cert);
      } else {
        return [...prev, cert];
      }
    });
  };

  // Handle save changes
  const handleSave = async () => {
    if (!parcelle || !hasChanges) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const updateData: UpdateParcelleInput = {};
      
      // Only include changed fields
      if (editedLabel !== (parcelle.label || '')) {
        updateData.label = editedLabel || null;
      }
      if (editedVillage !== (parcelle.village || '')) {
        updateData.village = editedVillage || null;
      }
      if (JSON.stringify([...editedCertifications].sort()) !== JSON.stringify([...parcelle.certifications].sort())) {
        updateData.certifications = editedCertifications;
      }

      await parcellesApi.update(parcelleId, updateData);
      
      // Refresh parcelle data to get updated values
      await fetchParcelle();
      setSaveSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  // Handle discard changes
  const handleDiscardChanges = () => {
    if (parcelle) {
      setEditedLabel(parcelle.label || '');
      setEditedVillage(parcelle.village || '');
      setEditedCertifications(parcelle.certifications || []);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Format coordinates with 6 decimal places for display
  const formatCoordinate = (value: number) => {
    return value.toFixed(6);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Breadcrumb skeleton */}
        <div className="animate-pulse">
          <div className="h-4 w-48 rounded bg-gray-200" />
        </div>
        {/* Header skeleton */}
        <div className="animate-pulse">
          <div className="h-8 w-1/3 rounded bg-gray-200" />
          <div className="mt-2 h-4 w-1/2 rounded bg-gray-200" />
        </div>
        {/* Content skeleton */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="animate-pulse rounded-lg bg-white p-6 shadow">
            <div className="h-64 rounded bg-gray-200" />
          </div>
          <div className="animate-pulse rounded-lg bg-white p-6 shadow">
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-4 w-full rounded bg-gray-200" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !parcelle) {
    return (
      <div className="space-y-4">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/parcelles" className="hover:text-gray-700">
            Parcelles
          </Link>
          <ChevronRightIcon className="h-4 w-4" />
          <span className="text-gray-400">—</span>
        </nav>
        
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error || 'Parcelle non trouvée'}</p>
          <Link href="/parcelles" className="mt-2 inline-block text-sm text-red-600 hover:underline">
            ← Retour à la liste des parcelles
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-sm">
        <Link 
          href="/parcelles" 
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          Parcelles
        </Link>
        <ChevronRightIcon className="h-4 w-4 text-gray-400" />
        <Link 
          href={`/planteurs/${parcelle.planteur.id}`}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          {parcelle.planteur.name}
        </Link>
        <ChevronRightIcon className="h-4 w-4 text-gray-400" />
        <span className="font-medium text-gray-900">{parcelle.code}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{parcelle.code}</h1>
            {/* Conformity Status Badge with Edit Dropdown */}
            {canEdit && parcelle.is_active ? (
              <div className="relative flex items-center gap-1" ref={statusDropdownRef}>
                <button
                  onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                  disabled={updatingStatus}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold transition-all hover:ring-2 hover:ring-offset-1 disabled:opacity-50"
                  style={{
                    backgroundColor: `${CONFORMITY_STATUS_COLORS[parcelle.conformity_status]}20`,
                    color: CONFORMITY_STATUS_COLORS[parcelle.conformity_status],
                  }}
                  title="Cliquez pour modifier le statut"
                >
                  {updatingStatus ? (
                    <LoadingSpinner className="h-3 w-3" />
                  ) : null}
                  {CONFORMITY_STATUS_LABELS[parcelle.conformity_status]}
                  <ChevronDownIcon className="h-4 w-4" />
                </button>
                {/* Info Bubble for conformity details */}
                <ConformityInfoBubble parcelle={parcelle} />
                
                {/* Dropdown Menu */}
                {statusDropdownOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                    <div className="py-1" role="menu" aria-orientation="vertical">
                      {CONFORMITY_STATUS_VALUES.map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(status)}
                          disabled={updatingStatus}
                          className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-gray-100 disabled:opacity-50 ${
                            status === parcelle.conformity_status ? 'bg-gray-50' : ''
                          }`}
                          role="menuitem"
                        >
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: CONFORMITY_STATUS_COLORS[status] }}
                          />
                          <span className="flex-1">{CONFORMITY_STATUS_LABELS[status]}</span>
                          {status === parcelle.conformity_status && (
                            <CheckIcon className="h-4 w-4 text-primary-600" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span
                  className="inline-flex rounded-full px-3 py-1 text-sm font-semibold"
                  style={{
                    backgroundColor: `${CONFORMITY_STATUS_COLORS[parcelle.conformity_status]}20`,
                    color: CONFORMITY_STATUS_COLORS[parcelle.conformity_status],
                  }}
                >
                  {CONFORMITY_STATUS_LABELS[parcelle.conformity_status]}
                </span>
                {/* Info Bubble for conformity details */}
                <ConformityInfoBubble parcelle={parcelle} />
              </div>
            )}
            {!parcelle.is_active && (
              <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600">
                Archivée
              </span>
            )}
          </div>
          {parcelle.label && (
            <p className="mt-1 text-gray-600">{parcelle.label}</p>
          )}
          <p className="mt-1 text-sm text-gray-500">
            Planteur:{' '}
            <Link
              href={`/planteurs/${parcelle.planteur.id}`}
              className="text-primary-600 hover:underline"
            >
              {parcelle.planteur.name}
            </Link>
            {' '}({parcelle.planteur.code})
          </p>
        </div>
        <div className="flex gap-2">
          {/* Save Success Message */}
          {saveSuccess && (
            <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              <CheckCircleIcon className="h-4 w-4" />
              Enregistré
            </div>
          )}
          {/* Enregistrer Button - Shows when there are unsaved changes */}
          {canEdit && parcelle.is_active && hasChanges && (
            <>
              <button
                onClick={handleDiscardChanges}
                disabled={saving}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <LoadingSpinner className="mr-2 h-4 w-4" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <SaveIcon className="mr-2 h-4 w-4" />
                    Enregistrer
                  </>
                )}
              </button>
            </>
          )}
          {canArchive && parcelle.is_active && (
            <button
              onClick={async () => {
                if (confirm('Êtes-vous sûr de vouloir archiver cette parcelle ?')) {
                  try {
                    await parcellesApi.archive(parcelleId);
                    fetchParcelle();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Erreur lors de l\'archivage');
                  }
                }
              }}
              className="inline-flex items-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              <ArchiveIcon className="mr-2 h-4 w-4" />
              Archiver
            </button>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Map Section - Single parcelle with zoom-to-fit */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Localisation</h2>
          {parcelle.geometry ? (
            <ParcelleMap
              parcelles={[parcelle as Parcelle]}
              selectedId={parcelle.id}
              height="320px"
              zoomToFit={true}
              showCentroids={true}
              enableFullscreen={true}
              className="rounded-lg overflow-hidden"
            />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
              <div className="text-center">
                <MapIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2">Géométrie non disponible</p>
                <p className="text-sm text-gray-400">
                  Centroïde: {formatCoordinate(parcelle.centroid.lat)}, {formatCoordinate(parcelle.centroid.lng)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Informations</h2>
          <dl className="space-y-4">
            <DetailRow 
              label="Producteur" 
              value={
                <Link
                  href={`/planteurs/${parcelle.planteur.id}`}
                  className="text-primary-600 hover:underline"
                >
                  {parcelle.planteur.name}
                </Link>
              } 
            />
            <DetailRow label="Identifiant Producteur" value={parcelle.planteur.code} />
            <DetailRow label="Identifiant Interne" value={parcelle.code} />
            <DetailRow label="Surface" value={`${parcelle.surface_hectares.toFixed(4)} hectares`} />
            <DetailRow 
              label="Centroïde" 
              value={`${formatCoordinate(parcelle.centroid.lat)}, ${formatCoordinate(parcelle.centroid.lng)}`} 
            />
            {/* Editable Label Field */}
            {canEdit && parcelle.is_active ? (
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <dt className="text-sm text-gray-500">Label</dt>
                <dd className="flex-1 ml-4">
                  <input
                    type="text"
                    value={editedLabel}
                    onChange={(e) => setEditedLabel(e.target.value)}
                    placeholder="Ajouter un label..."
                    className="w-full text-right text-sm font-medium text-gray-900 border-0 border-b border-transparent focus:border-primary-500 focus:ring-0 bg-transparent placeholder:text-gray-400"
                  />
                </dd>
              </div>
            ) : (
              <DetailRow label="Label" value={parcelle.label || '—'} />
            )}
            {/* Editable Village Field */}
            {canEdit && parcelle.is_active ? (
              <div className="flex justify-between border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                <dt className="text-sm text-gray-500">Village</dt>
                <dd className="flex-1 ml-4">
                  <input
                    type="text"
                    value={editedVillage}
                    onChange={(e) => setEditedVillage(e.target.value)}
                    placeholder="Ajouter un village..."
                    className="w-full text-right text-sm font-medium text-gray-900 border-0 border-b border-transparent focus:border-primary-500 focus:ring-0 bg-transparent placeholder:text-gray-400"
                  />
                </dd>
              </div>
            ) : (
              <DetailRow label="Village" value={parcelle.village || '—'} />
            )}
          </dl>
        </div>
      </div>

      {/* Certifications & Status */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Certifications */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Certifications</h2>
          {canEdit && parcelle.is_active ? (
            <div className="space-y-3">
              {/* Selected certifications */}
              <div className="flex flex-wrap gap-2">
                {editedCertifications.length > 0 ? (
                  editedCertifications.map((cert) => (
                    <button
                      key={cert}
                      onClick={() => handleCertificationToggle(cert)}
                      className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 hover:bg-green-200 transition-colors"
                    >
                      {CERTIFICATION_LABELS[cert] || cert}
                      <XIcon className="h-3 w-3" />
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">Aucune certification sélectionnée</p>
                )}
              </div>
              {/* Add certification dropdown */}
              <div className="relative" ref={certDropdownRef}>
                <button
                  onClick={() => setCertDropdownOpen(!certDropdownOpen)}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <PlusIcon className="h-4 w-4" />
                  Ajouter une certification
                  <ChevronDownIcon className="h-4 w-4" />
                </button>
                {certDropdownOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                    <div className="py-1" role="menu">
                      {CERTIFICATIONS_WHITELIST.map((cert) => (
                        <button
                          key={cert}
                          onClick={() => {
                            handleCertificationToggle(cert);
                            setCertDropdownOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-gray-100 ${
                            editedCertifications.includes(cert) ? 'bg-green-50' : ''
                          }`}
                          role="menuitem"
                        >
                          <span className="flex-1">{CERTIFICATION_LABELS[cert]}</span>
                          {editedCertifications.includes(cert) && (
                            <CheckIcon className="h-4 w-4 text-green-600" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {parcelle.certifications.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {parcelle.certifications.map((cert) => (
                    <span
                      key={cert}
                      className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800"
                    >
                      {CERTIFICATION_LABELS[cert] || cert}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Aucune certification</p>
              )}
            </>
          )}
        </div>

        {/* Risk Flags */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Indicateurs de risque</h2>
          {parcelle.risk_flags && Object.keys(parcelle.risk_flags).length > 0 ? (
            <div className="space-y-3">
              {/* Deforestation Risk */}
              {parcelle.risk_flags.deforestation?.flag && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3">
                  <div className="flex items-center gap-2">
                    <AlertIcon className="h-5 w-5 flex-shrink-0 text-red-600" />
                    <span className="font-medium text-red-800">Risque de déforestation</span>
                  </div>
                  <div className="mt-1 ml-7 text-sm text-red-700">
                    {parcelle.risk_flags.deforestation.score !== null && (
                      <span className="mr-3">
                        Score: <strong>{(parcelle.risk_flags.deforestation.score * 100).toFixed(0)}%</strong>
                      </span>
                    )}
                    <span className="text-red-600">
                      Source: {parcelle.risk_flags.deforestation.source === 'manual' ? 'Manuel' : 
                               parcelle.risk_flags.deforestation.source === 'api' ? 'API' : 'Import'}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Protected Zone Risk */}
              {parcelle.risk_flags.zone_protegee?.flag && (
                <div className="rounded-md border border-orange-200 bg-orange-50 p-3">
                  <div className="flex items-center gap-2">
                    <ShieldIcon className="h-5 w-5 flex-shrink-0 text-orange-600" />
                    <span className="font-medium text-orange-800">Zone protégée</span>
                  </div>
                  {parcelle.risk_flags.zone_protegee.name && (
                    <div className="mt-1 ml-7 text-sm text-orange-700">
                      Nom: <strong>{parcelle.risk_flags.zone_protegee.name}</strong>
                    </div>
                  )}
                </div>
              )}
              
              {/* Overlap Risk */}
              {parcelle.risk_flags.overlap?.flag && (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
                  <div className="flex items-center gap-2">
                    <OverlapIcon className="h-5 w-5 flex-shrink-0 text-yellow-600" />
                    <span className="font-medium text-yellow-800">Chevauchement détecté</span>
                  </div>
                  <div className="mt-1 ml-7 text-sm text-yellow-700">
                    {parcelle.risk_flags.overlap.overlap_pct !== null && (
                      <span className="mr-3">
                        Pourcentage: <strong>{parcelle.risk_flags.overlap.overlap_pct}%</strong>
                      </span>
                    )}
                    {parcelle.risk_flags.overlap.with_parcelle_id && (
                      <Link
                        href={`/parcelles/${parcelle.risk_flags.overlap.with_parcelle_id}`}
                        className="text-yellow-800 underline hover:text-yellow-900"
                      >
                        Voir la parcelle concernée
                      </Link>
                    )}
                  </div>
                </div>
              )}
              
              {/* No risks identified */}
              {!parcelle.risk_flags.deforestation?.flag && 
               !parcelle.risk_flags.zone_protegee?.flag && 
               !parcelle.risk_flags.overlap?.flag && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircleIcon className="h-5 w-5" />
                  <span className="text-sm">Aucun risque identifié</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircleIcon className="h-5 w-5" />
              <span className="text-sm">Aucun risque identifié</span>
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Métadonnées</h2>
        <dl className="grid gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Date d'enregistrement</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(parcelle.created_at)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Auteur</dt>
            <dd className="mt-1 text-sm text-gray-900">{parcelle.created_by_name || '—'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Dernière modification</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(parcelle.updated_at)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Source</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {PARCELLE_SOURCE_LABELS[parcelle.source] || parcelle.source}
            </dd>
          </div>
        </dl>
      </div>

      {/* Link back to planteur */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-6">
        <Link
          href={`/planteurs/${parcelle.planteur.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Retour au planteur {parcelle.planteur.name}
        </Link>
        <Link
          href="/parcelles"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Voir toutes les parcelles
        </Link>
      </div>
    </div>
  );
}

// Detail row component
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-gray-100 pb-2 last:border-0 last:pb-0">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}

// Icons
function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
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

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function OverlapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SaveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}
