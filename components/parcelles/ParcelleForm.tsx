'use client';

// CocoaTrack V2 - ParcelleForm Component
// Form for creating and editing parcelles
// Includes code input with auto-generation when empty
//
// Features:
// - Planteur selector (required)
// - Code input with auto-generate hint
// - Label input
// - Village input
// - Certifications multi-select
// - Conformity status select
// - Form validation with Zod

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save,
  X,
  AlertCircle,
  Loader2,
  Info,
  ChevronDown,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlanteurSelector, type PlanteurOption } from './PlanteurSelector';
import { parcellesApi } from '@/lib/api/parcelles';
import {
  createParcelleSchema,
  updateParcelleSchema,
} from '@/lib/validations/parcelle';
import type {
  Parcelle,
  CreateParcelleInput,
  UpdateParcelleInput,
  ConformityStatus,
  Certification,
} from '@/types/parcelles';
import {
  CONFORMITY_STATUS_VALUES,
  CONFORMITY_STATUS_LABELS,
  CONFORMITY_STATUS_COLORS,
  CERTIFICATIONS_WHITELIST,
  CERTIFICATION_LABELS,
} from '@/types/parcelles';
import type { MultiPolygon, Polygon } from 'geojson';
import { GeometryInput } from './GeometryInput';
import type { ParsedFeature, ParseReport, ParcelImportFile } from '@/types/parcelles';

/**
 * Props for ParcelleForm component
 */
export interface ParcelleFormProps {
  /** Existing parcelle for edit mode (null for create mode) */
  parcelle?: Parcelle | null;
  /** Pre-selected planteur ID (for create from planteur page) */
  initialPlanteurId?: string;
  /** Pre-loaded geometry from import */
  initialGeometry?: Polygon | MultiPolygon;
  /** Callback when form is submitted successfully */
  onSuccess?: (parcelle: Parcelle) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Form field errors
 */
interface FormErrors {
  planteur_id?: string;
  code?: string;
  label?: string;
  village?: string;
  geometry?: string;
  certifications?: string;
  conformity_status?: string;
  general?: string;
}

/**
 * ParcelleForm - Form for creating and editing parcelles
 *
 * In create mode:
 * - Planteur is required
 * - Code is optional (auto-generated if empty using format PARC-XXXX)
 * - Geometry can be provided via props or drawn on map
 *
 * In edit mode:
 * - Planteur cannot be changed
 * - All other fields are editable
 */
export function ParcelleForm({
  parcelle,
  initialPlanteurId,
  initialGeometry,
  onSuccess,
  onCancel,
  className,
}: ParcelleFormProps) {
  const router = useRouter();
  const isEditMode = !!parcelle;

  // Form state
  const [planteurId, setPlanteurId] = useState<string | null>(
    parcelle?.planteur_id || initialPlanteurId || null
  );
  const [selectedPlanteur, setSelectedPlanteur] = useState<PlanteurOption | null>(null);
  const [code, setCode] = useState(parcelle?.code || '');
  const [label, setLabel] = useState(parcelle?.label || '');
  const [village, setVillage] = useState(parcelle?.village || '');
  const [certifications, setCertifications] = useState<Certification[]>(
    parcelle?.certifications || []
  );
  const [conformityStatus, setConformityStatus] = useState<ConformityStatus>(
    parcelle?.conformity_status || 'informations_manquantes'
  );
  const [geometry, setGeometry] = useState<Polygon | MultiPolygon | null>(
    parcelle?.geometry || initialGeometry || null
  );

  // UI state
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [certDropdownOpen, setCertDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [importFile, setImportFile] = useState<ParcelImportFile | null>(null);
  const [parsedFeatures, setParsedFeatures] = useState<ParsedFeature[]>([]);

  // Update geometry when initialGeometry changes
  useEffect(() => {
    if (initialGeometry && !parcelle) {
      setGeometry(initialGeometry);
    }
  }, [initialGeometry, parcelle]);

  // Handle planteur selection
  const handlePlanteurChange = useCallback(
    (id: string | null, planteur: PlanteurOption | null) => {
      setPlanteurId(id);
      setSelectedPlanteur(planteur);
      // Clear code when planteur changes in create mode (will be auto-generated)
      if (!isEditMode && !code) {
        setCode('');
      }
      // Clear planteur error
      if (errors.planteur_id) {
        setErrors((prev) => ({ ...prev, planteur_id: undefined }));
      }
    },
    [isEditMode, code, errors.planteur_id]
  );

  // Handle geometry change from GeometryInput
  const handleGeometryChange = useCallback(
    (newGeometry: Polygon | MultiPolygon | null) => {
      setGeometry(newGeometry);
      // Clear geometry error
      if (errors.geometry) {
        setErrors((prev) => ({ ...prev, geometry: undefined }));
      }
    },
    [errors.geometry]
  );

  // Handle import file created
  const handleImportFileCreated = useCallback((file: ParcelImportFile) => {
    setImportFile(file);
  }, []);

  // Handle features parsed from import
  const handleFeaturesParseComplete = useCallback(
    (features: ParsedFeature[], _report: ParseReport) => {
      setParsedFeatures(features);
    },
    []
  );

  // Handle certification toggle
  const handleCertificationToggle = useCallback((cert: Certification) => {
    setCertifications((prev) => {
      if (prev.includes(cert)) {
        return prev.filter((c) => c !== cert);
      }
      return [...prev, cert];
    });
  }, []);

  // Validate form using Zod schemas
  const validateForm = useCallback((): { valid: boolean; data?: CreateParcelleInput | UpdateParcelleInput } => {
    const newErrors: FormErrors = {};

    if (isEditMode && parcelle) {
      // Build update data - only include changed fields
      const updateData: Partial<UpdateParcelleInput> = {};

      if (code !== parcelle.code) {
        updateData.code = code || undefined;
      }
      if (label !== (parcelle.label || '')) {
        updateData.label = label || null;
      }
      if (village !== (parcelle.village || '')) {
        updateData.village = village || null;
      }
      if (
        JSON.stringify([...certifications].sort()) !==
        JSON.stringify([...parcelle.certifications].sort())
      ) {
        updateData.certifications = certifications;
      }
      if (conformityStatus !== parcelle.conformity_status) {
        updateData.conformity_status = conformityStatus;
      }
      if (geometry && JSON.stringify(geometry) !== JSON.stringify(parcelle.geometry)) {
        updateData.geometry = geometry;
      }

      // Validate with Zod safeParse
      const result = updateParcelleSchema.safeParse(updateData);
      
      if (!result.success) {
        // Map Zod errors to form errors
        result.error.errors.forEach((err) => {
          const field = err.path[0] as keyof FormErrors;
          // Translate common error messages to French
          let message = err.message;
          if (message === 'At least one field must be provided for update') {
            message = 'Au moins un champ doit être modifié';
          } else if (message.includes('must be at most')) {
            message = message.replace('must be at most', 'ne doit pas dépasser');
          } else if (message.includes('must not be empty')) {
            message = message.replace('must not be empty', 'ne doit pas être vide');
          }
          newErrors[field] = message;
        });
        setErrors(newErrors);
        return { valid: false };
      }

      setErrors({});
      return { valid: true, data: result.data };
    } else {
      // Create mode - build create data
      const createData: Partial<CreateParcelleInput> = {
        planteur_id: planteurId || undefined,
        certifications,
        conformity_status: conformityStatus,
      };

      // Only include code if provided (otherwise auto-generated by backend)
      if (code.trim()) {
        createData.code = code.trim();
      }

      // Include optional fields if provided
      if (label.trim()) {
        createData.label = label.trim();
      }
      if (village.trim()) {
        createData.village = village.trim();
      }

      // Geometry is required for create
      if (geometry) {
        createData.geometry = geometry;
      }

      // Validate with Zod safeParse
      const result = createParcelleSchema.safeParse(createData);
      
      if (!result.success) {
        // Map Zod errors to form errors
        result.error.errors.forEach((err) => {
          const field = err.path[0] as keyof FormErrors;
          // Translate common error messages to French
          let message = err.message;
          if (message === 'Required') {
            if (field === 'planteur_id') {
              message = 'Le planteur est requis';
            } else if (field === 'geometry') {
              message = 'La géométrie est requise';
            } else {
              message = 'Ce champ est requis';
            }
          } else if (message === 'Invalid uuid') {
            message = 'ID invalide';
          } else if (message === 'Invalid planteur ID') {
            message = 'Le planteur est requis';
          } else if (message.includes('must be at most')) {
            message = message.replace('must be at most', 'ne doit pas dépasser');
          } else if (message.includes('must not be empty')) {
            message = message.replace('must not be empty', 'ne doit pas être vide');
          }
          newErrors[field] = message;
        });
        setErrors(newErrors);
        return { valid: false };
      }

      setErrors({});
      return { valid: true, data: result.data };
    }
  }, [planteurId, code, label, village, geometry, certifications, conformityStatus, isEditMode, parcelle]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form using Zod schemas
    const validation = validateForm();
    if (!validation.valid || !validation.data) {
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      let result: Parcelle;

      if (isEditMode && parcelle) {
        // Update existing parcelle - data is already validated
        result = await parcellesApi.update(parcelle.id, validation.data as UpdateParcelleInput);
      } else {
        // Create new parcelle - data is already validated
        result = await parcellesApi.create(validation.data as CreateParcelleInput);
      }

      // Success callback or redirect
      if (onSuccess) {
        onSuccess(result);
      } else {
        router.push(`/parcelles/${result.id}`);
      }
    } catch (err: unknown) {
      console.error('Form submission error:', err);

      // Handle API errors
      if (typeof err === 'object' && err !== null && 'error_code' in err) {
        const apiError = err as { error_code: string; message: string; details?: Record<string, unknown> };
        if (apiError.error_code === 'VALIDATION_ERROR' && apiError.details?.field) {
          setErrors({
            [apiError.details.field as string]: apiError.details.message as string,
          });
        } else {
          setErrors({ general: apiError.message });
        }
      } else if (err instanceof Error) {
        setErrors({ general: err.message });
      } else {
        setErrors({ general: 'Une erreur est survenue' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      {/* General Error */}
      {errors.general && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-sm text-red-700">{errors.general}</p>
          </div>
        </div>
      )}

      {/* Planteur Selector */}
      <PlanteurSelector
        value={planteurId || undefined}
        onChange={handlePlanteurChange}
        required
        disabled={isEditMode}
        label="Planteur"
        error={errors.planteur_id}
        helpText={isEditMode ? 'Le planteur ne peut pas être modifié' : undefined}
      />

      {/* Code Input with Auto-generate hint */}
      <div>
        <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
          Code
          {!isEditMode && (
            <span className="ml-1 text-gray-400 font-normal">(optionnel)</span>
          )}
          {isEditMode && <span className="text-red-500 ml-1">*</span>}
        </label>
        <div className="relative">
          <input
            type="text"
            id="code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (errors.code) {
                setErrors((prev) => ({ ...prev, code: undefined }));
              }
            }}
            placeholder={isEditMode ? 'Code de la parcelle' : 'Laisser vide pour auto-générer (ex: PARC-0001)'}
            maxLength={50}
            className={cn(
              'w-full rounded-lg border px-3 py-2.5 text-sm transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
              errors.code
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                : 'border-gray-200 hover:border-gray-300'
            )}
          />
        </div>
        {/* Auto-generate hint for create mode */}
        {!isEditMode && !code && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
            <Info className="h-3.5 w-3.5 text-blue-500" />
            <span>
              Si laissé vide, un code sera généré automatiquement au format{' '}
              <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">
                PARC-XXXX
              </code>
            </span>
          </p>
        )}
        {errors.code && (
          <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3" />
            {errors.code}
          </p>
        )}
      </div>

      {/* Label Input */}
      <div>
        <label htmlFor="label" className="block text-sm font-medium text-gray-700 mb-1">
          Label
          <span className="ml-1 text-gray-400 font-normal">(optionnel)</span>
        </label>
        <input
          type="text"
          id="label"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            if (errors.label) {
              setErrors((prev) => ({ ...prev, label: undefined }));
            }
          }}
          placeholder="Description ou nom de la parcelle"
          maxLength={200}
          className={cn(
            'w-full rounded-lg border px-3 py-2.5 text-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
            errors.label
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              : 'border-gray-200 hover:border-gray-300'
          )}
        />
        {errors.label && (
          <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3" />
            {errors.label}
          </p>
        )}
      </div>

      {/* Village Input */}
      <div>
        <label htmlFor="village" className="block text-sm font-medium text-gray-700 mb-1">
          Village
          <span className="ml-1 text-gray-400 font-normal">(optionnel)</span>
        </label>
        <input
          type="text"
          id="village"
          value={village}
          onChange={(e) => {
            setVillage(e.target.value);
            if (errors.village) {
              setErrors((prev) => ({ ...prev, village: undefined }));
            }
          }}
          placeholder="Village de localisation"
          maxLength={100}
          className={cn(
            'w-full rounded-lg border px-3 py-2.5 text-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
            errors.village
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              : 'border-gray-200 hover:border-gray-300'
          )}
        />
        {errors.village && (
          <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3" />
            {errors.village}
          </p>
        )}
      </div>

      {/* Certifications Multi-select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Certifications
          <span className="ml-1 text-gray-400 font-normal">(optionnel)</span>
        </label>
        <div className="space-y-2">
          {/* Selected certifications */}
          <div className="flex flex-wrap gap-2 min-h-[32px]">
            {certifications.length > 0 ? (
              certifications.map((cert) => (
                <button
                  key={cert}
                  type="button"
                  onClick={() => handleCertificationToggle(cert)}
                  className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 hover:bg-green-200 transition-colors"
                >
                  {CERTIFICATION_LABELS[cert]}
                  <X className="h-3 w-3" />
                </button>
              ))
            ) : (
              <span className="text-sm text-gray-400 py-1">
                Aucune certification sélectionnée
              </span>
            )}
          </div>
          {/* Add certification dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setCertDropdownOpen(!certDropdownOpen)}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Ajouter une certification
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', certDropdownOpen && 'rotate-180')}
              />
            </button>
            {certDropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                <div className="py-1" role="menu">
                  {CERTIFICATIONS_WHITELIST.map((cert) => (
                    <button
                      key={cert}
                      type="button"
                      onClick={() => {
                        handleCertificationToggle(cert);
                        setCertDropdownOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-gray-100',
                        certifications.includes(cert) && 'bg-green-50'
                      )}
                      role="menuitem"
                    >
                      <span className="flex-1">{CERTIFICATION_LABELS[cert]}</span>
                      {certifications.includes(cert) && (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {errors.certifications && (
          <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3" />
            {errors.certifications}
          </p>
        )}
      </div>

      {/* Conformity Status Select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Statut de conformité
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
            className="w-full flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm hover:border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: CONFORMITY_STATUS_COLORS[conformityStatus] }}
              />
              <span>{CONFORMITY_STATUS_LABELS[conformityStatus]}</span>
            </div>
            <ChevronDown
              className={cn('h-4 w-4 text-gray-400 transition-transform', statusDropdownOpen && 'rotate-180')}
            />
          </button>
          {statusDropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
              <div className="py-1" role="menu">
                {CONFORMITY_STATUS_VALUES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setConformityStatus(status);
                      setStatusDropdownOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-gray-100',
                      status === conformityStatus && 'bg-gray-50'
                    )}
                    role="menuitem"
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: CONFORMITY_STATUS_COLORS[status] }}
                    />
                    <span className="flex-1">{CONFORMITY_STATUS_LABELS[status]}</span>
                    {status === conformityStatus && (
                      <Check className="h-4 w-4 text-primary-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {errors.conformity_status && (
          <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3" />
            {errors.conformity_status}
          </p>
        )}
      </div>

      {/* Geometry Input - Draw on map OR upload file */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Géométrie
          {!isEditMode && <span className="text-red-500 ml-1">*</span>}
          {isEditMode && (
            <span className="ml-1 text-gray-400 font-normal">(optionnel - laisser vide pour conserver)</span>
          )}
        </label>
        <GeometryInput
          value={geometry}
          onChange={handleGeometryChange}
          onImportFileCreated={handleImportFileCreated}
          onFeaturesParseComplete={handleFeaturesParseComplete}
          error={errors.geometry}
          disabled={submitting}
          planteurId={planteurId || undefined}
          mapHeight="400px"
        />
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={handleCancel}
          disabled={submitting}
          className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEditMode ? 'Enregistrement...' : 'Création...'}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isEditMode ? 'Enregistrer' : 'Créer la parcelle'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default ParcelleForm;
