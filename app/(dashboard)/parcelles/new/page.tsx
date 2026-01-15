'use client';

// CocoaTrack V2 - New Parcelle Page
// Page for creating a new parcelle manually or via import
//
// Features:
// - ParcelleForm in create mode
// - ShapefileUploader integration with V2 import modes (auto_create, orphan, assign)
// - ImportPreview for uploaded files
// - Redirect to detail after create

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, MapPin, Upload, FileText, ArrowLeft } from 'lucide-react';

import { ProtectedRoute } from '@/components/auth';
import { useAuth, hasPermission } from '@/lib/auth';
import type { ExtendedUserRole } from '@/lib/auth';
import { PageTransition, AnimatedSection } from '@/components/dashboard';
import { ParcelleForm } from '@/components/parcelles/ParcelleForm';
import { ShapefileUploader } from '@/components/parcelles/ShapefileUploader';
import { ImportPreview } from '@/components/parcelles/ImportPreview';
import { parcellesImportApi } from '@/lib/api/parcelles-import';
import type {
  Parcelle,
  ParcelImportFile,
  ParsedFeature,
  ParseReport,
  FieldMapping,
  ImportDefaults,
  ImportMode,
} from '@/types/parcelles';
import { cn } from '@/lib/utils';

/**
 * Creation mode for the page
 */
type CreationMode = 'manual' | 'import';

/**
 * Import workflow step
 */
type ImportStep = 'upload' | 'preview' | 'applying';

export default function NewParcellePage() {
  return (
    <ProtectedRoute requiredPermission="parcelles:read">
      <NewParcelleContent />
    </ProtectedRoute>
  );
}

function NewParcelleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Get pre-selected planteur from URL params (if coming from planteur page)
  const initialPlanteurId = searchParams.get('planteur_id') || undefined;

  // Check permissions
  const canCreate = user && hasPermission(user.role as ExtendedUserRole, 'planteurs:create');

  // State for creation mode
  const [mode, setMode] = useState<CreationMode>('manual');

  // State for import workflow
  const [importStep, setImportStep] = useState<ImportStep>('upload');
  const [importFile, setImportFile] = useState<ParcelImportFile | null>(null);
  const [parsedFeatures, setParsedFeatures] = useState<ParsedFeature[]>([]);
  const [parseReport, setParseReport] = useState<ParseReport | null>(null);
  const [dbfFields, setDbfFields] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [importDefaults, setImportDefaults] = useState<ImportDefaults>({
    conformity_status: 'informations_manquantes',
    certifications: [],
  });
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // State for import mode (V2)
  const [importMode, setImportMode] = useState<ImportMode>(initialPlanteurId ? 'assign' : 'orphan');
  const [planteurNameField, setPlanteurNameField] = useState<string | undefined>(undefined);
  const [selectedChefPlanteurId, setSelectedChefPlanteurId] = useState<string | undefined>(undefined);
  const [selectedPlanteurId, setSelectedPlanteurId] = useState<string | undefined>(initialPlanteurId);

  // Handle successful parcelle creation (manual mode)
  const handleSuccess = useCallback(
    (parcelle: Parcelle) => {
      router.push(`/parcelles/${parcelle.id}`);
    },
    [router]
  );

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (initialPlanteurId) {
      router.push(`/planteurs/${initialPlanteurId}`);
    } else {
      router.push('/parcelles');
    }
  }, [router, initialPlanteurId]);

  // Handle upload complete
  const handleUploadComplete = useCallback((file: ParcelImportFile) => {
    setImportFile(file);
  }, []);

  // Handle parse complete
  const handleParseComplete = useCallback(
    (features: ParsedFeature[], report: ParseReport, availableFields: string[] = []) => {
      setParsedFeatures(features);
      setParseReport(report);

      // Use available fields from parser, or extract from first feature as fallback
      if (availableFields.length > 0) {
        setDbfFields(availableFields);
      } else if (features.length > 0 && features[0].dbf_attributes) {
        setDbfFields(Object.keys(features[0].dbf_attributes));
      }

      // Move to preview step
      setImportStep('preview');
    },
    []
  );

  // Handle field mapping change
  const handleMappingChange = useCallback((mapping: FieldMapping) => {
    setFieldMapping(mapping);
  }, []);

  // Handle defaults change
  const handleDefaultsChange = useCallback((defaults: ImportDefaults) => {
    setImportDefaults(defaults);
  }, []);

  // Handle import mode change
  const handleModeChange = useCallback((mode: ImportMode) => {
    setImportMode(mode);
  }, []);

  // Handle planteur name field change (for auto_create mode)
  const handlePlanteurNameFieldChange = useCallback((field: string | undefined) => {
    setPlanteurNameField(field);
  }, []);

  // Handle chef planteur change (for auto_create mode)
  const handleChefPlanteurChange = useCallback((chefPlanteurId: string | undefined) => {
    setSelectedChefPlanteurId(chefPlanteurId);
  }, []);

  // Handle planteur change (for assign mode)
  const handlePlanteurChange = useCallback((planteurId: string | undefined) => {
    setSelectedPlanteurId(planteurId);
  }, []);

  // Handle apply import (V2 - supports all modes)
  const handleApplyImport = useCallback(async () => {
    if (!importFile) {
      setApplyError('Aucun fichier d\'import sélectionné');
      return;
    }

    // Validate mode-specific requirements
    if (importMode === 'assign' && !selectedPlanteurId) {
      setApplyError('Veuillez sélectionner un planteur pour le mode "Assigner"');
      return;
    }

    if (importMode === 'auto_create') {
      if (!planteurNameField) {
        setApplyError('Veuillez sélectionner le champ contenant le nom du planteur');
        return;
      }
      // Note: chef_planteur_id is optional - planteurs can be created without a supplier
    }

    setIsApplying(true);
    setApplyError(null);

    // Helper function to check if import succeeded and redirect
    const checkAndRedirect = async (): Promise<boolean> => {
      try {
        const refreshedImport = await parcellesImportApi.get(importFile.id);
        if (refreshedImport?.import_status === 'applied' && (refreshedImport.nb_applied || 0) > 0) {
          // Import was successful, redirect to parcelles list
          router.push(`/parcelles?import_file_id=${importFile.id}`);
          return true;
        }
      } catch {
        // Ignore error checking import status
      }
      return false;
    };

    try {
      const result = await parcellesImportApi.applyV2(importFile.id, {
        mode: importMode,
        planteur_id: importMode === 'assign' ? selectedPlanteurId : undefined,
        planteur_name_field: importMode === 'auto_create' ? planteurNameField : undefined,
        default_chef_planteur_id: importMode === 'auto_create' ? selectedChefPlanteurId : undefined,
        mapping: fieldMapping,
        defaults: importDefaults,
      });

      // Redirect based on result
      if (result.nb_applied === 1 && result.created_ids.length === 1) {
        // Single parcelle created - go to detail
        router.push(`/parcelles/${result.created_ids[0]}`);
      } else if (result.nb_applied > 0) {
        // Multiple parcelles created - go to list filtered by import
        router.push(`/parcelles?import_file_id=${importFile.id}`);
      } else {
        // No parcelles created (all duplicates) - check if import was already applied
        // This can happen if the import succeeded but the response was lost
        const redirected = await checkAndRedirect();
        if (!redirected) {
          setApplyError(
            `Aucune parcelle créée. ${result.nb_skipped} doublon(s) ignoré(s). Les parcelles existent peut-être déjà.`
          );
          setIsApplying(false);
        }
      }
    } catch (err) {
      console.error('Apply import error:', err);
      
      // Check if import was actually applied despite the error
      // This can happen with timeout errors where the operation succeeded
      const redirected = await checkAndRedirect();
      if (redirected) {
        return; // Successfully redirected, don't show error
      }
      
      const errorMessage =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message || 'Erreur lors de l\'import';
      setApplyError(errorMessage);
      setIsApplying(false);
    }
  }, [importFile, importMode, selectedPlanteurId, planteurNameField, selectedChefPlanteurId, fieldMapping, importDefaults, router]);

  // Handle cancel import preview
  const handleCancelImport = useCallback(() => {
    setImportStep('upload');
    setParsedFeatures([]);
    setParseReport(null);
    setDbfFields([]);
    setFieldMapping({});
    setImportFile(null);
    setApplyError(null);
  }, []);

  // Handle upload error
  const handleUploadError = useCallback((error: Error | { message: string }) => {
    console.error('Upload error:', error);
  }, []);

  // Redirect if no permission
  if (!canCreate) {
    return (
      <PageTransition className="space-y-6">
        <div className="rounded-xl bg-red-50 border border-red-200 p-6">
          <h2 className="text-lg font-semibold text-red-800">Accès refusé</h2>
          <p className="mt-2 text-sm text-red-700">
            Vous n'avez pas les permissions nécessaires pour créer une parcelle.
          </p>
          <Link
            href="/parcelles"
            className="mt-4 inline-flex items-center text-sm font-medium text-red-600 hover:text-red-700"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la liste des parcelles
          </Link>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <Link
          href="/parcelles"
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          Parcelles
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <span className="font-medium text-gray-900">Nouvelle parcelle</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle parcelle</h1>
          <p className="mt-1 text-sm text-gray-500">
            Créez une nouvelle parcelle manuellement ou importez depuis un fichier
          </p>
        </div>
      </div>

      {/* Mode Tabs */}
      <AnimatedSection animation="fadeUp" delay={0.1}>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-medium transition-colors',
                mode === 'manual'
                  ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              <MapPin className="h-5 w-5" />
              <span>Création manuelle</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('import')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-medium transition-colors',
                mode === 'import'
                  ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              <Upload className="h-5 w-5" />
              <span>Import de fichier</span>
            </button>
          </div>

          <div className="p-6">
            {/* Manual Mode - ParcelleForm */}
            {mode === 'manual' && (
              <ParcelleForm
                initialPlanteurId={initialPlanteurId}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
              />
            )}

            {/* Import Mode */}
            {mode === 'import' && (
              <div className="space-y-6">
                {/* Upload Step - now works without planteur */}
                {importStep === 'upload' && (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-600">
                      <p>
                        Importez un fichier Shapefile (.zip), KML, KMZ ou GeoJSON pour créer
                        des parcelles automatiquement.
                      </p>
                    </div>
                    <ShapefileUploader
                      planteurId={initialPlanteurId}
                      onUploadComplete={handleUploadComplete}
                      onParseComplete={handleParseComplete}
                      onError={handleUploadError}
                      onModeChange={handleModeChange}
                      onPlanteurNameFieldChange={handlePlanteurNameFieldChange}
                      onChefPlanteurChange={handleChefPlanteurChange}
                      onPlanteurChange={handlePlanteurChange}
                      showModeSelector={!initialPlanteurId}
                      defaultMode={initialPlanteurId ? 'assign' : 'orphan'}
                    />
                  </div>
                )}

                {/* Preview Step */}
                {importStep === 'preview' && parseReport && (
                  <div className="space-y-4">
                    {/* Auto-create mode: Planteur name field selector */}
                    {importMode === 'auto_create' && dbfFields.length > 0 && (
                      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-primary-900 mb-2">
                          Mode: Créer planteurs automatiquement
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Champ contenant le nom du planteur *
                            </label>
                            <select
                              value={planteurNameField || ''}
                              onChange={(e) => setPlanteurNameField(e.target.value || undefined)}
                              className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 bg-white"
                            >
                              <option value="">-- Sélectionner un champ --</option>
                              {dbfFields.map((field) => (
                                <option key={field} value={field}>
                                  {field}
                                </option>
                              ))}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">
                              Les planteurs seront créés automatiquement à partir de ce champ
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Apply Error */}
                    {applyError && (
                      <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                        <p className="text-sm text-red-700">{applyError}</p>
                      </div>
                    )}

                    <ImportPreview
                      features={parsedFeatures}
                      report={parseReport}
                      dbfFields={dbfFields}
                      onMappingChange={handleMappingChange}
                      onDefaultsChange={handleDefaultsChange}
                      onApply={handleApplyImport}
                      onCancel={handleCancelImport}
                      isApplying={isApplying}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </AnimatedSection>

      {/* Back link */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-6">
        <button
          type="button"
          onClick={handleCancel}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {initialPlanteurId ? 'Retour au planteur' : 'Retour à la liste'}
        </button>
      </div>
    </PageTransition>
  );
}
