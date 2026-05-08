'use client';

// CocoaTrack V2 - Parcelle Detail Page
// Displays detailed information about a specific parcelle including map, attributes, and metadata

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Mountain as MountainIcon, RefreshCw } from 'lucide-react';

import { ProtectedRoute } from '@/components/auth';
import { useAuth, hasPermission } from '@/lib/auth';
import type { ExtendedUserRole } from '@/lib/auth';
import { parcellesApi } from '@/lib/api/parcelles';
import { ParcelleMap } from '@/components/parcelles/ParcelleMap';
import { ParcelleMapWithNDVI } from '@/components/parcelles/ParcelleMapWithNDVI';
import { ConformityInfoBubble } from '@/components/parcelles/ConformityInfoBubble';
import StaticImageButton from '@/components/parcelles/StaticImageButton';
import HealthStatusBadge from '@/components/satellite/HealthStatusBadge';
import type { HealthStatus, TrendDirection } from '@/components/satellite/HealthStatusBadge';
import { TemporalSlider } from '@/components/satellite/TemporalSlider';
import { TemporalDataChart } from '@/components/satellite/TemporalDataChart';
import DeforestationAlert from '@/components/satellite/DeforestationAlert';
import { KMLExportButton } from '@/components/satellite/KMLExportButton';
import ReportOptionsModal from '@/components/satellite/ReportOptionsModal';
import type { ReportOptions } from '@/components/satellite/ReportOptionsModal';
import ReportDownloadLink from '@/components/satellite/ReportDownloadLink';
import YieldPredictionDisplay from '@/components/satellite/YieldPredictionDisplay';
import type { DeforestationEvent } from '@/lib/satellite/types';
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
  const [calculatingElevation, setCalculatingElevation] = useState(false);

  // Health status state
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [meanNDVI, setMeanNDVI] = useState<number | null>(null);
  const [lastCalculationDate, setLastCalculationDate] = useState<Date | null>(null);
  const [trend, setTrend] = useState<TrendDirection | null>(null);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [loadingHealthStatus, setLoadingHealthStatus] = useState(false);
  const [healthStatusError, setHealthStatusError] = useState<string | null>(null);
  const [recalculatingNDVI, setRecalculatingNDVI] = useState(false);
  const [ndviRasterUrl, setNdviRasterUrl] = useState<string | null>(null);
  const [ndviRasterBounds, setNdviRasterBounds] = useState<[number, number, number, number] | null>(null);
  const [showNDVIOverlay, setShowNDVIOverlay] = useState(true);

  // Temporal slider state
  const [showTemporalSlider, setShowTemporalSlider] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoadingTemporalData, setIsLoadingTemporalData] = useState(false);

  // Deforestation alerts state
  const [deforestationAlerts, setDeforestationAlerts] = useState<DeforestationEvent[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  // Report generation state
  const [showReportModal, setShowReportModal] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

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

  // Fetch health status data
  const fetchHealthStatus = useCallback(async () => {
    if (!parcelleId) return;

    setLoadingHealthStatus(true);
    setHealthStatusError(null);

    try {
      const response = await fetch(`/api/satellite/health-status/${parcelleId}`);

      if (response.status === 404) {
        // No NDVI data available yet
        setHealthStatus(null);
        setMeanNDVI(null);
        setLastCalculationDate(null);
        setTrend(null);
        setRecommendation(null);
        setNdviRasterUrl(null);
        setNdviRasterBounds(null);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch health status');
      }

      const result = await response.json();

      if (result.success && result.data) {
        setHealthStatus(result.data.healthStatus);
        setMeanNDVI(result.data.meanNDVI);
        setLastCalculationDate(new Date(result.data.lastCalculationDate));
        setTrend(result.data.trend?.direction || null);
        setRecommendation(result.data.recommendation);
        setNdviRasterUrl(result.data.ndviRasterUrl || null);
        setNdviRasterBounds(result.data.ndviRasterBounds || null);
      }
    } catch (err) {
      console.error('Error fetching health status:', err);
      setHealthStatusError(err instanceof Error ? err.message : 'Failed to load health status');
    } finally {
      setLoadingHealthStatus(false);
    }
  }, [parcelleId]);

  useEffect(() => {
    fetchHealthStatus();
  }, [fetchHealthStatus]);

  // Fetch deforestation alerts
  const fetchDeforestationAlerts = useCallback(async () => {
    if (!parcelleId) return;

    setLoadingAlerts(true);
    setAlertsError(null);

    try {
      const response = await fetch(`/api/satellite/deforestation?parcelleId=${parcelleId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch deforestation alerts');
      }

      const result = await response.json();

      if (result.success && result.data?.alerts) {
        // Sort alerts by detection date (most recent first)
        const sortedAlerts = result.data.alerts.sort((a: DeforestationEvent, b: DeforestationEvent) => {
          return new Date(b.detectionDate).getTime() - new Date(a.detectionDate).getTime();
        });
        setDeforestationAlerts(sortedAlerts);
      }
    } catch (err) {
      console.error('Error fetching deforestation alerts:', err);
      setAlertsError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoadingAlerts(false);
    }
  }, [parcelleId]);

  useEffect(() => {
    fetchDeforestationAlerts();
  }, [fetchDeforestationAlerts]);

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

  // Handle calculate elevation
  const handleCalculateElevation = async () => {
    if (!parcelle) return;
    
    setCalculatingElevation(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/parcelles/${parcelleId}/elevation`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors du calcul de l\'élévation');
      }
      
      const result = await response.json();
      
      // Refresh parcelle data to show new elevation
      await fetchParcelle();
      
      // Show success message with details
      alert(
        `Élévation calculée avec succès!\n\n` +
        `Altitude moyenne: ${result.data.elevation_meters}m\n` +
        `Pente moyenne: ${result.data.slope_percent}%\n` +
        `Altitude min: ${result.data.min_elevation}m\n` +
        `Altitude max: ${result.data.max_elevation}m\n` +
        `Points échantillonnés: ${result.data.points_sampled}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du calcul de l\'élévation');
    } finally {
      setCalculatingElevation(false);
    }
  };

  // Handle recalculate NDVI
  const handleRecalculateNDVI = async () => {
    if (!parcelle) return;

    setRecalculatingNDVI(true);
    setHealthStatusError(null);

    try {
      const response = await fetch('/api/satellite/ndvi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parcelleId: parcelle.id,
          forceRecalculate: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to calculate NDVI');
      }

      const result = await response.json();

      if (result.success && result.data) {
        // Update health status with new data
        setHealthStatus(result.data.ndvi.healthStatus);
        setMeanNDVI(result.data.ndvi.meanNDVI);
        setLastCalculationDate(new Date(result.data.ndvi.calculationDate));
        setRecommendation(result.data.recommendation);
        
        // Refresh trend data
        await fetchHealthStatus();
      }
    } catch (err) {
      console.error('Error recalculating NDVI:', err);
      setHealthStatusError(err instanceof Error ? err.message : 'Failed to recalculate NDVI');
    } finally {
      setRecalculatingNDVI(false);
    }
  };

  // Handle temporal date change from slider
  const handleTemporalDateChange = useCallback(async (date: Date) => {
    if (!parcelle) return;

    setSelectedDate(date);
    setIsLoadingTemporalData(true);
    setHealthStatusError(null);

    try {
      // Fetch NDVI data for the selected date
      const response = await fetch('/api/satellite/ndvi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parcelleId: parcelle.id,
          date: date.toISOString().split('T')[0],
          forceRecalculate: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch NDVI for selected date');
      }

      const result = await response.json();

      if (result.success && result.data) {
        // Update map layers with data from selected date
        setHealthStatus(result.data.ndvi.healthStatus);
        setMeanNDVI(result.data.ndvi.meanNDVI);
        setLastCalculationDate(new Date(result.data.ndvi.calculationDate));
        setNdviRasterUrl(result.data.ndvi.ndviRasterUrl || null);
        setNdviRasterBounds(result.data.ndvi.ndviRasterBounds || null);
      }
    } catch (err) {
      console.error('Error fetching temporal NDVI data:', err);
      setHealthStatusError(err instanceof Error ? err.message : 'Failed to load temporal data');
    } finally {
      setIsLoadingTemporalData(false);
    }
  }, [parcelle]);

  // Handle acknowledge deforestation alert
  const handleAcknowledgeAlert = async (alertId: string, notes: string) => {
    try {
      const response = await fetch(`/api/satellite/deforestation/${alertId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'acknowledge',
          notes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to acknowledge alert');
      }

      // Refresh alerts
      await fetchDeforestationAlerts();
    } catch (err) {
      console.error('Error acknowledging alert:', err);
      alert('Erreur lors de la reconnaissance de l\'alerte');
    }
  };

  // Handle dispute deforestation alert
  const handleDisputeAlert = async (alertId: string, reason: string) => {
    try {
      const response = await fetch(`/api/satellite/deforestation/${alertId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'dispute',
          reason,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to dispute alert');
      }

      // Refresh alerts
      await fetchDeforestationAlerts();
    } catch (err) {
      console.error('Error disputing alert:', err);
      alert('Erreur lors de la contestation de l\'alerte');
    }
  };

  // Handle generate report
  const handleGenerateReport = async (options: ReportOptions) => {
    console.log('=== GENERATE REPORT CALLED ===', options);
    
    if (!parcelle) return;

    setGeneratingReport(true);
    setReportError(null);
    setReportUrl(null);

    try {
      console.log('Calling API...');
      const response = await fetch('/api/satellite/reports/certification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parcelleId: parcelle.id,
          options,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate report');
      }

      const result = await response.json();

      console.log('Report generation result:', result);

      if (result.success && result.data?.reportUrl) {
        console.log('Report URL received:', result.data.reportUrl);
        console.log('Report fileName:', result.data.fileName);
        
        setReportUrl(result.data.reportUrl);
        setShowReportModal(false);
        
        // Download the PDF via fetch and create a blob
        console.log('Fetching PDF from URL...');
        const pdfResponse = await fetch(result.data.reportUrl);
        
        if (!pdfResponse.ok) {
          throw new Error('Failed to download PDF from storage');
        }
        
        const pdfBlob = await pdfResponse.blob();
        console.log('PDF blob created, size:', pdfBlob.size);
        
        // Create download link with blob URL
        const blobUrl = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = result.data.fileName || `certification-report-${parcelle.code || parcelleId}.pdf`;
        document.body.appendChild(link);
        console.log('Clicking download link...');
        link.click();
        document.body.removeChild(link);
        
        // Clean up blob URL
        window.URL.revokeObjectURL(blobUrl);
        console.log('Download triggered successfully');
      } else {
        console.error('Invalid result structure:', result);
        throw new Error('Report URL not returned');
      }
    } catch (err) {
      console.error('Error generating report:', err);
      setReportError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  // Handle close report download
  const handleCloseReportDownload = () => {
    setReportUrl(null);
    setReportError(null);
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
          {/* Calculate Elevation Button */}
          {canEdit && parcelle.is_active && (
            <button
              onClick={handleCalculateElevation}
              disabled={calculatingElevation}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              title="Calculer l'altitude et la pente avec Google Elevation API"
            >
              {calculatingElevation ? (
                <>
                  <LoadingSpinner className="mr-2 h-4 w-4" />
                  Calcul en cours...
                </>
              ) : (
                <>
                  <MountainIcon className="mr-2 h-4 w-4" />
                  {parcelle.elevation_meters ? 'Recalculer Élévation' : 'Calculer Élévation'}
                </>
              )}
            </button>
          )}
          {/* Static Image Button */}
          {parcelle.is_active && (
            <StaticImageButton 
              parcelleId={parcelle.id} 
              parcelleCode={parcelle.code} 
            />
          )}
          {/* KML Export Button */}
          {parcelle.is_active && (
            <KMLExportButton
              parcelleIds={parcelle.id}
              parcelleCodes={parcelle.code ?? undefined}
              variant="outline"
              size="md"
              showText={true}
            />
          )}
          {/* Generate Report Button */}
          {parcelle.is_active && (
            <button
              onClick={() => setShowReportModal(true)}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <svg 
                className="mr-2 h-4 w-4" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                />
              </svg>
              Générer Rapport
            </button>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Map Section - Single parcelle with zoom-to-fit */}
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Localisation</h2>
            {/* Temporal Analysis Toggle */}
            {parcelle.is_active && (
              <button
                onClick={() => setShowTemporalSlider(!showTemporalSlider)}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                title={showTemporalSlider ? 'Masquer l\'analyse temporelle' : 'Afficher l\'analyse temporelle'}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {showTemporalSlider ? 'Masquer Temporel' : 'Analyse Temporelle'}
              </button>
            )}
          </div>
          
          {/* Loading indicator during temporal data fetch */}
          {isLoadingTemporalData && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
              <div className="flex flex-col items-center gap-2">
                <LoadingSpinner className="h-8 w-8 text-primary-600" />
                <span className="text-sm text-gray-600">Chargement des données...</span>
              </div>
            </div>
          )}
          
          {parcelle.geometry ? (
            <ParcelleMapWithNDVI
              parcelle={parcelle as Parcelle}
              ndviRasterUrl={ndviRasterUrl}
              ndviRasterBounds={ndviRasterBounds}
              height="320px"
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
          
          {/* Temporal Slider */}
          {showTemporalSlider && parcelle.is_active && (
            <div className="mt-4">
              <TemporalSlider
                parcelleId={parcelle.id}
                startDate={new Date(new Date().setMonth(new Date().getMonth() - 12))} // Last 12 months
                endDate={new Date()}
                interval="monthly"
                onDateChange={handleTemporalDateChange}
                highlightChanges={true}
                animationSpeed={1000}
                className="shadow-sm"
              />
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
            
            {/* Elevation and Slope */}
            {parcelle.elevation_meters && (
              <>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <dt className="text-sm text-gray-500">Altitude</dt>
                  <dd className={`text-sm font-medium ${
                    parcelle.elevation_meters < 200 || parcelle.elevation_meters > 800
                      ? 'text-orange-600'
                      : 'text-green-600'
                  }`}>
                    {parcelle.elevation_meters} m
                    {parcelle.elevation_meters < 200 && ' ⚠️ Trop bas'}
                    {parcelle.elevation_meters > 800 && ' ⚠️ Trop haut'}
                    {parcelle.elevation_meters >= 200 && parcelle.elevation_meters <= 800 && ' ✓ Optimal'}
                  </dd>
                </div>
                {parcelle.slope_percent !== null && parcelle.slope_percent !== undefined && (
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <dt className="text-sm text-gray-500">Pente</dt>
                    <dd className={`text-sm font-medium ${
                      parcelle.slope_percent > 30
                        ? 'text-red-600'
                        : parcelle.slope_percent > 15
                        ? 'text-orange-600'
                        : 'text-green-600'
                    }`}>
                      {parcelle.slope_percent}%
                      {parcelle.slope_percent > 30 && ' ⚠️ Très forte'}
                      {parcelle.slope_percent > 15 && parcelle.slope_percent <= 30 && ' ⚠️ Forte'}
                      {parcelle.slope_percent <= 15 && ' ✓ Modérée'}
                    </dd>
                  </div>
                )}
              </>
            )}
            
            <DetailRow 
              label="Centroïde" 
              value={`${formatCoordinate(parcelle.centroid.lat)}, ${formatCoordinate(parcelle.centroid.lng)}`} 
            />
            
            {/* GPS Coordinates with Copy Button */}
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <dt className="text-sm text-gray-500">Coordonnées GPS</dt>
              <dd className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900 font-mono">
                    {formatCoordinate(parcelle.centroid.lat)}°N
                  </div>
                  <div className="text-sm font-medium text-gray-900 font-mono">
                    {formatCoordinate(parcelle.centroid.lng)}°E
                  </div>
                </div>
                <button
                  onClick={() => {
                    const coords = `${formatCoordinate(parcelle.centroid.lat)}, ${formatCoordinate(parcelle.centroid.lng)}`;
                    navigator.clipboard.writeText(coords);
                    alert('Coordonnées copiées !');
                  }}
                  className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded transition-colors"
                  title="Copier les coordonnées GPS"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </dd>
            </div>
            
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

      {/* Health Status Section */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">État de Santé de la Végétation</h2>
          {canEdit && parcelle.is_active && (
            <button
              onClick={handleRecalculateNDVI}
              disabled={recalculatingNDVI}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              title="Recalculer l'indice NDVI"
            >
              <RefreshCw className={`h-4 w-4 ${recalculatingNDVI ? 'animate-spin' : ''}`} />
              {recalculatingNDVI ? 'Calcul en cours...' : 'Recalculer NDVI'}
            </button>
          )}
        </div>

        {loadingHealthStatus ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner className="h-8 w-8 text-primary-600" />
            <span className="ml-3 text-sm text-gray-500">Chargement de l'état de santé...</span>
          </div>
        ) : healthStatusError ? (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-700">{healthStatusError}</p>
          </div>
        ) : healthStatus && meanNDVI !== null ? (
          <div className="space-y-4">
            {/* Health Status Badge */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">Statut:</span>
              <HealthStatusBadge 
                status={healthStatus} 
                showTrend={!!trend}
                trend={trend || undefined}
                size="lg"
              />
            </div>

            {/* NDVI Value */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">Indice NDVI:</span>
              <span className="text-lg font-semibold text-gray-900">
                {meanNDVI.toFixed(3)}
              </span>
              <span className="text-xs text-gray-400">(échelle: -1 à +1)</span>
            </div>

            {/* Last Calculation Date */}
            {lastCalculationDate && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Dernière analyse:</span>
                <span className="text-sm text-gray-900">
                  {lastCalculationDate.toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}

            {/* Recommendation */}
            {recommendation && (
              <div className="mt-4 rounded-md bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-start gap-2">
                  <svg 
                    className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                    />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-blue-900">Recommandation</h3>
                    <p className="mt-1 text-sm text-blue-700">{recommendation}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <svg 
              className="mx-auto h-12 w-12 text-gray-400" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500">
              Aucune donnée NDVI disponible pour cette parcelle
            </p>
            {canEdit && parcelle.is_active && (
              <button
                onClick={handleRecalculateNDVI}
                disabled={recalculatingNDVI}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${recalculatingNDVI ? 'animate-spin' : ''}`} />
                {recalculatingNDVI ? 'Calcul en cours...' : 'Calculer NDVI'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Temporal Analysis Section - Task 3.4.2 */}
      {parcelle.is_active && <TemporalAnalysisSection parcelleId={parcelle.id} />}

      {/* Yield Prediction Section - Task 5.5.4 */}
      {parcelle.is_active && (
        <YieldPredictionDisplay
          parcelleId={parcelle.id}
          cooperativeAverage={undefined} // TODO: Fetch cooperative average from API
          canEdit={canEdit ?? false}
          onActualYieldUpdate={(actualYield) => {
            console.log('Actual yield updated:', actualYield);
          }}
        />
      )}

      {/* Deforestation Alerts Section - Task 4.3.3 */}
      {parcelle.is_active && (
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Alertes de Déforestation</h2>
              {/* Alert Count Badge */}
              {deforestationAlerts.length > 0 && (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  deforestationAlerts.some(alert => alert.status === 'pending')
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {deforestationAlerts.length} {deforestationAlerts.length === 1 ? 'alerte' : 'alertes'}
                </span>
              )}
            </div>
            {deforestationAlerts.length > 1 && !showAllAlerts && (
              <button
                onClick={() => setShowAllAlerts(true)}
                className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                Voir toutes les alertes →
              </button>
            )}
            {showAllAlerts && deforestationAlerts.length > 1 && (
              <button
                onClick={() => setShowAllAlerts(false)}
                className="text-sm font-medium text-gray-600 hover:text-gray-700 transition-colors"
              >
                Masquer
              </button>
            )}
          </div>

          {loadingAlerts ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner className="h-8 w-8 text-primary-600" />
              <span className="ml-3 text-sm text-gray-500">Chargement des alertes...</span>
            </div>
          ) : alertsError ? (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{alertsError}</p>
            </div>
          ) : deforestationAlerts.length > 0 ? (
            <div className="space-y-4">
              {/* Show most recent alert prominently */}
              {!showAllAlerts && deforestationAlerts.length > 0 && (
                <DeforestationAlert
                  alert={deforestationAlerts[0]}
                  onAcknowledge={canEdit ? handleAcknowledgeAlert : undefined}
                  onDispute={canEdit ? handleDisputeAlert : undefined}
                />
              )}

              {/* Show all alerts when expanded */}
              {showAllAlerts && deforestationAlerts.map((alert) => (
                <DeforestationAlert
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={canEdit ? handleAcknowledgeAlert : undefined}
                  onDispute={canEdit ? handleDisputeAlert : undefined}
                />
              ))}

              {/* Summary for multiple alerts */}
              {deforestationAlerts.length > 1 && !showAllAlerts && (
                <div className="mt-3 rounded-md bg-gray-50 border border-gray-200 p-3">
                  <p className="text-sm text-gray-700">
                    <strong>{deforestationAlerts.length - 1}</strong> autre{deforestationAlerts.length - 1 > 1 ? 's' : ''} alerte{deforestationAlerts.length - 1 > 1 ? 's' : ''} disponible{deforestationAlerts.length - 1 > 1 ? 's' : ''}.
                    {' '}
                    <button
                      onClick={() => setShowAllAlerts(true)}
                      className="font-medium text-primary-600 hover:text-primary-700 underline"
                    >
                      Voir toutes les alertes
                    </button>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg 
                className="mx-auto h-12 w-12 text-green-400" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <p className="mt-2 text-sm font-medium text-gray-900">
                Aucune alerte de déforestation
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Cette parcelle ne présente aucun signe de déforestation détecté.
              </p>
            </div>
          )}
        </div>
      )}

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

      {/* Report Options Modal */}
      <ReportOptionsModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onGenerate={handleGenerateReport}
        isGenerating={generatingReport}
      />

      {/* Report Download Link */}
      {reportUrl && (
        <div className="mt-6">
          <ReportDownloadLink
            reportUrl={reportUrl}
            parcelleCode={parcelle.code ?? 'parcelle'}
            onClose={handleCloseReportDownload}
          />
        </div>
      )}

      {/* Report Error */}
      {reportError && (
        <div className="mt-6 rounded-md bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <svg 
              className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-red-900">
                Erreur lors de la génération du rapport
              </h3>
              <p className="mt-1 text-sm text-red-700">{reportError}</p>
              <button
                onClick={() => setReportError(null)}
                className="mt-2 text-sm font-medium text-red-700 hover:text-red-800 underline"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Temporal Analysis Section Component - Task 3.4.2
function TemporalAnalysisSection({ parcelleId }: { parcelleId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 12);
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [customDateRange, setCustomDateRange] = useState(false);

  // Fetch temporal data
  const fetchTemporalData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        parcelleId,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        interval: 'monthly',
      });

      const response = await fetch(`/api/satellite/temporal?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch temporal data');
      }

      const result = await response.json();

      if (result.success && result.data?.summary?.timeline) {
        // Convert date strings back to Date objects
        const timelineData = result.data.summary.timeline.map((point: any) => ({
          ...point,
          date: new Date(point.date),
        }));
        setTimeline(timelineData);
        
        // Set selected date to the most recent data point
        if (timelineData.length > 0) {
          setSelectedDate(timelineData[timelineData.length - 1].date);
        }
      }
    } catch (err) {
      console.error('Error fetching temporal data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load temporal data');
    } finally {
      setLoading(false);
    }
  }, [parcelleId, startDate, endDate]);

  useEffect(() => {
    fetchTemporalData();
  }, [fetchTemporalData]);

  // Handle date range change
  const handleDateRangeChange = (newStartDate: Date, newEndDate: Date) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  // Handle date selection from chart
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Analyse Temporelle</h2>
          <p className="mt-1 text-sm text-gray-500">
            Évolution de l'indice NDVI sur les 12 derniers mois
          </p>
        </div>
        <button
          onClick={() => setCustomDateRange(!customDateRange)}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {customDateRange ? 'Masquer Sélecteur' : 'Période Personnalisée'}
        </button>
      </div>

      {/* Custom Date Range Selector */}
      {customDateRange && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de début
              </label>
              <input
                type="date"
                value={startDate.toISOString().split('T')[0]}
                onChange={(e) => {
                  const newDate = new Date(e.target.value);
                  if (!isNaN(newDate.getTime())) {
                    setStartDate(newDate);
                  }
                }}
                max={endDate.toISOString().split('T')[0]}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de fin
              </label>
              <input
                type="date"
                value={endDate.toISOString().split('T')[0]}
                onChange={(e) => {
                  const newDate = new Date(e.target.value);
                  if (!isNaN(newDate.getTime())) {
                    setEndDate(newDate);
                  }
                }}
                min={startDate.toISOString().split('T')[0]}
                max={new Date().toISOString().split('T')[0]}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchTemporalData}
                disabled={loading}
                className="w-full rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Chargement...' : 'Appliquer'}
              </button>
            </div>
          </div>
          
          {/* Quick date range buttons */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => {
                const now = new Date();
                handleDateRangeChange(
                  new Date(now.setMonth(now.getMonth() - 3)),
                  new Date()
                );
              }}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              3 mois
            </button>
            <button
              onClick={() => {
                const now = new Date();
                handleDateRangeChange(
                  new Date(now.setMonth(now.getMonth() - 6)),
                  new Date()
                );
              }}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              6 mois
            </button>
            <button
              onClick={() => {
                const now = new Date();
                handleDateRangeChange(
                  new Date(now.setMonth(now.getMonth() - 12)),
                  new Date()
                );
              }}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              12 mois
            </button>
            <button
              onClick={() => {
                const now = new Date();
                handleDateRangeChange(
                  new Date(now.setMonth(now.getMonth() - 24)),
                  new Date()
                );
              }}
              className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              24 mois
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner className="h-8 w-8 text-primary-600" />
          <span className="ml-3 text-sm text-gray-500">
            Chargement des données temporelles...
          </span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <div className="flex items-start gap-2">
            <svg
              className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-red-900">
                Erreur de chargement
              </h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                onClick={fetchTemporalData}
                className="mt-2 text-sm font-medium text-red-600 hover:text-red-700 underline"
              >
                Réessayer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temporal Chart */}
      {!loading && !error && timeline.length > 0 && (
        <TemporalDataChart
          timeline={timeline}
          selectedDate={selectedDate}
          parcelleId={parcelleId}
          startDate={startDate}
          endDate={endDate}
          onDateSelect={handleDateSelect}
          showChangeMarkers={true}
          loading={false}
          error={null}
        />
      )}

      {/* Empty State */}
      {!loading && !error && timeline.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <svg
            className="h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="mt-2 text-sm font-medium text-gray-900">
            Aucune donnée temporelle disponible
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Les données NDVI historiques ne sont pas encore disponibles pour cette parcelle.
          </p>
          <button
            onClick={fetchTemporalData}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </div>
      )}
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
